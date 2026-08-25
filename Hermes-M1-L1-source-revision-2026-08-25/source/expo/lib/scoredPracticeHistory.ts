import type { ModuleId } from "@/constants/modules";
import { PROGRESS_SIGNAL_LABELS, PROGRESS_SIGNAL_ORDER } from "@/lib/progressEvidence";
import { calculatePartialStartingIndex, type SharedResultContractV1, type SharedSignalKey } from "@/types/sharedProduct";

export const SCORED_PRACTICE_HISTORY_VERSION = 1 as const;

export interface ScoredPracticeEvidenceReference {
  turnId: string;
  approvedText?: string;
}

export interface ScoredPracticeSignal {
  key: SharedSignalKey;
  value: number;
  evidenceTurnIds: readonly string[];
}

/** A local, evidence-minimal snapshot of one genuinely scored completed practice. */
export interface ScoredPracticeRecord {
  schemaVersion: typeof SCORED_PRACTICE_HISTORY_VERSION;
  id: string;
  completedAt: number;
  rehearsalId: string;
  scenarioId: string;
  scenarioTitle?: string;
  moduleId?: ModuleId;
  observedSignals: readonly ScoredPracticeSignal[];
  observedSignalSet: readonly SharedSignalKey[];
  overallIndex: number;
  evidence: readonly ScoredPracticeEvidenceReference[];
  currentFocus: string | null;
}

export interface CreateScoredPracticeRecordInput {
  completedAt: number;
  scenarioId: string;
  scenarioTitle?: string;
  moduleId?: ModuleId;
  approvedTextByTurnId?: ReadonlyMap<string, string>;
}

/** Snapshots the existing canonical result; it never calculates a second score. */
export function createScoredPracticeRecord(
  result: SharedResultContractV1 | undefined,
  input: CreateScoredPracticeRecordInput,
): ScoredPracticeRecord | null {
  if (!result || !Number.isFinite(input.completedAt) || input.completedAt <= 0 || !input.scenarioId.trim()) return null;
  const observedSignals = PROGRESS_SIGNAL_ORDER.flatMap((key): ScoredPracticeSignal[] => {
    const signal = result.signals.find((item) => item.signal_key === key);
    const isValid = signal?.observation_status === "observed"
      && typeof signal.score === "number"
      && Number.isFinite(signal.score)
      && signal.score >= 0
      && signal.score <= 100
      && signal.evidence_turn_ids.length > 0;
    return isValid ? [{ key, value: signal.score as number, evidenceTurnIds: [...signal.evidence_turn_ids] }] : [];
  });
  if (observedSignals.length === 0) return null;
  const canonicalIndex = calculatePartialStartingIndex(result.signals).index_value;
  if (canonicalIndex === null) return null;
  const evidenceIds = [...new Set(observedSignals.flatMap((signal) => signal.evidenceTurnIds))];
  const evidence = evidenceIds.map((turnId): ScoredPracticeEvidenceReference => {
    const approvedText = input.approvedTextByTurnId?.get(turnId)?.trim();
    return approvedText ? { turnId, approvedText } : { turnId };
  });
  return {
    schemaVersion: SCORED_PRACTICE_HISTORY_VERSION,
    id: result.rehearsal_id,
    completedAt: input.completedAt,
    rehearsalId: result.rehearsal_id,
    scenarioId: input.scenarioId.trim(),
    ...(input.scenarioTitle?.trim() ? { scenarioTitle: input.scenarioTitle.trim() } : {}),
    ...(input.moduleId ? { moduleId: input.moduleId } : {}),
    observedSignals,
    observedSignalSet: observedSignals.map((signal) => signal.key),
    overallIndex: canonicalIndex,
    evidence,
    currentFocus: result.first_focus?.first_focus_label ?? null,
  };
}

/** Adds one immutable record per rehearsal and ignores scoreless completions. */
export function appendScoredPracticeRecord(
  history: readonly ScoredPracticeRecord[],
  record: ScoredPracticeRecord | null,
): ScoredPracticeRecord[] {
  if (!record || history.some((item) => item.id === record.id)) return [...history];
  return [...history, record].sort((left, right) => left.completedAt - right.completedAt);
}

/** Recovers only structurally sound v1 records from disk; malformed legacy entries are dropped. */
export function normalizeScoredPracticeHistory(value: unknown): ScoredPracticeRecord[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((candidate): ScoredPracticeRecord[] => {
    if (!candidate || typeof candidate !== "object") return [];
    const item = candidate as Partial<ScoredPracticeRecord>;
    if (item.schemaVersion !== SCORED_PRACTICE_HISTORY_VERSION
      || typeof item.id !== "string" || !item.id.trim() || seen.has(item.id)
      || typeof item.rehearsalId !== "string" || !item.rehearsalId.trim()
      || typeof item.scenarioId !== "string" || !item.scenarioId.trim()
      || typeof item.completedAt !== "number" || !Number.isFinite(item.completedAt) || item.completedAt <= 0
      || typeof item.overallIndex !== "number" || !Number.isFinite(item.overallIndex) || item.overallIndex < 0 || item.overallIndex > 100
      || !Array.isArray(item.observedSignals) || item.observedSignals.length === 0
      || !Array.isArray(item.observedSignalSet) || !Array.isArray(item.evidence)) return [];
    const signals = item.observedSignals.flatMap((signal): ScoredPracticeSignal[] => {
      if (!signal || typeof signal !== "object") return [];
      const value = signal as Partial<ScoredPracticeSignal>;
      if (!PROGRESS_SIGNAL_ORDER.includes(value.key as SharedSignalKey)
        || typeof value.value !== "number" || !Number.isFinite(value.value) || value.value < 0 || value.value > 100
        || !Array.isArray(value.evidenceTurnIds) || value.evidenceTurnIds.length === 0
        || value.evidenceTurnIds.some((id) => typeof id !== "string" || !id.trim())) return [];
      return [{ key: value.key as SharedSignalKey, value: value.value, evidenceTurnIds: [...value.evidenceTurnIds] }];
    });
    const keys = signals.map((signal) => signal.key);
    if (signals.length !== item.observedSignals.length || new Set(keys).size !== keys.length
      || item.observedSignalSet.length !== keys.length || keys.some((key) => !item.observedSignalSet?.includes(key))) return [];
    const derivedIndex = Math.round(signals.reduce((sum, signal) => sum + signal.value, 0) / signals.length);
    if (derivedIndex !== item.overallIndex) return [];
    const referenced = new Set(signals.flatMap((signal) => signal.evidenceTurnIds));
    const evidence = item.evidence.flatMap((reference): ScoredPracticeEvidenceReference[] => {
      if (!reference || typeof reference !== "object") return [];
      const value = reference as Partial<ScoredPracticeEvidenceReference>;
      if (typeof value.turnId !== "string" || !referenced.has(value.turnId)) return [];
      return [{ turnId: value.turnId, ...(typeof value.approvedText === "string" && value.approvedText.trim() ? { approvedText: value.approvedText.trim() } : {}) }];
    });
    seen.add(item.id);
    return [{
      schemaVersion: SCORED_PRACTICE_HISTORY_VERSION,
      id: item.id,
      completedAt: item.completedAt,
      rehearsalId: item.rehearsalId,
      scenarioId: item.scenarioId,
      ...(typeof item.scenarioTitle === "string" && item.scenarioTitle.trim() ? { scenarioTitle: item.scenarioTitle.trim() } : {}),
      ...(typeof item.moduleId === "string" ? { moduleId: item.moduleId as ModuleId } : {}),
      observedSignals: signals,
      observedSignalSet: keys,
      overallIndex: item.overallIndex,
      evidence,
      currentFocus: typeof item.currentFocus === "string" && item.currentFocus.trim() ? item.currentFocus.trim() : null,
    }];
  }).sort((left, right) => left.completedAt - right.completedAt);
}

export interface HistorySignalRow {
  key: SharedSignalKey;
  label: string;
  value: number | null;
  evidenceTurnIds: readonly string[];
}

export interface ProgressHistoryPresentation {
  recordCount: number;
  indexValue: number | null;
  observedCount: number;
  chartValues: readonly number[];
  rows: readonly HistorySignalRow[];
  currentFocus: string | null;
}

/** Derives the chart, count, Index, and six current rows from one ordered history. */
export function progressHistoryPresentation(history: readonly ScoredPracticeRecord[]): ProgressHistoryPresentation {
  const ordered = [...history].sort((left, right) => left.completedAt - right.completedAt);
  const current = ordered.at(-1);
  const bySignal = new Map(current?.observedSignals.map((signal) => [signal.key, signal]) ?? []);
  const rows = PROGRESS_SIGNAL_ORDER.map((key): HistorySignalRow => {
    const signal = bySignal.get(key);
    return { key, label: PROGRESS_SIGNAL_LABELS[key], value: signal?.value ?? null, evidenceTurnIds: signal?.evidenceTurnIds ?? [] };
  });
  return {
    recordCount: ordered.length,
    indexValue: current?.overallIndex ?? null,
    observedCount: current?.observedSignals.length ?? 0,
    chartValues: ordered.map((record) => record.overallIndex),
    rows,
    currentFocus: current?.currentFocus ?? null,
  };
}

export interface DimensionHistoryPresentation {
  key: SharedSignalKey;
  label: string;
  value: number | null;
  practiceCount: number;
  history: readonly { recordId: string; completedAt: number; value: number }[];
  latestEvidence: readonly ScoredPracticeEvidenceReference[];
  currentFocus: string | null;
}

/** Uses only records where the requested signal was genuinely observed. */
export function dimensionHistoryPresentation(
  key: SharedSignalKey,
  history: readonly ScoredPracticeRecord[],
): DimensionHistoryPresentation {
  const observed = [...history].sort((left, right) => left.completedAt - right.completedAt).flatMap((record) => {
    const signal = record.observedSignals.find((item) => item.key === key);
    return signal ? [{ record, signal }] : [];
  });
  const latest = observed.at(-1);
  const evidenceById = new Map(latest?.record.evidence.map((item) => [item.turnId, item]) ?? []);
  return {
    key,
    label: PROGRESS_SIGNAL_LABELS[key],
    value: latest?.signal.value ?? null,
    practiceCount: observed.length,
    history: observed.map(({ record, signal }) => ({ recordId: record.id, completedAt: record.completedAt, value: signal.value })),
    latestEvidence: latest?.signal.evidenceTurnIds.flatMap((id) => {
      const reference = evidenceById.get(id);
      return reference ? [reference] : [];
    }) ?? [],
    currentFocus: latest?.record.currentFocus ?? null,
  };
}
