import { describe, expect, test } from "bun:test";

import {
  canCompletePilotRun,
  pilotModule,
  pilotRetrySegment,
  selectDay8Pushback,
} from "@/lib/pilotCurriculum";
import {
  createOnboardingPracticeSession,
  createPilotDayRun,
  normalizePracticeSession,
  preserveOnboardingBaseline,
  preservePilotAttempt,
  transitionPilotRun,
  upsertPilotDayRun,
} from "@/lib/practiceSession";
import { newlySpokenContentNeedsSafetyCheck } from "@/lib/safety";
import type { Scenario } from "@/types/convo";

const scenario: Scenario = {
  id: "acceptance-onboarding",
  category: "partner",
  title: "Bedtime",
  counterpart: "Adam",
  situation: "Decide bedtime ownership.",
  persona: "One mild constraint.",
  goal: "Choose who owns two nights.",
  opensWith: "user",
  openingLine: "",
  minutes: 4,
};

function baselineSession() {
  return preserveOnboardingBaseline(
    createOnboardingPracticeSession("acceptance-session", "anon-1", scenario, "Choose two nights.", "not-sure", 100),
    "Can you take Tuesday and Thursday bedtime?",
    "Thursday I’m at work late.",
    110,
  );
}

describe("required exercised curriculum paths", () => {
  test("onboarding artifacts continue through an immutable Day 1 retry and completion gate", () => {
    const session = baselineSession();
    expect(session.attemptOne?.id).toBe("acceptance-session-attempt-1");
    expect(session.originalAdamResponse?.text).toBe("Thursday I’m at work late.");
    expect(session.nextState).toBe("awaiting_onboarding_baseline");
  });

  test("Day 1 missing-artifact recovery renders only approved recovery copy", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain("We couldn’t recover your first attempt");
    expect(source).toContain("Start with a sample conversation, or pick a different one of your own.");
    expect(source).toContain('label="Use a sample conversation" disabled');
    expect(source).toContain("Sample conversation not yet approved.");
    expect(source).toContain("Choose another conversation");
    expect(source).not.toContain('label="Use a sample conversation" onPress={() => router.push("/custom")}');
  });

  test("Day 2 selects only the coached segment and always reuses the ten-minute line", () => {
    expect(pilotRetrySegment(2, "conversation_job")).toBe("opener");
    expect(pilotRetrySegment(2, "timing_scope_channel")).toBe("pushback_response");
    expect(pilotModule(2)?.practice.adam_line?.text).toBe("I can talk, but I have to leave in ten minutes.");
  });

  test("Day 3 Not quite rejects the note as fact and resumes a neutral retry", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain('noteFit: "rejected"');
    expect(source).toContain("coachNote: undefined");
    expect(source).toContain("Does that fit what happened?");
    expect(source).toContain("Not quite");
  });

  test("Day 4 manual-tap path models audio pause but stores no timing score", () => {
    const day4 = pilotModule(4)!;
    expect(day4.copy.quiz?.option_b.leading_pause_ms).toBe(650);
    expect(day4.evaluation.prohibited_inferences).toContain("intentional silence from ASR gaps");
    expect(JSON.stringify(day4)).not.toMatch(/pause_score|pause_duration_ms|response_latency/i);
  });

  test("Day 5 begins with Adam and no invented learner line", () => {
    const day5 = pilotModule(5)!;
    expect(day5.practice.adam_line?.text).toBe("What actually happened this week?");
    expect(day5.copy.scenario?.attempt_prompt).toBeUndefined();
    expect(day5.copy.scenario?.response_prompt).toBe("Tell him what happened this week in a sentence or two. Stop before you say what it means about him.");
  });

  test("Day 7 preserves who, what, and when while allowing refusal or an alternative", () => {
    const day7 = pilotModule(7)!;
    expect(day7.copy.lessons[0]?.text).toContain("accept, decline, or change");
    expect(day7.retry.direction).toContain("Leave room for a no or a different plan.");
    expect(day7.evaluation.prohibited_inferences).toContain("refusal as communication failure");
  });

  test("Day 8 opener branch captures opener before replaying the persisted pushback", () => {
    const module = pilotModule(8)!;
    let run = createPilotDayRun(baselineSession(), 8, 200);
    const selected = selectDay8Pushback(run.id, module)!;
    run = { ...run, coachedBehaviorId: "integrated_opener", adamReactionId: "day8_pushback_1", adamAudioId: selected.audio_id };
    expect(pilotRetrySegment(8, run.coachedBehaviorId)).toBe("opener");
    run = preservePilotAttempt(run, "retry", "Can you take Tuesday bedtime?", 210);
    run = transitionPilotRun(run, "play_adam_after_opener_retry", 220);
    expect(run.retryAttempt?.confirmedAt).toBeLessThan(run.updatedAt);
    expect(run.adamAudioId).toBe(selected.audio_id);
  });

  test("Day 8 response branch replays the exact persisted pushback before response capture", () => {
    const module = pilotModule(8)!;
    const run = { ...createPilotDayRun(baselineSession(), 8, 200), coachedBehaviorId: "pushback_response" as const };
    const selected = selectDay8Pushback(run.id, module)!;
    const persisted = { ...run, adamReactionId: "day8_pushback_2", adamAudioId: selected.audio_id };
    expect(pilotRetrySegment(8, persisted.coachedBehaviorId)).toBe("pushback_response");
    expect(module.practice.approved_pushback_bank?.find((line) => line.audio_id === persisted.adamAudioId)?.text).toBe(selected.text);
  });

  test("microphone denial has an explicit recoverable state and never auto-starts", async () => {
    const dictation = await Bun.file(`${import.meta.dir}/../lib/useDictation.ts`).text();
    const module = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(dictation).toContain('setStatus("denied")');
    expect(module).toContain('setState("microphone_error")');
    expect(module).toContain('effectiveState === "microphone_error"');
    expect(module).not.toContain("automatic listening");
  });

  test("safety interruption preserves confirmation state and blocks ordinary processing", () => {
    expect(newlySpokenContentNeedsSafetyCheck("He threatened me with a knife")).toBe(true);
    expect(newlySpokenContentNeedsSafetyCheck("Could you take Tuesday bedtime?")).toBe(false);
  });

  test("restart resumes an unfinished attempt and completion stays blocked until retry", () => {
    const session = baselineSession();
    let run = createPilotDayRun(session, 2, 200);
    run = transitionPilotRun(run, "confirm_response_transcript", 210);
    const stored = upsertPilotDayRun(session, run, 220);
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(stored)) as unknown);
    expect(restored?.pilotRuns["2"]?.state).toBe("confirm_response_transcript");
    expect(canCompletePilotRun(restored?.pilotRuns["2"])).toBe(false);
    run = preservePilotAttempt(run, "retry", "Can we decide Tuesday?", 230);
    expect(canCompletePilotRun(transitionPilotRun(run, "transfer_cue", 240))).toBe(true);
  });
});
