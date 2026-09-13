import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { STAGING_AUTH_URL, selectAuthEnvironment } from "../lib/authEnvironment";
import { createStagingWebBridge, REVIEWED_STAGING_BRIDGE } from "../lib/stagingWebBridge";
import { writeFile } from "node:fs/promises";

// Read-only/invalid-auth probes only. No sign-in, signup, refresh, or valid account operation.
const selected = selectAuthEnvironment({ developmentBuild: true, nativeStagingBuild: true, mode: "staging-account", stagingUrl: STAGING_AUTH_URL, stagingKey: process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY });
assert.ok(selected?.staging);
const proof: { check: string; status?: number; result?: string }[] = [];
const base = `${STAGING_AUTH_URL}/functions/v1/bysi-staging-account`;
const key = selected.key;
async function probe(check: string, url: string, init: RequestInit, expected: number) {
  const response = await fetch(url, { ...init, redirect: "error", signal: AbortSignal.timeout(15000) });
  proof.push({ check, status: response.status });
  assert.equal(response.status, expected, check);
  return response;
}
const health = await probe("health with staging publishable key", `${base}/health`, { headers: { apikey: key } }, 200);
assert.deepEqual(await health.json(), { ok: true, environment: "staging", revision: "staging-account-v1" });
await probe("health without credentials", `${base}/health`, {}, 401);
for (const path of ["activate", "restore"]) {
  await probe(`${path}: public key is not user authentication`, `${base}/${path}`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(path === "activate" ? { token: "0".repeat(64) } : { sessionId: "00000000-0000-4000-8000-000000000000" }) }, 401);
}
const client = createClient(selected.url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: selected.storageKey } });
const invalid = await client.auth.getUser("invalid-native-smoke-token");
assert.ok(invalid.error);
assert.equal(invalid.data.user, null);
// Auth service rejects this malformed JWT with 403 (Edge gateway uses 401).
assert.equal(invalid.error.status, 403);
proof.push({ check: "real staging Supabase Auth getUser invalid token", status: invalid.error.status });
let signedOutRequests = 0;
const noAccount = createStagingWebBridge({ developmentBuild: true, reviewed: REVIEWED_STAGING_BRIDGE, authUrl: selected.url, auth: client.auth, fetch: async () => { ++signedOutRequests; throw new Error("Signed-out client must not send account requests"); } });
assert.ok(noAccount);
assert.equal(await noAccount.restore("00000000-0000-4000-8000-000000000000"), false);
assert.equal(signedOutRequests, 0);
assert.equal(noAccount.getSnapshot().record, null);
noAccount.dispose();
proof.push({ check: "real signed-out auth client", result: "fails closed without account HTTP" });
// Explicit synthetic local identity only to exercise actual native serializer against gateway rejection.
// Not a real authenticated session or positive restoration claim.
const user = { id: "synthetic-invalid-auth-probe", is_anonymous: false, email_confirmed_at: "2026-09-06" };
let emit: ((event: string, session: { user: typeof user }) => void) | undefined;
const bridge = createStagingWebBridge({ developmentBuild: true, reviewed: REVIEWED_STAGING_BRIDGE, authUrl: selected.url, auth: {
  getSession: async () => ({ data: { session: { access_token: "invalid-native-smoke-token", user } }, error: null }),
  getUser: async () => ({ data: { user }, error: null }),
  onAuthStateChange: callback => { emit = callback; return { data: { subscription: { unsubscribe() {} } } }; },
}, fetch: async (url, init) => {
  assert.equal(new Headers(init.headers).has("apikey"), false);
  assert.equal(new Headers(init.headers).has("Origin"), false);
  return probe(`native serializer ${url.endsWith("activate") ? "activate" : "restore"}: invalid bearer rejected (synthetic local verifier)`, url, init, 401);
} });
assert.ok(bridge);
assert.ok(emit);
emit("SIGNED_IN", { user });
assert.equal(await bridge.restore("00000000-0000-4000-8000-000000000000"), false);
assert.equal(await bridge.activate("0".repeat(64)), false);
assert.equal(bridge.getSnapshot().record, null);
assert.equal(bridge.suppressPurchasePrompt(), false);
bridge.dispose();
assert.equal(proof.length, 8);
assert.deepEqual(proof.slice(-2).map(check => check.status), [401, 401]);
await writeFile("../docs/NATIVE-STAGING-ACCOUNT-HTTP-PROOF.json", JSON.stringify({ project: "pqqxaklcburdxjfeolmd", timestamp: new Date().toISOString(), scope: "No real sign-in, account writes, eligible activation, private result, paid access or device acceptance", checks: proof }, null, 2) + "\n");
console.log(JSON.stringify(proof, null, 2));
