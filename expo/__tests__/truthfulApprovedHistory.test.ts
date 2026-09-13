import { expect, test } from "bun:test";
import { approvedRehearsalConfigs } from "@/lib/approvedRehearsals";
import { normalizeScoredPracticeHistory, progressHistoryPresentation, dimensionHistoryPresentation, type ScoredPracticeRecord } from "@/lib/scoredPracticeHistory";
test("legacy approved-lesson heuristic records remain stored but cannot count as measured Index evidence", () => {
  for (const config of approvedRehearsalConfigs()) {
    const record: ScoredPracticeRecord = { schemaVersion: 1, id: "legacy", completedAt: 1, rehearsalId: "legacy", scenarioId: config.scenario.id,
      observedSignals: [{ key: "clarity", value: 72, evidenceTurnIds: ["retry"] }], observedSignalSet: ["clarity"], overallIndex: 72, evidence: [{ turnId: "retry" }], currentFocus: "Old heuristic praise" };
    const history = normalizeScoredPracticeHistory([record]);
    expect(history).toHaveLength(1);
    expect(progressHistoryPresentation(history)).toMatchObject({ indexValue: null, recordCount: 0, observedCount: 0, chartValues: [], currentFocus: null });
    expect(dimensionHistoryPresentation("clarity", history)).toMatchObject({ value: null, practiceCount: 0, latestEvidence: [], currentFocus: null });
    const valid = { ...record, id: "provider", rehearsalId: "provider", scenarioId: "unrelated-provider-scene", observedSignals: [{ key: "clarity" as const, value: 60, evidenceTurnIds: ["real"] }], overallIndex: 60 };
    expect(progressHistoryPresentation([valid, record]).indexValue).toBe(60);
  }
});
