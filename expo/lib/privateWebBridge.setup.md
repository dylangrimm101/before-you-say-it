# Native private web bridge — opt-in local test/dev seam

## What is actually wired

- `privateWebBridge.ts`: injected HTTP client with required **exact activate and restore endpoint URLs**, injected `fetch`, and the same project-pinned Supabase `auth` capability used by the native AuthProvider. There are no default paths, environment URL guesses, credentials, SDK instances, or service mounts. Construction accepts only `test`/`development` and loopback HTTP(S), matching the current backend test handler restriction. Endpoint strings are copied after configuration, not read from mutable caller configuration during requests.
- Exact existing `httpTransport.ts` account contract: POST JSON `{token}` → `{sessionId}`; POST JSON `{sessionId}` → server BridgeResult. Native projection keeps only `{sessionId, privateResult}`. Billing/summary fields are not entitlement authority or practice data. Null privateResult stays null; full results pass the existing `restorePrivateWebResult` allowlist/validator without generating or reconstructing scores or text.
- Before **each** HTTP request, `getSession()` obtains the current bearer, then `getUser(jwt)` verifies that same token, expected account ID, confirmed email and nonanonymous status. Server authentication/ownership checks are still mandatory. Session identity alone is not verification.
- Requests omit cookies, disable cache, reject redirects and never put credentials in URLs. Token/session identifier formats exactly match the backend; inputs are not trimmed or repaired. Errors are static. No analytics, logging, persistent storage or navigation writes are introduced.
- Total auth/fetch/body deadline defaults to 10 seconds (explicit 1–30000 ms allowed). Abort races settle even if the injected capability ignores cancellation; late auth cannot start another network stage. Underlying SDK/network cancellation is best effort.
- `privateWebBridgeCoordinator.ts`: observable in-memory external store (`subscribe`, `getSnapshot`) supporting activate-then-restore, restore, clear and dispose. It clears visible cached state immediately on account changes/logout, aborts pending work, and generation-guards late results including A→B→A and superseded activation. Only result-only state is published; no token is in snapshots. A caller must not retain/render an obsolete snapshot after invalidation.
- `createAuthBoundPrivateWebBridge(config)` is the testable integration entry point. It creates client/coordinator together and subscribes synchronously to `auth.onAuthStateChange`; startup session restoration cannot overwrite a newer auth event. Auth callbacks perform no awaited auth calls. Same-account token refresh preserves loaded state, while each new request still fetches/verifies a fresh bearer. Dispose unsubscribes and clears state.

## Deliberate integration boundary

This seam is **not instantiated in AuthProvider, continue-from-web, the app store, or any customer route**. The existing screen continues to say web subscription activation/result restore are unavailable. RevenueCat gating, local practice ownership guards, anonymous-auth rollout and production routing are unchanged.

A future explicitly configured local test host may create `createAuthBoundPrivateWebBridge` using the existing `supabase.auth`, exact URLs supplied by its actual handler mounts and platform fetch. Subscribe with `useSyncExternalStore`; only pass a ready non-null `record.privateResult` to the existing `PrivateWebResultPresentation`. Clear on test-screen teardown or dispose on host teardown. Never put token/result JSON into Expo Router params, React Query persisted caches, analytics, or local practice/history. Do not embed arbitrary sample endpoint paths into app configuration.

Activation timeout/cancellation **does not prove server rollback**. A one-use token may have been consumed before the connection failed. This seam does not retry activation, mint credentials, or invent recovery endpoints. Trusted service/email/account recovery is still required before customer rollout.

## Local verification

Behavioral RED→GREEN cycles covered missing client/coordinator, exact HTTP requests and fresh verification, configuration/input/auth rejection, private-result validation, sanitized errors, auth/transport deadline and cancellation, endpoint mutation, logout/account switch, supersession/dispose, and stale initial auth restoration.

Commands executed:

```sh
bun test __tests__/privateWebBridgeHttpContract.test.ts __tests__/privateWebBridge.test.ts __tests__/privateWebBridgeCoordinator.test.ts __tests__/privateWebResultRoundtrip.test.ts __tests__/webBridgeAvailability.test.ts
bun run test
bun run check
bun run lint
```

Results: **19 focused tests passing** (includes existing adapter/presentation/availability coverage); **1027 full native tests passing across 85 files**; check and lint exited 0. The new in-process contract test drives the real backend `Request → handler → domain → Response` and native client/coordinator with synthetic injected auth/DB capabilities. Its exact test dispatch paths exist only inside the test; they are not service endpoints. It is not TCP, cryptographic JWT, real Supabase/RLS, or device acceptance.

## Still required

Actual reviewed handler mounts, real project-pinned server auth/end-user DB composition and deployed migrations; trusted credential delivery/recovery; resource pinning and operational controls; non-loopback/physical-device transport security review; unified production billing authority; native real-device fresh auth/restart/account lifecycle/result rendering and one-use activation acceptance. Loopback from a phone points to the phone, not the development Mac. No real-device acceptance or production restoration claim is made here.

No backend files, previously dirty native files, remote settings, commits or deployments were changed by this slice.
