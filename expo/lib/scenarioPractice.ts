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
  "listening_response", "confirm_response_transcript", "hope_coaching", "ready_for_retry",
  "listening_retry", "confirm_retry_transcript", "attempt_comparison", "transfer_cue", "complete",
  "network_error", "model_error",
]);

export interface PersistedScenarioPracticeRun {
  version: typeof SCENARIO_RUN_VERSION;
  run: PilotDayRun;
}

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
  return { ...value, run: transitionPilotRun(value.run, state, now) };
}

/** Stores one approved transcript using the canonical immutable-attempt helper. */
export function preserveScenarioAttempt(
  value: PersistedScenarioPracticeRun,
  kind: "opener" | "response" | "retry",
  transcript: string,
  now: number,
): PersistedScenarioPracticeRun {
  return { ...value, run: preservePilotAttempt(value.run, kind, transcript, now) };
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
    retryApprovedResponse: run.retryAttempt?.transcript,
  };
}
