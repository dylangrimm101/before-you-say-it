import { expect, test } from "bun:test";
import { createTestBridgeHttp } from "../../backend/bridge/httpTransport";
import type { Database } from "../../backend/bridge/domain";
import { createAuthBoundPrivateWebBridge } from "../lib/privateWebBridgeCoordinator";
import { privateResultFixture } from "./privateWebResult.test";

// In-process transport contract proof. Auth/DB fixtures are NOT Supabase/RLS acceptance.
test("native composition roundtrips through actual backend Request handlers, not invented response paths", async () => {
  const sessionId = "12345678-1234-4234-8234-123456789abc";
  const user = { id: "owner", is_anonymous: false, email_confirmed_at: "2026-09-06" };
  const privateResult = privateResultFixture();
  const observed: string[] = [];
  const auth = {
    async getSession() { return { data: { session: { access_token: "fixture-owner", user } }, error: null }; },
    async getUser(jwt: string) { observed.push(jwt); return { data: { user }, error: null }; },
    onAuthStateChange() { return { data: { subscription: { unsubscribe() {} } } }; },
  };
  const queries: string[] = [];
  const db: Database = { async query<T>(sql: string) {
    queries.push(sql);
    return { rows: [sql.includes("bysi_activate") ? { id: sessionId } : { value: {
      sessionId, privateResult, resultSummary: null, source: "stripe", status: "canceled", expiresAt: null,
      cancelAtPeriodEnd: false, livemode: false, access: false, reconciliationRequired: false,
    } }] as T[] };
  } };
  const handlers = createTestBridgeHttp({ environment: "test", serverOrigin: "http://localhost:8123", allowedOrigins: [], auth,
    databaseForVerifiedJwt: async () => db, serviceDb: db,
    stripeProvider: { async verifyAndResolve() { throw new Error("unused test capability"); } },
  });
  // Explicit test-only dispatch; backend exposes no registered paths.
  const endpoints = { activate: "http://localhost:8123/test-activation", restore: "http://localhost:8123/test-restoration" };
  const bridge = createAuthBoundPrivateWebBridge({ environment: "test", endpoints, auth,
    fetch: async (url, init) => {
      const handler = url === endpoints.activate ? handlers.activate : url === endpoints.restore ? handlers.restore : null;
      if (!handler) throw new Error("Unconfigured test endpoint");
      return handler(new Request(url, init));
    },
  });
  await new Promise(r => setTimeout(r, 0));
  expect(await bridge.activate("a".repeat(64))).toBe(true);
  expect(bridge.getSnapshot()).toEqual({ status: "ready", record: { sessionId, privateResult } });
  expect(observed).toEqual(Array(4).fill("fixture-owner")); // fresh verification on native AND server per operation
  expect(queries).toHaveLength(2);
  bridge.dispose();
  expect(bridge.getSnapshot().record).toBeNull();
});
