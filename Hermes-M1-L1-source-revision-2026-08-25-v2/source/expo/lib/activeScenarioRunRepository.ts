import { normalizeScenarioPracticeRun, type PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";

export const ACTIVE_SCENARIO_RUN_KEY = "cc.activeScenarioRun.v1";
export const ARCHIVED_SCENARIO_RUNS_KEY = "cc.archivedScenarioRuns.v1";
export const QUARANTINED_SCENARIO_RUN_KEY = "cc.quarantinedScenarioRun.v1";

export interface ActiveRunStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface ActiveRunRevision {
  runId: string;
  updatedAt: number;
}

let operationQueue: Promise<void> = Promise.resolve();

function serialize<T>(work: () => Promise<T>): Promise<T> {
  let result: T;
  const operation = operationQueue.then(async () => { result = await work(); });
  operationQueue = operation.then(() => undefined, () => undefined);
  return operation.then(() => result!);
}

async function quarantineMalformed(storage: ActiveRunStorage, raw: string): Promise<void> {
  await storage.setItem(QUARANTINED_SCENARIO_RUN_KEY, JSON.stringify({ quarantinedAt: Date.now(), reason: "invalid_active_run", removedByteCount: raw.length }));
  await storage.removeItem(ACTIVE_SCENARIO_RUN_KEY);
}

/** Reads canonical active storage and deterministically quarantines malformed bytes. */
export async function readActiveScenarioRunStrict(storage: ActiveRunStorage): Promise<PersistedScenarioPracticeRun | null> {
  const raw = await storage.getItem(ACTIVE_SCENARIO_RUN_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw) as unknown; } catch {
    await quarantineMalformed(storage, raw);
    throw new Error("Malformed active scenario run was quarantined");
  }
  const normalized = normalizeScenarioPracticeRun(parsed);
  if (!normalized) {
    await quarantineMalformed(storage, raw);
    throw new Error("Invalid active scenario run was quarantined");
  }
  return normalized;
}

async function latest(storage: ActiveRunStorage): Promise<PersistedScenarioPracticeRun | null> {
  return readActiveScenarioRunStrict(storage);
}

function assertExpected(current: PersistedScenarioPracticeRun | null, expected: ActiveRunRevision | null): void {
  if (!expected) {
    if (current) throw new Error("Active scenario run changed");
    return;
  }
  if (current?.run.id !== expected.runId || current.run.updatedAt !== expected.updatedAt) {
    throw new Error("Active scenario run revision changed");
  }
}

export function activeRunRevision(value: PersistedScenarioPracticeRun | null | undefined): ActiveRunRevision | null {
  return value ? { runId: value.run.id, updatedAt: value.run.updatedAt } : null;
}

/** Compare-and-swap replacement against the latest durable active run. */
export function replaceActiveScenarioRunCAS(
  storage: ActiveRunStorage,
  value: PersistedScenarioPracticeRun,
  expected: ActiveRunRevision | null,
): Promise<PersistedScenarioPracticeRun> {
  return serialize(async () => {
    const normalized = normalizeScenarioPracticeRun(value);
    if (!normalized) throw new Error("Invalid active scenario run");
    assertExpected(await latest(storage), expected);
    await storage.setItem(ACTIVE_SCENARIO_RUN_KEY, JSON.stringify(normalized));
    return normalized;
  });
}

/** Compare-and-swap deletion; optional private-content cleanup runs before the key is removed. */
export function clearActiveScenarioRunCAS(
  storage: ActiveRunStorage,
  expected: ActiveRunRevision,
  beforeRemove?: (run: PersistedScenarioPracticeRun) => Promise<void>,
  afterCleanupBeforeRemove?: (run: PersistedScenarioPracticeRun) => Promise<void>,
): Promise<void> {
  return serialize(async () => {
    const current = await latest(storage);
    assertExpected(current, expected);
    if (!current) throw new Error("Active scenario run is missing");
    await beforeRemove?.(current);
    await afterCleanupBeforeRemove?.(current);
    await storage.removeItem(ACTIVE_SCENARIO_RUN_KEY);
  });
}

/** Archives and clears only the expected latest durable run. */
export function archiveActiveScenarioRunCAS(storage: ActiveRunStorage, expected: ActiveRunRevision): Promise<void> {
  return serialize(async () => {
    const current = await latest(storage);
    assertExpected(current, expected);
    if (!current) throw new Error("Active scenario run is missing");
    const raw = await storage.getItem(ARCHIVED_SCENARIO_RUNS_KEY);
    let existing: PersistedScenarioPracticeRun[] = [];
    try {
      const parsed = raw ? JSON.parse(raw) as unknown : [];
      if (Array.isArray(parsed)) existing = parsed.map(normalizeScenarioPracticeRun).filter((item): item is PersistedScenarioPracticeRun => Boolean(item));
    } catch {
      existing = [];
    }
    const next = [...existing.filter((item) => item.run.id !== current.run.id), current];
    await storage.setItem(ARCHIVED_SCENARIO_RUNS_KEY, JSON.stringify(next));
    await storage.removeItem(ACTIVE_SCENARIO_RUN_KEY);
  });
}

export function resetActiveRunQueueForTests(): void {
  operationQueue = Promise.resolve();
}
