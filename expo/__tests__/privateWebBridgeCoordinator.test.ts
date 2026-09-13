import { expect, test } from "bun:test";
import { createPrivateWebBridgeClient } from "../lib/privateWebBridge";
import { privateResultFixture } from "./privateWebResult.test";
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
test("account switch/logout invalidate in-flight and cached data including late A after B", async () => {
  const { createPrivateWebBridgeCoordinator } = await coordinatorModule();
  const pending = deferred<any>(); const signals: AbortSignal[] = [];
  const coordinator = createPrivateWebBridgeCoordinator({
    activate: async () => ({ sessionId }),
    restore: async (_: string, account: string, signal: AbortSignal) => { signals.push(signal); return account === "a" ? pending.promise : { sessionId, privateResult: null }; },
  });
  coordinator.setAccount("a");
  const old = coordinator.restore(sessionId);
  coordinator.setAccount("b");
  expect(coordinator.getSnapshot()).toEqual({ status: "idle", record: null });
  expect(signals[0].aborted).toBe(true);
  expect(await old).toBe(false);
  expect(await coordinator.restore(sessionId)).toBe(true);
  pending.resolve({ sessionId, privateResult: privateResultFixture() });
  await new Promise(r => setTimeout(r, 1));
  expect(coordinator.getSnapshot()).toEqual({ status: "ready", record: { sessionId, privateResult: null } });
  coordinator.setAccount(null);
  expect(coordinator.getSnapshot()).toEqual({ status: "idle", record: null });
  expect(await coordinator.restore(sessionId)).toBe(false);
  expect(signals).toHaveLength(2);
});
test("superseded activation never restores; clear/dispose settle pending and notify mounted observers", async () => {
  const { createPrivateWebBridgeCoordinator } = await coordinatorModule();
  const pending = deferred<any>(); let restores = 0;
  const coordinator = createPrivateWebBridgeCoordinator({ activate: () => pending.promise, restore: async () => { restores++; return { sessionId, privateResult: null }; } });
  coordinator.setAccount("a");
  const notifications: string[] = []; coordinator.subscribe(() => notifications.push(coordinator.getSnapshot().status));
  const old = coordinator.activate(token);
  expect(await coordinator.restore(sessionId)).toBe(true);
  expect(await old).toBe(false);
  pending.resolve({ sessionId }); await new Promise(r => setTimeout(r, 1));
  expect(restores).toBe(1);
  coordinator.clear(); expect(coordinator.getSnapshot().record).toBeNull();
  coordinator.dispose(); coordinator.setAccount("b");
  expect(await coordinator.restore(sessionId)).toBe(false);
  expect(notifications).toContain("idle");
});
test("coordinator converts failures to static state and retains no activation credential", async () => {
  const { createPrivateWebBridgeCoordinator } = await coordinatorModule();
  const coordinator = createPrivateWebBridgeCoordinator({ activate: async () => { throw new Error(token); }, restore: async () => { throw new Error(token); } });
  coordinator.setAccount("a");
  expect(await coordinator.activate(token)).toBe(false);
  expect(coordinator.getSnapshot()).toEqual({ status: "unavailable", record: null });
});

test("auth-bound test composition clears synchronously on auth events and ignores stale initial restoration", async () => {
  const { createAuthBoundPrivateWebBridge } = await coordinatorModule();
  const initial = deferred<any>();
  let callback!: (event: string, session: any) => void;
  let unsubscribed = false;
  let session: any = { access_token: "fixture", user };
  let first = true;
  const auth = {
    getSession: async () => { if (first) { first = false; return initial.promise; } return { data: { session }, error: null }; },
    getUser: async () => ({ data: { user: session?.user ?? null }, error: null }),
    onAuthStateChange: (cb: typeof callback) => { callback = cb; return { data: { subscription: { unsubscribe: () => { unsubscribed = true; } } } }; },
  };
  const bridge = createAuthBoundPrivateWebBridge({ environment: "test", endpoints: { activate: "http://localhost/a", restore: "http://localhost/r" }, auth, fetch: async () => Response.json({ sessionId, livemode: false, privateResult: privateResultFixture() }) });
  callback("SIGNED_IN", session);
  expect(await bridge.restore(sessionId)).toBe(true);
  session = null; callback("SIGNED_OUT", null);
  expect(bridge.getSnapshot()).toEqual({ status: "idle", record: null });
  initial.resolve({ data: { session: { access_token: "old", user } }, error: null });
  await new Promise(r => setTimeout(r, 1));
  expect(await bridge.restore(sessionId)).toBe(false);
  session = { access_token: "fixture", user: { ...user, id: "b" } }; callback("SIGNED_IN", session);
  expect(await bridge.restore(sessionId)).toBe(true);
  callback("TOKEN_REFRESHED", session);
  expect(bridge.getSnapshot().status).toBe("ready");
  callback("USER_UPDATED", { ...session, user: { ...session.user, is_anonymous: true } });
  expect(bridge.getSnapshot().record).toBeNull();
  bridge.dispose(); expect(unsubscribed).toBe(true);
  callback("SIGNED_IN", session); expect(await bridge.restore(sessionId)).toBe(false);
});

const sessionId = "12345678-1234-4234-8234-123456789abc";
const token = "b".repeat(64);
const user = { id: "a", is_anonymous: false, email_confirmed_at: "2026-09-06" };
async function coordinatorModule() {
  const path = `${import.meta.dir}/../lib/privateWebBridgeCoordinator.ts`;
  expect(await Bun.file(path).exists(), "private-result state integration seam exists").toBe(true);
  return import(path);
}
test("coordinator activates then restores into result-only observable memory state", async () => {
  const { createPrivateWebBridgeCoordinator } = await coordinatorModule();
  const requests: any[] = [];
  const client = createPrivateWebBridgeClient({ environment: "test", endpoints: { activate: "http://localhost:1234/a", restore: "http://localhost:1234/r" }, auth: {
    async getSession() { return { data: { session: { access_token: "fixture", user } }, error: null }; },
    async getUser() { return { data: { user }, error: null }; },
  }, fetch: async (url, init) => { requests.push(JSON.parse(init.body as string)); return Response.json(url.endsWith("/a") ? { sessionId } : { sessionId, livemode: false, privateResult: privateResultFixture(), access: true }); } });
  const coordinator = createPrivateWebBridgeCoordinator(client);
  coordinator.setAccount(user.id);
  const states: any[] = [];
  const unsubscribe = coordinator.subscribe(() => states.push(coordinator.getSnapshot()));
  expect(await coordinator.activate(token)).toBe(true);
  expect(requests).toEqual([{ token }, { sessionId }]);
  expect(coordinator.getSnapshot()).toEqual({ status: "ready", record: { sessionId, privateResult: privateResultFixture() } });
  expect(states.map(s => s.status)).toEqual(["loading", "ready"]);
  expect(JSON.stringify(states)).not.toContain(token);
  expect(JSON.stringify(states)).not.toContain('"access"');
  unsubscribe();
});
