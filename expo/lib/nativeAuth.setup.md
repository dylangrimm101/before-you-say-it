# Native anonymous auth rollout — BLOCKED by default

`NATIVE_ANONYMOUS_AUTH_ENABLED` in `nativeAuth.ts` remains **false**. This is an explicit reviewed-build rollout gate, not an authentication or server authorization mechanism. Do not flip it merely to make onboarding work.

## Implemented behavior

- Entry waits for auth restoration, checks visible account-owned active practice, then obtains a real persisted Supabase session before writing the local journey flag or navigating.
- Existing sessions are reused; failed restoration does not create a replacement user. Concurrent taps share one signup. Missing config, disabled signup, missing session, and network errors fail visibly without secrets or a local-only fallback.
- When rollout is approved, the helper uses `supabase.auth.signInAnonymously()` through the existing securely persisted client. No email/password is required for free practice.
- Real-account A → B password login is blocked before calling Supabase while storage remains device-global. Same-account login and genuine Supabase-anonymous → real login are allowed. No data is automatically erased.
- `session` includes guest auth for protected requests; `user` remains registered-account-only for existing routing/settings consumers.
- A Supabase anonymous ID is **not** passed to RevenueCat `logIn`. Keep the SDK's existing anonymous purchase identity; explicit real-account login associates that identity using the existing RevenueCat mechanism. Paid access comes only from actual CustomerInfo entitlements.
- Identity transitions immediately cancel/remove customer-info cache. Serialized RevenueCat transitions and generation guards prevent late A results from publishing after B; failed identification blocks subsequent reads/purchases/restores from using A's SDK identity.

## Required external setup and acceptance before enabling

1. Project owner must explicitly approve/configure Supabase anonymous sign-ins in the intended project. Nothing in this change modifies remote Supabase settings. Verify the installed public URL/key point at that project. Remote settings were not queried; their current state is unknown.
2. Establish guest signup abuse controls, including verified rate limits and bot protection. If Supabase CAPTCHA is enabled/required, this client currently has **no native CAPTCHA-token flow**: implement and test it rather than disabling protection or bypassing authentication. Include guest cleanup/lifecycle policy.
3. Verify a deployed transcription endpoint with JWT verification still enabled, `/auth/v1/user` verification, and configured `TRANSCRIBE_RATE_LIMIT_URL` / `TRANSCRIBE_RATE_LIMIT_SECRET`. The limiter is an external service: its implementation, durable quota policy, and deployment are not present in the inspected backend.
4. Prove durable **global/provider spend limits and guest-churn-resistant quotas**, not only per-user limits. The existing local limiter allows 3 requests/user/minute per process. The distributed request sends `{subject: userId, action: "transcribe"}` only. New anonymous IDs defeat a per-user-only allowance; no trusted device/IP/CAPTCHA evidence or global budget is demonstrated by that contract. Missing/broken distributed limiter already returns 503; keep it fail-closed. All backend guards are unchanged.
5. Test RevenueCat sandbox: guest purchase → real-account login, failed identification, retry, restore, restart, and account reset. RevenueCat alias/transfer policy and any Stripe-to-RevenueCat web entitlement bridge are external configuration, not verified here. No free entitlement grants were added.
6. Resolve device-global account data before general account switching. This patch blocks known real-account switching and protects entry's active-practice owner. It does **not** introduce account-wide storage namespaces or establish the owner of every legacy record after lost/expired auth. Do not claim full multi-account isolation. Existing genuinely anonymous → real association remains subject to the store's ownership guard.
7. Only after the above are evidenced, approve changing the source rollout gate and rebuilding. Run fresh-install device acceptance: entry → real anonymous session persisted across restart → protected transcription succeeds; unavailable auth/limiter stays visibly blocked. No live transcription, purchase, remote enablement, deployment, or commit was performed in this task.

## Local regression commands

From `expo/`:

```sh
bun test __tests__/nativeAuth.test.ts __tests__/purchasesIdentity.test.ts
bunx tsc --noEmit
```

Behavioral tests use explicit SDK/auth seam fixtures and execute the real helpers; source-contract tests ensure entry/provider/purchase hooks are wired to them. They are not evidence of native-device or deployed-backend acceptance.
