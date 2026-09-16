import { describe, expect, test } from "bun:test";

import { createNormalResults } from "../lib/normalResults";
import { isValidNormalResultSessionId } from "../lib/normalResultClaimRetry";

const sessionId = "11111111-1111-4111-8111-111111111111";

function fixture() {
  const calls: { url: string; authorization: string | null; body: any }[] = [];
  const auth = {
    getSession: async () => ({ data: { session: { access_token: "signed-token", user: { id: "22222222-2222-4222-8222-222222222222" } } }, error: null }),
    getUser: async (jwt: string) => ({ data: { user: { id: jwt === "signed-token" ? "22222222-2222-4222-8222-222222222222" : "", is_anonymous: false, email_confirmed_at: "2026-09-15T00:00:00.000Z" } }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  };
  const service = createNormalResults({
    enabled: true,
    authUrl: "https://spvksnddzyvycfoefrcf.supabase.co",
    origin: "https://beforeyousayit.app",
    auth,
    fetch: async (url, init) => {
      calls.push({
        url: String(url),
        authorization: new Headers(init?.headers).get("authorization"),
        body: JSON.parse(String(init?.body)),
      });
      return String(url).endsWith("/discover")
        ? Response.json({ items: [
          { sessionId, source: "normal-native-free", capturedAt: "2026-09-15T00:00:00.000Z", expiresAt: null },
          { sessionId: "33333333-3333-4333-8333-333333333333", source: "normal-native-free", capturedAt: "2026-09-14T00:00:00.000Z", expiresAt: null },
        ], nextCursor: null })
        : String(url).endsWith("/claim")
        ? Response.json({ ok: true, sessionId })
        : Response.json({ ok: true, deleted: 1 });
    },
  });
  if (!service) throw new Error("missing service");
  return { service, calls };
}

describe("normal result return controls", () => {
  test("normal result session ids accept valid server UUIDs and reject malformed variants", () => {
    expect(isValidNormalResultSessionId(sessionId)).toBe(true);
    expect(isValidNormalResultSessionId("11111111-1111-4111-811111111111")).toBe(false);
    expect(isValidNormalResultSessionId("11111111-1111-4111-7111-111111111111")).toBe(false);
    expect(isValidNormalResultSessionId("11111111-1111-2111-8111-111111111111")).toBe(false);
    expect(isValidNormalResultSessionId("11111111-1111-4111-8111-11111111111z")).toBe(false);
  });

  test("delete and claim use signed owner transport without client owner ids", async () => {
    const { service, calls } = fixture();

    await expect(service.delete(sessionId)).resolves.toEqual({ deleted: 1 });
    await expect(service.deleteAll()).resolves.toEqual({ deleted: 1 });
    await expect(service.claimGuest(sessionId, "guest-source-token")).resolves.toBe(sessionId);
    await expect(service.history()).resolves.toHaveLength(2);

    expect(calls.map(call => call.url)).toEqual([
      "https://beforeyousayit.app/api/native/results/delete",
      "https://beforeyousayit.app/api/native/results/delete",
      "https://beforeyousayit.app/api/native/results/claim",
      "https://beforeyousayit.app/api/native/results/discover",
    ]);
    expect(calls.every(call => call.authorization === "Bearer signed-token")).toBe(true);
    expect(calls.map(call => call.body)).toEqual([
      { sessionId },
      { all: true },
      { sessionId, sourceAuthorization: "Bearer guest-source-token" },
      { limit: 20, cursor: null },
    ]);
  });

  test("latest accepts limit-one pagination metadata and does not traverse history", async () => {
    const { calls } = fixture();
    calls.length = 0;
    const resultRecord = {
      schema_version: 1,
      kind: "bysi_private_web_result",
      result: {
        mode: "result",
        outputVersion: "bysi-free-rehearsal-result-v1-2026-08-12",
        pressure_moment: { headline: "Saved", conclusion: "Again", how_bysi_read_this: { observed: "Specific ask", why_it_matters: "It can be answered.", confidence: "One rehearsal." } },
        practice_shift: { headline: "Practice", current_pattern: ["Ask", "Pushback", "Ask again"], practice_target: ["Ask", "Pause", "Name task"], goal_line: "Name one task.", honesty_note: "Practice target only." },
        starting_index: { overall: 61.25, label: "Partial index", coverage_note: "Two dimensions observed.", score_note: "Only observed signals are scored.", focus_dimension: "Specificity", observed_dimensions: [{ name: "Specificity", score: 49.25, evidence: "The task was not named." }, { name: "Steadiness", score: 61.75, evidence: "The user repeated the request." }], unobserved_dimensions: ["Clarity", "Listening", "Boundaries", "Repair"] },
        recommended_path: { first_module: "Make a Clear Ask", reason: "Practice naming the task.", next_modules: ["Listen and Respond"] },
      },
      provenance: {
        generation_id: "g",
        rehearsal_id: "r",
        provider_request_id: "p",
        model: "synthetic",
        generated_at: "2026-09-15T00:00:00.000Z",
        producer_version: "v",
        source: "server_generation",
      },
    };
    const serviceWithCursor = createNormalResults({
      enabled: true,
      authUrl: "https://spvksnddzyvycfoefrcf.supabase.co",
      origin: "https://beforeyousayit.app",
      auth: {
        getSession: async () => ({ data: { session: { access_token: "signed-token", user: { id: "22222222-2222-4222-8222-222222222222" } } }, error: null }),
        getUser: async () => ({ data: { user: { id: "22222222-2222-4222-8222-222222222222", is_anonymous: false, email_confirmed_at: "2026-09-15T00:00:00.000Z" } }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
      fetch: async (url, init) => {
        calls.push({ url: String(url), authorization: new Headers(init?.headers).get("authorization"), body: JSON.parse(String(init?.body)) });
        return String(url).endsWith("/discover")
          ? Response.json({ items: [{ sessionId, source: "normal-native-free", capturedAt: "2026-09-15T00:00:00.000Z", expiresAt: null }], nextCursor: "older-page" })
          : Response.json({ sessionId, source: "normal-native-free", capturedAt: "2026-09-15T00:00:00.000Z", expiresAt: null, privateResult: resultRecord });
      },
    });
    if (!serviceWithCursor) throw new Error("missing service");

    const latest = await serviceWithCursor.latest();
    expect(latest?.sessionId).toBe(sessionId);
    expect(calls.map(call => call.body)).toEqual([{ limit: 1, cursor: null }, { sessionId }]);
  });
});
