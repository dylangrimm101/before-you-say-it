import { ACTIVE_SCENARIO_RUN_KEY, QUARANTINED_SCENARIO_RUN_KEY, type ActiveRunRevision } from "@/lib/activeScenarioRunRepository";
import { normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";
import { commitConvertedProgress, type ConvertedProgressStorage } from "@/lib/convertedProgressRepository";
import { normalizeScenarioPracticeRun } from "@/lib/scenarioPractice";

export const CONVERTED_COMPLETION_PENDING_KEY = "cc.convertedCompletionPending.v1";

type CompletionPhase = "awaiting_private_cleanup" | "private_content_deleted";

export interface PendingConvertedCompletion {
  version: 2;
  phase: CompletionPhase;
  record: ConvertedLessonProgress;
  expectedActiveRevision: ActiveRunRevision;
}

export interface ConvertedCompletionStorage extends ConvertedProgressStorage {
  removeItem(key: string): Promise<void>;
}

function parsePending(raw: string | null): PendingConvertedCompletion | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingConvertedCompletion>;
    const record = normalizeConvertedLessonProgress([value.record])[0];
    const revision = value.expectedActiveRevision;
    if (value.version !== 2 || !record || !revision || revision.runId !== record.runId || !Number.isSafeInteger(revision.updatedAt)) return null;
    if (value.phase !== "awaiting_private_cleanup" && value.phase !== "private_content_deleted") return null;
    return { version: 2, phase: value.phase, record, expectedActiveRevision: { runId: revision.runId, updatedAt: revision.updatedAt } };
  } catch {
    return null;
  }
}

/** Writes a non-visible, identity-bound completion candidate. */
export async function writePendingConvertedCompletion(
  storage: ConvertedCompletionStorage,
  record: ConvertedLessonProgress,
  expectedActiveRevision: ActiveRunRevision,
): Promise<void> {
  const normalized = normalizeConvertedLessonProgress([record])[0];
  if (!normalized || expectedActiveRevision.runId !== normalized.runId || !Number.isSafeInteger(expectedActiveRevision.updatedAt)) throw new Error("Invalid pending converted completion");
  const existing = parsePending(await storage.getItem(CONVERTED_COMPLETION_PENDING_KEY));
  if (existing && existing.record.runId !== normalized.runId) throw new Error("Another completion is pending");
  const pending: PendingConvertedCompletion = { version: 2, phase: "awaiting_private_cleanup", record: normalized, expectedActiveRevision };
  await storage.setItem(CONVERTED_COMPLETION_PENDING_KEY, JSON.stringify(pending));
}

export async function readPendingConvertedCompletion(storage: ConvertedCompletionStorage): Promise<PendingConvertedCompletion | null> {
  return parsePending(await storage.getItem(CONVERTED_COMPLETION_PENDING_KEY));
}

/** Records the durable privacy boundary after strict audio deletion and before active-key removal. */
export async function markPendingPrivateContentDeleted(storage: ConvertedCompletionStorage, expectedRunId: string): Promise<void> {
  const pending = await readPendingConvertedCompletion(storage);
  if (!pending || pending.record.runId !== expectedRunId) throw new Error("Pending completion identity changed");
  await storage.setItem(CONVERTED_COMPLETION_PENDING_KEY, JSON.stringify({ ...pending, phase: "private_content_deleted" } satisfies PendingConvertedCompletion));
}

/** Promotes a journal entry only after private content is confirmed deleted. */
export async function promotePendingConvertedCompletion(storage: ConvertedCompletionStorage, expectedRunId: string): Promise<ConvertedLessonProgress[]> {
  const pending = await readPendingConvertedCompletion(storage);
  if (!pending || pending.record.runId !== expectedRunId) throw new Error("Pending completion identity changed");
  if (pending.phase !== "private_content_deleted") throw new Error("Private content deletion is not confirmed");
  const result = await commitConvertedProgress(storage, pending.record);
  await storage.removeItem(CONVERTED_COMPLETION_PENDING_KEY);
  return result;
}

async function clearExpectedActiveKeyAfterDeletion(storage: ConvertedCompletionStorage, pending: PendingConvertedCompletion): Promise<void> {
  const raw = await storage.getItem(ACTIVE_SCENARIO_RUN_KEY);
  if (!raw) return;
  let normalized;
  try { normalized = normalizeScenarioPracticeRun(JSON.parse(raw) as unknown); } catch { normalized = null; }
  if (!normalized) {
    await storage.setItem(QUARANTINED_SCENARIO_RUN_KEY, JSON.stringify({ quarantinedAt: Date.now(), reason: "invalid_active_run_after_private_cleanup", removedByteCount: raw.length }));
    await storage.removeItem(ACTIVE_SCENARIO_RUN_KEY);
    return;
  }
  const expected = pending.expectedActiveRevision;
  if (normalized.run.id !== expected.runId || normalized.run.updatedAt !== expected.updatedAt) throw new Error("Active scenario run revision changed during completion recovery");
  await storage.removeItem(ACTIVE_SCENARIO_RUN_KEY);
}

/** Recovers exactly once from every boundary after strict private-content deletion. */
export async function recoverPendingConvertedCompletion(storage: ConvertedCompletionStorage): Promise<ConvertedLessonProgress[] | null> {
  const pending = await readPendingConvertedCompletion(storage);
  if (!pending || pending.phase === "awaiting_private_cleanup") return null;
  await clearExpectedActiveKeyAfterDeletion(storage, pending);
  return promotePendingConvertedCompletion(storage, pending.record.runId);
}
