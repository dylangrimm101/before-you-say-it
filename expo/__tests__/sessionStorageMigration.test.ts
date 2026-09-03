import { describe, expect, test } from "bun:test";

import { migrateSessionStorage, type SessionMigrationStorage } from "@/lib/sessionStorageMigration";

class MemoryStorage implements SessionMigrationStorage {
  values = new Map<string, string>();
  failWrite = false;
  writes: string[] = [];
  removes: string[] = [];
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> {
    this.writes.push(key);
    if (this.failWrite) throw new Error("interrupted write");
    this.values.set(key, value);
  }
  async removeItem(key: string): Promise<void> { this.removes.push(key); this.values.delete(key); }
}

const V1 = "cc.sessions.v1";
const V2 = "cc.sessions.v2";
const legacy = JSON.stringify([{ id: "legacy-valid", scenarioId: "chores", turns: [{ role: "user", text: "PRIVATE" }], startedAt: 1 }]);

describe("crash-safe session storage migration", () => {
  test.each(["{malformed", "[]"])("recovers valid v1 when coexisting v2 is %s", async (v2) => {
    const storage = new MemoryStorage();
    storage.values.set(V1, legacy);
    storage.values.set(V2, v2);
    const result = await migrateSessionStorage(storage, V1, V2);
    expect(result.records.map((record) => record.id)).toEqual(["legacy-valid"]);
    expect(storage.values.has(V1)).toBe(false);
    expect(JSON.parse(storage.values.get(V2) ?? "[]")[0].id).toBe("legacy-valid");
  });

  test("never deletes v1 when the verified v2 write is interrupted", async () => {
    const storage = new MemoryStorage();
    storage.values.set(V1, legacy);
    storage.failWrite = true;
    await expect(migrateSessionStorage(storage, V1, V2)).rejects.toThrow("interrupted write");
    expect(storage.values.get(V1)).toBe(legacy);
    expect(storage.removes).not.toContain(V1);
  });

  test("rewrites consent-off v2 records that still contain custom labels", async () => {
    const storage = new MemoryStorage();
    storage.values.set(V2, JSON.stringify([{ schemaVersion: 2, id: "custom", scenarioId: "custom-private", title: "PRIVATE TITLE", counterpart: "PRIVATE PERSON", category: "work", difficulty: "steady", skillIds: [], turnCount: 0, userTurnCount: 0, retryCount: 0, completed: true, startedAt: 2, contentRetained: false }]));
    const result = await migrateSessionStorage(storage, V1, V2);
    expect(result.records[0]?.title).toBeUndefined();
    expect(storage.values.get(V2)).not.toContain("PRIVATE TITLE");
    expect(storage.values.get(V2)).not.toContain("PRIVATE PERSON");
  });

  test("prefers a valid non-empty v2 during interrupted coexistence", async () => {
    const storage = new MemoryStorage();
    storage.values.set(V1, legacy);
    storage.values.set(V2, JSON.stringify([{ schemaVersion: 2, id: "newer", scenarioId: "raise", category: "work", difficulty: "steady", skillIds: [], turnCount: 0, userTurnCount: 0, retryCount: 0, completed: true, startedAt: 2, contentRetained: false }]));
    const result = await migrateSessionStorage(storage, V1, V2);
    expect(result.records.map((record) => record.id)).toEqual(["newer"]);
    expect(storage.values.has(V1)).toBe(false);
  });
});
