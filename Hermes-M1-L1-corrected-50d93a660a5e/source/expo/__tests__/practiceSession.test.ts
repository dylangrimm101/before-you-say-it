import { describe, expect, test } from "bun:test";

import {
  associatePracticeSessionUser,
  createOnboardingPracticeSession,
  createPilotDayRun,
  dayOneResumeState,
  dayThirtyBaseline,
  normalizePracticeSession,
  preserveDayOneRetry,
  preserveOnboardingBaseline,
  preservePilotAttempt,
  protectImmutablePracticeRecords,
  transitionPilotRun,
  upsertPilotDayRun,
  type ActivePracticeSession,
  type DayOneLearningState,
} from "@/lib/practiceSession";
import type { Scenario } from "@/types/convo";

const scenario: Scenario = {
  id: "custom-onboarding",
  category: "partner",
  title: "Ask for a clear next step",
  counterpart: "Adam · practice partner",
  situation: "Discuss a shared responsibility.",
  persona: "Respond with mild defensiveness.",
  goal: "Agree on one next step.",
  opensWith: "user",
  openingLine: "",
  minutes: 4,
  isCustom: true,
};

function activeSession(): ActivePracticeSession {
  const created = createOnboardingPracticeSession(
    "practice-1",
    "anon-stable",
    scenario,
    "Agree on Tuesday.",
    "defensive",
    100,
  );
  return {
    ...preserveOnboardingBaseline(
      created,
      "Can we agree on Tuesday?",
      "Why does it have to be Tuesday?",
      150,
    ),
    coachNote: "Keep one answerable request in view.",
    retryInstruction: "Ask for one action and date.",
    nextState: "focused_coach_note",
    updatedAt: 200,
  };
}

const UNFINISHED_STATES: DayOneLearningState[] = [
  "focused_coach_note",
  "replay_original_adam_response",
  "spoken_retry",
  "confirm_retry_transcript",
  "attempt_comparison",
  "transfer_cue",
  "complete",
];

describe("Day 1 baseline retention", () => {
  test("completion preserves the immutable original baseline and Day 30 reference", () => {
    const original = activeSession();
    const completed = { ...original, nextState: "complete" as const, updatedAt: 500 };
    expect(completed.attemptOne).toEqual(original.attemptOne);
    expect(completed.dayThirtyBaseline?.baseline_attempt_id).toBe(original.attemptOne?.id);
    expect(completed.dayThirtyBaseline?.practiceSessionId).toBe(original.id);
    expect(completed.dayThirtyBaseline?.adam_response_text_reference).toBe(original.originalAdamResponse?.id);
    expect(completed.dayThirtyBaseline?.curriculum_version).toBe(original.moduleVersion);
  });

  test("Day 30 retrieves the confirmed Day 1 baseline", () => {
    const baseline = dayThirtyBaseline({ ...activeSession(), nextState: "complete" });
    expect(baseline?.id).toBe("practice-1-attempt-1");
    expect(baseline?.transcript).toBe("Can we agree on Tuesday?");
    expect(baseline?.representation).toBe("confirmed_transcript");
  });

  test("stores every required baseline pointer and capture condition explicitly", () => {
    const created = createOnboardingPracticeSession("practice-proof", "anon-proof", scenario, "Agree on Tuesday.", "defensive", 100);
    const stored = preserveOnboardingBaseline(created, "Fresh natural opener", "Fixed Adam response", 150, {
      baselineSource: "onboarding",
      scenarioVersion: "generated-onboarding-scenario-v1",
      conversationJobId: "specific-commitment",
      adamReactionId: "defensive",
      semanticAudioKey: "adam_counterpart",
      resolvedAudioId: "practice-proof-adam-response-1",
      reactionLevel: 2,
      turnNumber: 1,
      segment: "opener",
      copyVersion: "BYSI-approved-copy-v3-2026-08-04",
      captureMode: "spoken",
      microphoneUsed: true,
      rawAudioRetention: "not_permitted",
      omittedFields: [],
    });
    expect(stored.dayThirtyBaseline).toEqual({
      id: "practice-proof-day-30-baseline",
      practiceSessionId: "practice-proof",
      baseline_attempt_id: "practice-proof-attempt-1",
      baseline_source: "onboarding",
      scenario_id: "custom-onboarding",
      scenario_version: "generated-onboarding-scenario-v1",
      conversation_job_id: "specific-commitment",
      adam_reaction_id: "defensive",
      adam_response_text_reference: "practice-proof-adam-response-1",
      semantic_audio_key: "adam_counterpart",
      resolved_audio_id: "practice-proof-adam-response-1",
      reaction_level: 2,
      turn_number: 1,
      segment: "opener",
      confirmed_transcript_reference: "practice-proof-attempt-1",
      curriculum_version: "BYSI-days-1-8-v3-2026-08-04",
      copy_version: "BYSI-approved-copy-v3-2026-08-04",
      capture_mode: "spoken",
      capture_conditions: {
        uncoached: true,
        transcript_confirmed: true,
        model_answer_visible: false,
        capture_surface: "onboarding_rehearsal",
        microphone_used: true,
        raw_audio_retention: "not_permitted",
        omitted_fields: [],
      },
      created_at: 150,
      metadata_status: "complete",
    });
    expect(stored.dayThirtyBaseline?.audio_reference).toBeUndefined();
  });

  test("marks a future approved recovery capture as fresh, uncoached, and separate from its retry", () => {
    const created = createOnboardingPracticeSession("recovery-proof", "anon-proof", scenario, "One next step.", "not-sure", 100);
    const baseline = preserveOnboardingBaseline(created, "Fresh recovery opener", "Approved fixed response", 150, {
      baselineSource: "day1_recovery",
      scenarioVersion: "future-approved-preset-v1",
      conversationJobId: null,
      adamReactionId: "future-approved-reaction",
      resolvedAudioId: "future-approved-audio-v1",
      captureMode: "spoken",
      microphoneUsed: true,
      rawAudioRetention: "not_permitted",
      omittedFields: [],
    });
    const retried = preserveDayOneRetry(baseline, "Improved retry", 200);
    expect(baseline.attemptOne?.source).toBe("day_1_recovery_opener");
    expect(baseline.dayThirtyBaseline?.baseline_source).toBe("day1_recovery");
    expect(retried.dayThirtyBaseline?.baseline_attempt_id).toBe(baseline.attemptOne?.id);
    expect(retried.attemptTwo?.id).not.toBe(retried.dayThirtyBaseline?.baseline_attempt_id);
  });

  test("attempt two is separate and can never overwrite attempt one", () => {
    const original = activeSession();
    const withRetry = preserveDayOneRetry(original, "Could we pick Tuesday together?", 300);
    const ignoredOverwrite = preserveDayOneRetry(withRetry, "overwrite attempt", 400);
    expect(withRetry.attemptOne).toEqual(original.attemptOne);
    expect(withRetry.attemptTwo?.id).toBe("practice-1-attempt-2");
    expect(ignoredOverwrite.attemptTwo).toEqual(withRetry.attemptTwo);
    expect(ignoredOverwrite.attemptOne).toEqual(original.attemptOne);
  });

  test("re-preserving the onboarding baseline cannot alter attempt one or Adam's response", () => {
    const original = activeSession();
    const result = preserveOnboardingBaseline(original, "replacement", "replacement response", 999);
    expect(result).toBe(original);
    expect(result.attemptOne?.transcript).toBe("Can we agree on Tuesday?");
    expect(result.originalAdamResponse?.text).toBe("Why does it have to be Tuesday?");
  });

  test("ordinary persistence updates cannot replace immutable records", () => {
    const original = preserveDayOneRetry(activeSession(), "My retry", 300);
    const protectedSession = protectImmutablePracticeRecords(original, {
      ...original,
      attemptOne: { ...original.attemptOne!, transcript: "replacement" },
      attemptTwo: { ...original.attemptTwo!, transcript: "replacement retry" },
    });
    expect(protectedSession.attemptOne).toEqual(original.attemptOne);
    expect(protectedSession.attemptTwo).toEqual(original.attemptTwo);
  });

  test("incremental free-rehearsal turns remain persistable", () => {
    const original = { ...activeSession(), freeRehearsalTurns: [] };
    const nextTurns = [{ id: "turn-1", role: "user" as const, text: "I need help with chores." }];
    const protectedSession = protectImmutablePracticeRecords(original, {
      ...original,
      freeRehearsalTurns: nextTurns,
    });
    expect(protectedSession.freeRehearsalTurns).toEqual(nextTurns);
  });
});

describe("onboarding practice-session continuity", () => {
  test("survives an app restart through strict disk normalization", () => {
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(activeSession())) as unknown);
    expect(restored?.id).toBe("practice-1");
    expect(restored?.anonymousUserId).toBe("anon-stable");
    expect(restored?.attemptOne?.id).toBe("practice-1-attempt-1");
    expect(dayOneResumeState(restored, false)).toBe("focused_coach_note");
  });

  test("migrates schema 3 pointers without fabricating unavailable capture conditions", () => {
    const current = activeSession();
    const legacy = {
      ...current,
      schemaVersion: 3,
      originalAdamResponse: { id: current.originalAdamResponse?.id, text: current.originalAdamResponse?.text },
      dayThirtyBaseline: {
        id: current.dayThirtyBaseline?.id,
        practiceSessionId: current.id,
        attemptOneId: current.attemptOne?.id,
        adamResponseId: current.originalAdamResponse?.id,
        moduleVersion: current.moduleVersion,
      },
    };
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(legacy)) as unknown);
    expect(restored?.schemaVersion).toBe(6);
    expect(restored?.dayThirtyBaseline?.metadata_status).toBe("legacy_partial");
    expect(restored?.dayThirtyBaseline?.scenario_version).toBeNull();
    expect(restored?.dayThirtyBaseline?.conversation_job_id).toBeNull();
    expect(restored?.dayThirtyBaseline?.capture_conditions.microphone_used).toBe(false);
    expect(restored?.dayThirtyBaseline?.capture_conditions.omitted_fields).toContain("capture_mode_verification");
    expect(restored?.dayThirtyBaseline?.capture_conditions.omitted_fields).toContain("audio_reference");
  });

  test("anonymous-to-authenticated association is idempotent", () => {
    const migrated = associatePracticeSessionUser(activeSession(), "user-42", 300);
    const repeated = associatePracticeSessionUser(migrated, "user-42", 900);
    expect(migrated.anonymousUserId).toBe("anon-stable");
    expect(migrated.userId).toBe("user-42");
    expect(repeated).toBe(migrated);
    expect(repeated.updatedAt).toBe(300);
  });

  test("restarting at every unfinished state resumes exactly", () => {
    const session = activeSession();
    UNFINISHED_STATES.forEach((nextState) => {
      const restored = normalizePracticeSession(JSON.parse(JSON.stringify({ ...session, nextState })) as unknown);
      expect(dayOneResumeState(restored, false)).toBe(nextState);
    });
    expect(dayOneResumeState({ ...session, nextState: "transfer_cue" }, true)).toBe("complete");
  });

  test("uses a preset fallback instead of inventing a missing baseline", () => {
    expect(dayOneResumeState(null, false)).toBeNull();
    expect(dayOneResumeState({ ...activeSession(), nextState: "awaiting_onboarding_baseline" }, false)).toBeNull();
  });
});

describe("shared Days 2–8 run persistence", () => {
  test("persists every transition and resumes the exact unfinished state", () => {
    const session = activeSession();
    const run = createPilotDayRun(session, 2, 300);
    const listening = transitionPilotRun(run, "listening_attempt", 310);
    const stored = upsertPilotDayRun(session, listening, 320);
    const restored = normalizePracticeSession(JSON.parse(JSON.stringify(stored)) as unknown);
    expect(restored?.pilotRuns["2"]?.state).toBe("listening_attempt");
  });

  test("keeps opener, response, and retry as separate immutable records", () => {
    const session = activeSession();
    let run = createPilotDayRun(session, 8, 300);
    run = preservePilotAttempt(run, "opener", "Can we talk about bedtime?", 310);
    run = preservePilotAttempt(run, "response", "I hear that. Can we return to Tuesday?", 320);
    run = preservePilotAttempt(run, "retry", "Can you take Tuesday bedtime?", 330);
    const stored = upsertPilotDayRun(session, run, 340);
    const overwrite = upsertPilotDayRun(stored, {
      ...run,
      attempt: { ...run.attempt!, transcript: "replacement" },
      responseAttempt: { ...run.responseAttempt!, transcript: "replacement" },
      retryAttempt: { ...run.retryAttempt!, transcript: "replacement" },
    }, 350);
    expect(overwrite.pilotRuns["8"]?.attempt?.transcript).toBe("Can we talk about bedtime?");
    expect(overwrite.pilotRuns["8"]?.responseAttempt?.transcript).toBe("I hear that. Can we return to Tuesday?");
    expect(overwrite.pilotRuns["8"]?.retryAttempt?.transcript).toBe("Can you take Tuesday bedtime?");
  });

  test("completion is idempotent and impossible before a spoken retry", () => {
    const run = createPilotDayRun(activeSession(), 2, 300);
    expect(transitionPilotRun(run, "complete", 310)).toBe(run);
    const retried = preservePilotAttempt(run, "retry", "Can we decide Tuesday?", 320);
    expect(transitionPilotRun(retried, "complete", 330)).toBe(retried);
    const reviewed = { ...retried, state: "attempt_comparison" as const, comparison: { behaviorId: "conversation_job", text: "First attempt: used six words. Retry: used five words.", criterionChanged: true } };
    expect(transitionPilotRun(reviewed, "complete", 340)).toBe(reviewed);
    const completed = transitionPilotRun(transitionPilotRun(reviewed, "transfer_cue", 350), "complete", 360);
    expect(completed.state).toBe("complete");
    expect(transitionPilotRun(completed, "module_preview", 400)).toBe(completed);
    expect(transitionPilotRun(completed, "complete", 500)).toBe(completed);
  });
});

describe("paid Day 1 sequence and guardrails", () => {
  test("replays the exact original Adam response before enabling the retry", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain('nextState: "replay_original_adam_response"');
    expect(source).toContain("audio_id: session.originalAdamResponse?.id");
    expect(source).toContain('voice_key: "adam_counterpart"');
    expect(source).toContain("disabled={!hasReplayedDayOneAdam}");
    expect(source).not.toContain("nextPilotCounterpart(module, retryText");
  });

  test("implements every named paid state and confirms retry transcripts", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    for (const state of UNFINISHED_STATES) expect(source).toContain(`\"${state}\"`);
    expect(source).toContain('nextState: "confirm_retry_transcript"');
    expect(source).toContain('effectiveState === "confirm_retry_transcript"');
    expect(source).toContain("Does this match what you said?");
    expect(source).toContain("Use this transcript");
  });

  test("free users stop before every curriculum module while preview testers can exercise it", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain("const decision = canContinuePilot(access)");
    expect(source).toContain("if (!decision.allowed)");
    expect(source.indexOf("if (!decision.allowed)")).toBeLessThan(source.indexOf("return (\n    <View style={styles.root}>"));
    expect(source).not.toContain("requiresPaidDayOneCoaching");
  });

  test("never renders Day 1's repeated generic setup form", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain("module.copy.heading");
    expect(source).not.toContain("scenario_setup");
    expect(source).not.toContain("setup_fields");
  });
});

describe("sensitive-content boundaries", () => {
  test("conversation content is excluded from route params and ordinary logs", async () => {
    const routeSources = await Promise.all([
      "onboarding.tsx",
      "scenario/[id].tsx",
      "custom.tsx",
    ].map((file) => Bun.file(`${import.meta.dir}/../app/${file}`).text()));
    const combinedRoutes = routeSources.join("\n");
    expect(combinedRoutes).not.toContain("outcome: goal || scenario.goal");
    expect(combinedRoutes).not.toContain("outcome: profile?.outcome");
    expect(combinedRoutes).not.toContain("outcome: outcome || scenario.goal");
    expect(combinedRoutes).not.toContain("params.outcome");

    const moduleSource = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(moduleSource).not.toContain("console.log");
    expect(moduleSource).not.toContain("console.error");
    expect(moduleSource).not.toContain("console.warn");
  });

  test("creates the practice session before onboarding opens the rehearsal", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("createOnboardingPracticeSession(");
    expect(onboarding.indexOf("saveActivePracticeSession")).toBeLessThan(onboarding.lastIndexOf("router.replace({"));
  });
});
