import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";
import {
  CONVERTED_PROGRESS_KEY,
  resetConvertedLessonProgress,
  resetConvertedProgressQueueForTests,
  restoreConvertedLessonProgress,
  type ConvertedProgressStorage,
} from "@/lib/convertedProgressRepository";

class MemoryProgressStorage implements ConvertedProgressStorage {
  values = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

function completion(lessonId: "m2-l1" | "m2-l2", completedAt: number): ConvertedLessonProgress {
  const config = approvedRehearsalConfig(lessonId)!;
  return {
    lessonId,
    moduleId: config.moduleId,
    practiceId: config.practiceId,
    contentVersion: config.contentVersion,
    runId: `run-${lessonId}-${completedAt}`,
    lessonCardCheckpoint: config.completionCard,
    quizGatesCompleted: true,
    rehearsalCompleted: true,
    retryCompleted: true,
    comparisonViewed: true,
    savedMoveId: config.namedMoveId,
    transferChoice: "say",
    completedAt,
    sourceLineage: "approved-html-deck-pinned",
  };
}

describe("converted lesson reset and undo", () => {
  beforeEach(() => resetConvertedProgressQueueForTests());

  test("clears only the selected lesson and returns a reversible minimized snapshot", async () => {
    const storage = new MemoryProgressStorage();
    const selected = completion("m2-l1", 10);
    const other = completion("m2-l2", 20);
    storage.values.set(CONVERTED_PROGRESS_KEY, JSON.stringify([selected, other]));

    const result = await resetConvertedLessonProgress(storage, "m2-l1");

    expect(result.removed).toEqual([selected]);
    expect(result.next).toEqual([other]);
    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toEqual([other]);
  });

  test("undo restores completion without disturbing another lesson", async () => {
    const storage = new MemoryProgressStorage();
    const selected = completion("m2-l1", 10);
    const other = completion("m2-l2", 20);
    storage.values.set(CONVERTED_PROGRESS_KEY, JSON.stringify([other]));

    const restored = await restoreConvertedLessonProgress(storage, "m2-l1", [selected]);

    expect(restored).toEqual([selected, other]);
  });

  test("rejects an undo snapshot belonging to a different lesson", async () => {
    const storage = new MemoryProgressStorage();
    await expect(restoreConvertedLessonProgress(storage, "m2-l1", [completion("m2-l2", 20)]))
      .rejects.toThrow("Invalid converted lesson undo snapshot");
  });

  test("serializes reset with an overlapping undo without losing unrelated progress", async () => {
    const storage = new MemoryProgressStorage();
    const selected = completion("m2-l1", 10);
    const other = completion("m2-l2", 20);
    storage.values.set(CONVERTED_PROGRESS_KEY, JSON.stringify([selected, other]));

    const reset = await resetConvertedLessonProgress(storage, "m2-l1");
    await restoreConvertedLessonProgress(storage, "m2-l1", reset.removed);

    expect(JSON.parse(storage.values.get(CONVERTED_PROGRESS_KEY) ?? "[]")).toEqual([selected, other]);
  });
});
