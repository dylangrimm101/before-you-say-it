import { expect, test } from "bun:test";
import { privateResultFixture } from "./privateWebResult.test";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => { resolve = r; });
  return { promise, resolve };
}
test("abort and deadline settle even when auth/fetch ignore cancellation; late auth never starts network", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  const pending = deferred<any>(); let requests = 0;
  const auth = { ...authFixture(), getUser: () => pending.promise };
  const client = createPrivateWebBridgeClient({ environment: "test", endpoints, auth, timeoutMs: 10, fetch: async () => { requests++; return Response.json({ sessionId }); } });
  await expect(client.activate(token, user.id)).rejects.toThrow("Private web bridge unavailable");
  pending.resolve({ data: { user }, error: null });
  await new Promise(r => setTimeout(r, 1));
  expect(requests).toBe(0);
  const control = new AbortController();
  let signal: AbortSignal | undefined;
  const hanging = createPrivateWebBridgeClient({ environment: "test", endpoints, auth: authFixture(), fetch: async (_: string, init: RequestInit) => { signal = init.signal as AbortSignal; return new Promise(() => {}); } });
  const work = hanging.restore(sessionId, user.id, control.signal);
  await new Promise(r => setTimeout(r, 1)); control.abort();
  await expect(work).rejects.toThrow("Private web bridge unavailable");
  expect(signal?.aborted).toBe(true);
});

test("validated endpoint configuration cannot be mutated into credential forwarding", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  const mutableEndpoints = { ...endpoints }; const urls: string[] = [];
  const client = createPrivateWebBridgeClient({ environment: "test", endpoints: mutableEndpoints, auth: authFixture(), fetch: async (url: string) => { urls.push(url); return Response.json({ sessionId }); } });
  mutableEndpoints.activate = "https://outside.example/collect";
  await client.activate(token, user.id);
  expect(urls).toEqual([endpoints.activate]);
});

function restoredFixture() {
  return { sessionId, privateResult: privateResultFixture(), resultSummary: null, source: "stripe", status: "canceled", expiresAt: null, cancelAtPeriodEnd: false, livemode: false, access: false, reconciliationRequired: false };
}
test("restoration posts sessionId and projects full validated result without entitlement authority", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  const requests: { url: string; init: RequestInit }[] = [];
  let payload: any = restoredFixture();
  const client = createPrivateWebBridgeClient({ environment: "development", endpoints, auth: authFixture(), fetch: async (url: string, init: RequestInit) => { requests.push({url, init}); return Response.json(payload); } });
  expect(await client.restore(sessionId, user.id)).toEqual({ sessionId, privateResult: payload.privateResult });
  expect(requests[0].url).toBe(endpoints.restore);
  expect(requests[0].init.body).toBe(JSON.stringify({ sessionId }));
  for (const mutate of [
    (r: any) => { r.sessionId = "87654321-1234-4234-8234-123456789abc"; },
    (r: any) => { r.livemode = true; },
    (r: any) => { r.privateResult.result.starting_index.overall = "42"; },
    (r: any) => { r.privateResult = {}; },
  ]) {
    payload = restoredFixture(); mutate(payload);
    await expect(client.restore(sessionId, user.id)).rejects.toThrow("Private web bridge unavailable");
  }
  payload = { ...restoredFixture(), privateResult: null };
  expect(await client.restore(sessionId, user.id)).toEqual({ sessionId, privateResult: null });
});
test("HTTP failures, malformed success and transport errors never echo private bytes", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  for (const response of [Response.json({ error: token }, { status: 409 }), Response.json({ sessionId: "bad" }), new Response(token), Response.json({ sessionId, token })]) {
    const client = createPrivateWebBridgeClient({ environment: "test", endpoints, auth: authFixture(), fetch: async () => response });
    await expect(client.activate(token, user.id)).rejects.toThrow(/^Private web bridge unavailable$/);
  }
  const client = createPrivateWebBridgeClient({ environment: "test", endpoints, auth: authFixture(), fetch: async () => { throw new Error(token); } });
  await expect(client.activate(token, user.id)).rejects.toThrow(/^Private web bridge unavailable$/);
});

const endpoints = { activate: "http://127.0.0.1:8123/explicit-activation", restore: "http://127.0.0.1:8123/explicit-restoration" };
const sessionId = "12345678-1234-4234-8234-123456789abc";
const token = "a".repeat(64);
const user = { id: "account-a", is_anonymous: false, email_confirmed_at: "2026-09-06" };
function authFixture() {
  let bearer = 0;
  const verified: string[] = [];
  return {
    verified,
    async getSession() { return { data: { session: { access_token: `fresh-${++bearer}`, user } }, error: null }; },
    async getUser(jwt: string) { verified.push(jwt); return { data: { user }, error: null }; },
  };
}
async function moduleUnderTest() {
  const path = `${import.meta.dir}/../lib/privateWebBridge.ts`;
  expect(await Bun.file(path).exists(), "explicit test-only bridge client exists").toBe(true);
  return import(path);
}
test("activation uses exact configured POST contract and a newly verified bearer each time", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  const auth = authFixture();
  const requests: { url: string; init: RequestInit }[] = [];
  const client = createPrivateWebBridgeClient({ environment: "test", endpoints, auth, fetch: async (url: string, init: RequestInit) => {
    requests.push({ url, init }); return Response.json({ sessionId });
  } });
  expect(await client.activate(token, user.id)).toEqual({ sessionId });
  expect(await client.activate(token, user.id)).toEqual({ sessionId });
  expect(auth.verified).toEqual(["fresh-1", "fresh-2"]);
  expect(requests.map(r => r.url)).toEqual([endpoints.activate, endpoints.activate]);
  for (const [i, { init }] of requests.entries()) {
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ token }));
    expect(init.headers).toEqual({ "Content-Type": "application/json", Authorization: `Bearer ${"fresh-" + (i + 1)}` });
    expect(init.redirect).toBe("error");
    expect(init.cache).toBe("no-store");
    expect(init.credentials).toBe("omit");
  }
});

test("fails closed before network for invalid configuration, literal inputs and unverified accounts", async () => {
  const { createPrivateWebBridgeClient } = await moduleUnderTest();
  let requests = 0;
  const base = { environment: "test", endpoints, auth: authFixture(), fetch: async () => { requests++; return Response.json({ sessionId }); } };
  for (const overrides of [
    { environment: "production" }, { endpoints: undefined },
    { endpoints: { ...endpoints, activate: "https://production.example/activate" } },
    { endpoints: { ...endpoints, restore: endpoints.restore + "?secret=x" } },
    { endpoints: { ...endpoints, restore: "http://user:pass@localhost/restore" } },
  ]) expect(() => createPrivateWebBridgeClient({ ...base, ...overrides })).toThrow("Bridge configuration unavailable");
  const client = createPrivateWebBridgeClient(base);
  for (const value of [token.toUpperCase(), ` ${token}`, "invalid"]) await expect(client.activate(value, user.id)).rejects.toThrow("Private web bridge unavailable");
  for (const auth of [
    { ...authFixture(), getSession: async () => ({ data: { session: null }, error: null }) },
    { ...authFixture(), getSession: async () => ({ data: { session: { access_token: "x", user } }, error: new Error(token) }) },
    ...[null, { ...user, id: "other" }, { ...user, is_anonymous: true }, { ...user, email_confirmed_at: undefined }].map(verified => ({ ...authFixture(), getUser: async () => ({ data: { user: verified }, error: null }) })),
    { ...authFixture(), getUser: async () => ({ data: { user }, error: new Error(token) }) },
  ]) await expect(createPrivateWebBridgeClient({ ...base, auth }).activate(token, user.id)).rejects.toThrow("Private web bridge unavailable");
  expect(requests).toBe(0);
});
