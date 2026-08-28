import { hasCanonicalM1L1PressureSequence, isCanonicalM1L1PressureTurn } from "@/lib/convertedLesson";
import { comparePilotAttempts } from "@/lib/pilotCurriculum";
import { preservePilotAttempt, transitionPilotRun } from "@/lib/practiceSession";
import type { Difficulty, PersonaVoice, ReactionPattern, Scenario } from "@/types/convo";
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
const REACTIONS: ReadonlySet<ReactionPattern> = new Set(["defensive", "hears-criticism", "minimizes", "quiet", "louder", "turns-back", "agrees-without-changing", "not-sure"]);
const SCENARIO_STATES: ReadonlySet<PilotModuleState> = new Set([
  "ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "ready_for_response",
  "listening_response", "confirm_response_transcript", "ready_for_second_pressure", "ready_for_second_response",
  "listening_second_response", "confirm_second_response_transcript", "hope_coaching", "ready_for_retry",
  "listening_retry", "confirm_retry_transcript", "final_retry_available", "replay_pending", "ready_for_final_retry_capture",
  "listening_final_retry", "confirm_final_retry_transcript", "attempt_comparison", "transfer_cue", "complete",
  "network_error", "model_error",
]);

export interface PersistedScenarioPracticeRun {
  version: typeof SCENARIO_RUN_VERSION;
  run: PilotDayRun;
}

export type M1L1CaptureKind = "opener" | "response-one" | "retry";

/** Reconstructs ephemeral capture identity from a durable M1 L1 checkpoint. */
export function m1L1CaptureKindForState(state: PilotModuleState): M1L1CaptureKind | null {
  if (state === "listening_attempt" || state === "confirm_attempt_transcript") return "opener";
  if (state === "listening_response" || state === "confirm_response_transcript") return "response-one";
  if (state === "listening_retry" || state === "confirm_retry_transcript") return "retry";
  return null;
}

/** Returns the exact persisted pressure selected for replay by the coached beat. */
export function m1L1ReplayPressure(run: PilotDayRun): ScenarioCounterpartTurn | undefined {
  if (run.m1L1?.coachedBeat === 3) return run.m1L1.pushbackOne;
  if (run.m1L1?.coachedBeat === 5) return run.m1L1.pushbackTwo;
  return undefined;
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
  contextualPersona: PersonaVoice = scenario.counterpartGender === "man" ? "man-adam" : "woman-hope",
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
    contextualPersona,
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

function nonEmpty(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0; }
function timestamp(value: unknown): value is number { return Number.isSafeInteger(value) && (value as number) >= 0; }
function attempt(value: unknown, expectedKind: "opener" | "response" | "retry", expectedId: string): PilotDayRun["attempt"] | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.id !== expectedId || !nonEmpty(item.transcript) || item.representation !== "confirmed_transcript" || !timestamp(item.confirmedAt)) return null;
  if (item.kind !== expectedKind) return null;
  return { id: item.id, kind: item.kind as "opener" | "response" | "retry", transcript: item.transcript, representation: "confirmed_transcript", confirmedAt: item.confirmedAt };
}
function counterpartTurn(value: unknown): ScenarioCounterpartTurn | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!nonEmpty(item.id) || !nonEmpty(item.text) || !["provider", "authored"].includes(String(item.source))) return null;
  if (item.reactionId !== undefined && !nonEmpty(item.reactionId)) return null;
  if (item.resolvedAudioId !== undefined && !nonEmpty(item.resolvedAudioId)) return null;
  if (item.semanticVoiceKey !== undefined && !["hope_teacher", "adam_counterpart", "contextual_counterpart"].includes(String(item.semanticVoiceKey))) return null;
  if (item.authoredAt !== undefined && !timestamp(item.authoredAt)) return null;
  return { id: item.id, text: item.text, source: item.source as "provider" | "authored", ...(item.reactionId ? { reactionId: item.reactionId as string } : {}), ...(item.semanticVoiceKey ? { semanticVoiceKey: item.semanticVoiceKey as ScenarioCounterpartTurn["semanticVoiceKey"] } : {}), ...(item.resolvedAudioId ? { resolvedAudioId: item.resolvedAudioId as string } : {}), ...(item.authoredAt !== undefined ? { authoredAt: item.authoredAt as number } : {}) };
}

/** Strictly parses and canonically reconstructs every persisted run field. */
export function normalizeScenarioPracticeRun(value: unknown): PersistedScenarioPracticeRun | null {
  if (!value || typeof value !== "object") return null;
  const wrapper = value as Record<string, unknown>;
  const source = wrapper.run;
  if (wrapper.version !== SCENARIO_RUN_VERSION || !source || typeof source !== "object") return null;
  const run = source as Record<string, unknown>;
  const rawContext = run.scenarioContext;
  if (!rawContext || typeof rawContext !== "object") return null;
  const context = rawContext as Record<string, unknown>;
  const required = ["scenarioId", "category", "title", "situation", "objective", "difficulty", "reaction", "counterpartId", "counterpartName", "counterpartLabel", "counterpartRole"] as const;
  if (required.some((key) => !nonEmpty(context[key]))) return null;
  if (!["partner", "family", "work", "friends"].includes(String(context.category)) || !["gentle", "steady", "challenging"].includes(String(context.difficulty))) return null;
  if (!["woman-hope", "man-adam"].includes(String(context.contextualPersona)) || !REACTIONS.has(context.reaction as ReactionPattern)) return null;
  if (!nonEmpty(run.id) || !timestamp(run.createdAt) || !timestamp(run.updatedAt) || (run.updatedAt as number) < (run.createdAt as number)) return null;
  if (!SCENARIO_STATES.has(run.state as PilotModuleState) || !Number.isSafeInteger(run.day) || !Number.isSafeInteger(run.lessonIndex)) return null;
  if (!nonEmpty(run.curriculumVersion) || !["preset", "carried_context"].includes(String(run.scenarioMode))) return null;
  const parseOptionalAttempt = (key: "attempt" | "responseAttempt" | "retryAttempt", kind: "opener" | "response" | "retry") => {
    const expectedId = key === "retryAttempt" && run.m1L1 ? `${String(run.id)}-m1-l1-retry-1` : `${String(run.id)}-${kind}`;
    return run[key] === undefined ? undefined : attempt(run[key], kind, expectedId);
  };
  const opener = parseOptionalAttempt("attempt", "opener");
  const response = parseOptionalAttempt("responseAttempt", "response");
  const retry = parseOptionalAttempt("retryAttempt", "retry");
  if (opener === null || response === null || retry === null) return null;
  const pressure = run.counterpartTurn === undefined ? undefined : counterpartTurn(run.counterpartTurn);
  if (pressure === null || ((response || retry || run.comparison) && !pressure)) return null;
  const canonicalContext: ScenarioPracticeContext = {
    scenarioId: context.scenarioId as string, category: context.category as ScenarioPracticeContext["category"], title: context.title as string,
    situation: context.situation as string, objective: context.objective as string, difficulty: context.difficulty as Difficulty,
    reaction: context.reaction as ReactionPattern, counterpartId: context.counterpartId as string, counterpartName: context.counterpartName as string,
    counterpartLabel: context.counterpartLabel as string, counterpartRole: context.counterpartRole as string,
    contextualPersona: context.contextualPersona as PersonaVoice,
  };
  const canonicalRun: PilotDayRun = {
    id: run.id, day: run.day as number, curriculumVersion: run.curriculumVersion, state: run.state as PilotModuleState,
    scenarioMode: run.scenarioMode as PilotDayRun["scenarioMode"], scenarioContext: canonicalContext, lessonIndex: run.lessonIndex as number,
    createdAt: run.createdAt, updatedAt: run.updatedAt,
    ...(nonEmpty(run.moduleId) ? { moduleId: run.moduleId as PilotDayRun["moduleId"] } : {}),
    ...(nonEmpty(run.convertedModuleId) ? { convertedModuleId: run.convertedModuleId } : {}),
    ...(nonEmpty(run.practiceId) ? { practiceId: run.practiceId } : {}), ...(nonEmpty(run.contentVersion) ? { contentVersion: run.contentVersion } : {}),
    ...(pressure ? { counterpartTurn: pressure } : {}), ...(opener ? { attempt: opener } : {}), ...(response ? { responseAttempt: response } : {}), ...(retry ? { retryAttempt: retry } : {}),
  };
  const stringFields = ["counterpartIdentity", "counterpartReactionId", "resolvedAudioId", "adamReactionId", "adamAudioId", "coachedBehaviorId", "retryResetId", "coachNote", "retryInstruction"] as const;
  for (const key of stringFields) { if (run[key] !== undefined) { if (!nonEmpty(run[key])) return null; (canonicalRun as unknown as Record<string, unknown>)[key] = run[key]; } }
  if (run.coachedSegment !== undefined) { if (run.coachedSegment !== "opener" && run.coachedSegment !== "pushback_response") return null; canonicalRun.coachedSegment = run.coachedSegment; }
  if (run.noteFit !== undefined) { if (run.noteFit !== "accepted" && run.noteFit !== "rejected") return null; canonicalRun.noteFit = run.noteFit; }
  if (run.comparison !== undefined) {
    if (!run.comparison || typeof run.comparison !== "object") return null;
    const comparison = run.comparison as Record<string, unknown>;
    if (!nonEmpty(comparison.behaviorId) || !nonEmpty(comparison.text) || typeof comparison.criterionChanged !== "boolean") return null;
    canonicalRun.comparison = { behaviorId: comparison.behaviorId as PilotBehaviorId, text: comparison.text, criterionChanged: comparison.criterionChanged };
  }
  if (run.m1L1 !== undefined) {
    if (!run.m1L1 || typeof run.m1L1 !== "object") return null;
    const item = run.m1L1 as Record<string, unknown>;
    if (!Number.isSafeInteger(item.beat) || (item.beat as number) < 1 || (item.beat as number) > 8 || ![0, 1, 2].includes(item.retryCount as number)) return null;
    const pushbackOne = item.pushbackOne === undefined ? undefined : counterpartTurn(item.pushbackOne);
    const pushbackTwo = item.pushbackTwo === undefined ? undefined : counterpartTurn(item.pushbackTwo);
    const second = item.secondResponseAttempt === undefined ? undefined : attempt(item.secondResponseAttempt, "response", `${String(run.id)}-m1-l1-response-2`);
    const finalExpectedId = `${String(run.id)}-m1-l1-retry-${String(item.retryCount)}`;
    const final = item.finalRetryAttempt === undefined ? undefined : attempt(item.finalRetryAttempt, "retry", finalExpectedId);
    if (pushbackOne === null || pushbackTwo === null || second === null || final === null) return null;
    const timestampFields = ["approvedMoveSavedAt", "replayRequestedAt", "replayCompletedAt", "finalRetryPressureReplayedAt"] as const;
    if (timestampFields.some((key) => item[key] !== undefined && !timestamp(item[key]))) return null;
    if (item.coachedBeat !== undefined && ![1, 3, 5].includes(item.coachedBeat as number)) return null;
    if (item.replayTarget !== undefined && !["top_of_scene", "pushback_one", "evidence_trap"].includes(String(item.replayTarget))) return null;
    if (item.replayProof !== undefined && !["playback_completed", "text_fallback_acknowledged", "top_of_scene_reset"].includes(String(item.replayProof))) return null;
    if (item.selectedDimension !== undefined && !["point_placement", "issue_count", "grounding_concreteness", "motive_character_language", "move_clarity", "evidence_discipline", "park_and_return"].includes(String(item.selectedDimension))) return null;
    let flags: NonNullable<PilotDayRun["m1L1"]>["flags"];
    if (item.flags !== undefined) {
      if (!Array.isArray(item.flags)) return null;
      flags = item.flags.map((rawFlag) => {
        if (!rawFlag || typeof rawFlag !== "object") return null;
        const candidate = rawFlag as Record<string, unknown>;
        if (!["point_placement", "issue_count", "grounding_concreteness", "motive_character_language", "move_clarity", "evidence_discipline", "park_and_return"].includes(String(candidate.dimension))) return null;
        if (!["met", "not_met", "not_assessable"].includes(String(candidate.status))) return null;
        if (candidate.evidenceQuote !== null && !nonEmpty(candidate.evidenceQuote)) return null;
        if (candidate.status === "not_assessable" && candidate.evidenceQuote !== null) return null;
        return { dimension: candidate.dimension, status: candidate.status, evidenceQuote: candidate.evidenceQuote } as NonNullable<NonNullable<PilotDayRun["m1L1"]>["flags"]>[number];
      }).filter((entry): entry is NonNullable<NonNullable<PilotDayRun["m1L1"]>["flags"]>[number] => entry !== null);
      if (flags.length !== item.flags.length) return null;
    }
    const legacyBeat = item.beat as number;
    const migratedBeat = second && legacyBeat >= 6 ? legacyBeat - 1 : legacyBeat;
    const lesson: NonNullable<PilotDayRun["m1L1"]> = {
      beat: migratedBeat as NonNullable<PilotDayRun["m1L1"]>["beat"], retryCount: item.retryCount as 0 | 1 | 2,
      ...(pushbackOne ? { pushbackOne } : {}), ...(pushbackTwo ? { pushbackTwo } : {}), ...(second ? { secondResponseAttempt: second } : {}),
      ...(item.coachedBeat !== undefined ? { coachedBeat: item.coachedBeat as 1 | 3 | 5 } : {}), ...(flags ? { flags } : {}),
      ...(item.selectedDimension ? { selectedDimension: item.selectedDimension as NonNullable<PilotDayRun["m1L1"]>["selectedDimension"] } : {}),
      ...(item.approvedMoveSavedAt !== undefined ? { approvedMoveSavedAt: item.approvedMoveSavedAt as number } : {}),
      ...(item.replayTarget ? { replayTarget: item.replayTarget as NonNullable<PilotDayRun["m1L1"]>["replayTarget"] } : {}),
      ...(typeof item.replayIsFinal === "boolean" ? { replayIsFinal: item.replayIsFinal } : {}),
      ...(item.replayRequestedAt !== undefined ? { replayRequestedAt: item.replayRequestedAt as number } : {}),
      ...(nonEmpty(item.replayAudioId) ? { replayAudioId: item.replayAudioId } : {}),
      ...(item.replayProof ? { replayProof: item.replayProof as NonNullable<PilotDayRun["m1L1"]>["replayProof"] } : {}),
      ...(item.replayCompletedAt !== undefined ? { replayCompletedAt: item.replayCompletedAt as number } : {}),
      ...(item.finalRetryPressureReplayedAt !== undefined ? { finalRetryPressureReplayedAt: item.finalRetryPressureReplayedAt as number } : {}),
      ...(nonEmpty(item.finalRetryPressureAudioId) ? { finalRetryPressureAudioId: item.finalRetryPressureAudioId } : {}), ...(final ? { finalRetryAttempt: final } : {}),
    };
    if (item.replayIsFinal !== undefined && typeof item.replayIsFinal !== "boolean") return null;
    if (item.replayAudioId !== undefined && !nonEmpty(item.replayAudioId)) return null;
    if (item.finalRetryPressureAudioId !== undefined && !nonEmpty(item.finalRetryPressureAudioId)) return null;
    const hasReplayRequest = Boolean(lesson.replayTarget && lesson.replayRequestedAt && lesson.replayAudioId);
    const hasReplayCompletion = Boolean(lesson.replayProof && lesson.replayCompletedAt);
    if ((lesson.replayTarget || lesson.replayRequestedAt || lesson.replayAudioId) && !hasReplayRequest) return null;
    if ((lesson.replayProof || lesson.replayCompletedAt) && !hasReplayCompletion) return null;
    if (run.state === "replay_pending" && (!hasReplayRequest || hasReplayCompletion)) return null;
    if (lesson.replayTarget === "top_of_scene" && hasReplayCompletion && lesson.replayProof !== "top_of_scene_reset" && lesson.replayProof !== "text_fallback_acknowledged") return null;
    if (lesson.replayTarget !== "top_of_scene" && lesson.replayProof === "top_of_scene_reset") return null;
    if (lesson.replayIsFinal === true && hasReplayCompletion && (lesson.finalRetryPressureReplayedAt !== lesson.replayCompletedAt || lesson.finalRetryPressureAudioId !== lesson.replayAudioId)) return null;
    canonicalRun.m1L1 = lesson;
  }
  if (run.completedAt !== undefined) { if (!timestamp(run.completedAt)) return null; canonicalRun.completedAt = run.completedAt; }
  if (canonicalRun.m1L1) {
    const lesson = canonicalRun.m1L1;
    if (!hasCanonicalM1L1PressureSequence(canonicalRun)) return null;
    if (lesson.pushbackOne && !isCanonicalM1L1PressureTurn(lesson.pushbackOne, "pushback_one")) return null;
    if (lesson.pushbackTwo && !isCanonicalM1L1PressureTurn(lesson.pushbackTwo, "evidence_trap")) return null;
    if ((lesson.secondResponseAttempt || lesson.coachedBeat || lesson.retryCount > 0) && (!lesson.pushbackOne || !lesson.pushbackTwo)) return null;
    if (lesson.pushbackOne && (!canonicalRun.attempt || canonicalRun.attempt.confirmedAt >= (lesson.pushbackOne.authoredAt ?? 0))) return null;
    if (lesson.pushbackTwo && (!canonicalRun.responseAttempt || !lesson.pushbackOne || !((lesson.pushbackOne.authoredAt ?? 0) < canonicalRun.responseAttempt.confirmedAt && canonicalRun.responseAttempt.confirmedAt < (lesson.pushbackTwo.authoredAt ?? 0)))) return null;
    if (lesson.secondResponseAttempt && (!lesson.pushbackTwo || (lesson.pushbackTwo.authoredAt ?? 0) >= lesson.secondResponseAttempt.confirmedAt)) return null;
    const expectedReplayId = lesson.coachedBeat === 1 ? `top-of-scene:${canonicalRun.id}` : lesson.coachedBeat === 3 ? lesson.pushbackOne?.resolvedAudioId : lesson.pushbackTwo?.resolvedAudioId;
    if (lesson.finalRetryAttempt && (!lesson.finalRetryPressureReplayedAt || !lesson.replayProof || lesson.finalRetryPressureAudioId !== expectedReplayId)) return null;
  }
  return { version: SCENARIO_RUN_VERSION, run: canonicalRun };
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
/** Initializes the isolated accepted M1 L1 seven-step state. */
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
  if (!lesson?.pushbackTwo || !value.run.responseAttempt || !selectedDimension) return value;
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
      m1L1: { ...lesson, beat: 5, coachedBeat, flags, selectedDimension },
      updatedAt,
    },
  };
}

/** Persists the non-capturable Step 6 replay request for the exact coached moment. */
export function stageM1L1PressureReplay(value: PersistedScenarioPracticeRun, isFinal: boolean, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (!lesson?.selectedDimension || !lesson.coachedBeat) return value;
  if (isFinal && value.run.state !== "final_retry_available") return value;
  if (!isFinal && value.run.state !== "hope_coaching") return value;
  const target = lesson.coachedBeat === 1 ? "top_of_scene" : lesson.coachedBeat === 3 ? "pushback_one" : "evidence_trap";
  const pressure = target === "pushback_one" ? lesson.pushbackOne : target === "evidence_trap" ? lesson.pushbackTwo : undefined;
  const audioId = target === "top_of_scene" ? `top-of-scene:${value.run.id}` : pressure?.resolvedAudioId;
  if (!audioId) return value;
  const requestedAt = Math.max(now, value.run.updatedAt + 1);
  return {
    ...value,
    run: {
      ...value.run,
      state: "replay_pending",
      m1L1: {
        ...lesson,
        beat: 6,
        replayTarget: target,
        replayIsFinal: isFinal,
        replayRequestedAt: requestedAt,
        replayAudioId: audioId,
        replayProof: undefined,
        replayCompletedAt: undefined,
      },
      updatedAt: requestedAt,
    },
  };
}

/** Unlocks retry capture only after exact playback completes or the learner explicitly accepts the text fallback. */
export function confirmM1L1PressureReplay(
  value: PersistedScenarioPracticeRun,
  proof: "playback_completed" | "text_fallback_acknowledged" | "top_of_scene_reset",
  now: number,
): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  if (value.run.state !== "replay_pending" || !lesson?.replayRequestedAt || !lesson.replayAudioId || !lesson.replayTarget) return value;
  if (lesson.replayTarget === "top_of_scene" ? proof !== "top_of_scene_reset" : proof === "top_of_scene_reset") return value;
  const completedAt = Math.max(now, value.run.updatedAt + 1);
  const isFinal = lesson.replayIsFinal === true;
  return {
    ...value,
    run: {
      ...value.run,
      state: isFinal ? "ready_for_final_retry_capture" : "ready_for_retry",
      m1L1: {
        ...lesson,
        replayProof: proof,
        replayCompletedAt: completedAt,
        ...(isFinal ? { finalRetryPressureReplayedAt: completedAt, finalRetryPressureAudioId: lesson.replayAudioId } : {}),
      },
      updatedAt: completedAt,
    },
  };
}

/** Executes the replay completion boundary used by the screen; started/interrupted audio never unlocks capture. */
export async function completeM1L1PressureReplay(
  value: PersistedScenarioPracticeRun,
  playToCompletion: () => Promise<"completed" | "interrupted" | "failed" | "blocked" | "empty" | "muted">,
  now: number = Date.now(),
): Promise<PersistedScenarioPracticeRun> {
  if (value.run.state !== "replay_pending") return value;
  const outcome = await playToCompletion();
  return outcome === "completed" ? confirmM1L1PressureReplay(value, "playback_completed", now) : value;
}

/** Records the single allowed retry after exact replay proof. */
export function preserveM1L1Retry(value: PersistedScenarioPracticeRun, transcript: string, now: number): PersistedScenarioPracticeRun {
  const lesson = value.run.m1L1;
  const clean = transcript.trim();
  if (!lesson?.selectedDimension || clean.length < 2 || lesson.retryCount >= 1 || lesson.beat !== 6 || !lesson.replayProof || !lesson.replayCompletedAt) return value;
  const confirmedAt = Math.max(now, value.run.updatedAt + 1);
  const attempt = { id: `${value.run.id}-m1-l1-retry-${lesson.retryCount + 1}`, kind: "retry" as const, transcript: clean, representation: "confirmed_transcript" as const, confirmedAt };
  return { ...value, run: { ...value.run, retryAttempt: attempt, m1L1: { ...lesson, beat: 7, retryCount: 1 }, updatedAt: confirmedAt } };
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
