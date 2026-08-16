import type { ModuleId } from "@/constants/modules";

/** Mirrors the canonical repository-level JSON Schema for Metro-safe Expo imports. */
export const SHARED_PRODUCT_CONTRACT_VERSION = 1 as const;
export const PRESSURE_MOMENT_VERSION = "pressure-moment-v1" as const;
export const PRACTICE_SHIFT_VERSION = "practice-shift-v1" as const;
export const SIGNAL_VERSION = "signal-v1" as const;
export const STARTING_INDEX_VERSION = "starting-index-v1" as const;
export const FOCUS_VERSION = "first-focus-v1" as const;
export const PRACTICE_SHIFT_CAVEAT = "A practice target, not a result you’ve already achieved." as const;

export const SHARED_ENTRY_ROUTES = ["real_conversation", "recurring_problem", "desired_skill"] as const;
export const SHARED_ORIGINS = ["web", "native"] as const;
export const SHARED_SCENARIO_SOURCES = ["approved_authored", "user_supplied"] as const;
export const SHARED_SPEAKERS = ["user", "counterpart"] as const;
export const SHARED_TURN_KINDS = ["opening", "pushback", "pressure_response", "counterpart_close", "retry"] as const;
export const SHARED_SIGNAL_KEYS = ["clarity", "specificity", "steadiness", "listening", "boundaries", "repair"] as const;
export const SHARED_OBSERVATION_STATUSES = ["observed", "unobserved", "insufficient_evidence"] as const;
export const SHARED_FOCUS_STATUSES = ["suggested", "confirmed", "changed"] as const;

export type SharedEntryRoute = typeof SHARED_ENTRY_ROUTES[number];
export type SharedOrigin = typeof SHARED_ORIGINS[number];
export type SharedScenarioSource = typeof SHARED_SCENARIO_SOURCES[number];
export type SharedSpeaker = typeof SHARED_SPEAKERS[number];
export type SharedTurnKind = typeof SHARED_TURN_KINDS[number];
export type SharedSignalKey = typeof SHARED_SIGNAL_KEYS[number];
export type SharedObservationStatus = typeof SHARED_OBSERVATION_STATUSES[number];
export type SharedFocusStatus = typeof SHARED_FOCUS_STATUSES[number];

export interface SharedRouteContractV1 {
  contract_version: typeof SHARED_PRODUCT_CONTRACT_VERSION;
  entry_route: SharedEntryRoute;
  context: string;
  scenario_source: SharedScenarioSource;
  scenario_id: string;
  scenario_version: string | null;
  counterpart_label: string;
  counterpart_relationship: string;
  success_target: string;
  pressure_condition: string;
  pressure_level: number;
  origin: SharedOrigin;
}

export interface SharedApprovedTurnV1 {
  id: string;
  sequence: number;
  speaker: SharedSpeaker;
  turn_kind: SharedTurnKind;
  approved_text: string;
  approved_at: string;
}

export interface SharedTranscriptContractV1 {
  contract_version: typeof SHARED_PRODUCT_CONTRACT_VERSION;
  rehearsal_id: string;
  turns: SharedApprovedTurnV1[];
}

export interface PressureMomentV1 {
  pressure_moment_version: typeof PRESSURE_MOMENT_VERSION;
  headline: string;
  opening_turn_id: string;
  pushback_turn_id: string;
  pressure_response_turn_id: string;
  observation: string;
  why_it_matters: string;
  confidence_statement: string;
}

export interface RewriteV1 {
  original_ask: string;
  clearer_version: string;
}

export interface PracticeShiftV1 {
  practice_shift_version: typeof PRACTICE_SHIFT_VERSION;
  headline: string;
  current_pattern_steps: string[];
  practice_target_steps: string[];
  success_target: string;
  first_focus_key: string;
  first_focus_label: string;
  recommended_module_id: ModuleId;
  caveat: typeof PRACTICE_SHIFT_CAVEAT;
}

export interface SharedSignalV1 {
  signal_key: SharedSignalKey;
  observation_status: SharedObservationStatus;
  score: number | null;
  evidence_turn_ids: string[];
  /** Provider-generated evidence summary for an observed dimension. */
  evidence_summary?: string;
  signal_version: typeof SIGNAL_VERSION;
}

export interface PartialStartingIndexV1 {
  index_kind: "partial";
  index_value: number | null;
  observed_count: number;
  total_signal_count: 6;
  index_version: typeof STARTING_INDEX_VERSION;
}

export interface FirstFocusV1 {
  first_focus_key: string;
  first_focus_label: string;
  recommended_module_id: ModuleId;
  focus_status: SharedFocusStatus;
  focus_version: typeof FOCUS_VERSION;
}

/** Result fields are nullable until a v1-compatible result has been derived from approved turns. */
export interface SharedResultContractV1 {
  contract_version: typeof SHARED_PRODUCT_CONTRACT_VERSION;
  rehearsal_id: string;
  pressure_moment: PressureMomentV1 | null;
  rewrite?: RewriteV1 | null;
  practice_shift: PracticeShiftV1 | null;
  signals: SharedSignalV1[];
  starting_index: PartialStartingIndexV1 | null;
  first_focus: FirstFocusV1 | null;
}

export interface ActivationMilestonesV1 {
  identity_verified_at?: string | null;
  entitlement_confirmed_at?: string | null;
  app_opened_at?: string | null;
  state_hydrated_at?: string | null;
  first_paid_practice_started_at?: string | null;
  first_paid_practice_completed_at?: string | null;
}

export interface ExperimentAssignmentV1 {
  experiment_key: string;
  variant_key: string;
  assignment_version: string;
  assigned_at: string;
}

export interface SharedProductContractV1 {
  contract_version: typeof SHARED_PRODUCT_CONTRACT_VERSION;
  rehearsal_id: string;
  route: SharedRouteContractV1;
  transcript: SharedTranscriptContractV1;
  result: SharedResultContractV1;
  activation_milestones?: ActivationMilestonesV1;
  experiment_assignments?: ExperimentAssignmentV1[];
}

export type SharedContractErrorCode = "unsupported_contract_version" | "invalid_contract";

/** Recoverable validation error for incompatible or malformed shared state. */
export class SharedContractError extends Error {
  readonly code: SharedContractErrorCode;
  readonly recoverable = true as const;

  constructor(code: SharedContractErrorCode, message: string) {
    super(message);
    this.name = "SharedContractError";
    this.code = code;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) throw new SharedContractError("invalid_contract", `${label} must be an object.`);
  return value;
}

function requireVersion(value: unknown): asserts value is typeof SHARED_PRODUCT_CONTRACT_VERSION {
  if (value !== SHARED_PRODUCT_CONTRACT_VERSION) {
    throw new SharedContractError("unsupported_contract_version", `Unsupported shared product contract version: ${String(value)}.`);
  }
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SharedContractError("invalid_contract", `${label} must be a non-empty string.`);
  }
  return value;
}

function requireTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label);
  if (!Number.isFinite(Date.parse(timestamp))) {
    throw new SharedContractError("invalid_contract", `${label} must be an ISO timestamp.`);
  }
  return timestamp;
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new SharedContractError("invalid_contract", `${label} is not supported.`);
  }
  return value as T;
}

function requireInteger(value: unknown, label: string, minimum: number, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) < minimum || (value as number) > maximum) {
    throw new SharedContractError("invalid_contract", `${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value as number;
}

/** Parses the core route while tolerating additive unknown properties. */
export function parseSharedRouteContract(value: unknown): SharedRouteContractV1 {
  const item = requireRecord(value, "route");
  requireVersion(item.contract_version);
  const scenarioVersion = item.scenario_version;
  if (scenarioVersion !== null && typeof scenarioVersion !== "string") {
    throw new SharedContractError("invalid_contract", "route.scenario_version must be a string or null.");
  }
  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    entry_route: requireEnum(item.entry_route, SHARED_ENTRY_ROUTES, "route.entry_route"),
    context: requireString(item.context, "route.context"),
    scenario_source: requireEnum(item.scenario_source, SHARED_SCENARIO_SOURCES, "route.scenario_source"),
    scenario_id: requireString(item.scenario_id, "route.scenario_id"),
    scenario_version: scenarioVersion,
    counterpart_label: requireString(item.counterpart_label, "route.counterpart_label"),
    counterpart_relationship: requireString(item.counterpart_relationship, "route.counterpart_relationship"),
    success_target: requireString(item.success_target, "route.success_target"),
    pressure_condition: requireString(item.pressure_condition, "route.pressure_condition"),
    pressure_level: requireInteger(item.pressure_level, "route.pressure_level", 1, 3),
    origin: requireEnum(item.origin, SHARED_ORIGINS, "route.origin"),
  };
}

function parseApprovedTurn(value: unknown): SharedApprovedTurnV1 {
  const item = requireRecord(value, "transcript turn");
  return {
    id: requireString(item.id, "turn.id"),
    sequence: requireInteger(item.sequence, "turn.sequence", 0, Number.MAX_SAFE_INTEGER),
    speaker: requireEnum(item.speaker, SHARED_SPEAKERS, "turn.speaker"),
    turn_kind: requireEnum(item.turn_kind, SHARED_TURN_KINDS, "turn.turn_kind"),
    approved_text: requireString(item.approved_text, "turn.approved_text"),
    approved_at: requireTimestamp(item.approved_at, "turn.approved_at"),
  };
}

/** Parses only approved transcript fields and rejects duplicate IDs or sequence positions. */
export function parseSharedTranscriptContract(value: unknown): SharedTranscriptContractV1 {
  const item = requireRecord(value, "transcript");
  requireVersion(item.contract_version);
  if (!Array.isArray(item.turns)) throw new SharedContractError("invalid_contract", "transcript.turns must be an array.");
  const turns = item.turns.map(parseApprovedTurn).sort((left, right) => left.sequence - right.sequence);
  const ids = new Set<string>();
  const sequences = new Set<number>();
  turns.forEach((turn) => {
    if (ids.has(turn.id) || sequences.has(turn.sequence)) {
      throw new SharedContractError("invalid_contract", "Transcript turn IDs and sequences must be unique.");
    }
    ids.add(turn.id);
    sequences.add(turn.sequence);
  });
  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: requireString(item.rehearsal_id, "transcript.rehearsal_id"),
    turns,
  };
}

/** Validates that Pressure Moment references the required three approved turns in one transcript. */
export function validatePressureMoment(moment: PressureMomentV1, transcript: SharedTranscriptContractV1): PressureMomentV1 {
  if (moment.pressure_moment_version !== PRESSURE_MOMENT_VERSION) {
    throw new SharedContractError("invalid_contract", "Unsupported Pressure Moment version.");
  }
  const references = [moment.opening_turn_id, moment.pushback_turn_id, moment.pressure_response_turn_id];
  if (new Set(references).size !== 3) {
    throw new SharedContractError("invalid_contract", "Pressure Moment must reference three distinct turns.");
  }
  const byId = new Map<string, SharedApprovedTurnV1>(transcript.turns.map((turn) => [turn.id, turn]));
  const opening = byId.get(moment.opening_turn_id);
  const pushback = byId.get(moment.pushback_turn_id);
  const response = byId.get(moment.pressure_response_turn_id);
  if (opening?.turn_kind !== "opening" || opening.speaker !== "user") {
    throw new SharedContractError("invalid_contract", "Pressure Moment opening must reference an approved user opening.");
  }
  if (pushback?.turn_kind !== "pushback" || pushback.speaker !== "counterpart") {
    throw new SharedContractError("invalid_contract", "Pressure Moment pushback must reference an approved counterpart pushback.");
  }
  if (response?.turn_kind !== "pressure_response" || response.speaker !== "user") {
    throw new SharedContractError("invalid_contract", "Pressure Moment response must reference an approved user pressure response.");
  }
  requireString(moment.headline, "pressure_moment.headline");
  requireString(moment.observation, "pressure_moment.observation");
  requireString(moment.why_it_matters, "pressure_moment.why_it_matters");
  requireString(moment.confidence_statement, "pressure_moment.confidence_statement");
  return moment;
}

/** Validates the complete structured comparison without collapsing it to a module recommendation. */
export function validatePracticeShift(shift: PracticeShiftV1): PracticeShiftV1 {
  if (shift.practice_shift_version !== PRACTICE_SHIFT_VERSION || shift.caveat !== PRACTICE_SHIFT_CAVEAT) {
    throw new SharedContractError("invalid_contract", "Practice Shift version or caveat is invalid.");
  }
  if (shift.current_pattern_steps.length === 0 || shift.practice_target_steps.length === 0) {
    throw new SharedContractError("invalid_contract", "Practice Shift sequences cannot be empty.");
  }
  [...shift.current_pattern_steps, ...shift.practice_target_steps].forEach((step) => requireString(step, "practice_shift step"));
  requireString(shift.first_focus_key, "practice_shift.first_focus_key");
  requireString(shift.first_focus_label, "practice_shift.first_focus_label");
  return shift;
}

/** Validates signal score/evidence rules against one approved transcript. */
export function validateSignals(signals: readonly SharedSignalV1[], transcript: SharedTranscriptContractV1): SharedSignalV1[] {
  const turnIds = new Set<string>(transcript.turns.map((turn) => turn.id));
  const signalKeys = new Set<SharedSignalKey>();
  return signals.map((signal) => {
    requireEnum(signal.signal_key, SHARED_SIGNAL_KEYS, "signal.signal_key");
    requireEnum(signal.observation_status, SHARED_OBSERVATION_STATUSES, "signal.observation_status");
    if (signal.signal_version !== SIGNAL_VERSION || signalKeys.has(signal.signal_key)) {
      throw new SharedContractError("invalid_contract", "Signals require the current version and unique keys.");
    }
    signalKeys.add(signal.signal_key);
    if (signal.observation_status === "observed") {
      if (typeof signal.score !== "number" || !Number.isFinite(signal.score) || signal.score < 0 || signal.score > 100) {
        throw new SharedContractError("invalid_contract", "Observed signal scores must be from 0 through 100.");
      }
      if (signal.evidence_turn_ids.length === 0 || signal.evidence_turn_ids.some((id) => !turnIds.has(id))) {
        throw new SharedContractError("invalid_contract", "Observed signal evidence must reference approved turns in the rehearsal.");
      }
      if (signal.evidence_summary !== undefined) requireString(signal.evidence_summary, "signal.evidence_summary");
    } else if (signal.score !== null || signal.evidence_turn_ids.length !== 0 || signal.evidence_summary !== undefined) {
      throw new SharedContractError("invalid_contract", "Unobserved or insufficient-evidence signals must have null scores and no evidence.");
    }
    return { ...signal, evidence_turn_ids: [...signal.evidence_turn_ids] };
  });
}

/** Calculates the Partial Starting Index from observed signals only. */
export function calculatePartialStartingIndex(signals: readonly SharedSignalV1[]): PartialStartingIndexV1 {
  const observed = signals.filter((signal) => signal.observation_status === "observed");
  const scores = observed.map((signal) => signal.score).filter((score): score is number => score !== null);
  return {
    index_kind: "partial",
    index_value: scores.length === 0 ? null : Math.round(scores.reduce((total, score) => total + score, 0) / scores.length),
    observed_count: scores.length,
    total_signal_count: 6,
    index_version: STARTING_INDEX_VERSION,
  };
}

/** Creates an explicit empty result when current native data cannot safely supply new v1 result fields. */
export function emptySharedResult(rehearsalId: string): SharedResultContractV1 {
  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: requireString(rehearsalId, "result.rehearsal_id"),
    pressure_moment: null,
    rewrite: null,
    practice_shift: null,
    signals: [],
    starting_index: null,
    first_focus: null,
  };
}
