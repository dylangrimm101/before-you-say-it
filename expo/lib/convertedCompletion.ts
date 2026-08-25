import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

export interface ConvertedCompletionActions {
  commit(record: ConvertedLessonProgress): Promise<void>;
  clearActiveRunStrict(): Promise<void>;
}

/** Completion resolves only after durable scoreless progress and strict content deletion. */
export async function finalizeConvertedLesson(record: ConvertedLessonProgress, actions: ConvertedCompletionActions): Promise<void> {
  await actions.commit(record);
  await actions.clearActiveRunStrict();
}
