import { mergeConvertedLessonProgress, normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";

export interface ConvertedProgressStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ConvertedLessonResetResult {
  next: ConvertedLessonProgress[];
  removed: ConvertedLessonProgress[];
}

export const CONVERTED_PROGRESS_KEY = "cc.convertedLessonProgress.v1";

let commitQueue: Promise<void> = Promise.resolve();

/** Reads only strictly valid scoreless progress records. */
export async function readConvertedProgress(storage: ConvertedProgressStorage): Promise<ConvertedLessonProgress[]> {
  const raw = await storage.getItem(CONVERTED_PROGRESS_KEY);
  if (!raw) return [];
  try {
    return normalizeConvertedLessonProgress(JSON.parse(raw) as unknown);
  } catch {
    return [];
  }
}

/** Serializes commits and merges against latest durable state, never a React closure. */
export function commitConvertedProgress(storage: ConvertedProgressStorage, record: ConvertedLessonProgress): Promise<ConvertedLessonProgress[]> {
  let result: ConvertedLessonProgress[] = [];
  const operation = commitQueue.then(async () => {
    const latest = await readConvertedProgress(storage);
    result = mergeConvertedLessonProgress(latest, record);
    await storage.setItem(CONVERTED_PROGRESS_KEY, JSON.stringify(result));
  });
  commitQueue = operation.then(() => undefined, () => undefined);
  return operation.then(() => result);
}

/** Removes every completion version for one lesson against the latest durable state. */
export function resetConvertedLessonProgress(
  storage: ConvertedProgressStorage,
  lessonId: ConvertedLessonProgress["lessonId"],
): Promise<ConvertedLessonResetResult> {
  let result: ConvertedLessonResetResult = { next: [], removed: [] };
  const operation = commitQueue.then(async () => {
    const latest = await readConvertedProgress(storage);
    const removed = latest.filter((record) => record.lessonId === lessonId);
    const next = latest.filter((record) => record.lessonId !== lessonId);
    await storage.setItem(CONVERTED_PROGRESS_KEY, JSON.stringify(next));
    result = { next, removed };
  });
  commitQueue = operation.then(() => undefined, () => undefined);
  return operation.then(() => result);
}

/** Restores a just-reset lesson without replacing progress created for other lessons. */
export function restoreConvertedLessonProgress(
  storage: ConvertedProgressStorage,
  lessonId: ConvertedLessonProgress["lessonId"],
  snapshot: readonly ConvertedLessonProgress[],
): Promise<ConvertedLessonProgress[]> {
  let result: ConvertedLessonProgress[] = [];
  const operation = commitQueue.then(async () => {
    const restored = normalizeConvertedLessonProgress(snapshot).filter((record) => record.lessonId === lessonId);
    if (restored.length !== snapshot.length) throw new Error("Invalid converted lesson undo snapshot");
    const latest = await readConvertedProgress(storage);
    result = normalizeConvertedLessonProgress([
      ...latest.filter((record) => record.lessonId !== lessonId),
      ...restored,
    ]).sort((a, b) => a.completedAt - b.completedAt);
    await storage.setItem(CONVERTED_PROGRESS_KEY, JSON.stringify(result));
  });
  commitQueue = operation.then(() => undefined, () => undefined);
  return operation.then(() => result);
}

/** Test-only queue reset; production never needs to clear serialization state. */
export function resetConvertedProgressQueueForTests(): void {
  commitQueue = Promise.resolve();
}
