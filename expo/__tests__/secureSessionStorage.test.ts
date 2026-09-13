import { describe, expect, test } from "bun:test";

import { createMigratingSecureSessionStorage, type AsyncKeyValueStore } from "@/lib/secureSessionStorage";

class MemoryStore implements AsyncKeyValueStore {
  values = new Map<string, string>();
  failSetKey: string | null = null;
  failRemoveKey: string | null = null;
  failRemoveTimes = 0;
  removed: string[] = [];

  async getItem(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    if (this.failSetKey === key) throw new Error("write failed");
    this.values.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    if (this.failRemoveKey === key && this.failRemoveTimes > 0) {
      this.failRemoveTimes -= 1;
      throw new Error("remove failed");
    }
    this.removed.push(key);
    this.values.delete(key);
  }
}

function storage(secure: MemoryStore, legacy: MemoryStore, generations = ["g1", "g2", "g3"]) {
  let index = 0;
  return createMigratingSecureSessionStorage({
    secure,
    legacy,
    chunkSize: 8,
    namespaceForKey: async () => "bysi.auth.test",
    generation: () => generations[index++] ?? `g${index}`,
  });
}

describe("secure Supabase session storage", () => {
  test("migrates a legacy session only after a verified secure write", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    legacy.values.set("supabase-session", "legacy-session-value");
    const adapter = storage(secure, legacy);

    expect(await adapter.getItem("supabase-session")).toBe("legacy-session-value");
    expect(await legacy.getItem("supabase-session")).toBeNull();
    expect(await adapter.getItem("supabase-session")).toBe("legacy-session-value");
    expect([...secure.values.keys()].some((key) => key.endsWith(".manifest"))).toBe(true);
  });

  test("keeps the legacy session when secure migration cannot be verified", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    legacy.values.set("supabase-session", "keep-me");
    secure.failSetKey = "bysi.auth.test.g1.0";
    const adapter = storage(secure, legacy);

    expect(await adapter.getItem("supabase-session")).toBe("keep-me");
    expect(await legacy.getItem("supabase-session")).toBe("keep-me");
    expect(secure.values.size).toBe(0);
  });

  test("chunks and reconstructs sessions larger than one secure-store value", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    const adapter = storage(secure, legacy);
    const session = "abcdefghijklmnopqrstuvwxyz";

    await adapter.setItem("supabase-session", session);

    expect(await adapter.getItem("supabase-session")).toBe(session);
    expect([...secure.values.keys()].filter((key) => key.includes(".g1.")).length).toBe(4);
  });

  test("bounds every secure chunk by UTF-8 bytes without splitting Unicode", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    const adapter = storage(secure, legacy);
    const session = "🙂🙂🙂🙂🙂";

    await adapter.setItem("supabase-session", session);

    const chunks = [...secure.values.entries()].filter(([key]) => key.includes(".g1.")).map(([, value]) => value);
    expect(chunks.every((value) => new TextEncoder().encode(value).byteLength <= 8)).toBe(true);
    expect(chunks.join("")).toBe(session);
    expect(await adapter.getItem("supabase-session")).toBe(session);
  });

  test("preserves the previous committed session when a replacement manifest cannot commit", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    const adapter = storage(secure, legacy);
    await adapter.setItem("supabase-session", "first-session");
    secure.failSetKey = "bysi.auth.test.manifest";

    await expect(adapter.setItem("supabase-session", "replacement-session")).rejects.toThrow("write failed");
    secure.failSetKey = null;
    expect(await adapter.getItem("supabase-session")).toBe("first-session");
    await adapter.removeItem("supabase-session");
    expect([...secure.values.keys()].filter((key) => key.includes(".g2.")).length).toBe(0);
  });

  test("retries legacy deletion after a secure commit", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    legacy.values.set("supabase-session", "legacy-session");
    legacy.failRemoveKey = "supabase-session";
    legacy.failRemoveTimes = 1;
    const adapter = storage(secure, legacy);

    expect(await adapter.getItem("supabase-session")).toBe("legacy-session");
    expect(await legacy.getItem("supabase-session")).toBe("legacy-session");
    expect(await adapter.getItem("supabase-session")).toBe("legacy-session");
    expect(await legacy.getItem("supabase-session")).toBeNull();
  });

  test("cleans a crash-interrupted pending generation before reading", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    secure.values.set("bysi.auth.test.pending", JSON.stringify({ version: 1, generation: "crash", count: 2 }));
    secure.values.set("bysi.auth.test.crash.0", "partial-");
    secure.values.set("bysi.auth.test.crash.1", "secret");
    const adapter = storage(secure, legacy);

    expect(await adapter.getItem("supabase-session")).toBeNull();
    expect([...secure.values.keys()].some((key) => key.includes("crash"))).toBe(false);
    expect(await secure.getItem("bysi.auth.test.pending")).toBeNull();
  });

  test("blocks a new write while an older pending generation cannot be cleaned", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    secure.values.set("bysi.auth.test.pending", JSON.stringify({ version: 1, generation: "crash", count: 1 }));
    secure.values.set("bysi.auth.test.crash.0", "old-secret");
    secure.failRemoveKey = "bysi.auth.test.crash.0";
    secure.failRemoveTimes = 1;
    const adapter = storage(secure, legacy);

    await expect(adapter.setItem("supabase-session", "new-session")).rejects.toThrow("Pending secure session cleanup is incomplete");
    expect(await secure.getItem("bysi.auth.test.pending")).toContain('"generation":"crash"');
    expect([...secure.values.keys()].some((key) => key.includes(".g1."))).toBe(false);
  });

  test("wires Supabase persistence to the migrating secure adapter", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/supabase.ts`).text();
    expect(source).toContain("createMigratingSecureSessionStorage");
    expect(source).toContain('storage: Platform.OS === "web" ? AsyncStorage : supabaseAuthStorage');
    expect(source).not.toContain("storage: AsyncStorage,");
  });

  test("removes secure chunks, manifest, and any legacy copy", async () => {
    const secure = new MemoryStore();
    const legacy = new MemoryStore();
    const adapter = storage(secure, legacy);
    await adapter.setItem("supabase-session", "private-session");
    legacy.values.set("supabase-session", "stale-legacy");

    await adapter.removeItem("supabase-session");

    expect(await adapter.getItem("supabase-session")).toBeNull();
    expect(await legacy.getItem("supabase-session")).toBeNull();
    expect(secure.values.size).toBe(0);
  });
});
