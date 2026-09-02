import { migrateSessions, type MigrationResult } from "@/lib/sessionMigration";

export interface SessionMigrationStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

function isJsonArray(raw: string | null): boolean {
  if (raw === null) return false;
  try { return Array.isArray(JSON.parse(raw)); } catch { return false; }
}

/**
 * Chooses the newest usable minimized history and retires v1 only after a
 * canonical v2 write has been read back and verified. A coexisting empty or
 * malformed v2 is treated as an interrupted migration when v1 has records.
 */
export async function migrateSessionStorage(
  storage: SessionMigrationStorage,
  legacyKey: string,
  currentKey: string,
  options: { preserveCustomScenarioText?: boolean } = {},
): Promise<MigrationResult> {
  const [currentRaw, legacyRaw] = await Promise.all([
    storage.getItem(currentKey),
    storage.getItem(legacyKey),
  ]);
  const current = migrateSessions(currentRaw ?? [], options);
  const legacy = migrateSessions(legacyRaw ?? [], options);
  const currentUsable = isJsonArray(currentRaw) && (current.records.length > 0 || legacy.records.length === 0);
  const records = currentUsable ? current.records : legacy.records;
  const removedContentFrom = current.removedContentFrom + legacy.removedContentFrom;
  const canonical = JSON.stringify(records);
  const currentNeedsCanonicalWrite = currentRaw !== canonical;

  if (legacyRaw !== null || current.removedContentFrom > 0 || !isJsonArray(currentRaw) || currentNeedsCanonicalWrite) {
    await storage.setItem(currentKey, canonical);
    const verified = migrateSessions(await storage.getItem(currentKey), options);
    if (JSON.stringify(verified.records) !== canonical) throw new Error("Session migration verification failed");
    if (legacyRaw !== null) await storage.removeItem(legacyKey);
  }

  return { records, removedContentFrom };
}
