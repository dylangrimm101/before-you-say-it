import { expect, test } from "bun:test";
import { createPrivateWebBridgeClient } from "../lib/privateWebBridge";

// SYNTHETIC transport/auth only; no live account or result.
const sessionId = "12345678-1234-4234-8234-123456789abc";
const user = { id: "synthetic-owner", is_anonymous: false, email_confirmed_at: "2026-09-06" };
const body = { sessionId, privateResult: null, livemode: false, source: "stripe", status: "trialing", access: true, expiresAt: "2099-01-01T00:00:00Z", reconciliationRequired: false, cancelAtPeriodEnd: true };
const auth = { getSession: async () => ({ data: { session: { access_token: "synthetic", user } }, error: null }), getUser: async () => ({ data: { user }, error: null }) };
const config = { environment: "development" as const, endpoints: { activate: "http://localhost/a", restore: "http://localhost/r" }, auth, fetch: async () => Response.json(body) };

test("verified TEST owner restore can suppress staging repurchase without granting Pro", async () => {
  const module = await import("../lib/privateWebBridge");
  expect(typeof module.isVerifiedStagingWebBuyer).toBe("function");
  const restored = await createPrivateWebBridgeClient(config).restore(sessionId, user.id);
  expect(module.isVerifiedStagingWebBuyer(restored, user.id, true)).toBe(true);
  expect(module.isVerifiedStagingWebBuyer({ ...restored }, user.id, true)).toBe(false);
  expect(module.isVerifiedStagingWebBuyer(restored, "other", true)).toBe(false);
  expect(module.isVerifiedStagingWebBuyer(restored, user.id, false)).toBe(false);
  expect(restored).not.toHaveProperty("access");
});

test("staging controller is disabled by default and consumes the real auth lifecycle with cleanup", async () => {
  const path = `${import.meta.dir}/../lib/stagingWebBridge.ts`;
  expect(await Bun.file(path).exists()).toBe(true);
  const { createStagingWebBridge } = await import(path);
  expect(createStagingWebBridge({ developmentBuild: true, reviewed: null, auth: null })).toBeNull();
  expect(createStagingWebBridge({ developmentBuild: false, reviewed: {}, auth })).toBeNull();
  let listener: any;
  let current: any = { access_token: "synthetic", user };
  let pending: ((r: Response) => void) | undefined;
  const lifecycle = { ...auth, getSession: async () => ({ data: { session: current }, error: null }), getUser: async () => ({ data: { user: current?.user }, error: null }), onAuthStateChange: (cb: any) => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; } };
  const bridge = createStagingWebBridge({ developmentBuild: true, reviewed: { environment: "development", endpoints: config.endpoints, authUrl: "http://localhost:54321" }, authUrl: "http://localhost:54321", auth: lifecycle, fetch: async () => pending ? new Promise<Response>(r => { pending = r; }) : Response.json(body) });
  listener("SIGNED_IN", current);
  expect(await bridge.restore(sessionId)).toBe(true);
  expect(bridge.suppressPurchasePrompt()).toBe(true);
  current = { ...current, user: { ...user, id: "other" } }; listener("SIGNED_IN", current);
  expect(bridge.getSnapshot().record).toBeNull();
  expect(bridge.suppressPurchasePrompt()).toBe(false);
  pending = () => {};
  const old = bridge.restore(sessionId);
  await new Promise(r => setTimeout(r, 1));
  current = null; listener("SIGNED_OUT", null);
  expect(await old).toBe(false);
  pending!(Response.json(body));
  await Promise.resolve();
  expect(bridge.getSnapshot().record).toBeNull();
  expect(bridge.suppressPurchasePrompt()).toBe(false);
  bridge.dispose();
});

test("source wiring connects auth-owned controller and intercept web-buyer paywall without changing Apple gates", async () => {
  const source = async (p: string) => Bun.file(`${import.meta.dir}/../${p}`).text();
  expect(await source("providers/auth.tsx")).toContain("createStagingWebBridge");
  expect(await source("providers/auth.tsx")).toContain("supabase?.auth");
  expect(await source("app/_layout.tsx")).toContain('firstSegment === "staging-web-result"');
  expect(await source("app/continue-from-web.tsx")).toContain('router.push("/staging-web-result")');
  expect(await source("app/continue-from-web.tsx")).toContain('stagingWebBridge ? "Use your staging web account');
  expect(await source("app/staging-web-result.tsx")).toContain("PrivateWebResultPresentation");
  expect(await source("app/staging-web-result.tsx")).not.toContain("useLocalSearchParams");
  expect(await source("app/paywall.tsx")).toContain("suppressPurchasePrompt()");
  expect(await source("app/paywall.tsx")).toContain("return <ApplePaywall");
  expect(await source("lib/purchases.ts")).not.toContain("stagingWebBridge");
  expect(await source("lib/access.ts")).not.toContain("stagingWebBridge");
});

test("absent malformed expired and wrong-environment billing cannot suppress a prompt", async () => {
  const { isVerifiedStagingWebBuyer } = await import("../lib/privateWebBridge");
  for (const change of [{ access: undefined }, { access: "true" }, { source: "apple" }, { status: "past_due" }, { expiresAt: "bad" }, { expiresAt: "2000-01-01T00:00:00Z" }, { reconciliationRequired: true }, { cancelAtPeriodEnd: null }]) {
    const record = await createPrivateWebBridgeClient({ ...config, fetch: async () => Response.json({ ...body, ...change }) }).restore(sessionId, user.id);
    expect(isVerifiedStagingWebBuyer(record, user.id, true)).toBe(false);
  }
  await expect(createPrivateWebBridgeClient({ ...config, fetch: async () => Response.json({ ...body, livemode: true }) }).restore(sessionId, user.id)).rejects.toThrow();
  const record = await createPrivateWebBridgeClient(config).restore(sessionId, user.id);
  expect(isVerifiedStagingWebBuyer(record, user.id, true, Date.now() + 61000)).toBe(false);
});

test("reviewed staging is pinned to the exact Auth project and HTTPS account endpoints", async () => {
  const { createStagingWebBridge } = await import("../lib/stagingWebBridge");
  const lifecycle = { ...auth, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) };
  const authUrl = "https://pqqxaklcburdxjfeolmd.supabase.co";
  // Synthetic paths, deliberately NOT deployment configuration.
  const reviewed = { environment: "staging" as const, authUrl, endpoints: { activate: `${authUrl}/synthetic-activate`, restore: `${authUrl}/synthetic-restore` } };
  const instance = createStagingWebBridge({ developmentBuild: true, reviewed, authUrl, auth: lifecycle, fetch: config.fetch });
  expect(instance).not.toBeNull();
  instance?.dispose();
  for (const change of [
    { authUrl: "https://production.supabase.co" },
    { reviewed: { ...reviewed, endpoints: { ...reviewed.endpoints, restore: "https://evil.invalid/r" } } },
    { reviewed: { ...reviewed, authUrl: "https://production.supabase.co" }, authUrl: "https://production.supabase.co" },
    { reviewed: { environment: "development", authUrl, endpoints: config.endpoints } },
  ]) expect(createStagingWebBridge({ developmentBuild: true, reviewed, authUrl, auth: lifecycle, ...change } as any)).toBeNull();
});

test("expired known web restoration requests reverification, never falls through into a second Apple offer", async () => {
  const module = await import("../lib/stagingWebBridge");
  expect(typeof module.stagingPurchasePresentation).toBe("function");
  expect(module.stagingPurchasePresentation({ status: "ready", record: { sessionId, privateResult: null } }, false)).toBe("verify-web");
  expect(module.stagingPurchasePresentation({ status: "loading", record: null }, false)).toBe("verify-web");
  expect(module.stagingPurchasePresentation({ status: "ready", record: { sessionId, privateResult: null } }, true)).toBe("verified-web");
  expect(module.stagingPurchasePresentation({ status: "idle", record: null }, false)).toBe("apple");
});
