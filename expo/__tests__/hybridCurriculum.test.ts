import { describe, expect, test } from "bun:test";

import {
  CURRICULUM_MODULES,
  DESIRED_SKILLS,
  RECURRING_PROBLEMS,
  curriculumModule,
  isModuleId,
  practiceDayForRoute,
} from "@/constants/modules";
import { conversionEvidence, selectFocusSkill } from "@/lib/conversion";
import { createOnboardingPracticeSession, createPilotDayRun, createPracticeSessionId, upsertPilotDayRun } from "@/lib/practiceSession";
import type { Debrief, Scenario, Turn } from "@/types/convo";

const scenario: Scenario = {
  id: "hybrid-scenario",
  category: "work",
  title: "Ask for ownership",
  counterpart: "A coworker",
  situation: "You need one deadline owner.",
  persona: "Respond to the request with mild resistance.",
  goal: "Name one owner and date.",
  openingLine: "",
  opensWith: "user",
  minutes: 5,
};

const debrief: Debrief = {
  headline: "The request stayed open.",
  scores: { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 },
  wins: ["You named the deadline."],
  flags: [{ quote: "Could we maybe decide soon?", issue: "The request has no owner or date.", reframe: "Can you own this by Friday?" }],
  script: ["Can you own this by Friday?"],
  nextRep: "Make one specific request.",
};

const turns: Turn[] = [
  { id: "u1", role: "user", text: "Could we maybe decide soon?" },
  { id: "t1", role: "them", text: "I need more time." },
  { id: "u2", role: "user", text: "What date would work?" },
  { id: "t2", role: "them", text: "Maybe next week." },
];

describe("hybrid onboarding curriculum contract", () => {
  test("defines four blocks and the exact eight module taxonomy", () => {
    expect(CURRICULUM_MODULES).toHaveLength(8);
    expect(new Set(CURRICULUM_MODULES.map((module) => module.block))).toEqual(new Set([1, 2, 3, 4]));
    expect(CURRICULUM_MODULES.map((module) => module.id)).toEqual([
      "get_to_the_point",
      "make_a_clear_ask",
      "start_the_conversation",
      "listen_and_respond",
      "stay_clear_under_pushback",
      "pause_say_no_boundary",
      "repair_what_went_wrong",
      "use_it_in_real_life",
    ]);
  });

  test("maps both diagnosis entry routes into module hypotheses", () => {
    expect(RECURRING_PROBLEMS).toHaveLength(7);
    expect(DESIRED_SKILLS).toHaveLength(7);
    [...RECURRING_PROBLEMS, ...DESIRED_SKILLS].forEach((option) => expect(isModuleId(option.moduleId)).toBe(true));
  });

  test("routes module identifiers into the reused daily practice engine", () => {
    CURRICULUM_MODULES.forEach((module) => {
      expect(curriculumModule(module.id)?.name).toBe(module.name);
      expect(practiceDayForRoute(module.id)).toBeNull();
    });
  });

  test("uses only an exact contiguous confirmed quote", () => {
    const evidence = conversionEvidence(turns, debrief, "start_the_conversation");
    expect(evidence.learnerQuote).toBe("Could we maybe decide soon?");
    expect(evidence.confidence).toBe("confirmed_quote");
    const unreliable = conversionEvidence(turns, { ...debrief, flags: [{ ...debrief.flags[0]!, quote: "words never spoken" }] });
    expect(unreliable.learnerQuote).toBe("");
    expect(unreliable.confidence).toBe("uncertain");
  });

  test("observed wording can change the intake hypothesis", () => {
    expect(selectFocusSkill(debrief, "start_the_conversation").id).toBe("make_a_clear_ask");
  });

  test("keeps separate practice runs when two modules reuse an approved practice", () => {
    const session = createOnboardingPracticeSession(createPracticeSessionId(1, 0), "anon", scenario, scenario.goal, "not-sure", 1, {
      entryRoute: "desired_skill",
      provisionalModuleId: "repair_what_went_wrong",
      persona: "woman-hope",
    });
    const repair = createPilotDayRun(session, 8, 2, "repair_what_went_wrong");
    const transfer = createPilotDayRun(session, 8, 3, "use_it_in_real_life");
    const stored = upsertPilotDayRun(upsertPilotDayRun(session, repair), transfer);
    expect(stored.pilotRuns.repair_what_went_wrong?.id).not.toBe(stored.pilotRuns.use_it_in_real_life?.id);
  });
});
