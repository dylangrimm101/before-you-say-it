import { describe, expect, test } from "bun:test";

import { resetAllDataStrict, type ResetStorage } from "@/lib/resetAllData";

class MemoryResetStorage implements ResetStorage {
  values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async getAllKeys(): Promise<readonly string[]> { return [...this.values.keys()]; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async multiRemove(keys: readonly string[]): Promise<void> { keys.forEach((key) => this.values.delete(key)); }
}

const APP = ["cc.profile.v1", "cc.sessions.v2"] as const;
const ANON = "cc.anonymousUserId.v1";

describe("strict all-data reset", () => {
  test("clears app and Supabase auth bytes, identities, caches, and persists a fresh anonymous identity", async () => {
    const storage = new MemoryResetStorage();
    storage.values.set(APP[0], "profile");
    storage.values.set(APP[1], "sessions");
    storage.values.set(ANON, "anon-old");
    storage.values.set("sb-project-auth-token", "refresh-secret");
    storage.values.set("sb-project-auth-token-code-verifier", "pkce-secret");
    const order: string[] = [];

    const next = await resetAllDataStrict({
      storage,
      appKeys: APP,
      anonymousKey: ANON,
      newAnonymousId: () => "anon-new",
      signOutSupabase: async () => { order.push("supabase"); },
      logOutPurchases: async () => { order.push("revenuecat"); },
      deletePrivateAudio: async () => { order.push("audio"); },
      deleteGeneratedVoiceCache: async () => { order.push("voice"); },
    });

    expect(next).toBe("anon-new");
    expect(order).toEqual(["supabase", "revenuecat", "audio", "voice"]);
    expect(storage.values.get(ANON)).toBe("anon-new");
    expect(storage.values.has("sb-project-auth-token")).toBe(false);
    expect(storage.values.has("sb-project-auth-token-code-verifier")).toBe(false);
    APP.forEach((key) => expect(storage.values.has(key)).toBe(false));
  });

  test("does not report success or rotate identity when required cleanup fails", async () => {
    const storage = new MemoryResetStorage();
    storage.values.set(ANON, "anon-old");
    await expect(resetAllDataStrict({
      storage,
      appKeys: APP,
      anonymousKey: ANON,
      newAnonymousId: () => "anon-new",
      signOutSupabase: async () => {},
      logOutPurchases: async () => {},
      deletePrivateAudio: async () => { throw new Error("deletion unconfirmed"); },
      deleteGeneratedVoiceCache: async () => {},
    })).rejects.toThrow("deletion unconfirmed");
    expect(storage.values.get(ANON)).toBe("anon-old");
  });
});
