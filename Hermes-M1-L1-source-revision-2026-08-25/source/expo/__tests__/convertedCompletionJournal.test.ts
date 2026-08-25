import { describe, expect, test } from "bun:test";

import {
  CONVERTED_COMPLETION_PENDING_KEY,
  promotePendingConvertedCompletion,
  recoverPendingConvertedCompletion,
  writePendingConvertedCompletion,
  type ConvertedCompletionStorage,
} from "@/lib/convertedCompletionJournal";
import { CONVERTED_PROGRESS_KEY, resetConvertedProgressQueueForTests } from "@/lib/convertedProgressRepository";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

class MemoryCompletionStorage implements ConvertedCompletionStorage {
  values = new Map<string, string>();
  failNextRemove = false;
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> {
    if (this.failNextRemove) { this.failNextRemove = false; throw new Error("crash before journal cleanup"); }
    this.values.delete(key);
  }
}

function record(): ConvertedLessonProgress {
  return {
    lessonId: "m1-l1", moduleId: "bysi_m01_get_to_the_point", practiceId: "bysi_m01_l01_buried_point",
    contentVersion: "m1-l1-v2.1-2026-08-24", runId: "run-journal", lessonCardCheckpoint: 22,
    quizGatesCompleted: true, rehearsalCompleted: true, retryCompleted: true, comparisonViewed: true,
    savedMoveId: "one-point-one-proof-one-move", transferChoice: "say", completedAt: 100,
    sourceLineage: "approved-html-deck-pinned",
  };
}

describe("converted completion crash journal", () => {
  test("pending completion is never visible as completed progress", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await writePendingConvertedCompletion(storage, record());
    expect(storage.values.has(CONVERTED_COMPLETION_PENDING_KEY)).toBe(true);
    expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(false);
  });

  test("restart before private-content deletion keeps completion pending", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await writePendingConvertedCompletion(storage, record());
    expect(await recoverPendingConvertedCompletion(storage, JSON.stringify({ transcript: "still private" }))).toBeNull();
    expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(false);
  });

  test("restart after deletion promotes exactly once and clears the journal", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await writePendingConvertedCompletion(storage, record());
    const recovered = await recoverPendingConvertedCompletion(storage, null);
    expect(recovered).toHaveLength(1);
    expect(storage.values.has(CONVERTED_COMPLETION_PENDING_KEY)).toBe(false);
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toHaveLength(1);
    expect(await recoverPendingConvertedCompletion(storage, null)).toBeNull();
  });

  test("restart after progress write but before journal cleanup is idempotent", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await writePendingConvertedCompletion(storage, record());
    storage.failNextRemove = true;
    await expect(promotePendingConvertedCompletion(storage, "run-journal")).rejects.toThrow("journal cleanup");
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toHaveLength(1);
    expect(storage.values.has(CONVERTED_COMPLETION_PENDING_KEY)).toBe(true);
    const recovered = await recoverPendingConvertedCompletion(storage, null);
    expect(recovered).toHaveLength(1);
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toHaveLength(1);
    expect(storage.values.has(CONVERTED_COMPLETION_PENDING_KEY)).toBe(false);
  });

  test("promotion is identity-bound", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryCompletionStorage();
    await writePendingConvertedCompletion(storage, record());
    await expect(promotePendingConvertedCompletion(storage, "other-run")).rejects.toThrow("identity changed");
    expect(storage.values.has(CONVERTED_PROGRESS_KEY)).toBe(false);
  });
});
