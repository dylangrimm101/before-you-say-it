import { Platform } from "react-native";

import { safeLog } from "@/lib/redact";

export type TranscriptionTurn = "opener" | "reply";

const CONFIGURED_ENDPOINT = process.env.EXPO_PUBLIC_TRANSCRIBE_ENDPOINT?.trim() ?? "";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** Public endpoint URL only; transcription provider credentials remain server-side. */
export const TRANSCRIBE_ENDPOINT = CONFIGURED_ENDPOINT || (
  SUPABASE_URL ? `${SUPABASE_URL}/functions/v1/transcribe` : ""
);

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

function requestHeaders(): Record<string, string> {
  if (!TRANSCRIBE_ENDPOINT.includes(".supabase.co/functions/v1/") || !SUPABASE_ANON_KEY) return {};
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
}

/** Upload a short recording to the project backend and return unapproved transcript text. */
export async function transcribeRecording(
  uri: string,
  mediaType: string,
  turn: TranscriptionTurn,
): Promise<string> {
  if (!TRANSCRIBE_ENDPOINT) throw new TranscriptionUnavailableError(503);

  const body = new FormData();
  body.append("turn", turn);

  if (Platform.OS === "web") {
    const audioResponse = await fetch(uri);
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
  const response = await fetch(TRANSCRIBE_ENDPOINT, {
    method: "POST",
    headers: requestHeaders(),
    body,
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
  const text = typeof result.text === "string" ? result.text.trim() : "";
  if (!text) throw new Error("Empty transcription");
  safeLog("[evidence] native transcription completed", {
    length: text.length,
    platform: Platform.OS,
    turn,
  });
  return text;
}
