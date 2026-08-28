import { afterEach, describe, expect, test } from "bun:test";

import {
  approvedRehearsalDynamicReplyPassesQuality,
  generateApprovedRehearsalDynamicReply,
} from "@/lib/ai";
import { approvedRehearsalConfig, type ApprovedRehearsalLessonId } from "@/lib/approvedRehearsals";

const originalFetch = globalThis.fetch;
const lessonIds: readonly ApprovedRehearsalLessonId[] = [
  "m1-l2", "m1-l3", "m1-l4", "m1-l5", "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5",
];

function dynamicInput(lessonId: ApprovedRehearsalLessonId) {
  const config = approvedRehearsalConfig(lessonId)!;
  return {
    scenario: config.scenario,
    lessonId: config.lessonId,
    counterpartId: config.counterpartId,
    namedMove: config.namedMove,
    coachedBehaviorId: config.coachedBehaviorId,
    retryDirection: config.retryDirection,
    approvedTranscript: `My approved opening for ${lessonId}.`,
    authoredFallback: config.authoredPressureText,
    runId: `run-${lessonId}`,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("all approved lesson dynamic counterparts", () => {
  test("sends every lesson's current scenario, learner opening, persona, goal, and private teaching target", async () => {
    const payloads: Record<string, unknown>[] = [];
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      payloads.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return new Response(JSON.stringify({ mode: "turn", text: "I don't think that resolves this yet. Why should we handle it that way?" }), { status: 200 });
    }) as typeof fetch;

    for (const lessonId of lessonIds) {
      const result = await generateApprovedRehearsalDynamicReply(dynamicInput(lessonId));
      expect(result.source, lessonId).toBe("provider");
    }

    expect(payloads).toHaveLength(lessonIds.length);
    for (const [index, lessonId] of lessonIds.entries()) {
      const config = approvedRehearsalConfig(lessonId)!;
      expect(payloads[index], lessonId).toMatchObject({
        type: "rehearsal_turn",
        turn: "pushback",
        contract: {
          scenario: `${config.scenario.title}. ${config.scenario.situation}`,
          success_target: config.scenario.goal,
        },
        transcript: { user_turn_1: `My approved opening for ${lessonId}.` },
        avoid_repeating: [config.authoredPressureText],
        lesson_constraints: {
          lesson_id: lessonId,
          counterpart_id: config.counterpartId,
          counterpart: config.scenario.counterpart,
          scenario_context: `${config.scenario.title}. ${config.scenario.situation}`,
          counterpart_persona: config.scenario.persona,
          learner_goal: config.scenario.goal,
          coached_behavior_id: config.coachedBehaviorId,
          named_move_private: config.namedMove,
        },
        variation_seed: `run-${lessonId}-${lessonId}-pressure-0`,
      });
    }
  });

  test("rejects coaching leakage and falls back only after two unusable model replies", async () => {
    let requests = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      requests += 1;
      return new Response(JSON.stringify({ mode: "turn", text: "Good job, learner. Try saying the named move." }), { status: 200 });
    }) as typeof fetch;
    const input = dynamicInput("m1-l3");

    const result = await generateApprovedRehearsalDynamicReply(input);

    expect(requests).toBe(2);
    expect(result).toEqual({ reply: input.authoredFallback, source: "authored" });
  });

  test("accepts concise in-character pressure but rejects agreement and instructional text", () => {
    expect(approvedRehearsalDynamicReplyPassesQuality("I can't agree to that yet. Why should we handle it that way?")).toBe(true);
    expect(approvedRehearsalDynamicReplyPassesQuality("You're right. I'll do that.")).toBe(false);
    expect(approvedRehearsalDynamicReplyPassesQuality("Try saying the lesson's named move now.")).toBe(false);
  });
});
