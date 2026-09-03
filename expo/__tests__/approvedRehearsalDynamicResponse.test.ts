import { afterEach, describe, expect, test } from "bun:test";

import {
  approvedRehearsalDynamicReplyPassesQuality,
  generateApprovedRehearsalDynamicReply,
} from "@/lib/ai";
import { approvedRehearsalAuthoredCorpus, approvedRehearsalConfig, type ApprovedRehearsalLessonId } from "@/lib/approvedRehearsals";

const originalFetch = globalThis.fetch;
const lessonIds: readonly ApprovedRehearsalLessonId[] = [
  "m1-l2", "m1-l3", "m1-l4", "m1-l5", "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5",
];
const groundedReplies: Readonly<Record<ApprovedRehearsalLessonId, string>> = {
  "m1-l2": "One late file still doesn't prove the approval process needs one owner.",
  "m1-l3": "You still haven't answered what happens with Dad's regular calls.",
  "m1-l4": "Two pickup changes don't mean I disregard your work schedule.",
  "m1-l5": "Which calendar issue do you actually want us to decide tonight?",
  "m2-l1": "I can't finish the whole handoff brief before Thursday's review.",
  "m2-l2": "Why should I confirm the bakery order when Jen's card is attached?",
  "m2-l3": "I can take the van after Theo's game, but not the whole Saturday.",
  "m2-l4": "I can't handle school pickup tomorrow, even with your client dinner.",
  "m2-l5": "Which change in the camp signup timing actually counts as at risk?",
};

function dynamicInput(lessonId: ApprovedRehearsalLessonId) {
  const config = approvedRehearsalConfig(lessonId)!;
  return {
    scenario: config.scenario,
    lessonId: config.lessonId,
    kind: "pushback_one" as const,
    counterpartId: config.counterpartId,
    namedMove: config.namedMove,
    coachedBehaviorId: config.coachedBehaviorId,
    retryDirection: config.retryDirection,
    approvedTranscript: `My approved opening for ${lessonId}.`,
    openingTranscript: `My approved opening for ${lessonId}.`,
    authoredCorpus: approvedRehearsalAuthoredCorpus(config),
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
      const payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      payloads.push(payload);
      const constraints = payload.lesson_constraints as { lesson_id: ApprovedRehearsalLessonId };
      return new Response(JSON.stringify({ mode: "turn", text: groundedReplies[constraints.lesson_id] }), { status: 200 });
    }) as typeof fetch;

    for (const lessonId of lessonIds) {
      const result = await generateApprovedRehearsalDynamicReply(dynamicInput(lessonId));
      expect(result, lessonId).toEqual({ reply: groundedReplies[lessonId] });
    }

    expect(payloads).toHaveLength(lessonIds.length);
    for (const [index, lessonId] of lessonIds.entries()) {
      const config = approvedRehearsalConfig(lessonId)!;
      expect(payloads[index], lessonId).toMatchObject({
        type: "rehearsal_turn",
        turn: "pushback",
        contract: {
          scenario: expect.stringContaining(config.scenario.situation),
          counterpart: config.scenario.counterpart,
          counterpart_persona: config.scenario.persona,
          success_target: config.scenario.goal,
        },
        transcript: { user_turn_1: `My approved opening for ${lessonId}.` },
        avoid_repeating: approvedRehearsalAuthoredCorpus(config),
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
        variation_seed: `run-${lessonId}-${lessonId}-pushback_one-0`,
      });
    }
  });

  test("sends the full exchange when generating Pushback 2", async () => {
    let payload: Record<string, unknown> | undefined;
    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      payload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(JSON.stringify({ mode: "turn", text: "What part of the handoff brief can you commit to before Thursday's review?" }), { status: 200 });
    }) as typeof fetch;
    const base = dynamicInput("m2-l1");
    const config = approvedRehearsalConfig("m2-l1")!;
    const result = await generateApprovedRehearsalDynamicReply({
      ...base, kind: "pushback_two", approvedTranscript: "I still need the whole thing.",
      firstPressure: "I can't do Thursday.", firstResponse: "I still need the whole thing.",
    });
    expect(result).toEqual({ reply: "What part of the handoff brief can you commit to before Thursday's review?" });
    expect(payload).toMatchObject({
      turn: "close",
      transcript: { user_turn_1: base.openingTranscript, counterpart_pushback: "I can't do Thursday.", user_turn_2: "I still need the whole thing." },
      lesson_constraints: { pressure_kind: "pushback_two", first_pressure: "I can't do Thursday.", first_response: "I still need the whole thing." },
      variation_seed: "run-m2-l1-m2-l1-pushback_two-0",
    });
  });

  test("rejects coaching leakage and throws after exactly two unusable model replies", async () => {
    let requests = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      requests += 1;
      return new Response(JSON.stringify({ mode: "turn", text: "Good job, learner. Try saying the named move." }), { status: 200 });
    }) as typeof fetch;
    const input = dynamicInput("m1-l3");

    await expect(generateApprovedRehearsalDynamicReply(input)).rejects.toThrow("unavailable");
    expect(requests).toBe(2);
  });

  test("rejects zero-width authored-corpus variants for every shared lesson", async () => {
    for (const lessonId of lessonIds) {
      let requests = 0;
      const config = approvedRehearsalConfig(lessonId)!;
      const disguised = `${config.authoredPressureText.slice(0, 2)}\u200B${config.authoredPressureText.slice(2)}`;
      globalThis.fetch = (async (): Promise<Response> => {
        requests += 1;
        return new Response(JSON.stringify({ mode: "turn", text: disguised }), { status: 200 });
      }) as typeof fetch;
      await expect(generateApprovedRehearsalDynamicReply(dynamicInput(lessonId))).rejects.toThrow("unavailable");
      expect(requests, lessonId).toBe(2);
    }
  });

  test("rejects Pushback 2 when it duplicates the accepted first pressure", async () => {
    let requests = 0;
    globalThis.fetch = (async (): Promise<Response> => {
      requests += 1;
      return new Response(JSON.stringify({ mode: "turn", text: "I still need you to explain why this belongs to me." }), { status: 200 });
    }) as typeof fetch;
    const base = dynamicInput("m2-l2");
    await expect(generateApprovedRehearsalDynamicReply({
      ...base,
      kind: "pushback_two",
      firstPressure: "I still need you to explain why this belongs to me.",
      firstResponse: "Renee, you have the cash.",
    })).rejects.toThrow("unavailable");
    expect(requests).toBe(2);
  });

  test("rejects provider responses that are unrelated to the lesson scene and exchange", async () => {
    const unrelated = [
      "The spaceship leaves Mars tomorrow. Why should I agree?",
      "My rent doubled yesterday. Why is this my problem?",
      "I disagree. Why?",
      "The spaceship leaves Mars, but the handoff brief is late.",
      "Aliens landed on Mars; anyway, Thursday review.",
    ];
    const input = dynamicInput("m2-l1");
    const groundingContext = `${input.scenario.title} ${input.scenario.situation} ${input.scenario.persona} ${input.scenario.goal} ${input.openingTranscript}`;
    for (const reply of unrelated) {
      expect(approvedRehearsalDynamicReplyPassesQuality(reply, groundingContext), reply).toBe(false);
      let requests = 0;
      globalThis.fetch = (async (): Promise<Response> => {
        requests += 1;
        return new Response(JSON.stringify({ mode: "turn", text: reply }), { status: 200 });
      }) as typeof fetch;
      await expect(generateApprovedRehearsalDynamicReply(input)).rejects.toThrow("unavailable");
      expect(requests, reply).toBe(2);
    }
  });

  test("accepts concise scene-grounded pressure but rejects agreement and instructional text", () => {
    const config = approvedRehearsalConfig("m2-l1")!;
    const groundingContext = `${config.scenario.title} ${config.scenario.situation} ${config.scenario.persona} ${config.scenario.goal}`;
    expect(approvedRehearsalDynamicReplyPassesQuality("I can't finish the whole handoff brief before Thursday's review.", groundingContext)).toBe(true);
    expect(approvedRehearsalDynamicReplyPassesQuality("You're right. I'll do that.", groundingContext)).toBe(false);
    expect(approvedRehearsalDynamicReplyPassesQuality("Try saying the lesson's named move now.", groundingContext)).toBe(false);
  });
});
