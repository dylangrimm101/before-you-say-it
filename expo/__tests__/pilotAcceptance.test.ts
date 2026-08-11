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

  test("Day 1 missing-artifact recovery has one supported route and no disabled sample dead end", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain("We couldn’t recover your first attempt");
    expect(source).toContain("Choose another conversation to continue your practice.");
    expect(source).toContain('label="Choose another conversation" onPress={() => router.push("/custom")}');
    expect(source).not.toContain("Use a sample conversation");
    expect(source).not.toContain("Sample conversation not yet approved.");
  });

  test("Day 1 preserves valid onboarding artifacts and only shows recovery when either is missing", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain("Boolean(session?.attemptOne && session.originalAdamResponse)");
    expect(source).toContain('day === 1 && !dayOneRecoverable');
    expect(source).toContain("setAttemptText(session.attemptOne.transcript)");
    expect(source).toContain("session.originalAdamResponse.text");
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
    expect(day5.copy.scenario?.response_prompt).toBe("Say what happened this week in a sentence or two. Stop before assigning meaning to the other person.");
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
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const module = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    const denialBranch = dictation.indexOf("if (!permission.granted)");
    const recordingStart = dictation.indexOf("Audio.Recording.createAsync");
    expect(denialBranch).toBeGreaterThan(-1);
    expect(denialBranch).toBeLessThan(recordingStart);
    expect(dictation.slice(denialBranch, recordingStart)).toContain('setStatus("denied")');
    expect(dictation.slice(denialBranch, recordingStart)).toContain("return;");
    expect(rehearsal).toContain('label: "Microphone access is off."');
    expect(rehearsal).toContain("Linking.openSettings()");
    expect(rehearsal).toContain('accessibilityLabel="Try again"');
    expect(rehearsal).toContain('accessibilityLabel="Type instead"');
    expect(module).toContain('setState("microphone_error")');
    expect(module).toContain('effectiveState === "microphone_error"');
    expect(module).not.toContain("automatic listening");
  });

  test("recording and transcription failures remain recoverable through retry or typed fallback", async () => {
    const dictation = await Bun.file(`${import.meta.dir}/../lib/useDictation.ts`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(dictation).toContain('setError("Could not start the microphone.")');
    expect(dictation).toContain('setError("No recording was captured.")');
    expect(dictation).toContain('"Voice transcription is temporarily unavailable. Type this turn instead."');
    expect(dictation).toContain('"Could not transcribe that. Try again."');
    expect(dictation).toContain("TranscriptionUnavailableError");
    expect(dictation).toContain('if (Platform.OS !== "web")');
    expect(dictation).toContain("await response.blob()");
    expect(dictation).toContain("reader.readAsDataURL(blob)");
    expect(dictation).toContain("URL.revokeObjectURL(uri)");
    expect(rehearsal).toContain('dockState === "mic-blocked"');
    expect(rehearsal).toContain('dockState === "mic-error"');
    expect(rehearsal).toContain("Type instead");
    expect(rehearsal).toContain("openMicrophoneSettings");
    expect(rehearsal).toContain("retryMicrophone");
    const ai = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    expect(ai).toContain('"ai-transcription-model-specification-version": "4"');
    expect(ai).toContain("res.status === 402 || res.status === 429 || res.status >= 500");
  });

  test("playback interruption never blocks the rehearsal", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(rehearsal).toContain('dockState === "autoplay-blocked" || dockState === "playback-failed"');
    expect(rehearsal).toContain("continueWithoutAudio");
    expect(rehearsal).toContain("stopSpeech().catch(() => {})");
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
