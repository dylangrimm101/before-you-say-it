import { expect, test } from "bun:test";
import * as nativeAuth from "../lib/nativeAuth";
import type { Session } from "@supabase/supabase-js";

const session = { access_token: "test-session", user: { id: "guest-id", is_anonymous: true } } as Session;
function authStub(existing: Session | null = null) {
  let signups = 0;
  return {
    get signups() { return signups; },
    getSession: async () => ({ data: { session: existing }, error: null }),
    signInAnonymously: async () => { signups++; return { data: { session }, error: null }; },
  };
}

test("Get started creates one anonymous session when none exists", async () => {
  const auth = authStub();
  const result = await nativeAuth.createNativeSessionStarter(auth)();
  expect(result.success).toBe(true);
  expect(auth.signups).toBe(1);
});

test("expired leftover sessions are replaced with a new guest before talking", async () => {
  const leftover = { access_token: "dead", user: { id: "old-guest", is_anonymous: true } } as Session;
  const auth = authStub(leftover) as typeof authStub extends Function ? any : any;
  auth.getUser = async () => ({ data: { user: null }, error: new Error("invalid jwt") });
  auth.signOut = async () => {};
  const result = await nativeAuth.createNativeSessionStarter(auth)();
  expect(result.success).toBe(true);
  expect(auth.signups).toBe(1);
});

test("existing authenticated sessions are reused without replacing account identity", async () => {
  const account = { ...session, user: { id: "account-a", is_anonymous: false } } as Session;
  const auth = authStub(account);
  expect(await nativeAuth.createNativeSessionStarter(auth)()).toEqual({ success: true, session: account });
  expect(auth.signups).toBe(0);
});

test("auth failures never become local-only success or replacement identities", async () => {
  for (const failure of ["restore", "disabled", "empty", "network"]) {
    const auth = authStub();
    if (failure === "restore") auth.getSession = async () => ({ data: { session: null }, error: new Error("storage") } as any);
    if (failure === "disabled") auth.signInAnonymously = async () => ({ data: { session: null }, error: new Error("Anonymous sign-ins are disabled") } as any);
    if (failure === "empty") auth.signInAnonymously = async () => ({ data: { session: null }, error: null } as any);
    if (failure === "network") auth.signInAnonymously = async () => { throw new Error("fetch failed with secret detail"); };
    const result = await nativeAuth.createNativeSessionStarter(auth, true)();
    expect(result).toEqual({ success: false, message: nativeAuth.NATIVE_AUTH_UNAVAILABLE });
    expect(auth.signups).toBe(0);
  }
});

test("concurrent continuation requests create only one anonymous identity", async () => {
  const auth = authStub();
  const start = nativeAuth.createNativeSessionStarter(auth, true);
  await Promise.all([start(), start()]);
  expect(auth.signups).toBe(1);
});

test("real account changes are blocked before authentication while genuine guest upgrades remain possible", () => {
  expect(typeof nativeAuth.accountLoginAllowed).toBe("function");
  expect(nativeAuth.accountLoginAllowed({ id: "a", email: "a@example.com", is_anonymous: false }, "b@example.com")).toBe(false);
  expect(nativeAuth.accountLoginAllowed({ id: "a", email: "a@example.com", is_anonymous: false }, "A@example.com")).toBe(true);
  expect(nativeAuth.accountLoginAllowed({ id: "a" }, "b@example.com")).toBe(false);
  expect(nativeAuth.accountLoginAllowed({ id: "guest", is_anonymous: true }, "b@example.com")).toBe(true);
  expect(nativeAuth.accountLoginAllowed(null, "b@example.com")).toBe(true);
});

test("entry gates journey persistence and navigation on authenticated success with visible failure", async () => {
  const entry = await Bun.file(`${import.meta.dir}/../app/entry.tsx`).text();
  expect(entry).toContain("await startNativeSession()");
  expect(entry.indexOf("if (!result.success)")).toBeLessThan(entry.indexOf("await beginNativeJourney()"));
  expect(entry).toContain('accessibilityRole="alert"');
  expect(entry).toContain("disabled={isAuthLoading || isStarting}");
  const provider = await Bun.file(`${import.meta.dir}/../providers/auth.tsx`).text();
  expect(provider).toContain("createNativeSessionStarter");
  expect(provider).toContain("accountLoginAllowed");
  expect(provider.indexOf("accountLoginAllowed(current")).toBeLessThan(provider.indexOf("signInWithPassword"));
  expect(provider).toContain("nextSession?.user.is_anonymous === true");
  expect(entry).toContain("activePracticeSession?.userId");
  expect(entry).toContain("activePracticeSession.userId !== session?.user.id");
  expect(provider).toContain("session?.user.is_anonymous === true ? null");
  expect(provider).toContain('queryClient.setQueryData(["rc", "customerInfo"], null)');
  expect(provider).toContain("queryClient.removeQueries");
  expect(provider).toContain("generation !== purchasesGeneration.current");
});

test("fresh native continuation establishes a real session before local journey starts", async () => {
  expect(typeof nativeAuth.createNativeSessionStarter).toBe("function");
  const auth = authStub();
  const start = nativeAuth.createNativeSessionStarter(auth, true);
  expect(await start()).toEqual({ success: true, session });
  expect(auth.signups).toBe(1);
});
