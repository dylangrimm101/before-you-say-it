import { describe, expect, test } from "bun:test";

import {
  approvedRehearsalCoachNote,
  approvedRehearsalComparison,
  approvedRehearsalConfig,
  approvedRehearsalCriterion,
  approvedRehearsalIndexImpact,
  approvedRehearsalStrongVersion,
  validateApprovedRehearsalCompletion,
} from "@/lib/approvedRehearsals";
import { normalizeConvertedLessonProgress } from "@/lib/convertedLesson";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import type { PilotDayRun } from "@/types/pilotCurriculum";

describe("approved M1 L2-L5 rehearsals", () => {
  test("preserves each deck's authored scene, pressure, move, and card topology", () => {
    const l2 = approvedRehearsalConfig("m1-l2")!;
    const l3 = approvedRehearsalConfig("m1-l3")!;
    const l4 = approvedRehearsalConfig("m1-l4")!;
    const l5 = approvedRehearsalConfig("m1-l5")!;

    expect(l2.contentVersion).toBe("m1-l2-two-pressure-m1-l1-parity-v4-2026-08-29");
    expect(l2.scenario.situation).toBe(
      "Wednesday, end of day. You’re talking with Ravi about who should own final approval before client files are sent. You used yesterday’s late file as an example. Ravi points out that the client didn’t send its revisions until 3, so he doesn’t think yesterday proves the approval process is the problem.\n\nYou know yesterday wasn’t the only issue. Tuesday’s file was also late, another file stalled the week before, the specs have been messy since March, and two coworkers have mentioned similar concerns.",
    );
    expect(l2.authoredPressureText).toBe("Okay, but that's still one example. What else are you basing this on?");
    expect(l2.namedMove).toBe("One anchor. The rest stays in the folder.");
    expect([l2.rehearsalHandoffCard, l2.returnCard, l2.completionCard]).toEqual([20, 21, 22]);

    expect(l3.contentVersion).toBe("m1-l3-detailed-scene-v5-2026-08-29");
    expect(l3.scenario.counterpart).toBe("Renee — your sister");
    expect(l3.scenario.situation).toBe(
      "Sunday evening, you’re on the phone with your sister, Renee. Dad’s March appointments still need to be divided, and you handled the last four. You want to agree on who will take each March appointment before you hang up. Renee has been handling more of Dad’s regular check-in calls and may raise that you haven’t been calling as often.",
    );
    expect(l3.authoredPressureText).toBe("You never even call him.");
    expect(l3.namedMove).toBe("Both on the table. One at a time.");

    expect(l4.contentVersion).toBe("m1-l4-detailed-scene-v5-2026-08-29");
    expect(l4.scenario.counterpart).toBe("Theo");
    expect(l4.scenario.situation).toBe(
      "Thursday night, you’re talking with Theo, your partner, after the house is quiet. Twice this month, Theo agreed to handle school pickup, so you rearranged work around that plan. Both times, he changed the plan after your schedule was already set, leaving you to move meetings again. You want future changes discussed before either of you commits—not to suggest that Theo never considers your schedule.",
    );
    expect(l4.authoredPressureText).toBe("So you're saying I don't think about your schedule.");
    expect([l4.rehearsalHandoffCard, l4.returnCard, l4.completionCard]).toEqual([17, 18, 19]);

    expect(l5.contentVersion).toBe("m1-l5-detailed-scene-v5-2026-08-29");
    expect(l5.scenario.counterpart).toBe("Adam");
    expect(l5.scenario.situation).toBe(
      "Friday night, you’re at the kitchen table with Adam, who shares responsibility for your child’s calendar, after the kid has gone to bed. This month, most of the calendar has fallen to you—including camp signups, the dentist, and both birthday RSVPs. You want several things addressed, but raising all of them at once could leave none of them clear. Choose one purpose for tonight and keep the others for later. Adam has his own read of the month and may question which issue you actually want him to address.",
    );
    expect(l5.authoredPressureText).toBe("Is this you asking, or is this you working up to the signups?");
    expect([l5.rehearsalHandoffCard, l5.returnCard, l5.completionCard]).toEqual([18, 19, 20]);
  });

  test("checks only the named lesson move and produces a scoreless same-moment comparison", () => {
    const l3 = approvedRehearsalConfig("m1-l3")!;
    const before = "That's not true.";
    const after = "I hear that. Let's finish March's appointments, and tomorrow we can talk about calls.";
    expect(approvedRehearsalCriterion(l3, before)).toBe(false);
    expect(approvedRehearsalCriterion(l3, after)).toBe(true);
    expect(approvedRehearsalCoachNote(l3, before)).toMatchObject({
      evidenceQuote: before,
      coachedBehaviorId: "park_and_return",
      coachedBeat: 3,
      selectedDimension: "park_and_return",
      flags: [{ dimension: "park_and_return", status: "not_met", evidenceQuote: before }],
    });
    expect(approvedRehearsalComparison(l3, before, after)).toEqual({
      behaviorId: "park_and_return",
      text: "The retry made “Both on the table. One at a time.” observable. That is the only change Hope checked.",
      criterionChanged: true,
    });
  });

  test("rejects legacy one-pressure completion even when its old identity fields match", () => {
    const config = approvedRehearsalConfig("m1-l4")!;
    const wrapper = createScenarioPracticeRun(config.scenario, "steady", "defensive", "run-l4", 1);
    const run: PilotDayRun = {
      ...wrapper.run,
      convertedModuleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId,
      scenarioContext: { ...wrapper.run.scenarioContext!, counterpartId: config.counterpartId },
      counterpartTurn: {
        id: "run-l4-counterpart-turn-1",
        text: "I changed the plan because things came up. Why are you making this about your whole schedule?",
        source: "provider",
        reactionId: "m1-l4-dynamic-pressure",
        semanticVoiceKey: "contextual_counterpart",
        resolvedAudioId: "scenario-paid-practice-v1-run-l4-counterpart-turn-1",
        authoredAt: 3,
      },
      attempt: { id: "run-l4-opener", kind: "opener", transcript: "The plan changed twice.", representation: "confirmed_transcript", confirmedAt: 2 },
      responseAttempt: { id: "run-l4-response", kind: "response", transcript: "I mean those two changes.", representation: "confirmed_transcript", confirmedAt: 4 },
      coachedBehaviorId: config.coachedBehaviorId,
      coachedSegment: "pushback_response",
      coachingObservation: { coachedBeat: 3, selectedDimension: config.coachedBehaviorId, status: "met", evidenceQuote: "I mean those two changes." },
      retryAttempt: { id: "run-l4-retry", kind: "retry", transcript: "I mean the two changes this month.", representation: "confirmed_transcript", confirmedAt: 5 },
      comparison: { behaviorId: config.coachedBehaviorId, text: "Same criterion.", criterionChanged: false },
      state: "attempt_comparison",
      updatedAt: 5,
    };
    expect(validateApprovedRehearsalCompletion(config, run, "run-l4")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, { ...run, counterpartTurn: { ...run.counterpartTurn!, id: "different-turn" } }, "run-l4")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, run, "other-run")).toBe(false);
  });
});

describe("approved M2 L1-L5 rehearsals", () => {
  test("preserves each deck-specific scene, counterpart cue, move, and Cards 20-22 topology", () => {
    const l1 = approvedRehearsalConfig("m2-l1")!;
    const l2 = approvedRehearsalConfig("m2-l2")!;
    const l3 = approvedRehearsalConfig("m2-l3")!;
    const l4 = approvedRehearsalConfig("m2-l4")!;
    const l5 = approvedRehearsalConfig("m2-l5")!;

    expect(l1.moduleId).toBe("bysi_m02_make_a_clear_ask");
    expect(l1.contentVersion).toBe("m2-l1-detailed-scene-v5-2026-08-29");
    expect(l1.scenario.counterpart).toBe("Maya");
    expect(l1.scenario.situation).toBe(
      "Thursday morning, before standup, you’re speaking with Maya, your teammate who prepares the revised two-page handoff brief for a 4 PM review. The brief has arrived late three weeks in a row, and you’ve mentioned the pattern twice without making a specific request. You need to leave the conversation knowing what Maya can deliver in time for today’s review and by when. Maya may say she cannot finish the whole brief today, so make one clear, answerable ask while leaving room for a real constraint.",
    );
    expect(l1.authoredPressureText).toBe("I can't do Thursday.");
    expect(l1.namedMove).toBe("One action. One owner. Room to answer.");
    expect(l2.contentVersion).toBe("m2-l2-detailed-scene-v5-2026-08-29");
    expect(l2.scenario.counterpart).toBe("Renee — another parent");
    expect(l2.scenario.situation).toBe(
      "Thursday afternoon, outside the school after pickup, you’re standing with Renee, Cory, Angela, and Jen. The group’s cupcake order must be confirmed with the bakery by 5 PM. You already asked whether someone could handle it, but after a pause no one answered. Renee has collected everyone’s cash, while the order is under Jen’s name and card. You need to leave knowing who will take the next answerable action. Address one person directly rather than sending the request back to the group; Renee may ask why the request belongs to her.",
    );
    expect(l2.authoredPressureText).toBe("Why me?");
    expect(l2.namedMove).toBe("Say who you're asking.");
    expect(l3.scenario.counterpart).toBe("Marcus — your brother");
    expect(l3.authoredPressureText).toBe("I can't do a whole Saturday. Theo's got a game and I'm not free till two.");
    expect(l3.namedMove).toBe("Hear it. Trade one thing. Say where it stands.");
    expect(l4.scenario.counterpart).toBe("Sam");
    expect(l4.authoredPressureText).toBe("No, I can't do pickup tomorrow.");
    expect(l4.namedMove).toBe("Say whether no is available.");
    expect(l5.scenario.counterpart).toBe("Sam");
    expect(l5.authoredPressureText).toBe("What counts as at risk?");
    expect(l5.namedMove).toBe("Ask for the loop, not the last step.");

    for (const config of [l1, l2, l3, l4, l5]) {
      expect([config.rehearsalHandoffCard, config.returnCard, config.completionCard]).toEqual([20, 21, 22]);
      expect(config.retryCap).toBe(2);
      expect(config.launchEligible).toBe(false);
    }
  });

  test("checks only each Module 2 named move in scoreless same-moment coaching", () => {
    const cases = [
      ["m2-l1", "No, do everything anyway.", "What part of the brief can you finish by Thursday?"],
      ["m2-l2", "Can somebody handle it?", "Jen, can you confirm the order?"],
      ["m2-l3", "That doesn't help.", "Okay, I hear the game is fixed. Could you take the van after two, so that leaves the morning with me?"],
      ["m2-l4", "But I need you to reconsider.", "Okay. Thanks for telling me."],
      ["m2-l5", "Keep me copied on every step.", "Come back if anything changes what I'd have to do next."],
    ] as const;

    for (const [lessonId, before, after] of cases) {
      const config = approvedRehearsalConfig(lessonId)!;
      expect(approvedRehearsalCriterion(config, before)).toBe(false);
      expect(approvedRehearsalCriterion(config, after)).toBe(true);
      const note = approvedRehearsalCoachNote(config, before);
      expect(note).toMatchObject({
        evidenceQuote: before,
        coachedBehaviorId: config.coachedBehaviorId,
        coachedBeat: 3,
        selectedDimension: config.coachedBehaviorId,
        flags: [{ dimension: config.coachedBehaviorId, status: "not_met", evidenceQuote: before }],
      });
      expect(note.worked).toContain(`“${before}”`);
      expect(note.change).toMatch(/^On the retry,/);
      expect(note.retryDirection).toMatch(/^Replay this exact moment and/);
      const positive = approvedRehearsalCoachNote(config, after);
      expect(positive.flags[0].status).toBe("met");
      expect(positive.worked).toContain(`“${after}”`);
      expect(positive.change).toBe("Keep that same choice in the retry.");
      expect(approvedRehearsalComparison(config, before, after)).toEqual({
        behaviorId: config.coachedBehaviorId,
        text: `The retry made “${config.namedMove}” observable. That is the only change Hope checked.`,
        criterionChanged: true,
      });
    }
  });

  test("rejects a Module 2 legacy run without the second pressure and replay proof", () => {
    const config = approvedRehearsalConfig("m2-l3")!;
    const wrapper = createScenarioPracticeRun(config.scenario, "steady", "defensive", "run-m2-l3", 1);
    const run: PilotDayRun = {
      ...wrapper.run,
      convertedModuleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId,
      scenarioContext: { ...wrapper.run.scenarioContext!, counterpartId: config.counterpartId },
      counterpartTurn: {
        id: "run-m2-l3-counterpart-turn-1",
        text: "I can't give you the whole Saturday. Theo's game is fixed, and two is the earliest I can be there.",
        source: "provider",
        reactionId: "m2-l3-dynamic-pressure",
        semanticVoiceKey: "contextual_counterpart",
        resolvedAudioId: "scenario-paid-practice-v1-run-m2-l3-counterpart-turn-1",
        authoredAt: 3,
      },
      attempt: { id: "run-m2-l3-opener", kind: "opener", transcript: "Can you take Saturday?", representation: "confirmed_transcript", confirmedAt: 2 },
      responseAttempt: { id: "run-m2-l3-response", kind: "response", transcript: "That doesn't help.", representation: "confirmed_transcript", confirmedAt: 4 },
      coachedBehaviorId: config.coachedBehaviorId,
      coachedSegment: "pushback_response",
      coachingObservation: { coachedBeat: 3, selectedDimension: config.coachedBehaviorId, status: "not_met", evidenceQuote: "That doesn't help." },
      retryAttempt: { id: "run-m2-l3-retry", kind: "retry", transcript: "I hear you. Could you take it after two?", representation: "confirmed_transcript", confirmedAt: 5 },
      comparison: { behaviorId: config.coachedBehaviorId, text: "One criterion.", criterionChanged: true },
      state: "attempt_comparison",
      updatedAt: 5,
    };

    expect(validateApprovedRehearsalCompletion(config, run, "run-m2-l3")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, { ...run, convertedModuleId: "bysi_m01_get_to_the_point" }, "run-m2-l3")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, { ...run, counterpartIdentity: "different" }, "run-m2-l3")).toBe(false);
    expect(validateApprovedRehearsalCompletion(config, run, "other-run")).toBe(false);
  });

  test("normalizes Module 2 completion only against its own lesson identity", () => {
    const config = approvedRehearsalConfig("m2-l5")!;
    const completion = {
      lessonId: config.lessonId,
      moduleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      runId: "run-m2-l5",
      lessonCardCheckpoint: config.completionCard,
      quizGatesCompleted: true,
      rehearsalCompleted: true,
      retryCompleted: true,
      comparisonViewed: true,
      savedMoveId: config.namedMoveId,
      transferChoice: "say",
      completedAt: 10,
      sourceLineage: "approved-html-deck-pinned",
    };
    expect(normalizeConvertedLessonProgress([completion])).toHaveLength(1);
    expect(normalizeConvertedLessonProgress([{ ...completion, customWording: approvedRehearsalStrongVersion(config) }])).toHaveLength(1);
    expect(normalizeConvertedLessonProgress([{ ...completion, moduleId: "bysi_m01_get_to_the_point" }])).toHaveLength(0);
    expect(normalizeConvertedLessonProgress([{ ...completion, savedMoveId: "different-move" }])).toHaveLength(0);
  });
});

describe("approved lesson native completion evidence", () => {
  const passingRetry: Readonly<Record<string, string>> = {
    "m1-l2": "Yesterday’s late file is one example. Can we decide who owns approval?",
    "m1-l3": "That’s fair. Let’s finish March’s appointments, and tomorrow we can talk about calls.",
    "m1-l4": "I mean the two plan changes this month, not your schedule overall.",
    "m1-l5": "I’m asking for one thing: decide the current plan tonight.",
    "m2-l1": "What part of the brief can you finish by Friday?",
    "m2-l2": "Jen, can you confirm the order?",
    "m2-l3": "I hear the game is fixed. Could you take the van after two, so that leaves the morning with me?",
    "m2-l4": "Okay. Thanks for telling me.",
    "m2-l5": "Come back if the signup is at risk.",
  };

  function completionRun(lessonId: Parameters<typeof approvedRehearsalConfig>[0], before: string, after: string): PilotDayRun {
    const config = approvedRehearsalConfig(lessonId)!;
    const wrapper = createScenarioPracticeRun(config.scenario, "steady", "defensive", `run-${lessonId}`, 1);
    return {
      ...wrapper.run,
      responseAttempt: { id: `response-${lessonId}`, kind: "response", transcript: before, representation: "confirmed_transcript", confirmedAt: 2 },
      retryAttempt: { id: `retry-${lessonId}`, kind: "retry", transcript: after, representation: "confirmed_transcript", confirmedAt: 3 },
    };
  }

  test("maps every approved lesson to one observed signal and establishes first evidence", () => {
    const expectedSignals = {
      "m1-l2": "specificity",
      "m1-l3": "listening",
      "m1-l4": "steadiness",
      "m1-l5": "clarity",
      "m2-l1": "clarity",
      "m2-l2": "clarity",
      "m2-l3": "listening",
      "m2-l4": "listening",
      "m2-l5": "specificity",
    } as const;
    for (const [lessonId, signalKey] of Object.entries(expectedSignals)) {
      const config = approvedRehearsalConfig(lessonId)!;
      const impact = approvedRehearsalIndexImpact(config, completionRun(lessonId, "No.", passingRetry[lessonId]!), []);
      expect(impact?.signalKey).toBe(signalKey);
      expect(impact?.signalValue).toBe(72);
      expect(impact?.beforeIndex).toBeNull();
      expect(impact?.delta).toBeNull();
      expect(approvedRehearsalStrongVersion(config).length).toBeGreaterThan(30);
    }
  });

  test("supports evidence-based increase, hold, and decrease without completion points", () => {
    const config = approvedRehearsalConfig("m2-l4")!;
    const current = [{ key: "listening" as const, value: 60 }];
    const increased = approvedRehearsalIndexImpact(config, completionRun("m2-l4", "Please reconsider.", passingRetry["m2-l4"]!), current);
    const held = approvedRehearsalIndexImpact(config, completionRun("m2-l4", "Please reconsider.", "No, please reconsider."), current);
    const decreased = approvedRehearsalIndexImpact(config, completionRun("m2-l4", passingRetry["m2-l4"]!, "No, please reconsider."), current);
    expect(increased).toMatchObject({ signalValue: 78, beforeIndex: 60, afterIndex: 78, delta: 18 });
    expect(held).toMatchObject({ signalValue: 60, beforeIndex: 60, afterIndex: 60, delta: 0 });
    expect(decreased).toMatchObject({ signalValue: 48, beforeIndex: 60, afterIndex: 48, delta: -12 });
  });
});
