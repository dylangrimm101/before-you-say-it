import { afterEach, describe, expect, test } from "bun:test";

import { generateM1L1DynamicReply } from "@/lib/ai";
import { M1_L1_CONVERSION } from "@/lib/convertedLesson";
import { m1L1DynamicReplyPassesQuality, m1L1ProviderTurn } from "@/lib/m1L1DynamicResponse";

const originalFetch = globalThis.fetch;
const opening = "The file arrived at 4:20 yesterday, which left too little review time. Can we move the handoff to noon?";
const context = `${M1_L1_CONVERSION.scenario.title} ${M1_L1_CONVERSION.scenario.situation} ${M1_L1_CONVERSION.scenario.persona}`;

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
    expect(m1L1DynamicReplyPassesQuality("Noon isn't realistic every week when the client changes numbers last minute; I'm not locking in a fixed time just because two weeks were rough.", "evidence_trap", opening, context)).toBe(false);
    expect(m1L1DynamicReplyPassesQuality("But we should talk about chores and dinner instead.", "pushback_one", opening, context)).toBe(false);
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
      authoredFallback: M1_L1_CONVERSION.pushbackOneBank[0],
      runId: "dynamic-run",
    });

    expect(result.source).toBe("provider");
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

  test("falls back to the exact authored line after two failed quality checks", async () => {
    let requestCount = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      requestCount += 1;
      return new Response(JSON.stringify({ mode: "turn", text: "Sure, you're right. I'll do that." }), { status: 200 });
    }) as typeof fetch;
    const fallback = M1_L1_CONVERSION.pushbackOneBank[0];

    const result = await generateM1L1DynamicReply({
      scenario: M1_L1_CONVERSION.scenario,
      kind: "pushback_one",
      approvedTranscript: opening,
      openingTranscript: opening,
      authoredFallback: fallback,
      runId: "fallback-run",
    });

    expect(requestCount).toBe(2);
    expect(result).toEqual({ reply: fallback, source: "authored" });
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
