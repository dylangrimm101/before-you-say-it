import { describe, expect, test } from "bun:test";

import { validatedTranscribeEndpoint } from "@/lib/transcriptionConfig";

const expoRoot = `${import.meta.dir}/..`;
const projectRoot = `${expoRoot}/..`;

describe("server-side recording transcription", () => {
  test("sends session credentials only to the configured Supabase transcription function", () => {
    const project = "https://project.supabase.co";
    expect(validatedTranscribeEndpoint("", project)).toBe(`${project}/functions/v1/transcribe`);
    expect(validatedTranscribeEndpoint(`${project}/functions/v1/transcribe`, project)).toBe(`${project}/functions/v1/transcribe`);
    expect(validatedTranscribeEndpoint("https://evil.example/functions/v1/transcribe", project)).toBe("");
    expect(validatedTranscribeEndpoint(`${project}/functions/v1/other`, project)).toBe("");
    expect(validatedTranscribeEndpoint(`https://user:pass@project.supabase.co/functions/v1/transcribe`, project)).toBe("");
  });

  test("uploads multipart audio and turn metadata to the project backend", async () => {
    const client = await Bun.file(`${expoRoot}/lib/transcription.ts`).text();
    const config = await Bun.file(`${expoRoot}/lib/transcriptionConfig.ts`).text();
    expect(client).toContain("EXPO_PUBLIC_TRANSCRIBE_ENDPOINT");
    expect(config).toContain("/functions/v1/transcribe");
    expect(client).toContain('body.append("audio"');
    expect(client).toContain('body.append("turn", turn)');
    expect(client).toContain("nativeAudio as unknown as Blob");
    expect(client).not.toContain("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY");
    expect(client).not.toContain("transcription-model");
    expect(client).toContain("TRANSCRIPTION_TIMEOUT_MS");
    expect(client).toContain("signal: controller.signal");
    expect(client).toContain("new TranscriptionUnavailableError(408)");
    expect(client).toContain("supabase.auth.getSession()");
    expect(client).toContain("data.session?.access_token");
    expect(client).not.toContain("Authorization: `Bearer ${SUPABASE_ANON_KEY}`");
  });

  test("keeps the provider credential and provider request on the server", async () => {
    const backend = await Bun.file(`${projectRoot}/backend/functions/transcribe/index.ts`).text();
    expect(backend).toContain('Deno.env.get("OPENAI_API_KEY")');
    expect(backend).toContain("https://api.openai.com/v1/audio/transcriptions");
    expect(backend).toContain('Deno.env.get("OPENAI_TRANSCRIBE_MODEL")');
    expect(backend).toContain('"gpt-4o-mini-transcribe"');
    expect(backend).toContain('providerBody.append("language", "en")');
    expect(backend).toContain('providerBody.append("response_format", "json")');
  });

  test("requires a verified user, bounded streaming, layered rate limits, and restricted CORS", async () => {
    const backend = await Bun.file(`${projectRoot}/backend/functions/transcribe/index.ts`).text();
    const config = await Bun.file(`${projectRoot}/backend/supabase/config.toml`).text();
    expect(config).toContain("verify_jwt = true");
    expect(backend).toContain("/auth/v1/user");
    expect(backend).toContain("readBoundedBody");
    expect(backend).toContain("request.body?.getReader()");
    expect(backend).toContain("TRANSCRIBE_RATE_LIMIT_URL");
    expect(backend).toContain("TRANSCRIBE_RATE_LIMIT_SECRET");
    expect(backend).toContain("checkLocalRateLimit");
    expect(backend).toContain("checkDistributedRateLimit");
    expect(backend).toContain("AbortSignal.timeout");
    expect(backend).toContain("TRANSCRIBE_ALLOWED_ORIGINS");
    expect(backend).not.toContain('"Access-Control-Allow-Origin": "*"');
    expect(backend.indexOf("authenticateUser(request)")).toBeLessThan(backend.indexOf("readBoundedBody(request)"));
  });

  test("labels both onboarding turns and preserves transcript confirmation", async () => {
    const rehearsal = await Bun.file(`${expoRoot}/app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('const turn = myTurnCount === 0 ? "opener" : "reply"');
    expect(rehearsal).toContain("dictation.stop(turn)");
    expect(rehearsal).toContain("Turning your voice into text…");
    expect(rehearsal).toContain("EDIT TRANSCRIPT");
    expect(rehearsal).toContain("Re-record");
    expect(rehearsal).toContain('myTurnCount === 0 ? "Use this opener" : "Use this reply"');
    expect(rehearsal).toContain("setPending(recognizerEndState(text).pendingText)");
    expect(rehearsal).toContain("approvePendingTranscript");
    expect(rehearsal).toContain("void submitText(pending)");
    expect(rehearsal).toContain('onPress={approvePendingTranscript}');
  });

  test("all three onboarding routes converge on the same spoken rehearsal", async () => {
    const onboarding = await Bun.file(`${expoRoot}/app/onboarding.tsx`).text();
    expect(onboarding).toContain('"real_conversation"');
    expect(onboarding).toContain('"recurring_problem"');
    expect(onboarding).toContain('"desired_skill"');
    expect(onboarding).toContain("rehearse/");
  });

  test("private provider and deployment credentials are absent from Expo configuration", async () => {
    const envFile = Bun.file(`${expoRoot}/.env`);
    const env = await envFile.exists() ? await envFile.text() : "";
    expect(env).not.toMatch(/^OPENAI_API_KEY=/m);
    expect(env).not.toMatch(/^ANTHROPIC_API_KEY=/m);
    expect(env).not.toMatch(/^ELEVENLABS_API_KEY=/m);
    expect(env).not.toMatch(/^SUPABASE_ACCESS_TOKEN=/m);
    expect(env).not.toMatch(/^(?:SUPABASE_)?SERVICE_ROLE(?:_KEY)?=/m);
  });

  test("the deprecated client transcription gateway is absent", async () => {
    const ai = await Bun.file(`${expoRoot}/lib/ai.ts`).text();
    const dictation = await Bun.file(`${expoRoot}/lib/useDictation.ts`).text();
    expect(ai).not.toContain("/v2/vercel/v4/ai/transcription-model");
    expect(dictation).not.toContain("transcribeAudio");
    expect(dictation).not.toContain("base64");
  });

  test("Hope, Adam, debrief, and coaching use the user-owned Claude-backed BYSI endpoint", async () => {
    const ai = await Bun.file(`${expoRoot}/lib/ai.ts`).text();
    const rehearsal = await Bun.file(`${expoRoot}/app/rehearse/[id].tsx`).text();
    expect(ai).toContain("EXPO_PUBLIC_GENERATE_ENDPOINT");
    expect(ai).toContain('type: "rehearsal_turn"');
    expect(ai).toContain('type: "free_rehearsal_result"');
    expect(ai).toContain("nextCounterpartTurn");
    expect(ai).toContain("generateDebrief");
    expect(ai).toContain("evaluatePilotAttempt");
    expect(ai).toContain("entry_route: entryRoute");
    expect(rehearsal).toContain("activePracticeSession?.entryRoute");
    expect(rehearsal).toContain("[evidence] native counterpart accepted");
    expect(rehearsal).toContain("[evidence] native debrief ready");
    expect(ai).not.toContain("EXPO_PUBLIC_TOOLKIT_URL");
    expect(ai).not.toContain("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY");
    expect(ai).not.toContain("/v2/vercel/v1/chat/completions");
    expect(ai).not.toContain("OPENAI_API_KEY");
    expect(ai).not.toContain("ANTHROPIC_API_KEY");
    expect(ai).not.toContain('|| "https://beforeyousayit.app/api/generate"');
    expect(ai).toContain("BYSI generation endpoint is not configured");
    expect(ai).toContain('parsed.pathname.endsWith("/api/generate")');
  });
});
