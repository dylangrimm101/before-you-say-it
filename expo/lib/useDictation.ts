import { Audio } from "expo-av";
import { File } from "expo-file-system";
import { useCallback, useRef, useState } from "react";
import { Platform } from "react-native";

import { tap } from "@/components/ui";
import { transcribeAudio } from "@/lib/ai";
import { keepBaselineAudio } from "@/lib/baselineAudio";
import { errorShape, safeLog } from "@/lib/redact";

export type DictationStatus = "idle" | "recording" | "transcribing" | "denied" | "error";

interface UseDictationOptions {
  /**
   * When set, the finished recording is copied into the app's private
   * container under this id instead of being deleted. Opt-in only.
   */
  keepAudioAs?: string;
}

interface UseDictationReturn {
  status: DictationStatus;
  error: string;
  /** Smoothed microphone energy normalized from silence (0) to loud speech (1). */
  level: number;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
  cancel: () => Promise<void>;
  reset: () => void;
}

/**
 * Record a line, transcribe it, and delete the audio file.
 *
 * The recording is removed from disk on every path — success, transcription
 * failure, and teardown — unless the caller passed `keepAudioAs`, which only
 * happens when the user explicitly opted in.
 */
export function useDictation({ keepAudioAs }: UseDictationOptions = {}): UseDictationReturn {
  const [status, setStatus] = useState<DictationStatus>("idle");
  const [error, setError] = useState<string>("");
  const [level, setLevel] = useState<number>(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const operationRef = useRef<boolean>(false);

  const reset = useCallback(() => {
    recordingRef.current = null;
    setStatus("idle");
    setError("");
    setLevel(0);
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (operationRef.current || recordingRef.current) return;
    operationRef.current = true;
    setError("");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        setError("Microphone access is off.");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const preset = Audio.RecordingOptionsPresets.HIGH_QUALITY;
      const { recording } = await Audio.Recording.createAsync({
        ...preset,
        isMeteringEnabled: true,
      });
      recording.setProgressUpdateInterval(90);
      recording.setOnRecordingStatusUpdate((recordingStatus) => {
        if (!recordingStatus.isRecording) return;
        const decibels = recordingStatus.metering ?? -60;
        setLevel(Math.min(1, Math.max(0, (decibels + 60) / 60)));
      });
      recordingRef.current = recording;
      setStatus("recording");
      tap("medium");
    } catch (e) {
      safeLog("[dictation] start failed", errorShape(e));
      if (isPermissionDenied(e)) {
        setStatus("denied");
        setError("Microphone access is off.");
        return;
      }
      setStatus("error");
      setError("Could not start the microphone.");
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    } finally {
      operationRef.current = false;
    }
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    if (operationRef.current) return;
    operationRef.current = true;
    const recording = recordingRef.current;
    recordingRef.current = null;
    setLevel(0);
    setStatus("idle");
    if (!recording) {
      operationRef.current = false;
      return;
    }
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      safeLog("[dictation] cancel failed", errorShape(e));
    } finally {
      if (uri) await discard(uri);
      operationRef.current = false;
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    if (operationRef.current) return null;
    const recording = recordingRef.current;
    if (!recording) return null;
    operationRef.current = true;
    recordingRef.current = null;

    setStatus("transcribing");
    setLevel(0);
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      uri = recording.getURI();

      if (!uri) {
        setStatus("error");
        setError("No recording was captured.");
        return null;
      }

      const payload = await readAudioPayload(uri);
      const text = await transcribeAudio(payload.base64, payload.mediaType);
      setStatus("idle");
      tap("success");
      return text;
    } catch (e) {
      safeLog("[dictation] stop or transcribe failed", errorShape(e));
      setStatus("error");
      setError("Could not transcribe that. Try again.");
      return null;
    } finally {
      // The audio file is transient. It is only ever retained when the user
      // opted in for this specific session.
      if (uri) {
        if (keepAudioAs) await keepBaselineAudio(keepAudioAs, uri);
        await discard(uri);
      }
      operationRef.current = false;
    }
  }, [keepAudioAs]);

  return { status, error, level, start, stop, cancel, reset };
}

function isPermissionDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return name === "notallowederror" || name === "securityerror" || message.includes("permission denied") || message.includes("not allowed");
}

interface AudioPayload {
  base64: string;
  mediaType: string;
}

/** Read native files and browser blob URLs without assuming they share a filesystem. */
async function readAudioPayload(uri: string): Promise<AudioPayload> {
  if (Platform.OS !== "web") {
    const file = new File(uri);
    return { base64: await file.base64(), mediaType: file.type || "audio/mp4" };
  }

  const response = await fetch(uri);
  if (!response.ok) throw new Error("Recorded audio could not be read");
  const blob = await response.blob();
  const dataUrl = await blobDataUrl(blob);
  const separator = dataUrl.indexOf(",");
  if (separator < 0) throw new Error("Recorded audio could not be encoded");
  return {
    base64: dataUrl.slice(separator + 1),
    mediaType: blob.type || "audio/webm",
  };
}

function blobDataUrl(blob: Blob): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Recorded audio could not be encoded"));
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Recorded audio could not be encoded"));
    reader.readAsDataURL(blob);
  });
}

/** Delete a temporary recording, ignoring the case where it is already gone. */
async function discard(uri: string): Promise<void> {
  try {
    if (Platform.OS === "web") {
      URL.revokeObjectURL(uri);
      return;
    }
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    safeLog("[dictation] discard failed", errorShape(e));
  }
}
