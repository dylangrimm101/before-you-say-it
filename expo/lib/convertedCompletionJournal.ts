import { normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";
import { commitConvertedProgress, type ConvertedProgressStorage } from "@/lib/convertedProgressRepository";

export const CONVERTED_COMPLETION_PENDING_KEY = "cc.convertedCompletionPending.v1";

export interface ConvertedCompletionStorage extends ConvertedProgressStorage {
  removeItem(key: string): Promise<void>;
}

/** Writes a non-visible completion candidate. This key is never read by Progress UI. */
export async function writePendingConvertedCompletion(storage: ConvertedCompletionStorage, record: ConvertedLessonProgress): Promise<void> {
  const normalized = normalizeConvertedLessonProgress([record]);
  if (normalized.length !== 1) throw new Error("Invalid pending converted completion");
  await storage.setItem(CONVERTED_COMPLETION_PENDING_KEY, JSON.stringify(normalized[0]));
}

export async function readPendingConvertedCompletion(storage: ConvertedCompletionStorage): Promise<ConvertedLessonProgress | null> {
  const raw = await storage.getItem(CONVERTED_COMPLETION_PENDING_KEY);
  if (!raw) return null;
  try {
    return normalizeConvertedLessonProgress([JSON.parse(raw) as unknown])[0] ?? null;
  } catch {
    return null;
  }
}

/** Promotes a journal entry only after private content is confirmed absent. */
export async function promotePendingConvertedCompletion(storage: ConvertedCompletionStorage, expectedRunId: string): Promise<ConvertedLessonProgress[]> {
  const pending = await readPendingConvertedCompletion(storage);
  if (!pending || pending.runId !== expectedRunId) throw new Error("Pending completion identity changed");
  const result = await commitConvertedProgress(storage, pending);
  await storage.removeItem(CONVERTED_COMPLETION_PENDING_KEY);
  return result;
}

/** On restart, promote only when the transcript-bearing active slot is already absent. */
export async function recoverPendingConvertedCompletion(
  storage: ConvertedCompletionStorage,
  activeRunRaw: string | null,
): Promise<ConvertedLessonProgress[] | null> {
  const pending = await readPendingConvertedCompletion(storage);
  if (!pending || activeRunRaw !== null) return null;
  return promotePendingConvertedCompletion(storage, pending.runId);
}
