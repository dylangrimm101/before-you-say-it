import { describe, expect, test } from "bun:test";

import { ACTIVE_SCENARIO_RUN_KEY, QUARANTINED_SCENARIO_RUN_KEY, activeRunRevision } from "@/lib/activeScenarioRunRepository";
import {
  CONVERTED_COMPLETION_PENDING_KEY,
  markPendingPrivateContentDeleted,
  promotePendingConvertedCompletion,
  recoverPendingConvertedCompletion,
  writePendingConvertedCompletion,
  type ConvertedCompletionStorage,
} from "@/lib/convertedCompletionJournal";
import { CONVERTED_PROGRESS_KEY, resetConvertedProgressQueueForTests } from "@/lib/convertedProgressRepository";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import type { Scenario } from "@/types/convo";

class MemoryCompletionStorage implements ConvertedCompletionStorage {
  values = new Map<string, string>();
  failRemoveKey: string | null = null;
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> {
    if (this.failRemoveKey === key) { this.failRemoveKey = null; throw new Error(`crash removing ${key}`); }
    this.values.delete(key);
  }
}

const scenario: Scenario = { id: "journal", category: "work", title: "Journal", counterpart: "Adam — colleague", situation: "Handoff", persona: "Direct", goal: "Ask", openingLine: "", opensWith: "user" };
const active = createScenarioPracticeRun(scenario, "steady", "defensive", "run-journal", 50);
const revision = activeRunRevision(active)!;

function record(): ConvertedLessonProgress {
  return {
    lessonId: "m1-l1", moduleId: "bysi_m01_get_to_the_point", practiceId: "bysi_m01_l01_buried_point",
    contentVersion: "m1-l1-v2.1-2026-08-24", runId: "run-journal", lessonCardCheckpoint: 22,
    quizGatesCompleted: true, rehearsalCompleted: true, retryCompleted: true, comparisonViewed: true,
    savedMoveId: "one-point-one-proof-one-move", transferChoice: "say", completedAt: 100,
    sourceLineage: "approved-html-deck-pinned",
  };
}

async function pending(storage: MemoryCompletionStorage): Promise<void> {
  storage.values.set(ACTIVE_SCENARIO_RUN_KEY, JSON.stringify(active));
  await writePendingConvertedCompletion(storage, record(), revision);
}

describe("converted completion phase-aware crash journal", () => {
  test("restart resumes awaiting private cleanup before clearing and promoting", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    const deleted: string[] = [];
    expect(await recoverPendingConvertedCompletion(storage, async (runId) => { deleted.push(runId); })).toHaveLength(1);
    expect(deleted).toEqual(["run-journal"]);
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(true);
  });

  test("after strict deletion, restart clears the exact active revision and promotes once", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    await markPendingPrivateContentDeleted(storage, "run-journal");
    const recovered = await recoverPendingConvertedCompletion(storage, async () => {});
    expect(recovered).toHaveLength(1);
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(CONVERTED_COMPLETION_PENDING_KEY)).toBe(false);
    expect(await recoverPendingConvertedCompletion(storage, async () => {})).toBeNull();
  });

  test("active-key removal failure remains recoverable without repeating visible completion", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    await markPendingPrivateContentDeleted(storage, "run-journal");
    storage.failRemoveKey = ACTIVE_SCENARIO_RUN_KEY;
    await expect(recoverPendingConvertedCompletion(storage, async () => {})).rejects.toThrow("crash removing");
    expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(false);
    expect(await recoverPendingConvertedCompletion(storage, async () => {})).toHaveLength(1);
  });

  test("progress-write then journal-cleanup failure is idempotent", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    await markPendingPrivateContentDeleted(storage, "run-journal");
    storage.values.delete(ACTIVE_SCENARIO_RUN_KEY);
    storage.failRemoveKey = CONVERTED_COMPLETION_PENDING_KEY;
    await expect(promotePendingConvertedCompletion(storage, "run-journal")).rejects.toThrow("crash removing");
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toHaveLength(1);
    expect(await recoverPendingConvertedCompletion(storage, async () => {})).toHaveLength(1);
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toHaveLength(1);
  });

  test("malformed active JSON is quarantined only after restart audio cleanup uses journal identity", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    storage.values.set(ACTIVE_SCENARIO_RUN_KEY, "{bad json");
    const order: string[] = [];
    const recovered = await recoverPendingConvertedCompletion(storage, async (runId) => { order.push(`delete:${runId}`); });
    expect(recovered).toHaveLength(1);
    expect(order).toEqual(["delete:run-journal"]);
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(QUARANTINED_SCENARIO_RUN_KEY)).toBe(true);
  });

  test("web recovery promotes completion without loading unsupported native file APIs", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    const prior = process.env.EXPO_OS;
    process.env.EXPO_OS = "web";
    try {
      expect(await recoverPendingConvertedCompletion(storage)).toHaveLength(1);
      expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
      expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(true);
    } finally {
      if (prior === undefined) delete process.env.EXPO_OS;
      else process.env.EXPO_OS = prior;
    }
  });

  test("journal identity and phase are enforced", async () => {
    const storage = new MemoryCompletionStorage();
    await pending(storage);
    await expect(markPendingPrivateContentDeleted(storage, "other-run")).rejects.toThrow("identity changed");
    await expect(promotePendingConvertedCompletion(storage, "run-journal")).rejects.toThrow("not confirmed");
  });
});
