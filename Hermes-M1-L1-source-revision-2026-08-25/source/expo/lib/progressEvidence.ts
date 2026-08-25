import type { SharedResultContractV1, SharedSignalKey } from "@/types/sharedProduct";

export const PROGRESS_SIGNAL_ORDER = ["clarity", "specificity", "listening", "steadiness", "boundaries", "repair"] as const satisfies readonly SharedSignalKey[];

export const PROGRESS_SIGNAL_LABELS: Record<SharedSignalKey, string> = {
  clarity: "Clarity",
  specificity: "Specificity",
  listening: "Listening",
  steadiness: "Steadiness",
  boundaries: "Boundaries",
  repair: "Repair",
};

export interface ProgressEvidenceRow {
  key: SharedSignalKey;
  label: string;
  value: number | null;
  evidenceTurnIds: readonly string[];
}

export interface ProgressEvidencePresentation {
  indexValue: number | null;
  observedCount: number;
  rows: readonly ProgressEvidenceRow[];
}

/** Builds the Index, count, and six rows from the same observed signal records. */
export function progressEvidencePresentation(result: SharedResultContractV1 | undefined): ProgressEvidencePresentation {
  const bySignal = new Map(result?.signals.map((signal) => [signal.signal_key, signal]) ?? []);
  const rows = PROGRESS_SIGNAL_ORDER.map((key): ProgressEvidenceRow => {
    const signal = bySignal.get(key);
    const isObserved = signal?.observation_status === "observed" && signal.score !== null && signal.evidence_turn_ids.length > 0;
    return {
      key,
      label: PROGRESS_SIGNAL_LABELS[key],
      value: isObserved ? signal.score : null,
      evidenceTurnIds: isObserved ? signal.evidence_turn_ids : [],
    };
  });
  const values = rows.flatMap((row) => row.value === null ? [] : [row.value]);
  return {
    indexValue: values.length === 0 ? null : Math.round(values.reduce((total, value) => total + value, 0) / values.length),
    observedCount: values.length,
    rows,
  };
}
