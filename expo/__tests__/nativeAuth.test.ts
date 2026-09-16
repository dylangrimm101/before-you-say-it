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
  const account = { ...session, user: { id: "account-a", is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00.000Z" } } as Session;
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
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected setup failure");
    const codes: Record<string, string> = { restore: "session-read/rejected", disabled: "guest-signin/rejected", empty: "guest-signin/empty-session", network: "guest-signin/exception" };
    expect(result.message).toContain(`Setup code: ${codes[failure]}.`);
    expect(result.message).not.toContain("secret detail");
    expect(auth.signups).toBe(0);
  }
});

test("setup diagnostics distinguish missing configuration and allowlisted server rejection without leaking details", async () => {
  const missing = await nativeAuth.createNativeSessionStarter(null)();
  expect(missing.success).toBe(false);
  if (!missing.success) expect(missing.message).toContain("configuration/unavailable");
  for (const code of ["anonymous_provider_disabled", "over_request_rate_limit", "private-token-canary"]) {
    const auth: nativeAuth.NativeAuthClient = {
      getSession: async () => ({ data: { session: null }, error: null }),
      signInAnonymously: async () => ({ data: { session: null }, error: { code, message: "private-message-canary" } }),
    };
    const result = await nativeAuth.createNativeSessionStarter(auth)();
    expect(result.success).toBe(false);
    if (result.success) throw new Error("Expected setup failure");
    expect(result.message).toContain(`guest-signin/${code === "private-token-canary" ? "rejected" : code}`);
    expect(result.message).not.toContain("private-token-canary");
    expect(result.message).not.toContain("private-message-canary");
  }
});

test("setup reports storage-read exceptions without starting a replacement identity", async () => {
  const auth = authStub();
  auth.getSession = async () => { throw new Error("private-keychain-detail"); };
  const result = await nativeAuth.createNativeSessionStarter(auth)();
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.message).toContain("session-read/exception");
    expect(result.message).not.toContain("private-keychain-detail");
  }
  expect(auth.signups).toBe(0);
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
  expect(entry).not.toContain("beginNativeJourney");
  expect(entry.indexOf("if (!result.success)")).toBeLessThan(entry.indexOf('router.replace("/onboarding")'));
  expect(entry).toContain('accessibilityRole="alert"');
  expect(entry).toContain("disabled={isAuthLoading || isStarting}");
  const provider = await Bun.file(`${import.meta.dir}/../providers/auth.tsx`).text();
  expect(provider).toContain("createNativeSessionStarter");
  const startNativeSession = provider.slice(provider.indexOf("const startNativeSession"));
  expect(startNativeSession.indexOf("applySession(result.session)")).toBeLessThan(startNativeSession.indexOf("NATIVE_JOURNEY_STARTED_KEY"));
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
