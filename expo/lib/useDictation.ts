import { Audio } from "expo-av";
import { File } from "expo-file-system";
import { useCallback, useRef, useState } from "react";

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

  const reset = useCallback(() => {
    recordingRef.current = null;
    setStatus("idle");
    setError("");
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    setError("");
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setStatus("denied");
        setError("Microphone access is needed to speak your line.");
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
      setStatus("error");
      setError("Could not start the microphone.");
    }
  }, []);

  const cancel = useCallback(async (): Promise<void> => {
    const recording = recordingRef.current;
    recordingRef.current = null;
    setLevel(0);
    setStatus("idle");
    if (!recording) return;
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      uri = recording.getURI();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
    } catch (e) {
      safeLog("[dictation] cancel failed", errorShape(e));
    } finally {
      if (uri) await discard(uri);
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    const recording = recordingRef.current;
    if (!recording) return null;

    setStatus("transcribing");
    setLevel(0);
    let uri: string | null = null;
    try {
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      uri = recording.getURI();
      recordingRef.current = null;

      if (!uri) {
        setStatus("error");
        setError("No recording was captured.");
        return null;
      }

      const file = new File(uri);
      const encoded = await file.base64();
      const text = await transcribeAudio(encoded, file.type || "audio/mp4");
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
    }
  }, [keepAudioAs]);

  return { status, error, level, start, stop, cancel, reset };
}

/** Delete a temporary recording, ignoring the case where it is already gone. */
async function discard(uri: string): Promise<void> {
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch (e) {
    safeLog("[dictation] discard failed", errorShape(e));
  }
}
