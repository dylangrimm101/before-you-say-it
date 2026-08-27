import { describe, expect, test } from "bun:test";

import {
  appendScoredPracticeRecord,
  createScoredPracticeRecord,
  dimensionHistoryPresentation,
  normalizeScoredPracticeHistory,
  progressHistoryPresentation,
  type ScoredPracticeRecord,
} from "@/lib/scoredPracticeHistory";
import { PROGRESS_SIGNAL_ORDER } from "@/lib/progressEvidence";
import { isSharedSignalKey } from "@/lib/paidProduct";
import type { SharedResultContractV1, SharedSignalKey } from "@/types/sharedProduct";

function result(id: string, values: Partial<Record<SharedSignalKey, number>>): SharedResultContractV1 {
  return {
    contract_version: 1,
    rehearsal_id: id,
    pressure_moment: null,
    practice_shift: null,
    signals: PROGRESS_SIGNAL_ORDER.map((key) => {
      const value = values[key];
      return {
        signal_key: key,
        observation_status: value === undefined ? "unobserved" as const : "observed" as const,
        score: value ?? null,
        evidence_turn_ids: value === undefined ? [] : [`${id}-${key}`],
        signal_version: "signal-v1" as const,
      };
    }),
    starting_index: null,
    first_focus: { first_focus_key: "clear-ask", first_focus_label: "Make one answerable request", recommended_module_id: "make_a_clear_ask", focus_status: "suggested", focus_version: "first-focus-v1" },
  };
}

function record(id: string, completedAt: number, values: Partial<Record<SharedSignalKey, number>>): ScoredPracticeRecord {
  const scored = createScoredPracticeRecord(result(id, values), {
    completedAt,
    scenarioId: "chores",
    scenarioTitle: "Ask for a fair split",
    approvedTextByTurnId: new Map(PROGRESS_SIGNAL_ORDER.map((key) => [`${id}-${key}`, `Approved ${key} evidence ${id}`])),
  });
  if (!scored) throw new Error("Expected scored record");
  return scored;
}

describe("canonical scored-practice history", () => {
  test("no records produces an insufficient starting state", () => {
    expect(progressHistoryPresentation([])).toEqual({
      recordCount: 0,
      indexValue: null,
      observedCount: 0,
      chartValues: [],
      rows: PROGRESS_SIGNAL_ORDER.map((key) => ({ key, label: key[0]?.toUpperCase() + key.slice(1), value: null, evidenceTurnIds: [] })),
      currentFocus: null,
    });
  });

  test("one partial record uses only observed values", () => {
    const history = [record("one", 1000, { clarity: 40, specificity: 80 })];
    const view = progressHistoryPresentation(history);
    expect(view.recordCount).toBe(1);
    expect(view.indexValue).toBe(60);
    expect(view.observedCount).toBe(2);
    expect(view.rows.map((row) => row.value)).toEqual([40, 80, null, null, null, null]);
  });

  test("multiple records create exactly one chart point per scored practice", () => {
    const history = [record("one", 1000, { clarity: 40 }), record("two", 2000, { clarity: 60 }), record("three", 3000, { clarity: 50 })];
    expect(progressHistoryPresentation(history).chartValues).toEqual([40, 60, 50]);
  });

  test("flat results remain flat without judgment", () => {
    expect(progressHistoryPresentation([record("a", 1, { clarity: 55 }), record("b", 2, { clarity: 55 })]).chartValues).toEqual([55, 55]);
  });

  test("a lower latest result remains lower", () => {
    const view = progressHistoryPresentation([record("a", 1, { clarity: 80 }), record("b", 2, { clarity: 40 })]);
    expect(view.chartValues).toEqual([80, 40]);
    expect(view.indexValue).toBe(40);
  });

  test("a higher latest result remains higher", () => {
    expect(progressHistoryPresentation([record("a", 1, { clarity: 40 }), record("b", 2, { clarity: 80 })]).chartValues).toEqual([40, 80]);
  });

  test("a newly observed signal appears only in the current record", () => {
    const view = progressHistoryPresentation([record("a", 1, { clarity: 50 }), record("b", 2, { clarity: 50, repair: 70 })]);
    expect(view.observedCount).toBe(2);
    expect(view.rows.find((row) => row.key === "repair")?.value).toBe(70);
  });

  test("a later practice updates only what it observed and preserves earlier signal evidence", () => {
    const history = [record("a", 1, { clarity: 50, repair: 70 }), record("b", 2, { clarity: 60 })];
    expect(progressHistoryPresentation(history).rows.find((row) => row.key === "repair")?.value).toBe(70);
    expect(progressHistoryPresentation(history).indexValue).toBe(65);
    expect(dimensionHistoryPresentation("repair", history).practiceCount).toBe(1);
  });

  test("restart persistence round-trips the canonical records", () => {
    const history = [record("a", 1, { clarity: 50 }), record("b", 2, { specificity: 60 })];
    expect(normalizeScoredPracticeHistory(JSON.parse(JSON.stringify(history)))).toEqual(history);
  });

  test("local reset produces empty history", () => {
    expect(normalizeScoredPracticeHistory(null)).toEqual([]);
  });

  test("activity completion without a genuine score adds no record", () => {
    const scoreless = createScoredPracticeRecord(result("none", {}), { completedAt: 1, scenarioId: "chores" });
    expect(scoreless).toBeNull();
    expect(appendScoredPracticeRecord([record("a", 1, { clarity: 50 })], scoreless)).toHaveLength(1);
  });

  test("malformed legacy history recovers valid records and drops invalid entries", () => {
    const valid = record("valid", 1, { clarity: 50 });
    const malformed = { ...valid, id: "bad", overallIndex: 99 };
    expect(normalizeScoredPracticeHistory([malformed, null, valid, valid])).toEqual([valid]);
  });

  test("observed Dimension history includes only practices where the signal was observed", () => {
    const history = [record("a", 1, { clarity: 50 }), record("b", 2, { repair: 30 }), record("c", 3, { clarity: 70 })];
    const detail = dimensionHistoryPresentation("clarity", history);
    expect(detail.value).toBe(70);
    expect(detail.practiceCount).toBe(2);
    expect(detail.history.map((item) => item.value)).toEqual([50, 70]);
    expect(detail.latestEvidence[0]?.approvedText).toBe("Approved clarity evidence c");
  });

  test("unobserved Dimension history has no score, chart, or evidence", () => {
    const detail = dimensionHistoryPresentation("repair", [record("a", 1, { clarity: 50 })]);
    expect(detail.value).toBeNull();
    expect(detail.practiceCount).toBe(0);
    expect(detail.history).toEqual([]);
    expect(detail.latestEvidence).toEqual([]);
  });

  test("invalid Dimension keys fail closed before history derivation", () => {
    expect(isSharedSignalKey("clarity")).toBe(true);
    expect(isSharedSignalKey("confidence")).toBe(false);
    expect(isSharedSignalKey(undefined)).toBe(false);
  });

  test("intermittent Dimension history omits unobserved gaps", () => {
    const history = [record("a", 1, { repair: 20 }), record("b", 2, { clarity: 50 }), record("c", 3, { repair: 40 })];
    expect(dimensionHistoryPresentation("repair", history).history.map((item) => item.recordId)).toEqual(["a", "c"]);
  });
});
