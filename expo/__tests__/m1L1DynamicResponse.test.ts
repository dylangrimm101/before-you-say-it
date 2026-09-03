import { afterEach, describe, expect, test } from "bun:test";

import { generateM1L1DynamicReply, requestBysiGeneration } from "@/lib/ai";
import { M1_L1_CONVERSION } from "@/lib/convertedLesson";
import { m1L1DynamicReplyPassesQuality, m1L1ProviderTurn } from "@/lib/m1L1DynamicResponse";

const originalFetch = globalThis.fetch;
const opening = "The file arrived at 4:20 yesterday, which left too little review time. Can we move the handoff to noon?";
const context = `${M1_L1_CONVERSION.scenario.title} ${M1_L1_CONVERSION.scenario.situation} ${M1_L1_CONVERSION.scenario.persona}`;
const authoredCorpus = [...M1_L1_CONVERSION.pushbackOneBank, M1_L1_CONVERSION.authoredEvidenceTrap];

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("M1 L1 constrained dynamic counterpart", () => {
  test("accepts a relevant pressure reply and rejects coaching, agreement, invented facts, and topic changes", () => {
    const relevant = "I understand the late handoff caused a scramble, but quarter close has been unusually heavy. What timing would give you enough review time?";
    expect(m1L1DynamicReplyPassesQuality(relevant, "pushback_one", opening, context)).toBe(true);
    expect(m1L1DynamicReplyPassesQuality("Good job. Try saying one point, one proof, and one move.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("You're right. I'll move the handoff to noon.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("The handoff will arrive Monday at 9:00, but quarter close is heavy.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("Noon isn't realistic right now, the client keeps changing numbers on me until mid-afternoon during quarter close.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("Noon's not realistic because finance releases numbers late, so I can't promise that.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("Noon isn't realistic every week when the client changes numbers last minute; I'm not locking in a fixed time just because two weeks were rough.", "evidence_trap", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("But we should talk about chores and dinner instead.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("I understand the late file caused a deadline problem.", "pushback_one", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("How can I help with the file timing?", "evidence_trap", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("I don't think two late handoffs make this a pattern.", "evidence_trap", opening, context)).toBe(true);
  });

  test("retries one semantically rejected response and sends the full lesson contract", async () => {
    const payloads: Record<string, unknown>[] = [];
    const replies = [
      "Good job. Try saying one point and one proof.",
      "I understand the late handoff caused a scramble, but quarter close has been unusually heavy. What timing would give you enough review time?",
    ];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ mode: "turn", text: replies[payloads.length - 1] }), { status: 200 });
    }) as typeof fetch;

    const result = await generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "dynamic-run",
    });

    expect(result.reply).toContain("quarter close");
    expect(payloads).toHaveLength(2);
    expect(payloads[0]).toMatchObject({
      type: "rehearsal_turn",
      turn: "pushback",
      lesson_constraints: {
        lesson_id: "m1-l1",
        approved_transcript: opening,
      },
    });
  });

  test("fails closed instead of showing a canned line after two failed quality checks", async () => {
    let requestCount = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      requestCount += 1;
      return new Response(JSON.stringify({ mode: "turn", text: "Sure, you're right. I'll do that." }), { status: 200 });
    }) as typeof fetch;
    const request = generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "fallback-run",
    });

    await expect(request).rejects.toThrow("AI counterpart response is unavailable");
    expect(requestCount).toBe(2);
  });

  test("rejects an authored fallback returned verbatim by the provider", async () => {
    const fallback = M1_L1_CONVERSION.pushbackOneBank[0];
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(JSON.stringify({ mode: "turn", text: fallback }), { status: 200 })) as typeof fetch;

    await expect(generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "verbatim-fallback-run",
    })).rejects.toThrow("AI counterpart response is unavailable");
  });

  test("rejects every authored M1 L1 line even when a different fallback was selected", async () => {
    const differentCannedLine = M1_L1_CONVERSION.pushbackOneBank[0];
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(JSON.stringify({ mode: "turn", text: differentCannedLine }), { status: 200 })) as typeof fetch;

    await expect(generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "different-canned-line-run",
    })).rejects.toThrow("AI counterpart response is unavailable");
  });

  test("rejects authored fallback wording with punctuation-only changes", async () => {
    const fallback = M1_L1_CONVERSION.pushbackOneBank[0];
    const punctuationVariant = fallback.replace(/\.$/, "!");
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(JSON.stringify({ mode: "turn", text: punctuationVariant }), { status: 200 })) as typeof fetch;

    await expect(generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "punctuation-fallback-run",
    })).rejects.toThrow("AI counterpart response is unavailable");
  });

  test("rejects an authored line containing an invisible Unicode format character", async () => {
    const fallback = M1_L1_CONVERSION.pushbackOneBank[0];
    const invisibleVariant = fallback.replace("fair", "fa\u200Bir");
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(JSON.stringify({ mode: "turn", text: invisibleVariant }), { status: 200 })) as typeof fetch;

    await expect(generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredCorpus,
      runId: "invisible-canned-line-run",
    })).rejects.toThrow("AI counterpart response is unavailable");
  });

  test("rejects a second provider reply that repeats the first pressure", async () => {
    const repeated = "I don't think one late handoff makes this a pattern.";
    globalThis.fetch = (async (): Promise<Response> =>
      new Response(JSON.stringify({ mode: "turn", text: repeated }), { status: 200 })) as typeof fetch;

    await expect(generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "evidence_trap",
      approvedTranscript: "Yesterday's late file is one example. Can we decide who owns approval?",
      openingTranscript: opening,
      firstPushback: repeated,
      firstResponse: "Yesterday's late file is one example. Can we decide who owns approval?",
      authoredCorpus,
      runId: "duplicate-pressure-run",
    })).rejects.toThrow("AI counterpart response is unavailable");
  });

  test("aborts a stalled provider request within the configured boundary", async () => {
    let observedSignal: AbortSignal | undefined;
    globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      observedSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        observedSignal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }) as typeof fetch;

    await expect(requestBysiGeneration({ type: "rehearsal_turn" }, 5)).rejects.toThrow("aborted");
    expect(observedSignal?.aborted).toBe(true);
  });

  test("builds stable provider identities for persisted playback and resume", () => {
    const text = "But quarter close is heavy. What handoff timing would actually leave enough review time?";
    const first = m1L1ProviderTurn("stable-run", "pushback_one", text);
    const second = m1L1ProviderTurn("stable-run", "evidence_trap", "But that's one handoff example. What else are you basing this on?");
    expect(m1L1ProviderTurn("stable-run", "pushback_one", text)).toEqual(first);
    expect(first).toMatchObject({ source: "provider", id: "stable-run-pushback-1-provider", resolvedAudioId: "stable-run-m1-l1-dynamic-pushback-1" });
    expect(second).toMatchObject({ source: "provider", id: "stable-run-pushback-2-provider", resolvedAudioId: "stable-run-m1-l1-dynamic-pushback-2" });
  });
});
