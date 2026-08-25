import type { ModuleId, OnboardingEntryRoute } from "@/constants/modules";
import {
  createOnboardingPracticeSession,
  normalizePracticeSession,
  preserveDayOneRetry,
  preserveFreeRehearsalArtifact,
  preserveOnboardingBaseline,
  protectImmutablePracticeRecords,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import type { PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";
import {
  FOCUS_VERSION,
  SHARED_PRODUCT_CONTRACT_VERSION,
  emptySharedResult,
  parseSharedRouteContract,
  parseSharedTranscriptContract,
  SharedContractError,
  type FirstFocusV1,
  type SharedApprovedTurnV1,
  type SharedFocusStatus,
  type SharedOrigin,
  type SharedProductContractV1,
  type SharedResultContractV1,
  type SharedRouteContractV1,
  type SharedSpeaker,
  type SharedTranscriptContractV1,
  type SharedTurnKind,
} from "@/types/sharedProduct";

export interface SharedRouteAdapterOptions {
  origin?: SharedOrigin;
  scenarioVersion?: string | null;
  pressureLevel?: number;
  entryRoute?: OnboardingEntryRoute;
}

export interface NativeApprovedTurnCandidate {
  id: string;
  sequence: number;
  speaker: SharedSpeaker;
  turnKind: SharedTurnKind;
  text: string;
  approvedAt: number | string | null;
  approvalStatus: "approved" | "pending";
}

export interface SharedHydrationOptions {
  practiceSessionId: string;
  anonymousUserId: string;
  scenario: Scenario;
  persona: PersonaVoice;
  now?: number;
  existingSession?: ActivePracticeSession | null;
  transcript?: unknown;
}

const NATIVE_REACTION_PATTERNS: readonly ReactionPattern[] = [
  "defensive",
  "hears-criticism",
  "minimizes",
  "quiet",
  "louder",
  "turns-back",
  "agrees-without-changing",
  "not-sure",
];

export interface SharedResultAdapterOptions {
  firstFocusKey?: string;
  firstFocusLabel?: string;
  focusVersion?: typeof FOCUS_VERSION;
}

/** Maps the current durable native route state without copying roleplay prompts or provider fields. */
export function activePracticeSessionToSharedRoute(
  session: ActivePracticeSession,
  options: SharedRouteAdapterOptions = {},
): SharedRouteContractV1 {
  const entryRoute = options.entryRoute ?? session.entryRoute;
  if (!entryRoute) {
    return parseSharedRouteContract({ contract_version: SHARED_PRODUCT_CONTRACT_VERSION });
  }
  return parseSharedRouteContract({
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    entry_route: entryRoute,
    context: session.topic,
    scenario_source: session.scenarioSource ?? "user_supplied",
    scenario_id: session.scenarioId,
    scenario_version: options.scenarioVersion ?? session.dayThirtyBaseline?.scenario_version ?? null,
    counterpart_label: session.counterpartDisplayLabel ?? session.counterpart,
    counterpart_relationship: session.counterpartRelationship ?? session.counterpart,
    success_target: session.usefulOutcome,
    pressure_condition: session.expectedReaction,
    pressure_level: options.pressureLevel ?? session.dayThirtyBaseline?.reaction_level ?? 2,
    origin: options.origin ?? "native",
  });
}

function toIsoTimestamp(value: number | string): string {
  const milliseconds = typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(milliseconds)) return "";
  return new Date(milliseconds).toISOString();
}

/** Filters pending candidates before building a validated, approved-only transcript. */
export function approvedNativeTurnsToSharedTranscript(
  rehearsalId: string,
  candidates: readonly NativeApprovedTurnCandidate[],
): SharedTranscriptContractV1 {
  const turns: SharedApprovedTurnV1[] = candidates
    .filter((candidate) => candidate.approvalStatus === "approved" && candidate.approvedAt !== null)
    .map((candidate) => ({
      id: candidate.id,
      sequence: candidate.sequence,
      speaker: candidate.speaker,
      turn_kind: candidate.turnKind,
      approved_text: candidate.text.trim(),
      approved_at: toIsoTimestamp(candidate.approvedAt as number | string),
    }));
  return parseSharedTranscriptContract({
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: rehearsalId,
    turns,
  });
}

/** Maps only a completed native rehearsal artifact; incremental or pending screen state is excluded. */
export function completedPracticeSessionToSharedTranscript(session: ActivePracticeSession): SharedTranscriptContractV1 {
  if (!session.freeRehearsalCompletedAt || !session.freeRehearsalTurns) {
    return approvedNativeTurnsToSharedTranscript(session.id, []);
  }
  const completedAt = session.freeRehearsalCompletedAt;
  let userTurnCount = 0;
  let counterpartTurnCount = 0;
  const candidates: NativeApprovedTurnCandidate[] = session.freeRehearsalTurns.map((turn, sequence) => {
    const isUser = turn.role === "user";
    const turnKind: SharedTurnKind = isUser
      ? userTurnCount++ === 0 ? "opening" : "pressure_response"
      : counterpartTurnCount++ === 0 ? "pushback" : "counterpart_close";
    const approvedAt = isUser && turnKind === "opening"
      ? session.attemptOne?.confirmedAt ?? completedAt
      : completedAt;
    return {
      id: turn.id,
      sequence,
      speaker: isUser ? "user" : "counterpart",
      turnKind,
      text: turn.text,
      approvedAt,
      approvalStatus: "approved",
    };
  });
  if (session.attemptTwo && !candidates.some((candidate) => candidate.id === session.attemptTwo?.id)) {
    candidates.push({
      id: session.attemptTwo.id,
      sequence: candidates.length,
      speaker: "user",
      turnKind: "retry",
      text: session.attemptTwo.transcript,
      approvedAt: session.attemptTwo.confirmedAt,
      approvalStatus: "approved",
    });
  }
  return approvedNativeTurnsToSharedTranscript(session.id, candidates);
}

/** Represents currently unavailable v1 result structures as null rather than inventing evidence. */
export function activePracticeSessionToSharedResult(
  session: ActivePracticeSession,
  options: SharedResultAdapterOptions = {},
): SharedResultContractV1 {
  if (session.sharedResult?.rehearsal_id === session.id) return session.sharedResult;
  const result = emptySharedResult(session.id);
  const recommendation = session.recommendation;
  if (!recommendation || !options.firstFocusKey || !options.firstFocusLabel) return result;
  const firstFocus: FirstFocusV1 = {
    first_focus_key: options.firstFocusKey,
    first_focus_label: options.firstFocusLabel,
    recommended_module_id: recommendation.moduleId,
    focus_status: recommendation.status,
    focus_version: options.focusVersion ?? FOCUS_VERSION,
  };
  return { ...result, first_focus: firstFocus };
}

/** Creates a complete v1 envelope from native-compatible state without adding activation or analytics behavior. */
export function activePracticeSessionToSharedProduct(
  session: ActivePracticeSession,
  routeOptions: SharedRouteAdapterOptions = {},
  resultOptions: SharedResultAdapterOptions = {},
): SharedProductContractV1 {
  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: session.id,
    route: activePracticeSessionToSharedRoute(session, routeOptions),
    transcript: completedPracticeSessionToSharedTranscript(session),
    result: activePracticeSessionToSharedResult(session, resultOptions),
  };
}

function sharedTurnsToNative(turns: readonly SharedApprovedTurnV1[]): Turn[] {
  return turns
    .filter((turn) => turn.turn_kind !== "retry")
    .map((turn) => ({ id: turn.id, role: turn.speaker === "user" ? "user" : "them", text: turn.approved_text }));
}

function latestApprovedAt(transcript: SharedTranscriptContractV1, fallback: number): number {
  return transcript.turns.reduce((latest, turn) => Math.max(latest, Date.parse(turn.approved_at)), fallback);
}

/**
 * Hydrates compatible shared route/transcript state through existing native factories.
 * The supplied local Scenario retains native-only prompt instructions; none are read from the contract.
 */
export function hydrateSharedStateToPracticeSession(
  routeValue: unknown,
  options: SharedHydrationOptions,
): ActivePracticeSession {
  const route = parseSharedRouteContract(routeValue);
  if (route.scenario_id !== options.scenario.id) {
    throw new SharedContractError("invalid_contract", "Shared route scenario does not match the supplied native scenario.");
  }
  if (!NATIVE_REACTION_PATTERNS.includes(route.pressure_condition as ReactionPattern)) {
    throw new SharedContractError("invalid_contract", "Shared pressure condition is not compatible with the native rehearsal engine.");
  }
  const now = options.now ?? Date.now();
  const scenario: Scenario = {
    ...options.scenario,
    id: route.scenario_id,
    counterpart: route.counterpart_label,
    situation: route.context,
    goal: route.success_target,
  };
  let hydrated = createOnboardingPracticeSession(
    options.practiceSessionId,
    options.anonymousUserId,
    scenario,
    route.success_target,
    route.pressure_condition as ReactionPattern,
    now,
    {
      entryRoute: route.entry_route,
      scenarioSource: route.scenario_source,
      scenarioTitle: scenario.title,
      counterpartRelationship: route.counterpart_relationship,
      counterpartDisplayLabel: route.counterpart_label,
      behavioralGoal: scenario.goal,
      persona: options.persona,
    },
  );

  if (options.transcript !== undefined) {
    const transcript = parseSharedTranscriptContract(options.transcript);
    if (transcript.rehearsal_id !== options.practiceSessionId) {
      throw new SharedContractError("invalid_contract", "Shared transcript does not belong to the requested rehearsal.");
    }
    const opening = transcript.turns.find((turn) => turn.turn_kind === "opening" && turn.speaker === "user");
    const pushback = transcript.turns.find((turn) => turn.turn_kind === "pushback" && turn.speaker === "counterpart");
    if (opening && pushback) {
      hydrated = preserveOnboardingBaseline(
        hydrated,
        opening.approved_text,
        pushback.approved_text,
        Date.parse(opening.approved_at),
        { scenarioVersion: route.scenario_version, reactionLevel: route.pressure_level, microphoneUsed: false },
      );
    }
    const nativeTurns = sharedTurnsToNative(transcript.turns);
    if (nativeTurns.some((turn) => turn.role === "user")) {
      hydrated = preserveFreeRehearsalArtifact(hydrated, nativeTurns, latestApprovedAt(transcript, now));
    }
    const retry = transcript.turns.find((turn) => turn.turn_kind === "retry" && turn.speaker === "user");
    if (retry) hydrated = preserveDayOneRetry(hydrated, retry.approved_text, Date.parse(retry.approved_at));
  }

  const protectedSession = options.existingSession?.id === hydrated.id
    ? protectImmutablePracticeRecords(options.existingSession, hydrated)
    : hydrated;
  const normalized = normalizePracticeSession(protectedSession);
  if (!normalized) throw new SharedContractError("invalid_contract", "Shared state could not be normalized into a version-6 practice session.");
  return normalized;
}

/** Route params contain identifiers and enums only—never context, transcript, or result prose. */
export function sharedProductRouteParams(route: SharedRouteContractV1, practiceSessionId: string): Record<string, string> {
  return {
    practiceSessionId,
    scenarioId: route.scenario_id,
    entryRoute: route.entry_route,
    origin: route.origin,
    contractVersion: String(route.contract_version),
  };
}

/** Analytics-safe contract metadata contains no user-authored or generated content. */
export function sharedProductAnalyticsMeta(
  route: SharedRouteContractV1,
  transcript: SharedTranscriptContractV1,
): Record<string, string | number> {
  return {
    schemaVersion: route.contract_version,
    route: route.entry_route,
    scenarioId: route.scenario_id,
    count: transcript.turns.length,
  };
}

/** Keeps focus status typed separately from customer-facing labels and module IDs. */
export function createFirstFocus(
  firstFocusKey: string,
  firstFocusLabel: string,
  recommendedModuleId: ModuleId,
  focusStatus: SharedFocusStatus,
): FirstFocusV1 {
  return {
    first_focus_key: firstFocusKey,
    first_focus_label: firstFocusLabel,
    recommended_module_id: recommendedModuleId,
    focus_status: focusStatus,
    focus_version: FOCUS_VERSION,
  };
}
