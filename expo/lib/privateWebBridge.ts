import { restorePrivateWebResult, type PrivateWebResult } from "./privateWebResult";

/** Explicit local test composition only. No mounted service or paid-access authority. */
export interface BridgeAuth {
  getSession(): Promise<{ data: { session: { access_token: string; user: { id: string } } | null }; error: unknown }>;
  getUser(jwt: string): Promise<{ data: { user: { id: string; is_anonymous?: boolean; email_confirmed_at?: string } | null }; error: unknown }>;
}
export interface PrivateWebBridgeConfig {
  environment: "test" | "development" | "staging";
  endpoints: { activate: string; restore: string; discover?: string };
  auth: BridgeAuth;
  timeoutMs?: number;
  fetch: (url: string, init: RequestInit) => Promise<Response>;
}
export interface RestoredWebRecord { sessionId: string; privateResult: PrivateWebResult | null }
// Ephemeral provenance, never serializable, persisted, or a paid API credential.
const verifiedBuyers = new WeakMap<object, { owner: string; expires: number; checked: number }>();
export function isVerifiedStagingWebBuyer(record: unknown, owner: string | null, staging: boolean, now = Date.now()): boolean {
  if (!staging || !owner || !record || typeof record !== "object") return false;
  const receipt = verifiedBuyers.get(record);
  return !!receipt && receipt.owner === owner && now >= receipt.checked && now < Math.min(receipt.expires, receipt.checked + 60000);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const unavailable = () => new Error("Private web bridge unavailable");
export function createPrivateWebBridgeClient(input: PrivateWebBridgeConfig) {
  const config = { ...input, endpoints: { ...input.endpoints } };
  const timeoutMs = config.timeoutMs ?? 10000;
  try {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || timeoutMs > 30000) throw new Error();
    if (!["test", "development", "staging"].includes(config.environment)) throw new Error();
    for (const endpoint of [config.endpoints.activate, config.endpoints.restore, ...(config.endpoints.discover ? [config.endpoints.discover] : [])]) {
      const url = new URL(endpoint);
      const allowed = config.environment === "staging"
        ? url.origin === "https://pqqxaklcburdxjfeolmd.supabase.co"
        : ["http:", "https:"].includes(url.protocol) && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
      if (!allowed || url.search || url.hash || url.username || url.password) throw new Error();
    }
  } catch { throw new Error("Bridge configuration unavailable"); }
  async function request(operation: "activate" | "restore" | "discover", value: string, accountId: string, signal?: AbortSignal) {
    const control = new AbortController();
    const abort = () => control.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, timeoutMs);
    async function bounded<T>(operation: () => Promise<T>): Promise<T> {
      if (control.signal.aborted) throw unavailable();
      let cancel = () => {};
      try {
        return await Promise.race([
          operation(),
          new Promise<never>((_, reject) => {
            cancel = () => reject(unavailable());
            control.signal.addEventListener("abort", cancel, { once: true });
            if (control.signal.aborted) cancel();
          }),
        ]);
      } finally { control.signal.removeEventListener("abort", cancel); }
    }
    try {
      if (!accountId || !config.endpoints[operation] || (operation !== "discover" && (typeof value !== "string" || !(operation === "activate" ? /^[a-f0-9]{64}$/ : UUID).test(value)))) throw unavailable();
      const { data, error } = await bounded(() => config.auth.getSession());
      if (error || !data.session || data.session.user.id !== accountId) throw unavailable();
      const jwt = data.session.access_token;
      if (!/^[A-Za-z0-9._~-]{1,8192}$/.test(jwt)) throw unavailable();
      const verified = await bounded(() => config.auth.getUser(jwt));
      if (verified.error || verified.data.user?.id !== accountId || verified.data.user.is_anonymous !== false || !verified.data.user.email_confirmed_at) throw unavailable();
      const response = await bounded(() => config.fetch(config.endpoints[operation]!,  {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
        body: JSON.stringify(operation === "discover" ? { limit: 1, cursor: null } : { [operation === "activate" ? "token" : "sessionId"]: value }),
        redirect: "error", cache: "no-store", credentials: "omit", signal: control.signal,
      }));
      if (response.status !== 200 || response.redirected) throw unavailable();
      const body = await bounded(() => response.json());
      if (operation === "discover") {
        if (!body || Object.keys(body).sort().join() !== "items,nextCursor" || !Array.isArray(body.items) || body.items.length > 1) throw unavailable();
        for (const item of body.items) {
          if (!item || Object.keys(item).sort().join() !== "capturedAt,expiresAt,sessionId" || !UUID.test(item.sessionId)
            || typeof item.capturedAt !== "string" || !Number.isFinite(Date.parse(item.capturedAt))
            || typeof item.expiresAt !== "string" || Date.parse(item.expiresAt) <= Date.now() || !Number.isFinite(Date.parse(item.expiresAt))) throw unavailable();
        }
        if (body.nextCursor !== null && (!body.items.length || !body.nextCursor || Object.keys(body.nextCursor).sort().join() !== "capturedAt,sessionId"
          || body.nextCursor.sessionId !== body.items[0].sessionId || body.nextCursor.capturedAt !== body.items[0].capturedAt)) throw unavailable();
        return body.items.length ? { sessionId: body.items[0].sessionId } : null;
      }
      if (!body || typeof body.sessionId !== "string" || !UUID.test(body.sessionId)) throw unavailable();
      if (operation === "activate") {
        if (Object.keys(body).length !== 1) throw unavailable();
        return { sessionId: body.sessionId };
      }
      if (body.sessionId !== value || body.livemode !== false) throw unavailable();
      // Billing and summary fields deliberately never enter native access/practice state.
      const record = { sessionId: body.sessionId, privateResult: body.privateResult === null ? null : restorePrivateWebResult(body.privateResult) };
      const expires = typeof body.expiresAt === "string" ? Date.parse(body.expiresAt) : NaN;
      if (body.access === true && body.source === "stripe" && ["active", "trialing"].includes(body.status)
        && body.reconciliationRequired === false && typeof body.cancelAtPeriodEnd === "boolean" && expires > Date.now()) {
        verifiedBuyers.set(record, { owner: accountId, expires, checked: Date.now() });
      }
      return record;
    } catch { throw unavailable(); }
    finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
  }
  return {
    discoveryEnabled: !!config.endpoints.discover,
    discover: (accountId: string, signal?: AbortSignal) => request("discover", "", accountId, signal) as Promise<{ sessionId: string } | null>,
    activate: (token: string, accountId: string, signal?: AbortSignal) => request("activate", token, accountId, signal) as Promise<{ sessionId: string }>,
    restore: (sessionId: string, accountId: string, signal?: AbortSignal) => request("restore", sessionId, accountId, signal) as Promise<RestoredWebRecord>,
  };
}
