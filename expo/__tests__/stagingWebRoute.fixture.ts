import { mock } from "bun:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createStagingWebBridge } from "../lib/stagingWebBridge";
const Host = ({ children }: any) => React.createElement("div", null, children);
mock.module("react-native", () => ({ View: Host, Text: Host, ScrollView: Host, TextInput: Host, AppState: {}, StyleSheet: { create: (x: any) => x } }));
mock.module("@/constants/theme", () => ({ C: {}, T: {}, GUTTER: 24 }));
mock.module("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
mock.module("@/components/ui", () => ({ PrimaryButton: ({ label }: any) => React.createElement(Host, null, label) }));
mock.module("expo-router", () => ({ useRouter: () => ({}) }));
let context: any = { stagingWebBridge: null, user: null };
mock.module("@/providers/auth", () => ({ useAuth: () => context }));
// This result-only fixture has no persisted native practice. The separately
// mounted buyerComponents suite exercises the real owner-scoped StoreProvider.
mock.module("@/providers/store", () => ({ useStore: () => ({ convertedLessonProgress: [], moduleCloseProgress: [], hydrated: true }) }));
(globalThis as any).__DEV__ = true;
const { default: Screen } = await import("../app/staging-web-result");
const render = () => renderToStaticMarkup(React.createElement(Screen));
assert.ok(render().includes("no reviewed account endpoints"));
// SYNTHETIC record with no private content; real controller, mocked Auth/HTTP.
const user = { id: "synthetic-owner", is_anonymous: false, email_confirmed_at: "2026-09-06" };
let session: any = { access_token: "synthetic", user };
let listener: any;
const bridge = createStagingWebBridge({ developmentBuild: true, authUrl: "http://localhost:54321", reviewed: { authUrl: "http://localhost:54321", environment: "development", endpoints: { activate: "http://localhost/a", restore: "http://localhost/r" } }, auth: {
  getSession: async () => ({ data: { session }, error: null }), getUser: async () => ({ data: { user: session?.user }, error: null }),
  onAuthStateChange: cb => { listener = cb; return { data: { subscription: { unsubscribe() {} } } }; },
}, fetch: async () => Response.json({ sessionId: "12345678-1234-4234-8234-123456789abc", privateResult: null, livemode: false, source: "stripe", access: true, status: "active", expiresAt: "2099-01-01T00:00:00Z", reconciliationRequired: false, cancelAtPeriodEnd: false }) });
assert.ok(bridge);
listener("SIGNED_IN", session);
context = { stagingWebBridge: bridge, user };
assert.ok(!render().includes("restore an already-owned session ID"));
assert.ok(render().includes("Automatic discovery is not deployed for this build"));
assert.equal(await bridge.restore("12345678-1234-4234-8234-123456789abc"), true);
assert.ok(render().includes("Verified staging web subscription"));
session = { ...session, user: { ...user, id: "other" } }; listener("SIGNED_IN", session); context.user = session.user;
assert.ok(!render().includes("Verified staging web subscription"));
session = null; listener("SIGNED_OUT", null); context.user = null;
assert.ok(render().includes("Log in to the verified account"));
(globalThis as any).__DEV__ = false;
assert.ok(render().includes("no reviewed account endpoints"));
bridge.dispose();
console.log("Synthetic route rendering and controller cleanup verified");
