import { Platform } from "react-native";
import { withRequestDeadline } from "@/lib/requestDeadline";

import { safeLog } from "@/lib/redact";
import { supabase } from "@/lib/supabase";
import { validatedTranscribeEndpoint } from "@/lib/transcriptionConfig";

export type TranscriptionTurn = "opener" | "reply";

const CONFIGURED_ENDPOINT = process.env.EXPO_PUBLIC_TRANSCRIBE_ENDPOINT?.trim() ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const TRANSCRIPTION_TIMEOUT_MS = 45_000;

/** Public endpoint URL only; transcription provider credentials remain server-side. */
export const TRANSCRIBE_ENDPOINT = validatedTranscribeEndpoint(CONFIGURED_ENDPOINT, SUPABASE_URL);

export class TranscriptionUnavailableError extends Error {
  readonly status: number;

  constructor(status: number) {
    super("Transcription service unavailable");
    this.name = "TranscriptionUnavailableError";
    this.status = status;
  }
}

function fileNameFor(mediaType: string): string {
  if (mediaType.includes("webm")) return "recording.webm";
  if (mediaType.includes("wav")) return "recording.wav";
  return "recording.m4a";
}

function evidenceEndpoint(url: string): string {
  return url.replace(/^https?:\/\//, "").slice(0, 64);
}

async function requestHeaders(): Promise<Record<string, string>> {
  if (!supabase || !SUPABASE_ANON_KEY) throw new TranscriptionUnavailableError(401);
  const { data, error } = await supabase.auth.getSession();
  const accessToken = data.session?.access_token?.trim();
  if (error || !accessToken) throw new TranscriptionUnavailableError(401);
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${accessToken}`,
  };
}

/** Upload a short recording to the project backend and return unapproved transcript text. */
export async function transcribeRecording(
  uri: string,
  mediaType: string,
  turn: TranscriptionTurn,
  options: { signal?: AbortSignal; timeoutMs?: number; paidPractice?: boolean } = {},
): Promise<string> {
  const stagedPaid = options.paidPractice === true; // Paid callers fail closed outside the reviewed staging runtime.
  const normalFree = !stagedPaid && process.env.EXPO_PUBLIC_BYSI_BUILD_MODE !== 'staging-account' && !!process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN;
  if (!stagedPaid && !normalFree && !TRANSCRIBE_ENDPOINT) throw new TranscriptionUnavailableError(503);

  try {
    return await withRequestDeadline(async (signal) => {
      const body = new FormData();
      body.append("turn", turn);

      if (Platform.OS === "web") {
        const audioResponse = await fetch(uri, { signal });
        if (!audioResponse.ok) throw new Error("Recorded audio could not be read");
        const audioBlob = await audioResponse.blob();
        body.append("audio", audioBlob, fileNameFor(mediaType || audioBlob.type));
      } else {
        const nativeAudio = {
          uri,
          name: fileNameFor(mediaType),
          type: mediaType,
        };
        body.append("audio", nativeAudio as unknown as Blob);
      }

      safeLog("[evidence] native transcription request", {
        endpoint: evidenceEndpoint(TRANSCRIBE_ENDPOINT),
        platform: Platform.OS,
        provider: "supabase-openai-transcription",
        turn,
      });
      const headers = stagedPaid || normalFree ? {} : await requestHeaders();
      if (signal.aborted) throw new Error("Request aborted");
      const response = stagedPaid
        ? await (await import("./paidVoiceRuntime")).requestPaidVoice("transcribe", body, signal)
        : normalFree ? await (await import('./normalFreeRuntime')).requestNormalFree('transcribe', body, signal, {turn,identity:uri})
        : await fetch(TRANSCRIBE_ENDPOINT, {
        method: "POST",
        headers,
        body,
        signal,
      });
      safeLog("[evidence] native transcription response", {
        endpoint: evidenceEndpoint(TRANSCRIBE_ENDPOINT),
        ok: response.ok,
        platform: Platform.OS,
        status: response.status,
        turn,
      });

      if (!response.ok) {
        if (response.status === 402 || response.status === 429 || response.status >= 500) {
          throw new TranscriptionUnavailableError(response.status);
        }
        throw new Error(`Transcription failed (${response.status})`);
      }

      const result = await response.json() as { text?: unknown };
      if (signal.aborted) throw new Error("Request aborted");
      const text = typeof result.text === "string" ? result.text.trim() : "";
      if (!text) throw new Error("Empty transcription");
      safeLog("[evidence] native transcription completed", {
        length: text.length,
        platform: Platform.OS,
        turn,
      });
      return text;
    }, options.timeoutMs ?? TRANSCRIPTION_TIMEOUT_MS, options.signal);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw new TranscriptionUnavailableError(408);
    throw error;
  }
}
