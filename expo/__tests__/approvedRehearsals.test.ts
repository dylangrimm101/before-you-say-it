import { describe, expect, test } from "bun:test";

import {
  approvedRehearsalCoachNote,
  approvedRehearsalComparison,
  approvedRehearsalConfig,
  approvedRehearsalCriterion,
  validateApprovedRehearsalCompletion,
} from "@/lib/approvedRehearsals";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import type { PilotDayRun } from "@/types/pilotCurriculum";

describe("approved M1 L2-L5 rehearsals", () => {
  test("preserves each deck's authored scene, pressure, move, and card topology", () => {
    const l2 = approvedRehearsalConfig("m1-l2")!;
    const l3 = approvedRehearsalConfig("m1-l3")!;
    const l4 = approvedRehearsalConfig("m1-l4")!;
    const l5 = approvedRehearsalConfig("m1-l5")!;

    expect(l2.scenario.situation).toContain("Wednesday, end of day");
    expect(l2.authoredPressureText).toBe("Okay, but that's still one example. What else are you basing this on?");
    expect(l2.namedMove).toBe("One anchor. The rest stays in the folder.");
    expect([l2.rehearsalHandoffCard, l2.returnCard, l2.completionCard]).toEqual([20, 21, 22]);

    expect(l3.scenario.counterpart).toBe("Renee — your sister");
    expect(l3.authoredPressureText).toBe("You never even call him.");
    expect(l3.namedMove).toBe("Both on the table. One at a time.");

    expect(l4.scenario.counterpart).toBe("Theo");
    expect(l4.authoredPressureText).toBe("So you're saying I don't think about your schedule.");
    expect([l4.rehearsalHandoffCard, l4.returnCard, l4.completionCard]).toEqual([17, 18, 19]);

    expect(l5.scenario.counterpart).toBe("Adam");
    expect(l5.authoredPressureText).toBe("Is this you asking, or is this you working up to the signups?");
    expect([l5.rehearsalHandoffCard, l5.returnCard, l5.completionCard]).toEqual([18, 19, 20]);
  });

  test("checks only the named lesson move and produces a scoreless same-moment comparison", () => {
    const l3 = approvedRehearsalConfig("m1-l3")!;
    const before = "That's not true.";
    const after = "I hear that. Let's finish March's appointments, and tomorrow we can talk about calls.";
    expect(approvedRehearsalCriterion(l3, before)).toBe(false);
    expect(approvedRehearsalCriterion(l3, after)).toBe(true);
    expect(approvedRehearsalCoachNote(l3, before).note).toContain("checking no other behavior");
    expect(approvedRehearsalComparison(l3, before, after)).toEqual({
      behaviorId: "park_and_return",
      text: "The retry made “Both on the table. One at a time.” observable. That is the only change Hope checked.",
      criterionChanged: true,
    });
  });

  test("accepts completion only for the exact run, manifest, counterpart, and authored pressure", () => {
    const config = approvedRehearsalConfig("m1-l4")!;
    const wrapper = createScenarioPracticeRun(config.scenario, "steady", "defensive", "run-l4", 1);
    const run: PilotDayRun = {
      ...wrapper.run,
      convertedModuleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId,
      scenarioContext: { ...wrapper.run.scenarioContext!, counterpartId: config.counterpartId },
      counterpartTurn: { id: "pressure", text: config.authoredPressureText, source: "authored", authoredAt: 3 },
      attempt: { id: "run-l4-opener", kind: "opener", transcript: "The plan changed twice.", representation: "confirmed_transcript", confirmedAt: 2 },
      responseAttempt: { id: "run-l4-response", kind: "response", transcript: "I mean those two changes.", representation: "confirmed_transcript", confirmedAt: 4 },
      retryAttempt: { id: "run-l4-retry", kind: "retry", transcript: "I mean the two changes this month.", representation: "confirmed_transcript", confirmedAt: 5 },
      comparison: { behaviorId: config.coachedBehaviorId, text: "Same criterion.", criterionChanged: false },
      state: "attempt_comparison",
      updatedAt: 5,
    };
    expect(validateApprovedRehearsalCompletion(config, run, "run-l4")).toBe(true);
    expect(validateApprovedRehearsalCompletion(config, { ...run, counterpartTurn: { ...run.counterpartTurn!, text: "Different line" } }, "run-l4")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, run, "other-run")).toBe(false);
  });
});
