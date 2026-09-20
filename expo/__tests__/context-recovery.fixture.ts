import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import React from "react";
import { plugin } from "bun";

const mode = process.argv[2] ?? process.env.BYSI_FRONT_DOOR_MODE ?? "journey";
const continuationMode = mode.startsWith("continuation-");
const openerContinuation = mode === "continuation-opener";
let interruptContinuation = continuationMode;
let loseContinuationResponse = mode === "continuation-lost";
const ledger: string[] = [];
const reviewerPushbackBodies:any[]=[];
const mark = (step: string) => ledger.push(step);

const web = new URL("../../server/", import.meta.url).pathname.replace(/\/$/, "");
const { setupContent, guest, owner, authOrigin, origin } = await import("../../server/tests/normal-results-proof.mjs");
const { db, database, contentDatabase } = await setupContent();

const tokenFor = (id: string) => {
  const value = [{ alg: "HS256", typ: "JWT" }, { sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }]
    .map((part) => Buffer.from(JSON.stringify(part)).toString("base64url"))
    .join(".");
  return `${value}.${createHmac("sha256", "synthetic-local-auth").update(value).digest("base64url")}`;
};
const verifiedOwner = (authorization: string) => {
  try {
    const [head, payload, signature] = authorization.replace(/^Bearer /, "").split(".");
    const expected = createHmac("sha256", "synthetic-local-auth").update(`${head}.${payload}`).digest("base64url");
    if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    return claims.exp > Date.now() / 1000 ? claims.sub as string : null;
  } catch {
    return null;
  }
};
const userFor = (id: string) => id === guest
  ? { id, aud: "authenticated", role: "authenticated", email: null, is_anonymous: true, email_confirmed_at: null, created_at: "2026-01-01", app_metadata: {}, user_metadata: {} }
  : { id, aud: "authenticated", role: "authenticated", email: "frontdoor@invalid", is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01", app_metadata: {}, user_metadata: {} };
const sessionFor = (id: string) => ({ access_token: tokenFor(id), refresh_token: `refresh-${id}`, expires_in: 3600, token_type: "bearer", user: userFor(id) });

let currentSession: ReturnType<typeof sessionFor> | null = null;
const listeners: Array<(event: string, session: ReturnType<typeof sessionFor> | null) => void> = [];
const notify = (event: string) => listeners.forEach((listener) => listener(event, currentSession));
let authGetSessionCalls = 0;
let injectSignout = false;
let switchDuringUser = false;
let sameOwnerEventDuringUser = false;
let abaDuringUser = false;
let anonymousSignInCalls = 0;
let signOutCalls = 0;
let signUpCalls = 0;
const auth = {
  getSession: async () => {
    authGetSessionCalls++;
    if (injectSignout) {
      injectSignout = false;
      currentSession = null;
      notify("SIGNED_OUT");
    }
    return { data: { session: currentSession }, error: null };
  },
  getUser: async (jwt: string) => {
    if (switchDuringUser) {
      switchDuringUser = false;
      currentSession = sessionFor(owner);
      notify("SIGNED_IN");
      return { data: { user: null }, error: new Error("stale guest verification") };
    }
    if (sameOwnerEventDuringUser) {
      sameOwnerEventDuringUser = false;
      if (abaDuringUser) {
        abaDuringUser = false;
        currentSession = null;
        notify("SIGNED_OUT");
        currentSession = sessionFor(guest);
      }
      notify("SIGNED_IN");
    }
    const id = verifiedOwner(`Bearer ${jwt}`);
    return { data: { user: id ? userFor(id) : null }, error: id ? null : new Error("synthetic token rejected") };
  },
  signInAnonymously: async () => {
    anonymousSignInCalls++;
    currentSession = sessionFor(guest);
    notify("SIGNED_IN");
    return { data: { session: currentSession }, error: null };
  },
  signInWithPassword: async ({ email }: { email: string }) => {
    assert.equal(email, "frontdoor@invalid");
    currentSession = sessionFor(owner);
    notify("SIGNED_IN");
    return { data: { session: currentSession, user: currentSession.user }, error: null };
  },
  signOut: async () => {
    signOutCalls++;
    currentSession = null;
    notify("SIGNED_OUT");
    return { error: null };
  },
  signUp: async ({ email, password }: { email: string; password: string }) => {
    signUpCalls++;
    assert.equal(email, "frontdoor@invalid");
    assert.equal(password, "synthetic-only-password");
    return { data: { user: userFor(owner), session: null }, error: null };
  },
  resend: async () => ({ data: {}, error: null }),
  onAuthStateChange: (listener: (event: string, session: ReturnType<typeof sessionFor> | null) => void) => {
    listeners.push(listener);
    setTimeout(() => listener("INITIAL_SESSION", currentSession), 0);
    return { data: { subscription: { unsubscribe() { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1); } } } };
  },
};
const authFetch = async (_url: unknown, init: RequestInit = {}) => {
  const id = verifiedOwner(new Headers(init.headers).get("authorization") ?? "");
  return id ? Response.json(userFor(id)) : Response.json({ message: "synthetic token rejected" }, { status: 401 });
};

const { createFreeRuntime } = await import(`${web}/server/native-free/runtime.mjs`);
const providerCosts = JSON.stringify(Object.fromEntries(["pushback", "close", "result", "tts_pushback", "tts_close", "transcribe_opener", "transcribe_reply"].map((kind) => [kind, 1])));
const freeRuntime = createFreeRuntime({
  database: contentDatabase,
  fetch: authFetch,
  env: {
    BYSI_NATIVE_FREE: "registered-v1",
    ...(process.env.BYSI_TEST_LEGACY_UPGRADE==='1'?{BYSI_NATIVE_FREE_RPC:'recovery-v2'}:{}),
    BYSI_NATIVE_FREE_PROVENANCE_KEY: "a".repeat(64),
    BYSI_NATIVE_FREE_DAILY_SPEND_CENTS: "500",
    BYSI_NATIVE_FREE_PROVIDER_COST_CENTS: providerCosts,
    BYSI_NATIVE_SERVICE: "account-v1",
    BYSI_NATIVE_SERVICE_DATABASE_URL: "postgres://bysi_native_service:fixture@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full",
    BYSI_NATIVE_ORIGIN: origin,
    BYSI_NATIVE_AUTH_ORIGIN: authOrigin,
    BYSI_NATIVE_PUBLISHABLE_KEY: "synthetic-public",
    BYSI_REVENUECAT_SERVER_KEY: "synthetic-server",
    BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION: "synthetic-webhook-authorization-not-live",
  },
});
mock.module(`${web}/server/native-free/runtime.mjs`, () => ({ createFreeRuntime, getFreeRuntime: () => freeRuntime }));

const { createServiceRuntime } = await import(`${web}/server/revenuecat/service.mjs`);
const { createRuntime: createRevenueCatRuntime } = await import(`${web}/server/revenuecat/runtime.mjs`);
const { createReceiverRuntime } = await import(`${web}/server/revenuecat/receiver.mjs`);
const { createDatabase: createRevenueCatDatabase } = await import(`${web}/server/revenuecat/database.mjs`);
const now = Date.now();
const webhookSecret = "synthetic-webhook-authorization-not-live";
const paid = createServiceRuntime({
  database,
  now: () => now,
  env: {
    BYSI_NATIVE_SERVICE: "production-v1",
    BYSI_NATIVE_SERVICE_DATABASE_URL: "postgres://bysi_native_service:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full",
    BYSI_NATIVE_PAID: "revenuecat-v1",
    BYSI_NATIVE_ORIGIN: origin,
    BYSI_NATIVE_AUTH_ORIGIN: authOrigin,
    BYSI_NATIVE_DATABASE_URL: "postgres://fixture:fixture@localhost/fixture?sslmode=verify-full",
    BYSI_NATIVE_PUBLISHABLE_KEY: "synthetic-public",
    BYSI_REVENUECAT_SERVER_KEY: "synthetic-server",
    BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION: webhookSecret,
  },
  fetch: async (url: unknown, init: RequestInit = {}) => String(url).startsWith("https://api.revenuecat.com/v1/subscribers/")
    ? revenueCatLookup(url, init)
    : authFetch(url, init),
});
const revenueCatDatabase = createRevenueCatDatabase({
  async connect() {
    return { query: async (sql: string, params?: unknown[]) => db.query(sql, params), release() {} };
  },
});
const billingRuntime = createRevenueCatRuntime({
  database: revenueCatDatabase,
  now: () => now,
  env: {
    BYSI_NATIVE_PAID: "revenuecat-v1",
    BYSI_NATIVE_ORIGIN: origin,
    BYSI_NATIVE_AUTH_ORIGIN: authOrigin,
    BYSI_NATIVE_DATABASE_URL: "postgres://fixture:fixture@localhost/fixture?sslmode=verify-full",
    BYSI_NATIVE_PUBLISHABLE_KEY: "synthetic-public",
    BYSI_REVENUECAT_SERVER_KEY: "synthetic-server",
    BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION: webhookSecret,
  },
  fetch: async (url: unknown, init: RequestInit = {}) => String(url).startsWith("https://api.revenuecat.com/v1/subscribers/")
    ? revenueCatLookup(url, init)
    : authFetch(url, init),
});
const receiver = createReceiverRuntime({
  database: createRevenueCatDatabase({
    async connect() {
      return { query: async (sql: string, params?: unknown[]) => {
        try {
          return await db.query(sql, params);
        } catch (error) {
          console.warn("[frontdoor receiver sql]", JSON.stringify({ sql: sql.slice(0, 90), error: String((error as Error).message ?? error).slice(0, 160) }));
          throw error;
        }
      }, release() {} };
    },
  }),
  now: () => now,
  env: {
    BYSI_REVENUECAT_RECEIVER: "receiver-v1",
    BYSI_NATIVE_ORIGIN: origin,
    BYSI_NATIVE_AUTH_ORIGIN: authOrigin,
    BYSI_NATIVE_DATABASE_URL: "postgres://bysi_native_runtime:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full",
    BYSI_NATIVE_PUBLISHABLE_KEY: "synthetic-public",
    BYSI_REVENUECAT_SERVER_KEY: "synthetic-server",
    BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION: webhookSecret,
  },
  fetch: async (url: unknown, init: RequestInit = {}) => String(url).startsWith("https://api.revenuecat.com/v1/subscribers/")
    ? revenueCatLookup(url, init)
    : authFetch(url, init),
});
mock.module(`${web}/server/revenuecat/service.mjs`, () => ({ getServiceRuntime: () => paid }));
const { createResultsRuntime } = await import(`${web}/server/normal-results/runtime.mjs`);
const results = createResultsRuntime({
  database: contentDatabase,
  env: {
    BYSI_NATIVE_RESULTS: "normal-results-v1",
    BYSI_NATIVE_ORIGIN: origin,
    BYSI_NATIVE_AUTH_ORIGIN: authOrigin,
    BYSI_NATIVE_SERVICE_DATABASE_URL: "postgres://bysi_native_service:fixture@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full",
    BYSI_NATIVE_PUBLISHABLE_KEY: "synthetic-public",
  },
  fetch: authFetch,
});
mock.module(`${web}/server/normal-results/runtime.mjs`, () => ({ createResultsRuntime, getResultsRuntime: () => results }));

const { NextRequest } = await import(`${web}/node_modules/next/server.js`);
const freeRoutes: Record<string, (request: Request) => Promise<Response>> = {};
for (const op of ["session", "generate", "tts", "transcribe"]) freeRoutes[op] = (await import(`${web}/app/api/native/free/${op}/route.js`)).POST;
const paidRoutes: Record<string, (request: Request) => Promise<Response>> = {};
for (const op of ["identify", "access", "generate", "tts", "transcribe"]) paidRoutes[op] = (await import(`${web}/app/api/native/${op}/route.js`)).POST;
const resultRoutes: Record<string, (request: Request) => Promise<Response>> = {};
for (const op of ["discover", "restore", "delete", "claim"]) resultRoutes[op] = (await import(`${web}/app/api/native/results/${op}/route.js`)).POST;

let providerCalls = 0;
let claimAttempts = 0;
let failNextClaimBeforeCommit = mode === "claim-retry-503";
let loseNextClaimAfterCommit = mode === "claim-retry-lost";
let ttsCalls = 0;
let transcribeCalls = 0;
let transcriptionProviderCalls = 0;
let ttsProviderCalls = 0;
let ttsFailuresRemaining = mode === "tts-failure" ? 1 : 0;
let transcribeFailuresRemaining = mode === "transcribe-retry" ? 1 : 0;
let rcLookupCalls = 0;
let lostResultOnce = mode === "lost-result";
const BrowserFormData = globalThis.FormData;
type NativeFixturePart = { name: string; value: unknown; fileName?: string };
class NativeFixtureFormData {
  readonly parts: NativeFixturePart[] = [];
  append(name: string, value: unknown, fileName?: string) {
    this.parts.push({ name, value, fileName });
  }
  get(name: string) {
    return this.parts.find((part) => part.name === name)?.value ?? null;
  }
  getAll(name: string) {
    return this.parts.filter((part) => part.name === name).map((part) => part.value);
  }
  keys() {
    return this.parts.map((part) => part.name)[Symbol.iterator]();
  }
}
(globalThis as any).FormData = NativeFixtureFormData;
async function revenueCatLookup(url: unknown, _init: RequestInit = {}) {
  rcLookupCalls++;
  const transaction = `frontdoor-tx-${Math.max(sequence, 1)}`;
  console.warn("[frontdoor rc lookup]", JSON.stringify({ rcLookupCalls, transaction, rcId }));
  return Response.json({
    request_date_ms: now,
    subscriber: {
      entitlements: { pro: { product_identifier: "byis_pro_monthly_5", expires_date: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString() } },
      subscriptions: { byis_pro_monthly_5: { store: "app_store", store_transaction_id: transaction, expires_date: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(), is_sandbox: false, ownership_type: "PURCHASED", refunded_at: null } },
    },
  });
}
globalThis.fetch = (async (url: unknown, init: RequestInit = {}) => {
  const target = String(url);
  if (target.endsWith("/api/native/results/claim")) {
    claimAttempts++;
    if (failNextClaimBeforeCommit) {
      failNextClaimBeforeCommit = false;
      return Response.json({ error: "synthetic offline before claim commit" }, { status: 503 });
    }
    const response = await resultRoutes.claim(new NextRequest(target, init));
    if (loseNextClaimAfterCommit && response.ok) {
      loseNextClaimAfterCommit = false;
      throw new Error("Synthetic claim response lost after durable commit");
    }
    return response;
  }
  if (target.startsWith(`${origin}/api/native/results/`)) return resultRoutes[target.split("/").at(-1)!](new NextRequest(target, init));
  if (target.startsWith(`${origin}/api/native/free/`)) {
    const op = target.split("/").at(-1)!;
    if (op === "tts") ttsCalls++;
    if (op === "transcribe") transcribeCalls++;
    let routedInit = init;
    if (op === "transcribe" && init.body instanceof NativeFixtureFormData) {
      const form = new BrowserFormData();
      for (const part of init.body.parts) {
        if (part.name !== "audio") {
          form.append(part.name, String(part.value));
          continue;
        }
        const descriptor = part.value as { uri?: string; name?: string; type?: string };
        const bytes = descriptor.uri ? audioBytesByUri.get(descriptor.uri) : null;
        assert.ok(bytes, `recording bytes available for ${descriptor.uri ?? "unknown"}`);
        form.append("audio", new Blob([bytes], { type: descriptor.type ?? "audio/mp4" }), descriptor.name ?? part.fileName ?? "recording.m4a");
      }
      const headers = new Headers(init.headers);
      headers.delete("content-type");
      routedInit = { ...init, headers, body: form };
    }
    if(op === "generate" && JSON.parse(String(init.body)).turn) reviewerPushbackBodies.push(JSON.parse(String(init.body)));
    if (interruptContinuation && op === "generate" && JSON.parse(String(init.body)).turn === (openerContinuation ? "pushback" : "close")) {
      throw new Error("Synthetic interruption after approval, before generation dispatch");
    }
    const response = await freeRoutes[op](new NextRequest(target, routedInit));
    if (loseContinuationResponse && op === "generate" && JSON.parse(String(init.body)).turn === "close" && response.ok) {
      loseContinuationResponse=false;
      throw new Error("Synthetic lost close response after commit; same operation must replay");
    }
    if (op === "session") {
      const body = JSON.parse(String(init.body));
      if (body.recover === true) {
        const recovered = await response.clone().json();
        console.warn("[frontdoor recover]", JSON.stringify({ status: recovered.status, phase: recovered.phase, hasCheckpoint: Boolean(recovered.checkpoint), hasAudio: Boolean(recovered.audio), sentContract: Boolean(body.contract), sentTranscript: Boolean(body.transcript) }));
      }
    }
    if (lostResultOnce && op === "generate" && JSON.parse(String(init.body)).type === "free_rehearsal_result" && response.ok) {
      lostResultOnce = false;
      throw new Error("Synthetic response lost after durable result commit");
    }
    return response;
  }
  if (target.startsWith(`${origin}/api/native/`)) return paidRoutes[target.split("/api/native/")[1]](new NextRequest(target, init));
  if (target.startsWith("https://api.elevenlabs.io/v1/text-to-speech/")) {
    ttsProviderCalls++;
    if (ttsFailuresRemaining > 0) {
      ttsFailuresRemaining--;
      return Response.json({ error: "synthetic tts failure" }, { status: 502 });
    }
    const body = JSON.parse(String(init.body));
    ttsProviderTexts.push(String(body.text ?? ""));
    return new Response(new Uint8Array([0xff, 0xfb, 0x90, 0x64, 0x00, 0x00]), { headers: { "content-type": "audio/mpeg" } });
  }
  if (target.startsWith("https://api.revenuecat.com/v1/subscribers/")) {
    return revenueCatLookup(url, init);
  }
  if (target === "https://api.openai.com/v1/audio/transcriptions") {
    transcriptionProviderCalls++;
    if (transcribeFailuresRemaining > 0) {
      transcribeFailuresRemaining--;
      pendingTranscriptions.shift();
      return Response.json({ error: "synthetic transcription failure" }, { status: 502 });
    }
    const next = pendingTranscriptions.shift() ?? "";
    transcribedTexts.push(next);
    return Response.json({ text: next });
  }
  assert.equal(target, "https://api.anthropic.com/v1/messages");
  providerCalls++;
  const body = JSON.parse(JSON.parse(String(init.body)).messages[0].content);
  const turn = body.turn;
  const full = (await import("../../server/tests/fixtures/generation-output.mjs")).fixture();
  full.outputVersion = "bysi-free-rehearsal-result-v1-2026-08-12";
  full.starting_index.overall = null;
  full.starting_index.observed_dimensions[0].score = 43.25;
  full.pressure_moment.ask_quote = body.transcript.user_turn_1;
  full.pressure_moment.pushback_quote = body.transcript.counterpart_pushback;
  full.pressure_moment.response_quote = body.transcript.user_turn_2;
  const output = turn
    ? { mode: "turn", turn, role: "hope", text: turn === "pushback" ? "I was joking. Everyone else knew that, and you are making this bigger than it was." : "I still think you are overreacting, and I do not want every family joke turned into a serious conversation.", safety: null }
    : full;
  return Response.json({ id: `msg_frontdoor_${providerCalls}`, model: "synthetic-fixture", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(output) }] });
}) as typeof fetch;

plugin({ name: "front-door-assets", setup(builder) { builder.onLoad({ filter: /\.(png|ttf)$/ }, () => ({ contents: "export default 1", loader: "js" })); } });
const disk = new Map<string, string>();
const secureDisk = new Map<string, string>();
const storage = { getItem: async (key: string) => disk.get(key) ?? null, setItem: async (key: string, value: string) => { disk.set(key, value); }, removeItem: async (key: string) => { disk.delete(key); }, getAllKeys: async () => [...disk.keys()], multiRemove: async (keys: string[]) => { keys.forEach((key) => disk.delete(key)); } };
mock.module("@react-native-async-storage/async-storage", () => ({ default: storage }));
mock.module("@/lib/supabase", () => ({ supabase: { auth }, authEnvironment: { url: authOrigin, key: "synthetic-public", staging: false }, isAuthConfigured: true }));
let switchDuringClaimRetrySave = false;
mock.module("expo-secure-store", () => ({ AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1, isAvailableAsync: async () => true, getItemAsync: async (key: string) => secureDisk.get(key) ?? null, setItemAsync: async (key: string, value: string) => {
  secureDisk.set(key, value);
  if (switchDuringClaimRetrySave && key.startsWith("claim.")) {
    switchDuringClaimRetrySave = false;
    currentSession = sessionFor("22222222-2222-4222-8222-222222222222");
    notify("SIGNED_IN");
  }
}, deleteItemAsync: async (key: string) => { secureDisk.delete(key); } }));
mock.module("expo-crypto", () => ({ randomUUID, getRandomBytes: randomBytes, CryptoDigestAlgorithm: { SHA256: "sha256" }, digestStringAsync: async (_algorithm: string, value: string) => createHash("sha256").update(value).digest("hex") }));

let rcId = "anonymous";
let sdkPro = false;
let sequence = 0;
let purchaseMode: "success" | "cancel" | "pending" | "error" = "success";
let offeringMode: "ready" | "unavailable" = mode === "paywall-unavailable" ? "unavailable" : "ready";
let purchaseCalls = 0;
let restoreCalls = 0;
const packageMonthly = { identifier: "frontdoor-package", product: { identifier: "byis_pro_monthly_5", priceString: "$5.00", subscriptionPeriod: "P1M", introPrice: null } };
async function billingEvent(type = "INITIAL_PURCHASE") {
  const response = await billingRuntime.authority.webhook(new NextRequest(`${origin}/api/native/webhook`, {
    method: "POST",
    headers: { authorization: webhookSecret, "content-type": "application/json" },
    body: JSON.stringify({ api_version: "1.0", event: { id: `frontdoor-${++sequence}`, type, app_id: "appab45402f36", event_timestamp_ms: now + sequence, app_user_id: rcId, original_app_user_id: rcId, aliases: [rcId], environment: "PRODUCTION", store: "APP_STORE", product_id: "byis_pro_monthly_5", entitlement_ids: ["pro"], transaction_id: `frontdoor-tx-${sequence}`, is_family_share: false } }),
  }));
  const bindings = (await db.query("select owner_id::text owner_id,app_user_id::text app_user_id from bysi_revenuecat.binding")).rows;
  const events = (await db.query("select count(*)::int n from bysi_revenuecat.event")).rows[0].n;
  const projections = (await db.query("select environment,app_user_id::text app_user_id,value from bysi_revenuecat.projection")).rows;
  assert.equal(response.status, 200, JSON.stringify({ rcId, sequence, rcLookupCalls, bindings, events, projections }));
}
const info = () => ({ entitlements: { active: sdkPro ? { pro: {} } : {} } });
mock.module("react-native-purchases", () => ({ default: {
  configure() {},
  getAppUserID: async () => rcId,
  isAnonymous: async () => rcId === "anonymous",
  getCustomerInfo: async () => info(),
  logIn: async (id: string) => { rcId = id; return { customerInfo: info(), created: false }; },
  logOut: async () => { rcId = "anonymous"; sdkPro = false; return info(); },
  getOfferings: async () => {
    if (offeringMode === "unavailable") throw new Error("synthetic offerings unavailable");
    return { current: { monthly: packageMonthly } };
  },
  purchasePackage: async () => {
    purchaseCalls++;
    if (purchaseMode === "cancel") throw { userCancelled: true };
    if (purchaseMode === "pending") throw { code: "PAYMENT_PENDING" };
    if (purchaseMode === "error") throw new Error("synthetic purchase error");
    sdkPro = true;
    await billingEvent();
    return { customerInfo: info() };
  },
  restorePurchases: async () => {
    restoreCalls++;
    sdkPro = true;
    await billingEvent();
    return info();
  },
} }));

let micPermissionFailures = mode === "mic-retry" ? 1 : 0;
let recorderStarts = 0;
let recorderStops = 0;
let playerCreates = 0;
let playerPlays = 0;
let playerRemoves = 0;
const pendingTranscriptions: string[] = [];
const transcribedTexts: string[] = [];
const ttsProviderTexts: string[] = [];
const audioBytesByUri = new Map<string, Uint8Array>();
const fileBytesByUri = new Map<string, string>();
const generatedRecordingBytes = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70,
  0x4d, 0x34, 0x41, 0x20, 0x00, 0x00, 0x00, 0x00,
  0x4d, 0x34, 0x41, 0x20, 0x69, 0x73, 0x6f, 0x6d,
]);
mock.module("expo-audio", () => {
  const setAudioModeAsync = async () => {};
  return {
    AudioModule: {
      requestRecordingPermissionsAsync: async () => {
        if (micPermissionFailures > 0) {
          micPermissionFailures--;
          return { granted: false };
        }
        return { granted: true };
      },
    },
    RecordingPresets: { HIGH_QUALITY: {} },
    setAudioModeAsync,
    useAudioRecorder: () => React.useMemo(() => ({
      uri: null as string | null,
      async prepareToRecordAsync() {},
      record() {
        recorderStarts++;
      },
      async stop() {
        recorderStops++;
        const uri = `file:///front-door-recording-${recorderStops}.m4a`;
        this.uri = uri;
        audioBytesByUri.set(uri, generatedRecordingBytes);
      },
    }), []),
    useAudioRecorderState: () => ({ isRecording: true, metering: -18 }),
    createAudioPlayer: ({ uri }: { uri: string }) => {
      playerCreates++;
      const listeners = new Set<(status: any) => void>();
      const status = { isLoaded: true, playing: false, isBuffering: false, didJustFinish: false, duration: 0.05, currentTime: 0 };
      const emit = (next: Partial<typeof status>) => {
        Object.assign(status, next);
        listeners.forEach((listener) => listener({ ...status }));
      };
      return {
        isLoaded: true,
        currentStatus: status,
        volume: 1,
        muted: false,
        addListener: (_event: string, listener: (status: any) => void) => {
          listeners.add(listener);
          setTimeout(() => listener({ ...status }), 0);
          return { remove: () => listeners.delete(listener) };
        },
        play() {
          playerPlays++;
          assert.ok(fileBytesByUri.has(uri), `cached voice file exists for player source ${uri}`);
          emit({ playing: true, didJustFinish: false, currentTime: 0 });
          setTimeout(() => emit({ playing: false, didJustFinish: true, currentTime: status.duration }), 2);
        },
        pause() {
          emit({ playing: false });
        },
        remove() {
          playerRemoves++;
          listeners.clear();
        },
      };
    },
  };
});
mock.module("@/lib/reminders", () => ({ cancelChallengeNudge: async () => {}, cancelDailyReminder: async () => {}, syncChallengeNudge: async () => {} }));
mock.module("@/lib/baselineAudio", () => ({ deleteAllBaselineAudioStrict: async () => {}, deleteBaselineAudioStrict: async () => {}, keepBaselineAudio: async () => {} }));

const Host = (props: any) => React.createElement("host", props, props.children);
const ButtonHost = (props: any) => React.createElement("button", props, props.children ?? props.label);
class Value { constructor(public value = 0) {} setValue(value: number) { this.value = value; } stopAnimation() {} interpolate() { return this; } addListener() { return "listener"; } removeListener() {} }
const animation = { start: (cb?: (value: { finished: boolean }) => void) => cb?.({ finished: true }), stop() {} };
const Animated = { Value, View: Host, Text: Host, ScrollView: Host, event: () => () => {}, timing: () => animation, parallel: () => animation, stagger: () => animation, multiply: () => new Value(), add: () => new Value(), subtract: () => new Value() };
mock.module("react-native", () => ({ View: Host, Text: Host, Image: Host, ScrollView: Host, Pressable: ButtonHost, TextInput: (props: any) => React.createElement("input", props), AppState: { addEventListener: () => ({ remove() {} }) }, AccessibilityInfo: { announceForAccessibility() {} }, ActivityIndicator: Host, KeyboardAvoidingView: Host, Animated, Easing: { bezier: () => () => {}, out: () => () => {}, cubic: () => {} }, InteractionManager: { runAfterInteractions: (fn: () => void) => { fn(); return { cancel() {} }; } }, Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: 390, height: 844 }), Platform: { OS: "ios", select: (value: any) => value.ios ?? value.default }, StyleSheet: { create: (value: any) => value, absoluteFillObject: {} } }));
const icons = ["Bookmark", "Star", "TrendingUp", "X", "AlertCircle", "ChevronDown", "Clock3", "ArrowUp", "Keyboard", "Mic", "RotateCcw", "Square", "Volume2", "VolumeX", "Lock", "ArrowLeft", "LockKeyhole", "Check", "ChevronRight", "PenLine", "Sparkles", "Circle", "Info", "Settings", "Target", "Trash2", "CreditCard", "Database", "FileText", "FlaskConical", "HelpCircle", "Mic2", "RefreshCw", "ShieldCheck", "UserRound"];
mock.module("lucide-react-native", () => Object.fromEntries(icons.map((name) => [name, () => null])));
mock.module("react-native-svg", () => ({ default: Host, Circle: Host, Path: Host, Rect: Host }));
mock.module("expo-blur", () => ({ BlurView: Host }));
mock.module("expo-constants", () => ({ ExecutionEnvironment: { StoreClient: "go" }, default: { executionEnvironment: "standalone", expoConfig: { version: "synthetic-front-door" } } }));
mock.module("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
mock.module("@/components/ui", () => ({ Backdrop: () => null, HeroSurface: Host, MicControl: ButtonHost, Thinking: Host, Waveform: Host, Eyebrow: Host, Reveal: Host, Meter: Host, StateDock: Host, GlassCard: Host, PressCard: ButtonHost, GhostButton: ButtonHost, PrimaryButton: ButtonHost, tap() {}, useReducedMotion: () => true }));
mock.module("react-native-gesture-handler", () => ({ GestureHandlerRootView: Host }));
mock.module("expo-font", () => ({ useFonts: () => [true, null] }));
mock.module("expo-status-bar", () => ({ StatusBar: () => null }));
mock.module("expo-splash-screen", () => ({ preventAutoHideAsync: async () => {}, hideAsync: async () => {} }));
mock.module("@/components/LaunchExperience", () => ({ LaunchExperience: () => null }));
mock.module("@/components/MigrationNotice", () => ({ MigrationNotice: () => null }));
mock.module("@/components/PaidProductUI", () => ({ ProductCard: Host, SectionLabel: Host, StatusPill: Host, PaidHeader: Host }));
mock.module("react-native-webview", () => ({ WebView: (props: any) => React.createElement("webview", props) }));
mock.module("expo-file-system", () => ({
  File: class {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    get exists() {
      return audioBytesByUri.has(this.uri) || fileBytesByUri.has(this.uri);
    }
    delete() {
      audioBytesByUri.delete(this.uri);
      fileBytesByUri.delete(this.uri);
    }
  },
}));
const legacyFs = {
  cacheDirectory: "file:///front-door-cache/",
  EncodingType: { Base64: "base64", UTF8: "utf8" },
  makeDirectoryAsync: async () => {},
  writeAsStringAsync: async (uri: string, value: string) => {
    fileBytesByUri.set(uri, value);
  },
  getInfoAsync: async (uri: string) => ({
    exists: fileBytesByUri.has(uri) || [...fileBytesByUri.keys()].some((key) => key.startsWith(uri)),
  }),
  deleteAsync: async (uri: string) => {
    for (const key of [...fileBytesByUri.keys()]) {
      if (key === uri || key.startsWith(uri)) fileBytesByUri.delete(key);
    }
  },
  readDirectoryAsync: async (uri: string) => {
    const prefix = uri.endsWith("/") ? uri : `${uri}/`;
    return [...new Set([...fileBytesByUri.keys()]
      .filter((key) => key.startsWith(prefix))
      .map((key) => key.slice(prefix.length).split("/")[0])
      .filter(Boolean))];
  },
};
mock.module("expo-file-system/legacy", () => legacyFs);
mock.module("@/lib/approvedDeckLoader", () => ({ loadApprovedDeckHtml: async () => "<html>synthetic asset host</html>", loadConvertedHandoffDeckHtml: async () => "<html>synthetic asset host</html>", loadModuleCloseDeckHtml: async () => "<html>synthetic asset host</html>" }));
mock.module("@/lib/lessonFeedbackService", () => ({ submitLessonFeedback: async () => { throw new Error("No external feedback"); } }));

for (const name of Object.keys(process.env)) if (name.startsWith("EXPO_PUBLIC_")) delete process.env[name];
process.env.EAS_BUILD_PROFILE = "testflight";
process.env.EXPO_PUBLIC_SUPABASE_URL = authOrigin;
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "synthetic-public";
process.env.EXPO_PUBLIC_NATIVE_RESULTS = "normal-results-v1";
process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY = "appl_fixture";
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN = origin;
process.env.ANTHROPIC_API_KEY = "synthetic";
process.env.ELEVENLABS_API_KEY = "synthetic";
process.env.OPENAI_API_KEY = "synthetic";
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;

const { create, act } = await import(await import("../scripts/component-test-deps").then((module) => module.verifyComponentTestDeps()));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__DEV__ = false;
(globalThis as any).requestAnimationFrame = (cb: (time: number) => void) => { cb(0); return 1; };

function normalizeRoute(next: any): any {
  if (typeof next === "string" && next.startsWith("/debrief/")) return { pathname: "/debrief/[id]", params: { id: next.split("/")[2] } };
  return next;
}
let route: any = "/(tabs)";
let params: any = {};
let navigate: ((route: any) => void) | null = null;
const routeEvents: string[] = [];
const routePath = () => typeof route === "string" ? route : route.pathname;
const router = { replace: (next: any) => { routeEvents.push(`replace:${typeof next === "string" ? next : next.pathname}`); route = normalizeRoute(next); navigate?.(route); }, push: (next: any) => { routeEvents.push(`push:${typeof next === "string" ? next : next.pathname}`); route = normalizeRoute(next); navigate?.(route); }, back: () => router.replace("/(tabs)"), canGoBack: () => true, setParams: (next: any) => { params = { ...params, ...next }; } };
let account: any;
let store: any;
let root: any;
let queryClient: any;
const Stack = Object.assign(() => React.createElement(RouterScreen), { Screen: () => null });
mock.module("expo-router", () => ({ Stack, useRouter: () => router, useLocalSearchParams: () => params, useGlobalSearchParams: () => params, useSegments: () => routePath().split("/").filter(Boolean) }));

const purchases = await import("../lib/purchases");
const { QueryClientProvider, useQueryClient } = await import("@tanstack/react-query");
const { useAuth } = await import("../providers/auth");
const { useStore } = await import("../providers/store");
const { default: Entry } = await import("../app/entry");
const { default: Onboarding } = await import("../app/onboarding");
const { default: Rehearse } = await import("../app/rehearse/[id]");
const { default: Debrief } = await import("../app/debrief/[id]");
const { default: ContinueFromWeb } = await import("../app/continue-from-web");
const { default: SavedResult } = await import("../app/saved-result");
const { default: Paywall } = await import("../app/paywall");
const { default: PurchaseSuccess } = await import("../app/purchase-success");
const { default: Today } = await import("../app/(tabs)/index");
const { default: Library } = await import("../app/(tabs)/library");
const { default: AccountPractice } = await import("../app/account-practice");
const { default: Lesson } = await import("../app/approved-lesson/[lessonId]");
const { default: LessonRehearsal } = await import("../app/approved-rehearsal/[lessonId]");
const { default: Root } = await import("../app/_layout");
const screens: Record<string, any> = { "/entry": Entry, "/onboarding": Onboarding, "/rehearse/[id]": Rehearse, "/debrief/[id]": Debrief, "/continue-from-web": ContinueFromWeb, "/saved-result": SavedResult, "/paywall": Paywall, "/purchase-success": PurchaseSuccess, "/(tabs)": Today, "/(tabs)/library": Library, "/account-practice": AccountPractice, "/approved-lesson/[lessonId]": Lesson, "/approved-rehearsal/[lessonId]": LessonRehearsal };
function RouterScreen() {
  purchases.useIsPro();
  queryClient = useQueryClient();
  account = useAuth();
  store = useStore();
  const Screen = screens[routePath()];
  assert.ok(Screen, `mounted destination ${routePath()}`);
  return React.createElement(Screen, { key: JSON.stringify(route) });
}
function Harness() {
  const [location, setLocation] = React.useState(normalizeRoute(route));
  navigate = setLocation;
  route = normalizeRoute(location);
  params = typeof route === "string" ? {} : route.params ?? {};
  return React.createElement(Root);
}
const nodeText = (node: any): string => typeof node === "string" ? node : Array.isArray(node) ? node.map(nodeText).join(" ") : node && typeof node === "object" ? nodeText(node.children ?? []) : "";
const text = () => nodeText(root.toJSON());
async function flush(rounds = 1) { for (let index = 0; index < rounds; index++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); }); }
async function press(label: string) {
  const found = root.root.findAllByType("button").find((node: any) => (node.props.label === label || node.props.accessibilityLabel === label || nodeText(node).includes(label)) && !node.props.disabled);
  assert.ok(found, `enabled control: ${label} at ${routePath()} ${text().slice(-1800)}`);
  await act(async () => { await found.props.onPress(); });
  await flush(2);
}
async function waitForControl(label: string, rounds = 50) {
  for (let index = 0; index < rounds; index++) {
    const found = root.root.findAllByType("button").some((node: any) => (node.props.label === label || node.props.accessibilityLabel === label || nodeText(node).includes(label)) && !node.props.disabled);
    if (found) return;
    await flush();
  }
  assert.fail(`enabled control: ${label} at ${routePath()} ${text().slice(-1800)}`);
}
async function waitForText(fragment: string, rounds = 50) {
  for (let index = 0; index < rounds; index++) {
    if (text().includes(fragment)) return;
    await flush();
  }
  assert.fail(`text: ${fragment} at ${routePath()} ${text().slice(-1800)}`);
}
async function setInput(accessibilityLabel: string, value: string) {
  const input = root.root.findAllByType("input").find((node: any) => node.props.accessibilityLabel === accessibilityLabel);
  assert.ok(input, `input: ${accessibilityLabel}`);
  await act(async () => input.props.onChangeText(value));
  await flush();
}
async function restart() {
  await act(async () => root.unmount());
  await act(async () => { root = create(React.createElement(Harness)); });
  await flush(3);
}
async function go(next: any) {
  await act(async () => router.replace(next));
  await flush(3);
}
async function mount() {
  await act(async () => { root = create(React.createElement(Harness)); });
  await flush(4);
}
async function recordLine(line: string, useLabel: string) {
  pendingTranscriptions.push(line);
  await press("Record your line");
  await press("Stop and review your line");
  await press(useLabel);
}

async function recordLineWithTranscriptionRetry(line: string, useLabel: string) {
  pendingTranscriptions.push(line);
  await press("Record your line");
  await press("Stop and review your line");
  await waitForText("Transcription unavailable");
  await press("Try mic again");
  pendingTranscriptions.push(line);
  await press("Stop and review your line");
  await press(useLabel);
}

async function resumeApprovedContinuation() {
  const before = (await db.query("select id,generation,state from bysi_native_free.session where owner_id=$1", [guest])).rows;
  assert.equal(before.length, 1);
  const calls = transcriptionProviderCalls;
  const words = store.activePracticeSession.freeRehearsalTurns.map((t:any)=>t.text);
  if (mode === "continuation-expired") await db.query("update bysi_native_free.session set state=jsonb_set(state,'{proof,expires}',to_jsonb(1::bigint)) where id=$1", [before[0].id]);
  if (mode === "continuation-spend") await db.exec("update bysi_native_free.spend_day set spent_cents=500");
  if (mode === "continuation-generation") {
    for (const seed of ['d','e']) {
      const args={sessionId:before[0].id,kind:'close',operationId:seed.repeat(64),digest:'f'.repeat(64)};
      const reserved=await freeRuntime!.rpc(guest,{...args,action:'reserve',costCents:1,spendLimitCents:500});
      assert.equal(reserved.code,'reserved');
      assert.equal((await freeRuntime!.rpc(guest,{...args,action:'fail',lease:reserved.lease})).code,'ok');
    }
  }
  if (mode === "continuation-missing") await act(async()=>{await store.saveActivePracticeSession({...store.activePracticeSession,freeRehearsalTurns:store.activePracticeSession.freeRehearsalTurns.slice(0,2)});});
  const generations=providerCalls;
  const outgoingBeforeRestart=reviewerPushbackBodies.length;
  interruptContinuation = false;
  const rehearsalRoute=route;
  const beforeRestart={label:store.activePracticeSession.counterpartDisplayLabel,topic:store.activePracticeSession.topic,goal:store.activePracticeSession.usefulOutcome};
  if(process.env.BYSI_CONTEXT_CASE==='screen') {await go('/account-practice');await go(rehearsalRoute);} else await restart();
  console.log(JSON.stringify({reviewerProbe:'full root restart before first checkpoint',before:beforeRestart,after:{label:store.activePracticeSession?.counterpartDisplayLabel,topic:store.activePracticeSession?.topic,goal:store.activePracticeSession?.usefulOutcome},wordsRetained:JSON.stringify(store.activePracticeSession?.freeRehearsalTurns.map((t:any)=>t.text))===JSON.stringify(words)}));

  if (["continuation-missing","continuation-generation"].includes(mode)) {
    await waitForText("recording limit");
    assert.ok(!root.root.findAllByType("button").some((n:any)=>n.props.accessibilityLabel==='Retry sending'||n.props.accessibilityLabel==='Record your line'||n.props.label==='Start new rehearsal'));
    assert.equal(providerCalls,generations);assert.equal(transcriptionProviderCalls,calls);
    assert.deepEqual((await db.query("select id,generation from bysi_native_free.session where owner_id=$1",[guest])).rows,before.map((r:any)=>({id:r.id,generation:r.generation})));
    mark("continuation: missing approved words or generation exhaustion stays blocked without remint");
    return false;
  }
  if(openerContinuation && !['screen','cold-on'].includes(process.env.BYSI_CONTEXT_CASE??'')) {
  await waitForText("Restore your conversation context");
  assert.equal(providerCalls,generations);
  assert.equal(reviewerPushbackBodies.length,outgoingBeforeRestart,"no generation request after cold restart before explicit restoration");
  assert.equal((await db.query("select state from bysi_native_free.session where owner_id=$1",[guest])).rows[0].state.checkpoint,undefined);
  assert.ok(!JSON.stringify([...disk.values()]).includes("My sister keeps making jokes"),"consent off does not persist custom context");
  await setInput("Restore conversation title","Your conversation");
  await setInput("Restore counterpart","Hope");
  await setInput("Restore situation","My sister keeps making jokes about my choices in front of other people.");
  await setInput("Restore goal","Say the request clearly");
  await setInput("Restore counterpart behavior","Past attempts have stalled before anything was settled. They begin guarded and need you to stay specific about what you want.");
  await setInput("Restore opening line","Okay. What did you want to talk about?");
  assert.equal(reviewerPushbackBodies.length,outgoingBeforeRestart,"typing is not confirmation");
  await press("Confirm restored context");
  assert.ok(!JSON.stringify([...disk.values()]).includes("My sister keeps making jokes"),"restoration does not change persistence consent");
  }
  await waitForControl("Retry sending");
  assert.deepEqual(store.activePracticeSession.freeRehearsalTurns.map((t:any)=>t.text), words);
  await press("Retry sending");
  console.log(JSON.stringify({reviewerProbe:'generation contract after root restart',before:reviewerPushbackBodies[0]?.contract,after:reviewerPushbackBodies.at(-1)?.contract,committedPhase:(await db.query("select phase from bysi_native_free.session where owner_id=$1",[guest])).rows[0].phase}));
  assert.deepEqual(reviewerPushbackBodies.at(-1)?.contract,reviewerPushbackBodies[0]?.contract,'do not silently send substituted custom context');
  const committed=(await db.query("select state from bysi_native_free.session where owner_id=$1",[guest])).rows[0].state.checkpoint;
  assert.deepEqual(committed.contract,reviewerPushbackBodies[0].contract,'exact original contract committed, not only sent');
  assert.equal(committed.transcript.user_turn_1,words[0]);
  assert.equal(transcriptionProviderCalls, calls, "continuation never makes a third recording");
  if (mode === "continuation-spend") {
    assert.equal(providerCalls,generations);
    assert.deepEqual((await db.query("select id,generation,phase from bysi_native_free.session where owner_id=$1",[guest])).rows,before.map((r:any)=>({id:r.id,generation:r.generation,phase:'pushback'})));
    assert.equal((await db.query("select count(*)::int n from bysi_native_free.operation where kind='close'")).rows[0].n,0);
    mark("continuation: separate spend limit denies generation without provider dispatch or remint");
    return false;
  }
  assert.equal(providerCalls,generations+1,"next generation dispatches once, including lost-response replay");
  const after = (await db.query("select id,generation,phase from bysi_native_free.session where owner_id=$1", [guest])).rows;
  assert.deepEqual(after.map((r:any)=>[r.id,r.generation]), before.map((r:any)=>[r.id,r.generation]), "no remint or restart");
  assert.equal(after[0].phase, openerContinuation ? "pushback" : "close", "synthetic next generation committed, not merely reserved");
  const recordings = (await db.query("select count(*)::int n from bysi_native_free.operation where session_id=$1 and kind=$2", [before[0].id,openerContinuation?'transcribe_opener':'transcribe_reply'])).rows[0].n;
  assert.equal(recordings,2);
  mark("continuation: failed then successful transcription, approved words, close/reopen, synthetic next generation completed without third transcription");
  return true;
}
async function completeGuestJourney() {
  if (mode === "fd2-same-owner-transcribe") {
    currentSession = sessionFor(guest);
    sameOwnerEventDuringUser = true;
  }
  await mount();
  if (mode === "fd2-same-owner-transcribe") await go("/entry");
  assert.equal(routePath(), "/entry");
  assert.equal(account.user, null);
  mark("entry: mounted release root at guest front door");
  await press("Get started");
  assert.equal(routePath(), "/onboarding", `${text()} authGetSession=${authGetSessionCalls} anonymousSignIn=${anonymousSignInCalls} current=${currentSession?.user.id ?? "none"} routes=${routeEvents.join(",")}`);
  assert.equal(account.user, null, "guest can start talking before registered login");
  mark("entry: Get started created anonymous Auth session without registered login");
  if(process.env.BYSI_CONTEXT_CASE==='cold-on') await act(async()=>{await store.setSaveCustomScenarioText(true);});
  await press("I have a conversation I need to prepare for");
  await press("Family member");
  await setInput("Conversation situation", "My sister keeps making jokes about my choices in front of other people.");
  await press("Continue");
  await press("Say the request clearly");
  await press("Minimizes the problem");
  assert.equal(routePath(), "/rehearse/[id]");
  assert.equal(store.activePracticeSession.counterpartDisplayLabel, "Hope");
  const runId = store.activePracticeSession.id;
  mark("onboarding: selected real family conversation with Hope");
  await press("Start my rehearsal");
  if (mode === "mic-retry") {
    await press("Allow microphone");
    assert.ok(text().includes("Microphone access is off."));
    await press("Try again");
    mark("microphone: denied once and recovered through retry");
  } else {
    await press("Allow microphone");
  }
  if (mode === "transcribe-retry" || openerContinuation) {
    if (openerContinuation) transcribeFailuresRemaining = 1;
    await recordLineWithTranscriptionRetry("I need you to stop joking about my choices in front of people.", "Use this opener");
    mark("transcription: provider failure surfaced and recovered through mounted retry");
  } else {
    await recordLine("I need you to stop joking about my choices in front of people.", "Use this opener");
  }
  if (openerContinuation) {await resumeApprovedContinuation();await waitForControl("Record your line");}
  assert.ok(text().includes("I was joking. Everyone else knew that"));
  if (mode === "tts-failure") {
    await waitForText("Voice unavailable");
    await press("Try voice again");
    mark("voice: failed TTS surfaced and recovered through mounted replay");
  }
  assert.ok(ttsProviderTexts.some((line) => line.includes("I was joking. Everyone else knew that")), "Hope playback seam received exact pushback");
  mark("rehearsal: spoken opener produced and played Hope pushback");
  if (mode === "cold-server-claim") {
    const originalContract = (await db.query("select state from bysi_native_free.session where owner_id=$1", [guest])).rows[0].state.checkpoint.contract;
    await act(async () => root.unmount());
    disk.clear();
    secureDisk.clear();
    route = "/entry";
    await mount();
    assert.equal(store.activePracticeSession, null);
    await press("Get started");
    if(process.env.BYSI_CONTEXT_CASE==='cold-on') await act(async()=>{await store.setSaveCustomScenarioText(true);});
  await press("I have a conversation I need to prepare for");
    await press("Family member");
    await setInput("Conversation situation", "A different new conversation that must not replace saved authority.");
    await press("Continue");
    await press("Say the request clearly");
    await press("Minimizes the problem");
    assert.equal(routePath(), "/rehearse/[id]");
    assert.deepEqual(store.activePracticeSession.normalFreeContract, originalContract);
    assert.ok(text().includes("I was joking. Everyone else knew that"), `after true cold text=${text().slice(-2200)} session=${JSON.stringify(store.activePracticeSession)}`);
    assert.equal(store.activePracticeSession.counterpartDisplayLabel, "Hope");
    mark("recovery: true cold remount recovered exact server-owned Hope contract");
  } else {
    await restart();
    assert.equal(routePath(), "/rehearse/[id]");
    assert.ok(text().includes("I was joking. Everyone else knew that"), `after restart text=${text().slice(-2200)} session=${JSON.stringify(store.activePracticeSession)}`);
    assert.equal(store.activePracticeSession.counterpartDisplayLabel, "Hope");
    mark("recovery: cold remount preserved exact Hope pushback and context");
  }
  if (continuationMode && !openerContinuation) {
    transcribeFailuresRemaining = 1;
    await recordLineWithTranscriptionRetry("I am asking you not to make those jokes when other people are there.", "Use this reply");
    if (!await resumeApprovedContinuation()) return;
  } else await recordLine("I am asking you not to make those jokes when other people are there.", "Use this reply");
  assert.ok(text().includes("I still think you are overreacting"));
  assert.ok(ttsProviderTexts.some((line) => line.includes("I still think you are overreacting")), "Hope close playback seam received exact close");
  mark("rehearsal: spoken reply produced and played Hope close");
  await press("Review complete transcript");
  assert.ok(text().includes("Nothing gets analyzed until you approve it."));
  await press("Approve transcript");
  await flush(20);
  if (mode === "lost-result") {
    await press("Recover my result");
    await flush(20);
    mark("result: lost committed response recovered through mounted debrief control");
  }
  assert.equal(routePath(), "/debrief/[id]");
  assert.ok(text().includes("You asked for a task."));
  assert.ok(store.activePracticeSession.sharedResult);
  const savedTurns = store.activePracticeSession.freeRehearsalTurns;
  assert.equal(savedTurns.find((turn: any) => turn.role === "user")?.text, "I need you to stop joking about my choices in front of people.");
  assert.equal(store.activePracticeSession.sharedResult.rehearsal_id, store.activePracticeSession.id);
  assert.equal(store.activePracticeSession.sharedResult.pressure_moment.opening_turn_id, savedTurns[0].id);
  assert.equal(store.activePracticeSession.sharedResult.pressure_moment.pushback_turn_id, savedTurns[1].id);
  mark("result: authentic saved result finalized from approved spoken transcript");
  await press("See what changes with practice");
  await press("See the practice plan");
  await press("See my practice plan");
  assert.equal(routePath(), "/paywall");
  assert.ok(!text().includes("Log in to verify purchases before viewing an Apple offer."));
  await press("Continue");
  await press("Continue");
  assert.ok(text().includes("Monthly subscription"));
  assert.equal(purchaseCalls, 0);
  mark("paywall: guest reviews monthly terms before account verification");
  return runId;
}

async function loginFromPaywall() {
  await press("Restore purchases");
  assert.equal(routePath(), "/continue-from-web");
  await setInput("Email address", "frontdoor@invalid");
  await setInput("Password", "synthetic-only-password");
  await press("Sign in to save this result and continue");
  await flush(8);
  assert.equal(account.user.id, owner);
  assert.equal(routePath(), "/paywall", "subscription login returns to the offer");
  // Independently inspect the claimed result; this is not the login destination.
  await go("/saved-result");
  assert.equal(routePath(), "/saved-result");
  await flush(8);
  assert.ok(text().includes("You asked for a task."));
  const saved = (await db.query("select owner_id,state,phase from bysi_native_free.session where owner_id=$1", [owner])).rows[0];
  assert.equal(saved.owner_id, owner);
  assert.equal(saved.phase, "result");
  assert.ok(saved.state.record, "registered owner retained claimed normal-free result");
  mark("account: login claimed the guest result without duplicate generation");
}

async function fd2InitialSignout() {
  await mount();
  assert.equal(routePath(), "/entry");
  injectSignout = true;
  await press("Get started");
  assert.equal(routePath(), "/entry");
  assert.equal(currentSession, null);
  assert.equal(account.session, null);
  assert.equal(anonymousSignInCalls, 0);
  assert.equal(providerCalls, 0);
  mark("fd2: initial getter sign-out cancelled start without anonymous replacement or onward route");
}

async function fd2UserOwnerSwitch() {
  currentSession = sessionFor(guest);
  await mount();
  await go("/entry");
  switchDuringUser = true;
  await press("Get started");
  assert.equal(routePath(), "/entry");
  assert.equal(currentSession?.user.id, owner);
  assert.equal(account.session?.user.id, owner);
  assert.equal(anonymousSignInCalls, 0);
  assert.equal(signOutCalls, 0);
  assert.equal(providerCalls, 0);
  mark("fd2: getUser registered-owner switch cancelled start without replacing the account");
}

async function fd2AbaContained() {
  currentSession = sessionFor(guest);
  await mount();
  await go("/entry");
  sameOwnerEventDuringUser = true;
  abaDuringUser = true;
  await press("Get started");
  assert.equal(routePath(), "/entry");
  assert.equal(anonymousSignInCalls, 0);
  assert.equal(signOutCalls, 0);
  assert.equal(providerCalls, 0);
  mark("fd2: explicit logout before same-owner sign-in cancelled start without navigation");
}

async function runClaimRetry() {
  await completeGuestJourney();
  await press("Restore purchases");
  assert.equal(routePath(), "/continue-from-web");
  await setInput("Email address", "frontdoor@invalid");
  await setInput("Password", "synthetic-only-password");
  await press("Sign in to save this result and continue");
  await flush(8);
  assert.equal(account.user.id, owner);
  assert.equal(claimAttempts, 1);
  const afterFirst = (await db.query("select owner_id::text owner_id,count(*)::int n from bysi_native_free.session where phase='result' group by owner_id order by owner_id")).rows;
  if (mode === "claim-retry-503") assert.deepEqual(afterFirst, [{ owner_id: guest, n: 1 }]);
  await go("/saved-result");
  await flush(8);
  assert.equal(routePath(), "/saved-result");
  await act(async () => root.unmount());
  await act(async () => { root = create(React.createElement(Harness)); });
  await flush(8);
  await press("Find my latest saved result");
  await flush(12);
  assert.equal(claimAttempts, 2);
  assert.ok(text().includes("You asked for a task."), text());
  const saved = (await db.query("select owner_id,state,phase from bysi_native_free.session where owner_id=$1", [owner])).rows[0];
  assert.equal(saved.owner_id, owner);
  assert.equal(saved.phase, "result");
  assert.ok(saved.state.record);
  assert.equal(providerCalls, 3, "server claim retry did not regenerate the assessment");
  mark("fd3: visible saved-result retry claimed exact guest result after failed first response");
}

async function fd3SwitchDuringFirstClaimSave() {
  await completeGuestJourney();
  await press("Restore purchases");
  assert.equal(routePath(), "/continue-from-web");
  await setInput("Email address", "frontdoor@invalid");
  await setInput("Password", "synthetic-only-password");
  switchDuringClaimRetrySave = true;
  await press("Sign in to save this result and continue");
  await flush(8);
  const rows = (await db.query("select owner_id::text owner_id from bysi_native_free.result")).rows;
  assert.equal(claimAttempts, 0);
  assert.equal(rows[0].owner_id, guest);
  assert.equal(secureDisk.has("claim." + owner), false);
  mark("fd3: destination switch during retry persistence did not transfer guest result");
}

async function signupFromPaywall() {
  await press("Restore purchases");
  assert.equal(routePath(), "/continue-from-web");
  await press("Create an account to save this result");
  await setInput("Email address", "frontdoor@invalid");
  await setInput("Password", "synthetic-only-password");
  await press("Create account");
  await waitForText("Check your email and open the confirmation link.");
  assert.equal(signUpCalls, 1);
  await press("I confirmed my email — log in");
  await flush(8);
  assert.equal(account.user.id, owner);
  assert.equal(routePath(), "/paywall", "confirmed signup returns to the offer");
  await go("/saved-result");
  assert.equal(routePath(), "/saved-result");
  await flush(8);
  assert.ok(text().includes("You asked for a task."));
  const saved = (await db.query("select owner_id,state,phase from bysi_native_free.session where owner_id=$1", [owner])).rows[0];
  assert.equal(saved.owner_id, owner);
  assert.equal(saved.phase, "result");
  assert.ok(saved.state.record, "new signup owner retained claimed normal-free result");
  mark("account: actual create-account flow claimed the guest result after confirmed login");
}

async function loggedInPaywall() {
  await press("See my practice plan");
  assert.equal(routePath(), "/paywall");
  await waitForControl("Restore existing Apple purchase");
}

async function viewAppleOffer() {
  await waitForControl("I have not subscribed — view Apple offer");
  await press("I have not subscribed — view Apple offer");
  if (root.root.findAllByType("button").some((node: any) => node.props.label === "Subscribe monthly")) return;
  await waitForControl("Continue");
  await press("Continue");
  await waitForControl("Continue");
  await press("Continue");
  assert.ok(text().includes("Monthly subscription"));
}

async function runJourney() {
  await completeGuestJourney();
  if (mode === "signup-result") await signupFromPaywall();
  else await loginFromPaywall();
  assert.equal(providerCalls, mode === "lost-result" ? 3 : 3);
  assert.equal(recorderStarts, mode === "transcribe-retry" ? 3 : 2);
  assert.equal(recorderStops, mode === "transcribe-retry" ? 3 : 2);
  assert.ok(ttsCalls >= 2, "Hope TTS route was exercised with synthetic MP3 seam");
  assert.ok(ttsProviderCalls >= 2, "real voice module reached synthetic TTS provider");
  assert.ok(playerCreates >= 2 && playerPlays >= 2 && playerRemoves >= 2, "real Expo audio player was composed with cached voice files");
  assert.equal(transcribeCalls, mode === "transcribe-retry" ? 3 : 2, "real dictation module reached local transcription route");
  assert.equal(transcriptionProviderCalls, mode === "transcribe-retry" ? 3 : 2, "local transcription route reached synthetic provider");
  assert.deepEqual(transcribedTexts, [
    "I need you to stop joking about my choices in front of people.",
    "I am asking you not to make those jokes when other people are there.",
  ]);
}

async function runPaywallCase() {
  await completeGuestJourney();
  await loginFromPaywall();
  await loggedInPaywall();
  if (mode === "paywall-web-buyer") {
    await press("I already subscribed on the web");
    assert.ok(text().includes("Do not subscribe again in Apple."));
    assert.equal(purchaseCalls, 0);
    mark("paywall: web buyer warning prevents duplicate Apple offer");
    return;
  }
  if (mode === "paywall-restore") {
    await press("Restore existing Apple purchase");
    await waitForText("Your current access is verified.");
    assert.equal(restoreCalls, 1);
    assert.equal(purchaseCalls, 0);
    mark("paywall: restore grants only after server access verifies");
    return;
  }
  if (mode === "paywall-already") {
    sdkPro = true;
    await billingEvent();
    await queryClient.invalidateQueries({ queryKey: ["native", "access"] });
    await waitForText("Your current access is verified.");
    await go("/paywall");
    await waitForText("Your current access is verified.");
    assert.ok(!text().includes("Subscribe monthly"));
    mark("paywall: already entitled owner cannot be charged again");
    return;
  }
  await viewAppleOffer();
  if (mode === "paywall-unavailable") {
    assert.ok(text().includes("In-app purchase configuration required"));
    assert.ok(text().includes("You can still restore an existing purchase."));
    assert.equal(purchaseCalls, 0);
    mark("paywall: unavailable catalog disables checkout without inventing price");
    return;
  }
  if (mode === "paywall-cancel") purchaseMode = "cancel";
  await press(mode === "paywall-cancel" ? "Subscribe monthly" : "Subscribe monthly");
  await flush(8);
  if (mode === "paywall-cancel") {
    assert.ok(text().includes("Purchase cancelled. Nothing was charged or unlocked by BYSI."));
    assert.equal(purchaseCalls, 1);
    mark("paywall: cancel leaves access locked and reports no charge");
    return;
  }
  assert.equal(routePath(), "/purchase-success");
  assert.equal(purchaseCalls, 1);
  assert.equal(await (await import("../lib/nativeBillingRuntime")).nativeBilling!.access(), true);
  mark("paywall: purchase reaches success only after server access verifies");
}

try {
  if (mode === "fd2-initial-signout") await fd2InitialSignout();
  else if (mode === "fd2-user-owner-switch") await fd2UserOwnerSwitch();
  else if (mode === "fd2-aba-contained") await fd2AbaContained();
  else if (continuationMode) await completeGuestJourney();
  else if (["journey", "signup-result", "lost-result", "mic-retry", "transcribe-retry", "tts-failure", "fd2-same-owner-transcribe", "cold-server-claim"].includes(mode)) await runJourney();
  else if (["claim-retry-503", "claim-retry-lost"].includes(mode)) await runClaimRetry();
  else if (mode === "fd3-switch-during-save") await fd3SwitchDuringFirstClaimSave();
  else await runPaywallCase();
  const outDir = new URL("../../review-local-results/context-recovery/", import.meta.url);
  mkdirSync(outDir, { recursive: true });
  writeFileSync(new URL(`${mode}.json`, outDir), JSON.stringify({ mode, ledger, providerCalls, claimAttempts, ttsCalls, transcribeCalls, transcriptionProviderCalls, ttsProviderCalls, recorderStarts, recorderStops, playerCreates, playerPlays, playerRemoves, signUpCalls, anonymousSignInCalls, signOutCalls, purchaseCalls, restoreCalls }, null, 2));
  console.log(`PASS FRONT DOOR ${mode}: ${ledger.join(" -> ")}. External seams: synthetic Auth, RevenueCat SDK/receipt/webhook, upstream providers, Expo recorder hardware and Expo player hardware; local SQL, native routes, dictation module and voice module are real.`);
} finally {
  if (root) await act(async () => root.unmount());
  await db.close();
}
