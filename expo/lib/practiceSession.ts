import { PILOT_PROGRAM } from "@/lib/pilotCurriculum";
import type { ModuleId, OnboardingEntryRoute } from "@/constants/modules";
import type { CategoryId, PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";
import type { PilotAttemptKind, PilotAttemptRecord, PilotComparison, PilotDayRun, PilotModuleState } from "@/types/pilotCurriculum";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

export const PRACTICE_SESSION_SCHEMA_VERSION = 6 as const;
export const BASELINE_COPY_VERSION = "BYSI-approved-copy-v3-2026-08-04" as const;

export type DayOneLearningState =
  | "focused_coach_note"
  | "replay_original_adam_response"
  | "spoken_retry"
  | "confirm_retry_transcript"
  | "attempt_comparison"
  | "transfer_cue"
  | "complete";

export type PracticeSessionState = "awaiting_onboarding_baseline" | DayOneLearningState;
export type FreeJourneyCheckpoint = "briefing" | "rehearsal" | "transcript_review" | "generating" | "pressure_moment" | "practice_shift" | "starting_index" | "complete";

export interface ImmutablePracticeAttempt {
  id: string;
  transcript: string;
  representation: "confirmed_transcript";
  confirmedAt: number;
  source: "onboarding_opener" | "day_1_recovery_opener" | "day_1_spoken_retry";
}

export interface OriginalAdamResponse {
  id: string;
  text: string;
  reactionId: string;
  semanticAudioKey: "adam_counterpart";
  resolvedAudioId: string;
}

export type BaselineSource = "onboarding" | "day1_recovery";
export type BaselineCaptureMode = "spoken" | "typed_accessibility_fallback";

export interface BaselineCaptureConditions {
  uncoached: true;
  transcript_confirmed: true;
  model_answer_visible: false;
  capture_surface: "onboarding_rehearsal" | "day1_recovery_preset";
  microphone_used: boolean;
  raw_audio_retention: "not_permitted" | "permitted_not_retained" | "retained";
  omitted_fields: string[];
}

/** Immutable pointer and capture provenance reserved for the later Day 30 comparison. */
export interface DayThirtyBaselineReference {
  id: string;
  practiceSessionId: string;
  baseline_attempt_id: string;
  baseline_source: BaselineSource;
  scenario_id: string;
  scenario_version: string | null;
  conversation_job_id: string | null;
  adam_reaction_id: string;
  adam_response_text_reference: string;
  semantic_audio_key: "adam_counterpart";
  resolved_audio_id: string;
  reaction_level: number;
  turn_number: number;
  segment: "opener";
  confirmed_transcript_reference: string;
  audio_reference?: string;
  curriculum_version: string;
  copy_version: string;
  capture_mode: BaselineCaptureMode;
  capture_conditions: BaselineCaptureConditions;
  created_at: number;
  metadata_status: "complete" | "legacy_partial";
}

export interface PracticeRecommendation {
  moduleId: ModuleId;
  hypothesisModuleId?: ModuleId;
  evidenceQuote: string | null;
  evidenceTurnId: string | null;
  confidence: "confirmed_quote" | "uncertain";
  status: "suggested" | "confirmed" | "changed";
  supportedStrength: string | null;
  immediateAction: string;
  createdAt: number;
}

/** Durable bridge from onboarding through the modular curriculum. */
export interface ActivePracticeSession {
  schemaVersion: typeof PRACTICE_SESSION_SCHEMA_VERSION;
  id: string;
  anonymousUserId: string;
  userId?: string;
  scenarioId: string;
  category: CategoryId;
  counterpart: string;
  topic: string;
  usefulOutcome: string;
  expectedReaction: ReactionPattern;
  safetyStatus: "cleared";
  moduleVersion: string;
  entryRoute?: OnboardingEntryRoute;
  provisionalModuleId?: ModuleId;
  selectionLabel?: string;
  scenarioSource?: "user_supplied" | "approved_authored";
  scenarioTitle?: string;
  counterpartRelationship?: string;
  counterpartDisplayLabel?: string;
  behavioralGoal?: string;
  persona?: PersonaVoice;
  freeRehearsalTurns?: Turn[];
  recommendation?: PracticeRecommendation;
  freeRehearsalCompletedAt?: number;
  /** Furthest valid local acquisition checkpoint; drafts and raw audio are never stored here. */
  freeJourneyCheckpoint?: FreeJourneyCheckpoint;
  /** Evidence-linked v1 result built only from the completely approved transcript. */
  sharedResult?: SharedResultContractV1;
  attemptOne?: ImmutablePracticeAttempt;
  originalAdamResponse?: OriginalAdamResponse;
  dayThirtyBaseline?: DayThirtyBaselineReference;
  coachNote?: string;
  retryInstruction?: string;
  coachedBehaviorId?: string;
  attemptTwo?: ImmutablePracticeAttempt;
  comparison?: PilotComparison;
  pilotRuns: Record<string, PilotDayRun>;
  nextState: PracticeSessionState;
  createdAt: number;
  updatedAt: number;
}

/** Generates an opaque local ID without learner content. */
export function createPracticeSessionId(now: number = Date.now(), random: number = Math.random()): string {
  return `practice-${now.toString(36)}-${Math.floor(random * 0x100000000).toString(36)}`;
}

/** Creates the session before onboarding hands off to its free rehearsal. */
export function createOnboardingPracticeSession(
  id: string,
  anonymousUserId: string,
  scenario: Scenario,
  usefulOutcome: string,
  expectedReaction: ReactionPattern,
  now: number = Date.now(),
  onboarding?: {
    entryRoute: OnboardingEntryRoute;
    provisionalModuleId?: ModuleId;
    selectionLabel?: string;
    scenarioSource: "user_supplied" | "approved_authored";
    scenarioTitle: string;
    counterpartRelationship: string;
    counterpartDisplayLabel: string;
    behavioralGoal: string;
    persona: PersonaVoice;
  },
): ActivePracticeSession {
  return {
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    id,
    anonymousUserId,
    scenarioId: scenario.id,
    category: scenario.category,
    counterpart: onboarding?.counterpartDisplayLabel ?? scenario.counterpart,
    topic: scenario.situation,
    usefulOutcome: usefulOutcome.trim() || scenario.goal,
    expectedReaction,
    safetyStatus: "cleared",
    moduleVersion: PILOT_PROGRAM.curriculum_version,
    ...(onboarding ? {
      entryRoute: onboarding.entryRoute,
      ...(onboarding.provisionalModuleId ? { provisionalModuleId: onboarding.provisionalModuleId } : {}),
      ...(onboarding.selectionLabel ? { selectionLabel: onboarding.selectionLabel } : {}),
      scenarioSource: onboarding.scenarioSource,
      scenarioTitle: onboarding.scenarioTitle,
      counterpartRelationship: onboarding.counterpartRelationship,
      counterpartDisplayLabel: onboarding.counterpartDisplayLabel,
      behavioralGoal: onboarding.behavioralGoal,
      persona: onboarding.persona,
    } : {}),
    pilotRuns: {},
    freeJourneyCheckpoint: "briefing",
    nextState: "awaiting_onboarding_baseline",
    createdAt: now,
    updatedAt: now,
  };
}

/** Creates a content-minimal preset session only when onboarding recovery is impossible. */
export function createPresetPracticeSession(anonymousUserId: string, now: number = Date.now()): ActivePracticeSession {
  const id = createPracticeSessionId(now);
  return {
    schemaVersion: PRACTICE_SESSION_SCHEMA_VERSION,
    id,
    anonymousUserId,
    scenarioId: "bysi-v3-preset-bedtime",
    category: "partner",
    counterpart: "Adam",
    topic: "Bedtime schedule",
    usefulOutcome: "Decide one shared responsibility",
    expectedReaction: "not-sure",
    safetyStatus: "cleared",
    moduleVersion: PILOT_PROGRAM.curriculum_version,
    pilotRuns: {},
    nextState: "awaiting_onboarding_baseline",
    createdAt: now,
    updatedAt: now,
  };
}

export interface PreserveBaselineOptions {
  baselineSource?: BaselineSource;
  scenarioVersion?: string | null;
  conversationJobId?: string | null;
  adamReactionId?: string;
  semanticAudioKey?: "adam_counterpart";
  resolvedAudioId?: string;
  reactionLevel?: number;
  turnNumber?: number;
  segment?: "opener";
  audioReference?: string;
  copyVersion?: string;
  captureMode?: BaselineCaptureMode;
  microphoneUsed?: boolean;
  rawAudioRetention?: BaselineCaptureConditions["raw_audio_retention"];
  omittedFields?: string[];
}

/** Adds a confirmed uncoached baseline once. Later writes cannot replace its content or provenance. */
export function preserveOnboardingBaseline(
  session: ActivePracticeSession,
  transcript: string,
  adamResponse: string,
  now: number = Date.now(),
  options: PreserveBaselineOptions = {},
): ActivePracticeSession {
  if (session.attemptOne && session.originalAdamResponse && session.dayThirtyBaseline) return session;
  const attemptOne: ImmutablePracticeAttempt = session.attemptOne ?? {
    id: `${session.id}-attempt-1`,
    transcript: transcript.trim(),
    representation: "confirmed_transcript",
    confirmedAt: now,
    source: options.baselineSource === "day1_recovery" ? "day_1_recovery_opener" : "onboarding_opener",
  };
  const adamResponseId = `${session.id}-adam-response-1`;
  const originalAdamResponse: OriginalAdamResponse = session.originalAdamResponse ?? {
    id: adamResponseId,
    text: adamResponse.trim(),
    reactionId: options.adamReactionId ?? session.expectedReaction,
    semanticAudioKey: options.semanticAudioKey ?? "adam_counterpart",
    resolvedAudioId: options.resolvedAudioId ?? adamResponseId,
  };
  const omittedFields = options.omittedFields ?? [
    ...(options.scenarioVersion === undefined ? ["scenario_version"] : []),
    ...(options.conversationJobId === undefined ? ["conversation_job_id"] : []),
    ...(options.audioReference === undefined ? ["audio_reference"] : []),
  ];
  const baseline: DayThirtyBaselineReference = {
    id: `${session.id}-day-30-baseline`,
    practiceSessionId: session.id,
    baseline_attempt_id: attemptOne.id,
    baseline_source: options.baselineSource ?? "onboarding",
    scenario_id: session.scenarioId,
    scenario_version: options.scenarioVersion ?? null,
    conversation_job_id: options.conversationJobId ?? null,
    adam_reaction_id: originalAdamResponse.reactionId,
    adam_response_text_reference: originalAdamResponse.id,
    semantic_audio_key: originalAdamResponse.semanticAudioKey,
    resolved_audio_id: originalAdamResponse.resolvedAudioId,
    reaction_level: options.reactionLevel ?? 2,
    turn_number: options.turnNumber ?? 1,
    segment: options.segment ?? "opener",
    confirmed_transcript_reference: attemptOne.id,
    ...(options.audioReference ? { audio_reference: options.audioReference } : {}),
    curriculum_version: session.moduleVersion,
    copy_version: options.copyVersion ?? BASELINE_COPY_VERSION,
    capture_mode: options.captureMode ?? "spoken",
    capture_conditions: {
      uncoached: true,
      transcript_confirmed: true,
      model_answer_visible: false,
      capture_surface: options.baselineSource === "day1_recovery" ? "day1_recovery_preset" : "onboarding_rehearsal",
      microphone_used: options.microphoneUsed ?? true,
      raw_audio_retention: options.rawAudioRetention ?? "not_permitted",
      omitted_fields: omittedFields,
    },
    created_at: now,
    metadata_status: omittedFields.length === 0 ? "complete" : "legacy_partial",
  };
  return { ...session, attemptOne, originalAdamResponse, dayThirtyBaseline: session.dayThirtyBaseline ?? baseline, updatedAt: now };
}

/** Preserves the completed free exchange without assigning the contextual counterpart to Adam. */
export function preserveFreeRehearsalArtifact(
  session: ActivePracticeSession,
  turns: Turn[],
  now: number = Date.now(),
): ActivePracticeSession {
  const first = turns.find((turn) => turn.role === "user");
  if (!first) return session;
  const attemptOne: ImmutablePracticeAttempt = session.attemptOne ?? {
    id: `${session.id}-free-attempt-1`,
    transcript: first.text.trim(),
    representation: "confirmed_transcript",
    confirmedAt: now,
    source: "onboarding_opener",
  };
  return {
    ...session,
    attemptOne,
    freeRehearsalTurns: session.freeRehearsalTurns ?? turns,
    freeRehearsalCompletedAt: session.freeRehearsalCompletedAt ?? now,
    updatedAt: now,
  };
}

/** Adds the confirmed Day 1 retry once. */
export function preserveDayOneRetry(session: ActivePracticeSession, transcript: string, now: number = Date.now()): ActivePracticeSession {
  if (session.attemptTwo) return session;
  return {
    ...session,
    attemptTwo: {
      id: `${session.id}-attempt-2`,
      transcript: transcript.trim(),
      representation: "confirmed_transcript",
      confirmedAt: now,
      source: "day_1_spoken_retry",
    },
    updatedAt: now,
  };
}

/** Create or recover one config-driven daily run. */
export function createPilotDayRun(
  session: ActivePracticeSession,
  day: number,
  now: number = Date.now(),
  moduleId?: ModuleId,
  practiceId?: string,
  contentVersion?: string,
): PilotDayRun {
  const runKey = practiceId ?? moduleId ?? String(day);
  const existing = session.pilotRuns[runKey];
  if (existing) return existing;
  return {
    id: `${session.id}-${practiceId ?? moduleId ?? `day-${day}`}`,
    ...(moduleId ? { moduleId } : {}),
    ...(practiceId ? { practiceId } : {}),
    ...(contentVersion ? { contentVersion } : {}),
    day,
    curriculumVersion: practiceId ? "2026-08-11.1-review" : PILOT_PROGRAM.curriculum_version,
    state: "module_preview",
    scenarioMode: "preset",
    lessonIndex: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/** Persist a daily transition while preserving every confirmed attempt. */
export function upsertPilotDayRun(session: ActivePracticeSession, incoming: PilotDayRun, now: number = Date.now()): ActivePracticeSession {
  const runKey = incoming.practiceId ?? incoming.moduleId ?? String(incoming.day);
  const existing = session.pilotRuns[runKey];
  const protectedRun: PilotDayRun = existing ? {
    ...incoming,
    ...(existing.attempt ? { attempt: existing.attempt } : {}),
    ...(existing.responseAttempt ? { responseAttempt: existing.responseAttempt } : {}),
    ...(existing.retryAttempt ? { retryAttempt: existing.retryAttempt } : {}),
    ...(existing.counterpartTurn ? { counterpartTurn: existing.counterpartTurn } : {}),
    ...(existing.counterpartIdentity ? { counterpartIdentity: existing.counterpartIdentity } : {}),
    ...(existing.counterpartReactionId ? { counterpartReactionId: existing.counterpartReactionId } : {}),
    ...(existing.resolvedAudioId ? { resolvedAudioId: existing.resolvedAudioId } : {}),
    ...(existing.adamReactionId ? { adamReactionId: existing.adamReactionId } : {}),
    ...(existing.adamAudioId ? { adamAudioId: existing.adamAudioId } : {}),
    ...(existing.coachedSegment ? { coachedSegment: existing.coachedSegment } : {}),
    ...(existing.retryResetId ? { retryResetId: existing.retryResetId } : {}),
    updatedAt: now,
  } : { ...incoming, updatedAt: now };
  return {
    ...session,
    pilotRuns: { ...session.pilotRuns, [runKey]: protectedRun },
    updatedAt: now,
  };
}

/** Add one immutable confirmed transcript; duplicate submissions are idempotent. */
export function preservePilotAttempt(run: PilotDayRun, kind: PilotAttemptKind, transcript: string, now: number = Date.now()): PilotDayRun {
  const key = kind === "opener" ? "attempt" : kind === "response" ? "responseAttempt" : "retryAttempt";
  if (run[key]) return run;
  const record: PilotAttemptRecord = {
    id: `${run.id}-${kind}`,
    kind,
    transcript: transcript.trim(),
    representation: "confirmed_transcript",
    confirmedAt: now,
  };
  return { ...run, [key]: record, updatedAt: now };
}

/** Persist a state transition without allowing completion before a retry. */
export function transitionPilotRun(run: PilotDayRun, state: PilotModuleState, now: number = Date.now()): PilotDayRun {
  if (state === "complete" && (!run.retryAttempt || run.state !== "transfer_cue")) return run;
  if (run.state === "complete") return run;
  return { ...run, state, ...(state === "complete" ? { completedAt: run.completedAt ?? now } : {}), updatedAt: now };
}

/** Retrieves the immutable Day 1 measurement used by Day 30. */
export function dayThirtyBaseline(session: ActivePracticeSession | null): ImmutablePracticeAttempt | null {
  if (!session?.dayThirtyBaseline || !session.attemptOne) return null;
  return session.dayThirtyBaseline.baseline_attempt_id === session.attemptOne.id ? session.attemptOne : null;
}

/** Prevents later session updates from replacing confirmed records. */
export function protectImmutablePracticeRecords(existing: ActivePracticeSession, incoming: ActivePracticeSession): ActivePracticeSession {
  if (existing.id !== incoming.id) return incoming;
  const pilotRuns = Object.fromEntries(Object.entries(incoming.pilotRuns).map(([day, run]) => {
    const old = existing.pilotRuns[day];
    return [day, old ? {
      ...run,
      ...(old.attempt ? { attempt: old.attempt } : {}),
      ...(old.responseAttempt ? { responseAttempt: old.responseAttempt } : {}),
      ...(old.retryAttempt ? { retryAttempt: old.retryAttempt } : {}),
      ...(old.counterpartTurn ? { counterpartTurn: old.counterpartTurn } : {}),
      ...(old.counterpartIdentity ? { counterpartIdentity: old.counterpartIdentity } : {}),
      ...(old.counterpartReactionId ? { counterpartReactionId: old.counterpartReactionId } : {}),
      ...(old.resolvedAudioId ? { resolvedAudioId: old.resolvedAudioId } : {}),
      ...(old.adamReactionId ? { adamReactionId: old.adamReactionId } : {}),
      ...(old.adamAudioId ? { adamAudioId: old.adamAudioId } : {}),
      ...(old.coachedSegment ? { coachedSegment: old.coachedSegment } : {}),
      ...(old.retryResetId ? { retryResetId: old.retryResetId } : {}),
    } : run];
  }));
  return {
    ...incoming,
    pilotRuns,
    ...(existing.attemptOne ? { attemptOne: existing.attemptOne } : {}),
    ...(existing.originalAdamResponse ? { originalAdamResponse: existing.originalAdamResponse } : {}),
    ...(existing.dayThirtyBaseline ? { dayThirtyBaseline: existing.dayThirtyBaseline } : {}),
    ...(existing.attemptTwo ? { attemptTwo: existing.attemptTwo } : {}),
    ...(existing.sharedResult ? { sharedResult: existing.sharedResult } : {}),
  };
}

/** Associates an anonymous session after sign-in without changing progress. */
export function associatePracticeSessionUser(session: ActivePracticeSession, userId: string, now: number = Date.now()): ActivePracticeSession {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId || session.userId === normalizedUserId) return session;
  return { ...session, userId: normalizedUserId, updatedAt: now };
}

export function dayOneResumeState(session: ActivePracticeSession | null, isDayOneComplete: boolean): DayOneLearningState | null {
  if (isDayOneComplete && session?.attemptOne) return "complete";
  if (!session || session.nextState === "awaiting_onboarding_baseline") return null;
  return session.nextState;
}

const DAY_ONE_STATES: PracticeSessionState[] = [
  "awaiting_onboarding_baseline", "focused_coach_note", "replay_original_adam_response", "spoken_retry",
  "confirm_retry_transcript", "attempt_comparison", "transfer_cue", "complete",
];

/** Reject malformed disk data and migrate schema 1/2 in place. */
export function normalizePracticeSession(value: unknown): ActivePracticeSession | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (item.schemaVersion === 1) return migrateVersionOne(item);
  if (item.schemaVersion === 2) return normalizeCurrent(migrateLegacyBaseline({ ...item, schemaVersion: 6, pilotRuns: {} }));
  if (item.schemaVersion === 3 || item.schemaVersion === 4) return normalizeCurrent(migrateLegacyBaseline({ ...item, schemaVersion: 6 }));
  if (item.schemaVersion === 5) return normalizeCurrent({ ...item, schemaVersion: 6, safetyStatus: "cleared" });
  return normalizeCurrent({ ...item, safetyStatus: "cleared" });
}

function normalizeCurrent(item: Record<string, unknown>): ActivePracticeSession | null {
  const required = ["id", "anonymousUserId", "scenarioId", "category", "counterpart", "topic", "usefulOutcome", "expectedReaction", "moduleVersion"];
  if (item.schemaVersion !== 6 || required.some((key) => typeof item[key] !== "string")) return null;
  if (!DAY_ONE_STATES.includes(item.nextState as PracticeSessionState) || typeof item.createdAt !== "number" || typeof item.updatedAt !== "number") return null;
  if (!item.pilotRuns || typeof item.pilotRuns !== "object" || Array.isArray(item.pilotRuns)) return null;
  return item as unknown as ActivePracticeSession;
}

function migrateVersionOne(item: Record<string, unknown>): ActivePracticeSession | null {
  const required = ["id", "anonymousUserId", "scenarioId", "category", "counterpart", "topic", "usefulOutcome", "expectedReaction"];
  if (required.some((key) => typeof item[key] !== "string") || item.safetyStatus !== "cleared" || typeof item.createdAt !== "number" || typeof item.updatedAt !== "number") return null;
  const legacyState: Record<string, PracticeSessionState> = {
    awaiting_onboarding_baseline: "awaiting_onboarding_baseline", focused_coach_note: "focused_coach_note",
    same_moment_retry: "spoken_retry", comparison: "attempt_comparison", transfer_cue: "transfer_cue", day_1_complete: "complete",
  };
  const nextState = legacyState[String(item.nextState)];
  if (!nextState) return null;
  let session: ActivePracticeSession = {
    schemaVersion: 6,
    id: item.id as string,
    anonymousUserId: item.anonymousUserId as string,
    ...(typeof item.userId === "string" ? { userId: item.userId } : {}),
    scenarioId: item.scenarioId as string,
    category: item.category as CategoryId,
    counterpart: item.counterpart as string,
    topic: item.topic as string,
    usefulOutcome: item.usefulOutcome as string,
    expectedReaction: item.expectedReaction as ReactionPattern,
    safetyStatus: "cleared",
    moduleVersion: PILOT_PROGRAM.curriculum_version,
    ...(typeof item.coachNote === "string" ? { coachNote: item.coachNote } : {}),
    ...(typeof item.retryInstruction === "string" ? { retryInstruction: item.retryInstruction } : {}),
    ...(item.comparison ? { comparison: item.comparison as PilotComparison } : {}),
    pilotRuns: {},
    nextState,
    createdAt: item.createdAt as number,
    updatedAt: item.updatedAt as number,
  };
  if (typeof item.baselineAttempt === "string" && typeof item.counterpartResponse === "string") {
    session = preserveOnboardingBaseline(session, item.baselineAttempt, item.counterpartResponse, item.updatedAt as number, {
      microphoneUsed: false,
      rawAudioRetention: "not_permitted",
      omittedFields: ["scenario_version", "conversation_job_id", "audio_reference", "capture_mode_verification", "microphone_used_verification"],
    });
  }
  if (typeof item.retryAttempt === "string") session = preserveDayOneRetry(session, item.retryAttempt, item.updatedAt as number);
  return session;
}

function migrateLegacyBaseline(item: Record<string, unknown>): Record<string, unknown> {
  const attempt = item.attemptOne as ImmutablePracticeAttempt | undefined;
  const response = item.originalAdamResponse as Partial<OriginalAdamResponse> | undefined;
  if (!attempt || !response?.id || typeof response.text !== "string") return item;
  const reactionId = typeof response.reactionId === "string" ? response.reactionId : String(item.expectedReaction ?? "not-sure");
  const resolvedAudioId = typeof response.resolvedAudioId === "string" ? response.resolvedAudioId : response.id;
  const originalAdamResponse: OriginalAdamResponse = {
    id: response.id,
    text: response.text,
    reactionId,
    semanticAudioKey: "adam_counterpart",
    resolvedAudioId,
  };
  const legacy = item.dayThirtyBaseline as Record<string, unknown> | undefined;
  const createdAt = typeof attempt.confirmedAt === "number" ? attempt.confirmedAt : Number(item.createdAt);
  const dayThirtyBaseline: DayThirtyBaselineReference = {
    id: typeof legacy?.id === "string" ? legacy.id : `${String(item.id)}-day-30-baseline`,
    practiceSessionId: String(item.id),
    baseline_attempt_id: attempt.id,
    baseline_source: "onboarding",
    scenario_id: String(item.scenarioId),
    scenario_version: null,
    conversation_job_id: null,
    adam_reaction_id: reactionId,
    adam_response_text_reference: response.id,
    semantic_audio_key: "adam_counterpart",
    resolved_audio_id: resolvedAudioId,
    reaction_level: 2,
    turn_number: 1,
    segment: "opener",
    confirmed_transcript_reference: attempt.id,
    curriculum_version: typeof legacy?.moduleVersion === "string" ? legacy.moduleVersion : String(item.moduleVersion),
    copy_version: BASELINE_COPY_VERSION,
    capture_mode: "spoken",
    capture_conditions: {
      uncoached: true,
      transcript_confirmed: true,
      model_answer_visible: false,
      capture_surface: "onboarding_rehearsal",
      microphone_used: false,
      raw_audio_retention: "not_permitted",
      omitted_fields: ["scenario_version", "conversation_job_id", "audio_reference", "capture_mode_verification", "microphone_used_verification"],
    },
    created_at: createdAt,
    metadata_status: "legacy_partial",
  };
  return { ...item, schemaVersion: 6, originalAdamResponse, dayThirtyBaseline };
}
