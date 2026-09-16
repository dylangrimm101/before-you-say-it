import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { plugin } from "bun";
import React from "react";

process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN = "https://beforeyousayit.app";
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
process.env.ANTHROPIC_API_KEY = "synthetic-provider";
process.env.BYSI_COMPONENT_TEST_DEPS ??= new URL("../../component-deps", import.meta.url).pathname;

const origin = "https://beforeyousayit.app";
const authOrigin = "https://spvksnddzyvycfoefrcf.supabase.co";
const owner = "11111111-1111-4111-8111-111111111111";
const key = "a".repeat(64);
const providerCosts = Object.fromEntries(["pushback", "close", "result", "tts_pushback", "tts_close", "transcribe_opener", "transcribe_reply"].map((kind) => [kind, 1]));
const tokenFor = (id: string) => [{ alg: "HS256", typ: "JWT" }, { sub: id, exp: Math.floor(Date.now() / 1000) + 3600 }, "synthetic"].map((value) => Buffer.from(JSON.stringify(value)).toString("base64url")).join(".");
const user = { id: owner, aud: "authenticated", role: "authenticated", email: "synthetic@invalid", is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00.000Z", created_at: "2026-01-01T00:00:00.000Z", app_metadata: {}, user_metadata: {} };
let session: any = { access_token: tokenFor(owner), refresh_token: "synthetic-refresh", user };

const { PGlite } = createRequire(new URL("../../test-deps/package.json", import.meta.url))("@electric-sql/pglite");
const db = new PGlite();
await db.exec(`create role anon;create role authenticated;create role service_role;create role bysi_native_service;
  create schema auth;
  create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz);
  create function public.bysi_owner_lifecycle_denied(id uuid) returns boolean language sql security definer set search_path=pg_catalog as $$ select exists(select 1 from auth.users where users.id=$1 and deleted_at is not null) $$;`);
await db.exec(readFileSync(new URL("../../server/server/native-free/schema.sql", import.meta.url), "utf8"));
await db.exec(readFileSync(new URL("../../server/server/normal-results/schema.sql", import.meta.url), "utf8"));
await db.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values($1,now(),false)", [owner]);
const rpc = async (id: string, input: Record<string, unknown>) => (await db.query("select public.bysi_native_free($1::uuid,$2::jsonb) value", [id, input])).rows[0].value;

const runtimePath = new URL("../../server/server/native-free/runtime.mjs", import.meta.url).pathname;
mock.module(runtimePath, () => ({ getFreeRuntime: () => ({
  origin,
  key,
  verifyOwner: async () => owner,
  spendLimitCents: 10000,
  providerCosts,
  rpc,
}) }));
const routes: Record<string, (request: Request) => Promise<Response>> = {};
for (const op of ["session", "generate", "tts", "transcribe"]) {
  routes[op] = (await import(`../../server/app/api/native/free/${op}/route.js`)).POST;
}

const secureDisk = new Map<string, string>();
mock.module("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  getItemAsync: async (k: string) => secureDisk.get(k) ?? null,
  setItemAsync: async (k: string, v: string) => { secureDisk.set(k, v); },
  deleteItemAsync: async (k: string) => { secureDisk.delete(k); },
}));
mock.module("expo-crypto", () => ({
  randomUUID: () => crypto.randomUUID(),
  getRandomBytes: (count: number) => randomBytes(count),
  CryptoDigestAlgorithm: { SHA256: "sha256" },
  digestStringAsync: async (_algorithm: string, value: string) => createHash("sha256").update(value).digest("hex"),
}));
const disk = new Map<string, string>();
const rawStorage = { getItem: async (k: string) => disk.get(k) ?? null, setItem: async (k: string, v: string) => { disk.set(k, v); }, removeItem: async (k: string) => { disk.delete(k); }, getAllKeys: async () => [...disk.keys()], multiRemove: async (keys: string[]) => { keys.forEach((key) => disk.delete(key)); } };
mock.module("@react-native-async-storage/async-storage", () => ({ default: rawStorage }));

const listeners = new Set<(event: string, session: any) => void>();
const auth = {
  getSession: async () => ({ data: { session }, error: null }),
  getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
  onAuthStateChange: (cb: (event: string, session: any) => void) => { listeners.add(cb); return { data: { subscription: { unsubscribe() { listeners.delete(cb); } } } }; },
  signInAnonymously: async () => ({ data: { session }, error: null }),
  signOut: async () => { session = null; for (const cb of listeners) cb("SIGNED_OUT", null); return { error: null }; },
};
mock.module("@/lib/supabase", () => ({ supabase: { auth }, authEnvironment: { url: authOrigin, staging: false, key: "synthetic-public", keychainService: "beforeyousayit.supabase" }, isAuthConfigured: true }));
mock.module("@/lib/purchases", () => ({ PRO_ENTITLEMENT: "pro", identifyPurchasesUser: async () => null, clearPurchasesIdentity: async () => {}, useIsPro: () => false, useCustomerInfo: () => ({ data: null, isLoading: false }), useOfferings: () => ({ data: null, isLoading: false }), usePurchasePackage: () => ({ isPending: false, mutateAsync: async () => { throw Error("No purchases in fixture"); } }), useRestorePurchases: () => ({ isPending: false, mutateAsync: async () => false }) }));
mock.module("@/lib/reminders", () => ({ cancelChallengeNudge: async () => {}, cancelDailyReminder: async () => {}, syncChallengeNudge: async () => {} }));
mock.module("@/lib/baselineAudio", () => ({ deleteAllBaselineAudioStrict: async () => {}, deleteBaselineAudioStrict: async () => {} }));
const dictation = { status: "denied", error: "synthetic permission denied", cancel: async () => {}, reset: async () => {}, requestPermission: async () => false };
mock.module("@/lib/useDictation", () => ({ useDictation: () => dictation }));
mock.module("@/lib/voice", () => ({ deleteGeneratedVoiceCacheStrict: async () => {}, replaySpeech: async () => {}, resetSpeech: async () => {}, speak: async () => {}, stopSpeech: async () => {}, unlockAudioPlayback: async () => {}, useSpeech: () => ({ phase: "idle", canReplay: false }) }));

const { fixture } = await import("../../server/tests/fixtures/generation-output.mjs");
let providerCalls = 0;
const seenOperations: string[] = [];
globalThis.fetch = (async (url: unknown, init?: RequestInit) => {
  const href = String(url);
  if (href.startsWith(origin + "/api/native/free/")) {
    const op = href.split("/").at(-1)!;
    seenOperations.push(op);
    return routes[op](new Request(href, init));
  }
  assert.equal(href, "https://api.anthropic.com/v1/messages");
  providerCalls++;
  const request = JSON.parse(String(init?.body));
  const body = JSON.parse(request.messages[0].content);
  if (request.max_tokens === 1600) {
    const result = fixture();
    result.outputVersion = "bysi-free-rehearsal-result-v1-2026-08-12";
    result.pressure_moment.ask_quote = body.transcript.user_turn_1;
    result.pressure_moment.pushback_quote = body.transcript.counterpart_pushback;
    result.pressure_moment.response_quote = body.transcript.user_turn_2;
    return Response.json({ id: "msg_result", model: "synthetic", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(result) }] });
  }
  const close = body.turn === "close";
  return Response.json({ id: "msg_turn_" + providerCalls, model: "synthetic", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify({ mode: "turn", outputVersion: "bysi-rehearsal-turn-v1-2026-08-12", turn: close ? "close" : "pushback", role: "hope", text: close ? "Which priority should wait?" : "Everything matters.", safety: null }) }] });
}) as typeof fetch;

plugin({ name: "mounted-assets", setup(builder) { builder.onLoad({ filter: /\.(png|ttf)$/ }, () => ({ contents: "export default 1", loader: "js" })); } });
const { verifyComponentTestDeps } = await import("../scripts/component-test-deps");
const { create, act } = await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
(globalThis as any).__DEV__ = true;
const Host = (props: any) => React.createElement("host", props, props.children);
class Value { setValue() {} stopAnimation() {} interpolate() { return this; } addListener() { return "listener"; } removeListener() {} }
const animation = { start: (cb?: any) => cb?.({ finished: true }), stop() {} };
const Animated = { Value, View: Host, Text: Host, ScrollView: Host, event: () => () => {}, timing: () => animation, parallel: () => animation, stagger: () => animation, multiply: () => new Value(), add: () => new Value(), subtract: () => new Value() };
mock.module("react-native", () => ({ View: Host, Text: Host, Image: Host, ScrollView: Host, Pressable: (props: any) => React.createElement("button", props, props.children), TextInput: (props: any) => React.createElement("input", props), ActivityIndicator: Host, KeyboardAvoidingView: Host, Animated, Easing: { bezier: () => () => {}, out: () => () => {}, cubic: () => {} }, InteractionManager: { runAfterInteractions: (fn: any) => { fn(); return { cancel() {} }; } }, Keyboard: { dismiss() {}, addListener: () => ({ remove() {} }) }, Alert: { alert() {} }, Linking: { openURL: async () => {} }, useWindowDimensions: () => ({ width: 390, height: 844 }), Platform: { OS: "web", select: (value: any) => value.web ?? value.default }, StyleSheet: { create: (value: any) => value, absoluteFillObject: {} } }));
const icons = ["AlertCircle", "ChevronDown", "Clock3", "ArrowUp", "Keyboard", "Mic", "RotateCcw", "Square", "Volume2", "VolumeX", "Lock", "ArrowLeft", "LockKeyhole", "Check", "ChevronRight", "PenLine", "Sparkles", "Circle", "Info", "Settings", "Target", "Trash2", "CreditCard", "Database", "FileText", "FlaskConical", "HelpCircle", "Mic2", "RefreshCw", "ShieldCheck", "UserRound", "Bookmark", "Star", "TrendingUp", "X"];
mock.module("lucide-react-native", () => Object.fromEntries(icons.map((name) => [name, () => null])));
mock.module("react-native-svg", () => ({ default: Host, Circle: Host, Path: Host, Rect: Host }));
mock.module("expo-blur", () => ({ BlurView: Host }));
mock.module("expo-constants", () => ({ default: { expoConfig: { version: "synthetic" } } }));
mock.module("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
mock.module("@/components/ui", () => ({ Backdrop: () => null, HeroSurface: Host, MicControl: Host, Thinking: Host, Waveform: Host, Eyebrow: Host, Reveal: Host, Meter: Host, StateDock: Host, GlassCard: Host, PressCard: (props: any) => React.createElement("button", props, props.children), GhostButton: (props: any) => React.createElement("button", props, props.label), PrimaryButton: (props: any) => React.createElement("button", props, props.label), tap() {}, useReducedMotion: () => true }));
mock.module("@/components/ScenarioPaidPractice", () => ({ ScenarioPaidPractice: () => { throw Error("paid route not part of fixture"); } }));

let route: any = "/onboarding";
let params: any = {};
let navigate: ((value: any) => void) | undefined;
const router = { replace: (value: any) => { route = value; navigate?.(value); }, push: (value: any) => router.replace(value), back() {}, canGoBack: () => true, setParams: (value: any) => { params = { ...params, ...value }; } };
const routePath = () => typeof route === "string" ? route : route.pathname;
mock.module("expo-router", () => ({ useRouter: () => router, useLocalSearchParams: () => params, useGlobalSearchParams: () => params, useSegments: () => routePath().split("/").filter(Boolean), Stack: Object.assign(() => React.createElement(RouterScreen), { Screen: () => null }) }));

const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { AuthProvider, useAuth } = await import("../providers/auth");
const { StoreProvider, useStore } = await import("../providers/store");
const { default: Onboarding } = await import("../app/onboarding");
const { default: Rehearse } = await import("../app/rehearse/[id]");
const { requestNormalFree } = await import("../lib/normalFreeRuntime");

const Debrief = () => React.createElement("host", null, "Debrief mounted");
const screens: Record<string, any> = { "/onboarding": Onboarding, "/rehearse/[id]": Rehearse, "/debrief/[id]": Debrief };
let store: any;
let account: any;
function RouterScreen() {
  account = useAuth();
  store = useStore();
  const Screen = screens[routePath()];
  assert.ok(Screen, "mounted route " + routePath());
  return React.createElement(Screen, { key: JSON.stringify(route) });
}
function Harness() {
  const [location, setLocation] = React.useState(route);
  navigate = setLocation;
  route = location;
  if (typeof route === "string" && route.startsWith("/debrief/")) route = { pathname: "/debrief/[id]", params: { id: route.split("/")[2] } };
  params = typeof route === "string" ? {} : route.params ?? {};
  return React.createElement(QueryClientProvider, { client }, React.createElement(AuthProvider, null, React.createElement(StoreProvider, null, React.createElement(RouterScreen))));
}
const client = new QueryClient();
const nodeText = (node: any): string => typeof node === "string" ? node : Array.isArray(node) ? node.map(nodeText).join(" ") : node && typeof node === "object" ? nodeText(node.children ?? []) : "";
const flush = async () => { for (let i = 0; i < 10; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); }); };
const press = async (label: string) => {
  const button = root.root.findAllByType("button").find((node: any) => (node.props.label === label || node.props.accessibilityLabel === label || nodeText(node).includes(label)) && !node.props.disabled);
  assert.ok(button, `enabled control: ${label} at ${routePath()} ${nodeText(root.toJSON()).slice(-1000)}`);
  await act(async () => { await button.props.onPress(); });
  await flush();
};
let root: any;

try {
  await requestNormalFree("generate", {
    type: "rehearsal_turn",
    turn: "pushback",
    contract: {
      entry_route: "desired_skill",
      context: "work",
      scenario: "Scope keeps changing.",
      counterpart: "Hope",
      counterpart_persona: "Hope disagrees without adding new facts.",
      difficulty: "steady",
      difficulty_behavior: "SERVER DIFFICULTY",
      reaction_pattern: "not-sure",
      opens_with: "user",
      opening_line: "",
      success_target: "Make a request",
      pressure_condition: "They disagree",
    },
    transcript: { user_turn_1: "Can we choose one task?" },
  });
  assert.equal(providerCalls, 1);
  assert.equal(store, undefined, "server checkpoint must exist before mounted store has local practice");

  await act(async () => { root = create(React.createElement(Harness)); });
  await flush();
  assert.equal(account.session.user.id, owner);
  assert.equal(store.activePracticeSession, null);
  await press("I have a conversation I need to prepare for");
  await press("Work");
  await act(async () => { root.root.findByType("input").props.onChangeText("Synthetic new conversation context that should not replace the server checkpoint."); });
  await flush();
  await press("Continue");
  await press("Say the request clearly");
  await press("I’m not sure. Surprise me");

  assert.equal(routePath(), "/rehearse/[id]");
  assert.equal(store.activePracticeSession.entryRoute, "desired_skill");
  assert.equal(store.activePracticeSession.topic, "Scope keeps changing.");
  assert.equal(store.activePracticeSession.usefulOutcome, "Make a request");
  assert.equal(store.activePracticeSession.counterpartDisplayLabel, "Hope");
  assert.deepEqual(store.activePracticeSession.freeRehearsalTurns.map((turn: any) => [turn.role, turn.text]), [["user", "Can we choose one task?"], ["them", "Everything matters."]]);

  await flush();
  await press("Type instead");
  await act(async () => { root.root.findAllByType("input").find((node: any) => node.props.accessibilityLabel === "Type your line").props.onChangeText("Which one comes first?"); });
  await press("Send your line");
  assert.deepEqual(store.activePracticeSession.freeRehearsalTurns.map((turn: any) => [turn.role, turn.text]), [["user", "Can we choose one task?"], ["them", "Everything matters."], ["user", "Which one comes first?"], ["them", "Which priority should wait?"]]);
  await press("Review complete transcript");
  await press("Approve transcript");
  for (let i = 0; i < 100 && store.activePracticeSession?.freeJourneyCheckpoint !== "pressure_moment"; i++) await act(async () => { await new Promise((resolve) => setTimeout(resolve, 10)); });
  assert.equal(store.activePracticeSession.freeJourneyCheckpoint, "pressure_moment");
  assert.equal(providerCalls, 3);
  assert.deepEqual(seenOperations, ["session", "generate", "session", "session", "generate", "generate"]);
  console.log("PASS mounted cold onboarding resume -> authoritative checkpoint -> close/result through actual transport/server SQL; synthetic Auth/provider/native hosts only");
} finally {
  if (root) await act(async () => root.unmount());
  await db.close();
  client.clear();
}
