import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";

import { tap } from "@/components/ui";
import { keepBaselineAudio } from "@/lib/baselineAudio";
import { errorShape, safeLog } from "@/lib/redact";
import { cleanupNativeRecordingStrict, cleanupWebRecordingStrict, discardTemporaryRecordingStrict } from "@/lib/temporaryRecording";
import {
  transcribeRecording,
  TranscriptionUnavailableError,
  type TranscriptionTurn,
} from "@/lib/transcription";

export type DictationStatus = "idle" | "recording" | "transcribing" | "denied" | "error";

let retryDetachedCleanup: (() => Promise<void>) | null = null;
const WEB_RECORDER_STOP_TIMEOUT_MS = 1_500;

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
  stop: (turn: TranscriptionTurn) => Promise<string | null>;
  cancel: () => Promise<void>;
  reset: () => Promise<void>;
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
  const temporaryUriRef = useRef<string | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    if (!nativeRecordingRef.current || !nativeRecorderState.isRecording) return;
    const decibels = nativeRecorderState.metering ?? -60;
    setLevel(Math.min(1, Math.max(0, (decibels + 60) / 60)));
  }, [nativeRecorderState.isRecording, nativeRecorderState.metering]);

  const waitForOperation = useCallback(async (): Promise<void> => {
    while (operationRef.current) await new Promise<void>((resolve) => setTimeout(resolve, 20));
  }, []);

  const resetState = useCallback((): void => {
    if (!mountedRef.current) return;
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
        webRecorderRef.current = recorder;
        recorder.start();
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
      nativeRecordingRef.current = true;
      nativeRecorder.record();
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
      try {
        if (Platform.OS === "web" && webRecorderRef.current) {
          const recorder = webRecorderRef.current;
          await cleanupWebRecordingStrict({
            stop: async () => stopWebRecorder(recorder),
            releaseTracks: () => webStreamRef.current?.getTracks().forEach((track) => track.stop()),
            discardBufferedContent: async () => { webChunksRef.current = []; },
          });
          webStreamRef.current = null;
          webRecorderRef.current = null;
        } else if (Platform.OS === "web" && webStreamRef.current) {
          webStreamRef.current.getTracks().forEach((track) => track.stop());
          webStreamRef.current = null;
        } else if (Platform.OS !== "web") {
          if (nativeRecordingRef.current) {
            await cleanupNativeRecordingStrict({
              stop: async () => nativeRecorder.stop(),
              uri: () => nativeRecorder.uri ?? temporaryUriRef.current,
              releaseAudioMode: async () => setAudioModeAsync({ allowsRecording: false }),
              discard: async (uri) => { temporaryUriRef.current = uri; await discard(uri); },
            });
            nativeRecordingRef.current = false;
            temporaryUriRef.current = null;
          }
        }
      } catch (cleanupError) {
        setStatus("error");
        setError("Recording cleanup is still pending. Try again before leaving.");
        throw cleanupError;
      }
    } finally {
      operationRef.current = false;
    }
  }, [nativeRecorder]);

  const cancel = useCallback(async (): Promise<void> => {
    await waitForOperation();
    operationRef.current = true;
    const hasNativeRecording = nativeRecordingRef.current;
    const webRecorder = webRecorderRef.current;
    let uri = temporaryUriRef.current ?? nativeRecorder.uri ?? null;
    try {
      if (mountedRef.current) {
        setLevel(0);
        setStatus("transcribing");
        setError("Finishing private recording cleanup…");
      }
      if (webRecorder) {
        await cleanupWebRecordingStrict({
          stop: async () => stopWebRecorder(webRecorder),
          discardBufferedContent: async () => { webChunksRef.current = []; },
          releaseTracks: () => {
            webStreamRef.current?.getTracks().forEach((track) => track.stop());
            webStreamRef.current = null;
          },
        });
      } else if (hasNativeRecording) {
        await cleanupNativeRecordingStrict({
          stop: async () => nativeRecorder.stop(),
          uri: () => nativeRecorder.uri ?? uri,
          releaseAudioMode: async () => setAudioModeAsync({ allowsRecording: false }),
          discard: async (capturedUri) => {
            temporaryUriRef.current = capturedUri;
            await discard(capturedUri);
          },
        });
        temporaryUriRef.current = null;
        uri = null;
      }
      if (uri) {
        temporaryUriRef.current = uri;
        await discard(uri);
        temporaryUriRef.current = null;
      }
      nativeRecordingRef.current = false;
      webRecorderRef.current = null;
      resetState();
    } catch (e) {
      safeLog("[dictation] strict cleanup failed", errorShape(e));
      if (mountedRef.current) {
        setStatus("error");
        setError("Recording cleanup is still pending. Try again before leaving.");
      }
      throw e;
    } finally {
      operationRef.current = false;
    }
  }, [nativeRecorder, resetState, waitForOperation]);

  const reset = useCallback(async (): Promise<void> => {
    await cancel();
    resetState();
  }, [cancel, resetState]);

  useEffect(() => {
    const detached = retryDetachedCleanup;
    if (detached) void detached().catch((caught: unknown) => safeLog("[dictation] detached cleanup retry remains pending", errorShape(caught)));
    return () => {
      mountedRef.current = false;
      void cancel().catch((caught: unknown) => {
        retryDetachedCleanup = cancel;
        safeLog("[dictation] unmount cleanup remains pending", errorShape(caught));
      });
    };
  }, [cancel]);

  const stop = useCallback(async (turn: TranscriptionTurn): Promise<string | null> => {
    if (operationRef.current) return null;
    const hasNativeRecording = nativeRecordingRef.current;
    const webRecorder = webRecorderRef.current;
    if (!hasNativeRecording && !webRecorder) return null;
    operationRef.current = true;
    setStatus("transcribing");
    setLevel(0);
    let uri: string | null = temporaryUriRef.current;
    let captureStopped = false;
    let audioModeReleased = Platform.OS === "web";
    let result: string | null = null;
    let operationError: unknown;
    try {
      if (webRecorder) {
        await stopWebRecorder(webRecorder);
        captureStopped = true;
        const mimeType = webRecorder.mimeType || "audio/webm";
        const blob = new Blob(webChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          uri = URL.createObjectURL(blob);
          temporaryUriRef.current = uri;
        }
      } else if (hasNativeRecording) {
        await nativeRecorder.stop();
        captureStopped = true;
        uri = nativeRecorder.uri ?? temporaryUriRef.current;
        temporaryUriRef.current = uri;
        await setAudioModeAsync({ allowsRecording: false });
        audioModeReleased = true;
      }
      if (!uri) throw new Error("No recording was captured");
      const mediaType = webRecorder?.mimeType || "audio/mp4";
      result = await transcribeRecording(uri, mediaType, turn);
    } catch (caught) {
      operationError = caught;
      uri = uri ?? nativeRecorder.uri ?? temporaryUriRef.current;
      temporaryUriRef.current = uri;
      safeLog("[dictation] stop or transcribe failed", {
        ...errorShape(caught),
        ...(caught instanceof TranscriptionUnavailableError ? { status: caught.status } : {}),
      });
    }

    try {
      if (uri) {
        if (keepAudioAs && result) await keepBaselineAudio(keepAudioAs, uri);
        await discard(uri);
      }
      if (!captureStopped) throw operationError ?? new Error("Recording stop was not confirmed");
      if (!audioModeReleased) {
        await setAudioModeAsync({ allowsRecording: false });
        audioModeReleased = true;
      }
      webStreamRef.current?.getTracks().forEach((track) => track.stop());
      webStreamRef.current = null;
      webChunksRef.current = [];
      temporaryUriRef.current = null;
      nativeRecordingRef.current = false;
      webRecorderRef.current = null;
      retryDetachedCleanup = null;
      if (result) {
        setStatus("idle");
        setError("");
        tap("success");
      } else {
        setStatus("error");
        if (operationError instanceof Error && operationError.message === "No recording was captured") {
          setError("No recording was captured.");
        } else {
          setError(operationError instanceof TranscriptionUnavailableError
            ? "Voice transcription is temporarily unavailable. Type this turn instead."
            : "Could not transcribe that. Try again.");
        }
      }
      return result;
    } catch (cleanupError) {
      if (mountedRef.current) {
        setStatus("error");
        setError("Recording cleanup is still pending. Try again before leaving.");
      }
      throw cleanupError;
    } finally {
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
    let isSettled = false;
    const settle = (error?: Error): void => {
      if (isSettled) return;
      isSettled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => {
      if (recorder.state === "inactive") settle();
      else settle(new Error("Browser microphone recorder did not stop"));
    }, WEB_RECORDER_STOP_TIMEOUT_MS);
    recorder.onstop = (): void => settle();
    recorder.onerror = (): void => settle(new Error("Browser microphone recorder failed"));
    try {
      recorder.stop();
    } catch (error: unknown) {
      settle(error instanceof Error ? error : new Error("Browser microphone recorder failed"));
    }
  });
}

function isPermissionDenied(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as { name?: unknown; message?: unknown };
  const name = typeof candidate.name === "string" ? candidate.name.toLowerCase() : "";
  const message = typeof candidate.message === "string" ? candidate.message.toLowerCase() : "";
  return name === "notallowederror" || name === "securityerror" || message.includes("permission denied") || message.includes("not allowed");
}

async function discard(uri: string): Promise<void> {
  try {
    await discardTemporaryRecordingStrict(uri);
  } catch (e) {
    safeLog("[dictation] strict discard failed", errorShape(e));
    throw e;
  }
}
