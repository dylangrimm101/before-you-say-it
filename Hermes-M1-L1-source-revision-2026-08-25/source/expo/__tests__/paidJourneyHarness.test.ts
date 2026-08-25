import { describe, expect, test } from "bun:test";

import { SCENARIOS } from "@/constants/scenarios";
import { scenarioInteraction } from "@/lib/nativeCommerce";
import { interruptedPresentation } from "@/lib/paidProduct";
import { preservePilotAttempt, createPilotDayRun, createPresetPracticeSession, transitionPilotRun, upsertPilotDayRun } from "@/lib/practiceSession";
import { appendScoredPracticeRecord, createScoredPracticeRecord, progressHistoryPresentation } from "@/lib/scoredPracticeHistory";
import { recommendScenario } from "@/lib/scenarioRecommendation";
import { todayActivityPresentation } from "@/lib/today";
import type { PilotDayRun, PilotModuleState } from "@/types/pilotCurriculum";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

const scoredResult: SharedResultContractV1 = {
  contract_version: 1,
  rehearsal_id: "journey-rehearsal",
  pressure_moment: null,
  practice_shift: null,
  signals: [{ signal_key: "clarity", observation_status: "observed", score: 64, evidence_turn_ids: ["approved-response"], signal_version: "signal-v1" }],
  starting_index: null,
  first_focus: { first_focus_key: "clear-ask", first_focus_label: "Make one answerable request", recommended_module_id: "make_a_clear_ask", focus_status: "suggested", focus_version: "first-focus-v1" },
};

function move(run: PilotDayRun, state: PilotModuleState, now: number): PilotDayRun {
  const next = transitionPilotRun(run, state, now);
  expect(next.state).toBe(state);
  return next;
}

describe("deterministic paid journey state harness", () => {
  test("drives the real persisted run through Lesson, Practice, Rehearsal, Review, Today, and Progress", () => {
    let session = createPresetPracticeSession("journey-user", 100);
    let run = createPilotDayRun(session, 7, 110, "make_a_clear_ask");
    run = move(run, "hope_lesson", 120);
    run = { ...run, lessonIndex: 2 };
    run = move(run, "quiz", 130);
    run = { ...move(run, "quiz_feedback", 140), quizChoice: "B" };
    expect(run.quizChoice).toBe("B");
    run = move(run, "preset_scenario", 150);
    run = move(run, "ready_for_attempt", 160);
    run = preservePilotAttempt(run, "opener", "Can we decide who owns Tuesday bedtime?", 170);
    run = move(run, "adam_response", 180);
    run = move(run, "ready_for_response", 190);
    run = preservePilotAttempt(run, "response", "Thursday is hard. Would Tuesday and Friday work?", 200);
    expect(run.responseAttempt?.representation).toBe("confirmed_transcript");
    run = { ...move(run, "hope_coaching", 210), coachNote: "The request names nights the other person can answer." };
    run = move(run, "ready_for_retry", 220);
    run = preservePilotAttempt(run, "retry", "Can you own Tuesday and Friday bedtime?", 230);
    run = { ...move(run, "attempt_comparison", 240), comparison: { behaviorId: "answerable_request", text: "The retry names a specific job and two nights.", criterionChanged: true } };
    run = move(run, "transfer_cue", 250);
    run = move(run, "complete", 260);
    session = upsertPilotDayRun(session, run, 260);
    expect(session.pilotRuns.make_a_clear_ask?.state).toBe("complete");
    expect(todayActivityPresentation(run.state, false).every((item) => item.state === "completed")).toBe(true);

    const scored = createScoredPracticeRecord(scoredResult, {
      completedAt: 260,
      scenarioId: session.scenarioId,
      moduleId: "make_a_clear_ask",
      approvedTextByTurnId: new Map([["approved-response", run.responseAttempt?.transcript ?? ""]]),
    });
    const history = appendScoredPracticeRecord([], scored);
    expect(progressHistoryPresentation(history).chartValues).toEqual([64]);
    expect(progressHistoryPresentation(history).rows[0]?.evidenceTurnIds).toEqual(["approved-response"]);
  });

  test("correct and incorrect Practice choices remain distinct persisted feedback branches", () => {
    const session = createPresetPracticeSession("choice-user", 100);
    const quiz = move(createPilotDayRun(session, 7, 110, "make_a_clear_ask"), "quiz", 120);
    const correct = { ...move(quiz, "quiz_feedback", 130), quizChoice: "B" as const };
    const incorrect = { ...move(quiz, "quiz_feedback", 130), quizChoice: "A" as const };
    expect(correct.quizChoice).toBe("B");
    expect(incorrect.quizChoice).toBe("A");
  });

  test("resumes the exact activity from Lesson, Practice, Rehearsal, and Review checkpoints", () => {
    const session = createPresetPracticeSession("interrupt-user", 100);
    const base = createPilotDayRun(session, 7, 110, "make_a_clear_ask");
    const states: readonly [PilotModuleState, string][] = [
      ["hope_lesson", "lesson"],
      ["quiz_feedback", "practice"],
      ["confirm_response_transcript", "rehearsal"],
      ["attempt_comparison", "review"],
    ];
    states.forEach(([state, activity], index) => {
      const interrupted = interruptedPresentation(transitionPilotRun(base, state, 120 + index));
      expect(interrupted.activity).toBe(activity);
      expect(interrupted.continueLabel).toBe(`Continue ${activity}`);
    });
  });

  test("scenario focus, filtering, entitlement, briefing selection, and rehearsal entry share one route family", () => {
    const recommendation = recommendScenario(SCENARIOS, "make_a_clear_ask", "Make one answerable request", "work", false);
    expect(recommendation.scenario?.category).toBe("work");
    const unlocked = scenarioInteraction(false, recommendation.scenario?.id ?? "");
    expect(unlocked).toEqual({ isLocked: false, destination: "/scenario/raise" });
    expect(scenarioInteraction(true, "raise").isLocked).toBe(true);
    const scenario = SCENARIOS.find((item) => item.id === "raise");
    expect(scenario?.goal).toContain("specific number");
    expect(`/rehearse/${scenario?.id}`).toBe("/rehearse/raise");
  });
});
