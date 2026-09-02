type TranscriptionTurn = "opener" | "reply";

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_AUDIO_BYTES + 64 * 1024;
const LOCAL_WINDOW_MS = 60_000;
const LOCAL_REQUEST_LIMIT = 3;
const ALLOWED_TURNS = new Set<TranscriptionTurn>(["opener", "reply"]);
const localRequests = new Map<string, number[]>();

class BodyTooLargeError extends Error {}

function allowedOrigins(): ReadonlySet<string> {
  return new Set((Deno.env.get("TRANSCRIBE_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean));
}

function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin")?.trim() ?? "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowedOrigins().has(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function originAllowed(request: Request): boolean {
  const origin = request.headers.get("origin")?.trim();
  return !origin || allowedOrigins().has(origin);
}

function jsonResponse(request: Request, status: number, body: Record<string, unknown>, extraHeaders: Record<string, string> = {}): Response {
  return Response.json(body, {
    status,
    headers: {
      ...corsHeaders(request),
      ...extraHeaders,
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
    },
  });
}

function isAudioFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0 && value.type.toLowerCase().startsWith("audio/");
}

async function authenticateUser(request: Request): Promise<string | null> {
  const authorization = request.headers.get("authorization")?.trim() ?? "";
  if (!/^Bearer\s+\S+$/i.test(authorization)) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.replace(/\/$/, "") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")?.trim() ?? "";
  if (!supabaseUrl || !anonKey) throw new Error("Authentication boundary is not configured");
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: authorization },
  });
  if (!response.ok) return null;
  const user = await response.json().catch(() => null) as { id?: unknown } | null;
  return typeof user?.id === "string" && user.id.length > 0 ? user.id : null;
}

function checkLocalRateLimit(userId: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number } {
  const recent = (localRequests.get(userId) ?? []).filter((timestamp) => now - timestamp < LOCAL_WINDOW_MS);
  if (recent.length >= LOCAL_REQUEST_LIMIT) {
    const retryAfterSeconds = Math.max(1, Math.ceil((LOCAL_WINDOW_MS - (now - recent[0]!)) / 1000));
    localRequests.set(userId, recent);
    return { allowed: false, retryAfterSeconds };
  }
  recent.push(now);
  localRequests.set(userId, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}

async function checkDistributedRateLimit(userId: string): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const rawUrl = Deno.env.get("TRANSCRIBE_RATE_LIMIT_URL")?.trim() ?? "";
  const secret = Deno.env.get("TRANSCRIBE_RATE_LIMIT_SECRET")?.trim() ?? "";
  if (!rawUrl || !secret) throw new Error("Distributed rate limit is not configured");
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash) throw new Error("Distributed rate limit URL is invalid");
  const response = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
    body: JSON.stringify({ subject: userId, action: "transcribe" }),
    signal: AbortSignal.timeout(3_000),
  });
  if (response.status === 429) {
    return { allowed: false, retryAfterSeconds: Number(response.headers.get("retry-after")) || 60 };
  }
  if (!response.ok) throw new Error(`Distributed rate limit failed (${response.status})`);
  const result = await response.json().catch(() => null) as { allowed?: unknown; retryAfterSeconds?: unknown } | null;
  if (typeof result?.allowed !== "boolean") throw new Error("Distributed rate limit returned an invalid response");
  return {
    allowed: result.allowed,
    retryAfterSeconds: typeof result.retryAfterSeconds === "number" && result.retryAfterSeconds > 0
      ? Math.ceil(result.retryAfterSeconds)
      : 60,
  };
}

async function readBoundedBody(request: Request): Promise<Uint8Array> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) throw new BodyTooLargeError();
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel("request body exceeds limit").catch(() => {});
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

Deno.serve(async (request: Request): Promise<Response> => {
  if (!originAllowed(request)) return jsonResponse(request, 403, { error: "Origin is not allowed" });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { ...corsHeaders(request), Allow: "POST", "Cache-Control": "no-store" } });
  }

  let userId: string | null;
  try {
    userId = await authenticateUser(request);
  } catch {
    return jsonResponse(request, 503, { error: "Authentication service is unavailable" });
  }
  if (!userId) return jsonResponse(request, 401, { error: "A verified user session is required" });

  const localLimit = checkLocalRateLimit(userId);
  if (!localLimit.allowed) {
    return jsonResponse(request, 429, { error: "Too many transcription requests" }, { "Retry-After": String(localLimit.retryAfterSeconds) });
  }
  let distributedLimit: { allowed: boolean; retryAfterSeconds: number };
  try {
    distributedLimit = await checkDistributedRateLimit(userId);
  } catch {
    return jsonResponse(request, 503, { error: "Transcription rate limit is unavailable" });
  }
  if (!distributedLimit.allowed) {
    return jsonResponse(request, 429, { error: "Too many transcription requests" }, { "Retry-After": String(distributedLimit.retryAfterSeconds) });
  }

  const openAIKey = Deno.env.get("OPENAI_API_KEY") ?? "";
  if (!openAIKey) return jsonResponse(request, 503, { error: "Transcription is not configured" });

  let rawBody: Uint8Array;
  try {
    rawBody = await readBoundedBody(request);
  } catch (error) {
    if (error instanceof BodyTooLargeError) return jsonResponse(request, 413, { error: "Audio upload is too large" });
    return jsonResponse(request, 400, { error: "Audio upload could not be read" });
  }

  let incoming: FormData;
  try {
    incoming = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: rawBody.buffer as ArrayBuffer,
    }).formData();
  } catch {
    return jsonResponse(request, 400, { error: "Expected a multipart audio upload" });
  }

  const turn = incoming.get("turn");
  const audio = incoming.get("audio");
  if (typeof turn !== "string" || !ALLOWED_TURNS.has(turn as TranscriptionTurn)) {
    return jsonResponse(request, 400, { error: "Turn must be opener or reply" });
  }
  if (!isAudioFile(audio)) return jsonResponse(request, 400, { error: "A non-empty audio file is required" });
  if (audio.size > MAX_AUDIO_BYTES) return jsonResponse(request, 413, { error: "Audio file is too large" });

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
    return jsonResponse(request, 503, { error: "Transcription provider could not be reached" });
  }

  if (!providerResponse.ok) {
    console.error("[transcribe] provider request failed", {
      status: providerResponse.status,
      turn,
      audioBytes: audio.size,
      mediaType: audio.type.slice(0, 64),
    });
    return jsonResponse(request, providerResponse.status === 429 ? 429 : 503, { error: "Transcription is temporarily unavailable" });
  }

  let result: { text?: unknown };
  try {
    result = await providerResponse.json() as { text?: unknown };
  } catch {
    return jsonResponse(request, 502, { error: "Transcription provider returned an invalid response" });
  }

  const text = typeof result.text === "string" ? result.text.trim() : "";
  if (!text) return jsonResponse(request, 422, { error: "No speech was detected" });
  return jsonResponse(request, 200, { text });
});
