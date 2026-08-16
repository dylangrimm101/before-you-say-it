type TranscriptionTurn = "opener" | "reply";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const ALLOWED_TURNS = new Set<TranscriptionTurn>(["opener", "reply"]);
const CORS_HEADERS: Readonly<Record<string, string>> = {
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return Response.json(body, {
    status,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.type.toLowerCase().startsWith("audio/");
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  if (request.method !== "POST") {
    return new Response(null, {
      status: 405,
      headers: { ...CORS_HEADERS, Allow: "POST", "Cache-Control": "no-store" },
    });
  }

  const openAIKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAIKey) return jsonResponse(503, { error: "Transcription is not configured" });

  let incoming: FormData;
  try {
    incoming = await request.formData();
  } catch {
    return jsonResponse(400, { error: "Expected a multipart audio upload" });
  }

  const turn = incoming.get("turn");
  const audio = incoming.get("audio");
  if (typeof turn !== "string" || !ALLOWED_TURNS.has(turn as TranscriptionTurn)) {
    return jsonResponse(400, { error: "Turn must be opener or reply" });
  }
  if (!isAudioFile(audio)) return jsonResponse(400, { error: "A non-empty audio file is required" });
  if (audio.size > MAX_AUDIO_BYTES) return jsonResponse(413, { error: "Audio file is too large" });

  const providerBody = new FormData();
  providerBody.append("file", audio, audio.name || (audio.type.includes("webm") ? "recording.webm" : "recording.m4a"));
  providerBody.append("model", Deno.env.get("OPENAI_TRANSCRIBE_MODEL") ?? "gpt-4o-mini-transcribe");
  providerBody.append("language", "en");
  providerBody.append("response_format", "json");

  let providerResponse: Response;
  try {
    providerResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${openAIKey}` },
      body: providerBody,
    });
  } catch {
    return jsonResponse(503, { error: "Transcription provider could not be reached" });
  }

  if (!providerResponse.ok) {
    console.error("[transcribe] provider request failed", {
      status: providerResponse.status,
      turn,
      audioBytes: audio.size,
      mediaType: audio.type.slice(0, 64),
    });
    return jsonResponse(providerResponse.status === 429 ? 429 : 503, {
      error: "Transcription is temporarily unavailable",
    });
  }

  let result: { text?: unknown };
  try {
    result = await providerResponse.json() as { text?: unknown };
  } catch {
    return jsonResponse(502, { error: "Transcription provider returned an invalid response" });
  }

  const text = typeof result.text === "string" ? result.text.trim() : "";
  if (!text) return jsonResponse(422, { error: "No speech was detected" });
  return jsonResponse(200, { text });
});
