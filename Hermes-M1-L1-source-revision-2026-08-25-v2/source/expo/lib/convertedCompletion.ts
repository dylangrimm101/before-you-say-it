import type { ActiveRunRevision } from "@/lib/activeScenarioRunRepository";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

export interface ConvertedCompletionActions {
  expectedActiveRevision: ActiveRunRevision;
  writePending(record: ConvertedLessonProgress, expected: ActiveRunRevision): Promise<void>;
  markPrivateContentDeleted(expectedRunId: string): Promise<void>;
  clearActiveRunStrict(expectedRunId: string, afterPrivateCleanup: () => Promise<void>): Promise<void>;
  promotePending(expectedRunId: string): Promise<void>;
}

/** Journaled completion never exposes progress before strict private-content deletion. */
export async function finalizeConvertedLesson(record: ConvertedLessonProgress, actions: ConvertedCompletionActions): Promise<void> {
  await actions.writePending(record, actions.expectedActiveRevision);
  await actions.clearActiveRunStrict(record.runId, () => actions.markPrivateContentDeleted(record.runId));
  await actions.promotePending(record.runId);
}
