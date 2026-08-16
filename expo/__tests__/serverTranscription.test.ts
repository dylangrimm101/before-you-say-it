import { describe, expect, test } from "bun:test";

const expoRoot = `${import.meta.dir}/..`;
const projectRoot = `${expoRoot}/..`;

describe("server-side recording transcription", () => {
  test("uploads multipart audio and turn metadata to the project backend", async () => {
    const client = await Bun.file(`${expoRoot}/lib/transcription.ts`).text();
    expect(client).toContain("EXPO_PUBLIC_TRANSCRIBE_ENDPOINT");
    expect(client).toContain("/functions/v1/transcribe");
    expect(client).toContain('body.append("audio"');
    expect(client).toContain('body.append("turn", turn)');
    expect(client).toContain("nativeAudio as unknown as Blob");
    expect(client).not.toContain("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY");
    expect(client).not.toContain("transcription-model");
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

  test("labels both onboarding turns and preserves transcript confirmation", async () => {
    const rehearsal = await Bun.file(`${expoRoot}/app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('dictation.stop(myTurnCount === 0 ? "opener" : "reply")');
    expect(rehearsal).toContain("Turning your voice into text…");
    expect(rehearsal).toContain("EDIT TRANSCRIPT");
    expect(rehearsal).toContain("Re-record");
    expect(rehearsal).toContain('myTurnCount === 0 ? "Use this opener" : "Use this reply"');
    expect(rehearsal).toContain("setPending(recognizerEndState(text).pendingText)");
    expect(rehearsal.indexOf("setPending(recognizerEndState(text).pendingText)")).toBeLessThan(
      rehearsal.indexOf("submitText(pending)"),
    );
  });

  test("all three onboarding routes converge on the same spoken rehearsal", async () => {
    const onboarding = await Bun.file(`${expoRoot}/app/onboarding.tsx`).text();
    expect(onboarding).toContain('"real_conversation"');
    expect(onboarding).toContain('"recurring_problem"');
    expect(onboarding).toContain('"desired_skill"');
    expect(onboarding).toContain("rehearse/");
  });

  test("the deprecated client transcription gateway is absent", async () => {
    const ai = await Bun.file(`${expoRoot}/lib/ai.ts`).text();
    const dictation = await Bun.file(`${expoRoot}/lib/useDictation.ts`).text();
    expect(ai).not.toContain("/v2/vercel/v4/ai/transcription-model");
    expect(dictation).not.toContain("transcribeAudio");
    expect(dictation).not.toContain("base64");
  });

  test("Hope, Adam, debrief, and coaching generation remain Claude-backed", async () => {
    const ai = await Bun.file(`${expoRoot}/lib/ai.ts`).text();
    expect(ai).toContain('const ROLEPLAY_MODEL = "anthropic/claude-sonnet-5"');
    expect(ai).toContain('const DEBRIEF_MODEL = "anthropic/claude-sonnet-5"');
    expect(ai).toContain('"anthropic/claude-haiku-4.5"');
    expect(ai).toContain("nextCounterpartTurn");
    expect(ai).toContain("generateDebrief");
    expect(ai).toContain("evaluatePilotAttempt");
    expect(ai).not.toContain('"google/gemini');
    expect(ai).not.toContain('"openai/gpt');
    expect(ai).not.toContain("OPENAI_API_KEY");
    expect(ai).not.toContain("ANTHROPIC_API_KEY");
  });
});
