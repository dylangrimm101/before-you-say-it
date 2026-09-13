// Real Supabase client + real secure-storage adapter; only native host primitives are synthetic.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
const mode = process.argv[2];
(globalThis as any).__DEV__ = mode !== "release" && mode !== "release-missing-marker";
for (const key of Object.keys(process.env)) if (key.startsWith("EXPO_PUBLIC_")) delete process.env[key];
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://production.invalid";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "production-public-key";
if (!["normal", "staging-binary-no-flag"].includes(mode!)) process.env.EXPO_PUBLIC_BYSI_BUILD_MODE = "staging-account";
process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL = "https://pqqxaklcburdxjfeolmd.supabase.co";
if (mode !== "missing-key") process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_synthetic";
if (mode === "release") process.env.EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE = "1";
const reads: string[] = [];
const legacyReads: string[] = [];
let networkCalls = 0;
globalThis.fetch = async () => { ++networkCalls; throw new Error("No network allowed in construction fixture"); };
mock.module("react-native", () => ({ Platform: { OS: "ios" } }));
mock.module("react-native-url-polyfill/auto", () => ({}));
mock.module("expo-constants", () => ({ default: { executionEnvironment: "bare" } }));
mock.module("expo-application", () => ({ applicationId: ["normal", "wrong-binary"].includes(mode!) ? "app.production" : "app.bysi.staging.account" }));
mock.module("expo-crypto", () => ({ CryptoDigestAlgorithm: { SHA256: "sha256" }, randomUUID, digestStringAsync: async (_: string, value: string) => createHash("sha256").update(value).digest("hex") }));
mock.module("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (key: string, options: any) => { reads.push(`${options.keychainService}:${key}`); return null; },
  setItemAsync: async () => {}, deleteItemAsync: async () => {},
}));
mock.module("@react-native-async-storage/async-storage", () => ({ default: {
  getItem: async (key: string) => { legacyReads.push(key); return null; }, setItem: async () => {}, removeItem: async () => {},
} }));
const { supabase, authEnvironment } = await import("../lib/supabase");
if (["staging", "normal", "release"].includes(mode!)) {
  assert.ok(supabase);
  const current = await supabase.auth.getSession();
  assert.equal(current.error, null);
  assert.equal(current.data.session, null);
  assert.ok(reads.length > 0);
  if (mode === "staging" || mode === "release") {
    assert.equal(supabase.supabaseUrl, "https://pqqxaklcburdxjfeolmd.supabase.co");
    assert.equal(authEnvironment?.staging, true);
    assert.ok(reads.every(key => key.startsWith("beforeyousayit.staging.supabase:")));
    assert.equal(legacyReads.length, 0);
  } else {
    assert.equal(supabase.supabaseUrl, "https://production.invalid");
    assert.equal(authEnvironment?.staging, false);
    assert.ok(reads.every(key => key.startsWith("beforeyousayit.supabase:")));
    assert.ok(legacyReads.includes("sb-production-auth-token"));
  }
  await supabase.auth.stopAutoRefresh();
} else {
  assert.equal(supabase, null);
  assert.equal(authEnvironment, null);
  assert.equal(reads.length, 0);
  assert.equal(legacyReads.length, 0);
}
assert.equal(networkCalls, 0);
console.log(`verified ${mode}`);
