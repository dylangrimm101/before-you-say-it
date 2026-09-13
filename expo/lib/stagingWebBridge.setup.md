# Native staging web-result route and purchase UI

> **Current status:** owner discovery migration 005 and account function version 5 are now verified on isolated staging; the exact native discovery URL is enabled only behind the existing isolated development gates. See [OWNER-DISCOVERY-HOSTED.md](../../docs/OWNER-DISCOVERY-HOSTED.md). Migration 006 and physical-device/TestFlight acceptance remain unenabled/unverified. The historical evidence below is retained.

> Current discovery implementation: `../../docs/OWNER-RESULT-DISCOVERY-LOCAL.md`. Automatic owner discovery→restore is locally integrated and tested, but its hosted/native capability gates remain disabled pending deployment review. Manual session-ID entry has been removed from the route. The notes below describe the historical earlier implementation.

> Historical local-route notes below. The reviewed hosted configuration is now applied behind an explicit isolated native development build. Current commands, auth/storage isolation, executed HTTP proof and device blockers: `../../docs/NATIVE-STAGING-ACCOUNT-BUILD.md`. Normal development and release builds remain disabled.

## Connected locally

`AuthProvider` creates and disposes `createStagingWebBridge` with the **same `supabase.auth` instance** used by native login. Synchronous Auth events clear prior-account result state, abort pending operations and reject stale responses through the existing coordinator. Initial-session restoration is revision guarded. The route is registered in Expo Router and exempt from native onboarding/debrief redirects because it owns its build/auth gate.

Development login → `staging-web-result` provides explicit activation-token or owned-session-ID entry. Credentials/results never enter navigation params, AsyncStorage, store practice records or history. Activation immediately chains to owner-scoped restore. The actual `PrivateWebResultPresentation` displays the restored record without transcript fabrication, numeric averaging or null replacement. Backgrounding the result screen clears its state and inputs. Account changes remount controls and synchronously clear the controller. A one-use token timeout is described as uncertain, never automatically replayed.

The paywall wrapper does not mount the original Apple/RevenueCat offer for a currently verified staging web buyer. Verification requires authenticated session/user equality, the reviewed environment, owner-scoped response, `livemode:false`, `source:stripe`, `access:true`, active/trialing status, future expiry, boolean cancellation state and `reconciliationRequired:false`. Ephemeral WeakMap provenance cannot be recreated by passing/deserializing arbitrary JSON. Verification lasts at most 60 seconds or until expiry, whichever comes first. Known stale/pending/failed web restoration shows a check-first message, **not Pro and not a second Apple offer**. With no staged web attempt, the existing Apple path remains intact.

**No changes to `useIsPro`, RevenueCat customer state, native access gates, paid API authorization or practice history.** This is result restoration and purchase-prompt safety, not authorization to run paid native practice.

## Disabled default and exact missing contracts

`REVIEWED_STAGING_BRIDGE` in `lib/stagingWebBridge.ts` is **null**. `__DEV__` is additionally required. No environment variables, config switches or deployments were changed. Production cannot enable this route's functionality; direct navigation renders unavailable. Release/TestFlight builds remain disabled even if someone fills the reviewed development configuration.

Before configuring a development build, supply explicitly reviewed **mounted** activate/restore HTTPS URLs on the existing staging project origin `https://pqqxaklcburdxjfeolmd.supabase.co`, with native Auth configured to that exact URL. No URL paths are inferred. Local fixtures may instead use loopback endpoints and loopback Auth. Other hosts/projects fail closed.

The existing backend `createTestBridgeHttp` is a loopback-only handler composition, not a hosted deployment. Its transport contract is the required basis for separately reviewed hosted account endpoints:

- POST exact configured activation URL, JSON `{token}` (64 lowercase hex), `Authorization: Bearer <current user JWT>`; HTTP 200 with **only** `{sessionId}` (UUID).
- POST exact configured owner-restoration URL, JSON `{sessionId}`, same current-user bearer; HTTP 200 with matching `sessionId`, `livemode:false`, canonical `privateResult` or null and server-derived billing fields listed above (`expiresAt` as timestamp).
- Server independently calls project-pinned Auth `getUser(jwt)`, requires confirmed non-anonymous identity, and uses the **same user JWT** for authenticated/RLS account RPCs. No client owner identifier or claimed access may authorize restoration. Wrong owner, missing/expired activation, revoked entitlement and reconciliation must fail closed. Do not mount the test harness by weakening its loopback checks.
- JSON/no-store responses, no redirect, appropriate native transport/CORS handling, private payload/credential log redaction and bounded operations are required. A non-200 response or malformed result yields static unavailable copy.

An account-level discovery endpoint is **still missing**: current restoration requires a known owned session ID. Fresh-install/restart automatic discovery cannot be claimed. A future owner-list/current-result contract must be designed and reviewed server-side before adding persistence or guessed paths. Activation email delivery/deep links/account creation and paid native web-entitlement server authorization are also not implemented by this slice.

## Evidence boundaries

Strict observed RED→GREEN covers receipt provenance, controller auth-switch/logout/stale-response behavior, routing source connections, exact project configuration, purchase presentation and actual route rendering with synthetic React Native hosts. The isolated route fixture uses a synthetic no-private-result response; it does not load the private genuine generated acceptance payload. Existing private-result suites cover canonical content/null preservation separately.

No customer API calls, private restored-payload reads, live login, device run, deployment or commits. Real iPhone navigation/input, activation/restore HTTPS requests to mounted staging endpoints, email delivery, restart discovery and TestFlight acceptance remain unproven.
