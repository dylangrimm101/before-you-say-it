import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

export interface ConvertedCompletionActions {
  writePending(record: ConvertedLessonProgress): Promise<void>;
  clearActiveRunStrict(expectedRunId: string): Promise<void>;
  promotePending(expectedRunId: string): Promise<void>;
}

/** Journaled completion never exposes progress before strict private-content deletion. */
export async function finalizeConvertedLesson(record: ConvertedLessonProgress, actions: ConvertedCompletionActions): Promise<void> {
  await actions.writePending(record);
  await actions.clearActiveRunStrict(record.runId);
  await actions.promotePending(record.runId);
}
