import { hasCanonicalM1L1PressureSequence, isCanonicalM1L1PressureTurn } from "@/lib/convertedLesson";
import { comparePilotAttempts } from "@/lib/pilotCurriculum";
import { preservePilotAttempt, transitionPilotRun } from "@/lib/practiceSession";
import type { Difficulty, ReactionPattern, Scenario } from "@/types/convo";
import type {
  PilotBehaviorId,
  PilotDayRun,
  PilotModuleState,
  ScenarioCounterpartTurn,
  ScenarioPracticeContext,
} from "@/types/pilotCurriculum";

const SCENARIO_RUN_VERSION = 1 as const;
const SCENARIO_DAY = 7;
const SCENARIO_CURRICULUM_VERSION = "scenario-paid-practice-v1";
const SCENARIO_STATES: ReadonlySet<PilotModuleState> = new Set([
  "ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "ready_for_response",
  "listening_response", "confirm_response_transcript", "ready_for_second_pressure", "ready_for_second_response",
  "listening_second_response", "confirm_second_response_transcript", "hope_coaching", "ready_for_retry",
  "listening_retry", "confirm_retry_transcript", "final_retry_available", "ready_for_final_retry_capture",
  "listening_final_retry", "confirm_final_retry_transcript", "attempt_comparison", "transfer_cue", "complete",
  "network_error", "model_error",
]);

export interface PersistedScenarioPracticeRun {
  version: typeof SCENARIO_RUN_VERSION;
  run: PilotDayRun;
}

export interface ScenarioCounterpartPresentation {
  name: string;
  role: string;
  text: string;
  continuityLabel: "Same pressure moment";
  accessibilityLabel: string;
}

export type ScenarioPracticePresentation =
  | {
      isAvailable: false;
      title: "This scenario run is unavailable.";
      body: "Return to Scenarios and start a fresh rehearsal. No generic practice fixture was substituted.";
    }
  | {
      isAvailable: true;
      counterpart?: ScenarioCounterpartPresentation;
    };

const UNAVAILABLE_PRESENTATION: ScenarioPracticePresentation = {
  isAvailable: false,
  title: "This scenario run is unavailable.",
  body: "Return to Scenarios and start a fresh rehearsal. No generic practice fixture was substituted.",
};

function counterpartParts(label: string): { name: string; role: string } {
  const [head, ...tail] = label.split(/[—–]/).map((part) => part.trim()).filter(Boolean);
  return {
    name: head || label.trim(),
    role: tail.join(" — ") || "conversation counterpart",
  };
}

/** Creates a scenario run by adding immutable context to the canonical paid-practice state machine. */
export function createScenarioPracticeRun(
  scenario: Scenario,
  difficulty: Difficulty,
  reaction: ReactionPattern,
  id: string,
  now: number = Date.now(),
): PersistedScenarioPracticeRun {
  const parts = counterpartParts(scenario.counterpart);
  const context: ScenarioPracticeContext = {
    scenarioId: scenario.id,
    category: scenario.category,
    title: scenario.title,
    situation: scenario.situation,
    objective: scenario.goal,
    difficulty,
    reaction,
    counterpartId: `${scenario.id}-counterpart`,
    counterpartName: parts.name,
    counterpartLabel: scenario.counterpart,
    counterpartRole: parts.role,
  };
  return {
    version: SCENARIO_RUN_VERSION,
    run: {
      id,
      day: SCENARIO_DAY,
      curriculumVersion: SCENARIO_CURRICULUM_VERSION,
      state: "ready_for_attempt",
      scenarioMode: scenario.isCustom ? "carried_context" : "preset",
      scenarioContext: context,
      lessonIndex: 0,
      createdAt: now,
      updatedAt: now,
    },
  };
}

/** Restores only complete, internally consistent scenario runs; malformed data fails closed. */
export function normalizeScenarioPracticeRun(value: unknown): PersistedScenarioPracticeRun | null {
  if (!value || typeof value !== "object") return null;
  const wrapper = value as Partial<PersistedScenarioPracticeRun>;
  const run = wrapper.run;
  const context = run?.scenarioContext;
  if (wrapper.version !== SCENARIO_RUN_VERSION || !run || !context) return null;
  const requiredContext = [
    context.scenarioId,
    context.category,
    context.title,
    context.situation,
    context.objective,
    context.difficulty,
    context.reaction,
    context.counterpartId,
    context.counterpartName,
    context.counterpartLabel,
    context.counterpartRole,
  ];
  if (requiredContext.some((item) => typeof item !== "string" || item.trim().length === 0)) return null;
  if (!run.id || typeof run.createdAt !== "number" || typeof run.updatedAt !== "number" || !SCENARIO_STATES.has(run.state)) return null;
  if (!["partner", "family", "work", "friends"].includes(context.category)) return null;
  if (!["gentle", "steady", "challenging"].includes(context.difficulty)) return null;
  if (run.counterpartTurn && (!run.counterpartTurn.id || !run.counterpartTurn.text || !["provider", "authored"].includes(run.counterpartTurn.source))) return null;
  if ((run.responseAttempt || run.retryAttempt || run.comparison) && !run.counterpartTurn) return null;
  if (run.m1L1) {
    const lesson = run.m1L1;
    if (!hasCanonicalM1L1PressureSequence(run)) return null;
    if (!Number.isInteger(lesson.beat) || lesson.beat < 1 || lesson.beat > 8) return null;
    if (!Number.isInteger(lesson.retryCount) || lesson.retryCount < 0 || lesson.retryCount > 2) return null;
    if (lesson.pushbackOne && !isCanonicalM1L1PressureTurn(lesson.pushbackOne, "pushback_one")) return null;
    if (lesson.pushbackTwo && !isCanonicalM1L1PressureTurn(lesson.pushbackTwo, "evidence_trap")) return null;
    if ((lesson.secondResponseAttempt || lesson.coachedBeat || lesson.retryCount > 0) && (!lesson.pushbackOne || !lesson.pushbackTwo)) return null;
    if (lesson.pushbackOne && (!run.attempt || !(run.attempt.confirmedAt < (lesson.pushbackOne.authoredAt ?? 0)))) return null;
    if (lesson.pushbackTwo && (!run.responseAttempt || !lesson.pushbackOne || !((lesson.pushbackOne.authoredAt ?? 0) < run.responseAttempt.confirmedAt && run.responseAttempt.confirmedAt < (lesson.pushbackTwo.authoredAt ?? 0)))) return null;
    if (lesson.secondResponseAttempt && (!lesson.pushbackTwo || !((lesson.pushbackTwo.authoredAt ?? 0) < lesson.secondResponseAttempt.confirmedAt))) return null;
    if (lesson.finalRetryAttempt && (!lesson.finalRetryPressureReplayedAt || lesson.finalRetryPressureAudioId !== (lesson.coachedBeat === 3 ? lesson.pushbackOne?.resolvedAudioId : lesson.pushbackTwo?.resolvedAudioId))) return null;
  }
  return wrapper as PersistedScenarioPracticeRun;
}

/** Returns this run only for its exact route identity; no fixture fallback is permitted. */
export function scenarioRunForRoute(value: unknown, scenarioId: string): PersistedScenarioPracticeRun | null {
  const normalized = normalizeScenarioPracticeRun(value);
  return normalized?.run.scenarioContext?.scenarioId === scenarioId ? normalized : null;
}

/** Advances one canonical state while preserving the immutable scenario and counterpart turn. */
export function transitionScenarioPracticeRun(
  value: PersistedScenarioPracticeRun,
  state: PilotModuleState,
  now: number,
): PersistedScenarioPracticeRun {
  return { ...value, run: transitionPilotRun(value.run, state, Math.max(now, value.run.updatedAt + 1)) };
}

/** Stores one approved transcript using the canonical immutable-attempt helper. */
export function preserveScenarioAttempt(
  value: PersistedScenarioPracticeRun,
  kind: "opener" | "response" | "retry",
  transcript: string,
  now: number,
): PersistedScenarioPracticeRun {
  const minimum = kind === "response" && value.run.m1L1?.pushbackOne?.authoredAt
    ? value.run.m1L1.pushbackOne.authoredAt + 1
    : now;
  const confirmedAt = Math.max(now, minimum);
  return { ...value, run: preservePilotAttempt(value.run, kind, transcript, confirmedAt) };
}

/** Attaches the one pressure turn that both attempts must answer. */
export function attachScenarioCounterpartTurn(
  value: PersistedScenarioPracticeRun,
  turn: ScenarioCounterpartTurn,
  now: number,
): PersistedScenarioPracticeRun {
  if (value.run.counterpartTurn) return value;
  return { ...value, run: { ...value.run, counterpartTurn: turn, adamReactionId: turn.id, adamAudioId: turn.id, updatedAt: now } };
}

/** Stores Hope's evidence-linked note without changing scenario identity. */
/** Initializes the isolated accepted M1 L1 eight-beat state. */
export function initializeM1L1Run(value: PersistedScenarioPracticeRun, now: number): PersistedScenarioPracticeRun {
  if (value.run.m1L1) return value;
  return { ...value, run: { ...value.run, m1L1: { beat: 1, retryCount: 0 }, updatedAt: now } };
}

/** Persists the selected approved Pushback 1 exactly once after opener approval. */
export function attachM1L1PushbackOne(value: PersistedScenarioPracticeRun, turn: ScenarioCounterpartTurn, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (!lesson || lesson.pushbackOne) return value;
  const authoredAt = Math.max(now, (value.run.attempt?.confirmedAt ?? now) + 1);
  return {
    ...value,
    run: {
      ...value.run,
      counterpartTurn: { ...turn, authoredAt },
      counterpartIdentity: value.run.scenarioContext?.counterpartId,
      counterpartReactionId: turn.reactionId ?? turn.id,
      resolvedAudioId: turn.resolvedAudioId ?? turn.id,
      adamReactionId: turn.reactionId ?? turn.id,
      adamAudioId: turn.resolvedAudioId ?? turn.id,
      m1L1: { ...lesson, beat: 2, pushbackOne: { ...turn, authoredAt } },
      updatedAt: authoredAt,
    },
  };
}

/** Advances the accepted run after the first pre-coaching response. */
export function advanceM1L1FirstResponse(value: PersistedScenarioPracticeRun, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (!lesson?.pushbackOne || !value.run.responseAttempt) return value;
  const updatedAt = Math.max(now, value.run.updatedAt + 1);
  return { ...value, run: { ...value.run, state: "ready_for_second_pressure", m1L1: { ...lesson, beat: 3 }, updatedAt } };
}

/** Persists mandatory Pushback 2 exactly once. */
export function attachM1L1PushbackTwo(value: PersistedScenarioPracticeRun, turn: ScenarioCounterpartTurn, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (!lesson || lesson.pushbackTwo) return value;
  const authoredAt = Math.max(now, (value.run.responseAttempt?.confirmedAt ?? now) + 1);
  return { ...value, run: { ...value.run, state: "ready_for_second_response", m1L1: { ...lesson, beat: 4, pushbackTwo: { ...turn, authoredAt } }, updatedAt: authoredAt } };
}

/** Stores the mandatory second pre-coaching response. */
export function preserveM1L1SecondResponse(value: PersistedScenarioPracticeRun, transcript: string, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  const clean = transcript.trim();
  if (!lesson?.pushbackTwo || lesson.secondResponseAttempt || clean.length < 2) return value;
  const confirmedAt = Math.max(now, (lesson.pushbackTwo.authoredAt ?? now) + 1);
  const attempt = { id: `${value.run.id}-m1-l1-response-2`, kind: "response" as const, transcript: clean, representation: "confirmed_transcript" as const, confirmedAt };
  return { ...value, run: { ...value.run, m1L1: { ...lesson, beat: 5, secondResponseAttempt: attempt }, updatedAt: confirmedAt } };
}

/** Stores scoreless M1 L1 coaching and the exact flagged beat. */
export function attachM1L1Coaching(
  value: PersistedScenarioPracticeRun,
  note: string,
  retryInstruction: string,
  coachedBeat: 1 | 3 | 5,
  flags: NonNullable<PersistedScenarioPracticeRun["run"]["m1L1"]>["flags"],
  selectedDimension: NonNullable<PersistedScenarioPracticeRun["run"]["m1L1"]>["selectedDimension"],
  now: number,
): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (!lesson?.secondResponseAttempt || !selectedDimension) return value;
  const updatedAt = Math.max(now, value.run.updatedAt + 1);
  return {
    ...value,
    run: {
      ...value.run,
      state: "hope_coaching",
      coachNote: note,
      retryInstruction,
      coachedBehaviorId: "point_proof_move",
      coachedSegment: "pushback_response",
      m1L1: { ...lesson, beat: 6, coachedBeat, flags, selectedDimension },
      updatedAt,
    },
  };
}

/** Persists Beat 7 only when the exact selected pressure is staged for replay. */
export function stageM1L1PressureReplay(value: PersistedScenarioPracticeRun, isFinal: boolean, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  const pressure = lesson?.coachedBeat === 3 || lesson?.coachedBeat === 1 ? lesson.pushbackOne : lesson?.pushbackTwo;
  if (!lesson?.selectedDimension || !pressure?.resolvedAudioId) return value;
  if (isFinal && value.run.state !== "final_retry_available") return value;
  const replayedAt = Math.max(now, value.run.updatedAt + 1);
  return {
    ...value,
    run: {
      ...value.run,
      state: isFinal ? "ready_for_final_retry_capture" : "ready_for_retry",
      m1L1: {
        ...lesson,
        beat: 7,
        ...(isFinal ? { finalRetryPressureReplayedAt: replayedAt, finalRetryPressureAudioId: pressure.resolvedAudioId } : {}),
      },
      updatedAt: replayedAt,
    },
  };
}

/** Records retry count with a hard cap of two and rejects final capture before exact replay. */
export function preserveM1L1Retry(value: PersistedScenarioPracticeRun, transcript: string, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  const clean = transcript.trim();
  if (!lesson?.selectedDimension || clean.length < 2 || lesson.retryCount >= 2 || lesson.beat !== 7) return value;
  const confirmedAt = Math.max(now, value.run.updatedAt + 1);
  const attempt = { id: `${value.run.id}-m1-l1-retry-${lesson.retryCount + 1}`, kind: "retry" as const, transcript: clean, representation: "confirmed_transcript" as const, confirmedAt };
  if (lesson.retryCount === 0) {
    return { ...value, run: { ...value.run, retryAttempt: attempt, m1L1: { ...lesson, beat: 8, retryCount: 1 }, updatedAt: confirmedAt } };
  }
  const pressure = lesson.coachedBeat === 3 || lesson.coachedBeat === 1 ? lesson.pushbackOne : lesson.pushbackTwo;
  if (!lesson.finalRetryPressureReplayedAt || lesson.finalRetryPressureAudioId !== pressure?.resolvedAudioId) return value;
  return { ...value, run: { ...value.run, m1L1: { ...lesson, beat: 8, retryCount: 2, finalRetryAttempt: attempt }, updatedAt: confirmedAt } };
}

export function attachScenarioCoaching(
  value: PersistedScenarioPracticeRun,
  note: string,
  retryInstruction: string,
  behaviorId: PilotBehaviorId,
  now: number,
): PersistedScenarioPracticeRun {
  return {
    ...value,
    run: {
      ...transitionPilotRun(value.run, "hope_coaching", now),
      coachNote: note,
      retryInstruction,
      coachedBehaviorId: behaviorId,
    },
  };
}

/** Compares the first and retry responses to the exact same persisted pressure turn. */
export function completeScenarioComparison(
  value: PersistedScenarioPracticeRun,
  now: number,
): PersistedScenarioPracticeRun {
  const { run } = value;
  if (!run.counterpartTurn || !run.responseAttempt || !run.retryAttempt) return value;
  const behavior = run.coachedBehaviorId ?? "pushback_response";
  return {
    ...value,
    run: {
      ...transitionPilotRun(run, "attempt_comparison", now),
      comparison: comparePilotAttempts(behavior, run.responseAttempt.transcript, run.retryAttempt.transcript),
    },
  };
}

/** Builds presentation-safe copy without exposing any persisted identity keys. */
export function scenarioPracticePresentation(value: unknown): ScenarioPracticePresentation {
  const normalized = normalizeScenarioPracticeRun(value);
  if (!normalized) return UNAVAILABLE_PRESENTATION;
  const context = normalized.run.scenarioContext;
  const pressure = normalized.run.counterpartTurn;
  if (!context || !pressure) return { isAvailable: true };
  const continuityLabel = "Same pressure moment" as const;
  return {
    isAvailable: true,
    counterpart: {
      name: context.counterpartName,
      role: context.counterpartRole,
      text: pressure.text,
      continuityLabel,
      accessibilityLabel: `${context.counterpartName}, ${context.counterpartRole}. ${continuityLabel}. ${pressure.text}`,
    },
  };
}

/** Snapshot used by every scenario state and deterministic continuity tests. */
export function scenarioContinuitySnapshot(value: PersistedScenarioPracticeRun): Record<string, string | undefined> {
  const { run } = value;
  const context = run.scenarioContext;
  return {
    scenarioId: context?.scenarioId,
    category: context?.category,
    title: context?.title,
    situation: context?.situation,
    objective: context?.objective,
    difficulty: context?.difficulty,
    counterpartId: context?.counterpartId,
    counterpartName: context?.counterpartName,
    counterpartRole: context?.counterpartRole,
    counterpartTurnId: run.counterpartTurn?.id,
    counterpartTurnText: run.counterpartTurn?.text,
    firstApprovedResponse: run.responseAttempt?.transcript,
    retryApprovedResponse: run.m1L1?.finalRetryAttempt?.transcript ?? run.retryAttempt?.transcript,
  };
}
