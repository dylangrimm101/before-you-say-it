import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { File } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { tap } from "@/components/ui";
import { transcribeAudio, TranscriptionUnavailableError } from "@/lib/ai";
import { keepBaselineAudio } from "@/lib/baselineAudio";
import { errorShape, safeLog } from "@/lib/redact";

export type DictationStatus = "idle" | "recording" | "transcribing" | "denied" | "error";

const NATIVE_RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  isMeteringEnabled: true,
};

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
  requestPermission: () => Promise<boolean>;
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
  const nativeRecorder = useAudioRecorder(NATIVE_RECORDING_OPTIONS);
  const nativeRecorderState = useAudioRecorderState(nativeRecorder, 90);
  const nativeRecordingRef = useRef<boolean>(false);
  const webRecorderRef = useRef<MediaRecorder | null>(null);
  const webStreamRef = useRef<MediaStream | null>(null);
  const webChunksRef = useRef<Blob[]>([]);
  const operationRef = useRef<boolean>(false);

  useEffect(() => {
    if (!nativeRecordingRef.current || !nativeRecorderState.isRecording) return;
    const decibels = nativeRecorderState.metering ?? -60;
    setLevel(Math.min(1, Math.max(0, (decibels + 60) / 60)));
  }, [nativeRecorderState.isRecording, nativeRecorderState.metering]);

  const reset = useCallback(() => {
    nativeRecordingRef.current = false;
    webRecorderRef.current = null;
    webStreamRef.current?.getTracks().forEach((track) => track.stop());
    webStreamRef.current = null;
    webChunksRef.current = [];
    setStatus("idle");
    setError("");
    setLevel(0);
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    setError("");
    try {
      if (Platform.OS === "web") {
        const stream = await requestWebMicrophone();
        stream.getTracks().forEach((track) => track.stop());
        setStatus("idle");
        return true;
      }
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        setError("Microphone access is off.");
        return false;
      }
      setStatus("idle");
      return true;
    } catch (caught) {
      safeLog("[dictation] permission request failed", errorShape(caught));
      setStatus("error");
      setError("Could not check microphone access.");
      return false;
    }
  }, []);

  const start = useCallback(async (): Promise<void> => {
    if (operationRef.current || nativeRecordingRef.current || webRecorderRef.current) return;
    operationRef.current = true;
    setError("");
    try {
      if (Platform.OS === "web") {
        const stream = await requestWebMicrophone();
        webStreamRef.current = stream;
        const mimeType = preferredWebMimeType();
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        webChunksRef.current = [];
        recorder.ondataavailable = (event: BlobEvent): void => {
          if (event.data.size > 0) webChunksRef.current.push(event.data);
        };
        recorder.start();
        webRecorderRef.current = recorder;
        setLevel(0.45);
        setStatus("recording");
        tap("medium");
        return;
      }

      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        setError("Microphone access is off.");
        return;
      }

      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      });
      await nativeRecorder.prepareToRecordAsync();
      nativeRecorder.record();
      nativeRecordingRef.current = true;
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
      setError(Platform.OS === "web"
        ? "Microphone access is unavailable in this preview. Allow it in your browser, or type this turn instead."
        : "Could not start the microphone.");
      webStreamRef.current?.getTracks().forEach((track) => track.stop());
      webStreamRef.current = null;
      if (Platform.OS !== "web") {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    } finally {
      operationRef.current = false;
    }
  }, [nativeRecorder]);

  const cancel = useCallback(async (): Promise<void> => {
    if (operationRef.current) return;
    operationRef.current = true;
    const hasNativeRecording = nativeRecordingRef.current;
    const webRecorder = webRecorderRef.current;
    nativeRecordingRef.current = false;
    webRecorderRef.current = null;
    setLevel(0);
    setStatus("idle");
    if (!hasNativeRecording && !webRecorder) {
      operationRef.current = false;
      return;
    }
    let uri: string | null = null;
    try {
      if (webRecorder) {
        await stopWebRecorder(webRecorder);
        webStreamRef.current?.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
        webChunksRef.current = [];
      } else if (hasNativeRecording) {
        await nativeRecorder.stop();
        uri = nativeRecorder.uri;
        await setAudioModeAsync({ allowsRecording: false });
      }
    } catch (e) {
      safeLog("[dictation] cancel failed", errorShape(e));
    } finally {
      if (uri) await discard(uri);
      operationRef.current = false;
    }
  }, [nativeRecorder]);

  const stop = useCallback(async (): Promise<string | null> => {
    if (operationRef.current) return null;
    const hasNativeRecording = nativeRecordingRef.current;
    const webRecorder = webRecorderRef.current;
    if (!hasNativeRecording && !webRecorder) return null;
    operationRef.current = true;
    nativeRecordingRef.current = false;
    webRecorderRef.current = null;

    setStatus("transcribing");
    setLevel(0);
    let uri: string | null = null;
    try {
      if (webRecorder) {
        await stopWebRecorder(webRecorder);
        webStreamRef.current?.getTracks().forEach((track) => track.stop());
        webStreamRef.current = null;
        const mimeType = webRecorder.mimeType || "audio/webm";
        const blob = new Blob(webChunksRef.current, { type: mimeType });
        webChunksRef.current = [];
        if (blob.size > 0) uri = URL.createObjectURL(blob);
      } else if (hasNativeRecording) {
        await nativeRecorder.stop();
        uri = nativeRecorder.uri;
        await setAudioModeAsync({ allowsRecording: false });
      }

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
      safeLog("[dictation] stop or transcribe failed", {
        ...errorShape(e),
        ...(e instanceof TranscriptionUnavailableError ? { status: e.status } : {}),
      });
      setStatus("error");
      setError(e instanceof TranscriptionUnavailableError
        ? "Voice transcription is temporarily unavailable. Type this turn instead."
        : "Could not transcribe that. Try again.");
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
  }, [keepAudioAs, nativeRecorder]);

  return { status, error, level, requestPermission, start, stop, cancel, reset };
}

async function requestWebMicrophone(): Promise<MediaStream> {
  if (!globalThis.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone capture requires a secure browser preview");
  }
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

function preferredWebMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  return candidates.find((candidate) => MediaRecorder.isTypeSupported(candidate)) ?? "";
}

function stopWebRecorder(recorder: MediaRecorder): Promise<void> {
  if (recorder.state === "inactive") return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    recorder.onstop = (): void => resolve();
    recorder.onerror = (): void => reject(new Error("Browser microphone recorder failed"));
    recorder.stop();
  });
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
