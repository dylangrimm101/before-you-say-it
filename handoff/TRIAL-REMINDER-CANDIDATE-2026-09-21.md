# Trial screens and local reminder — candidate evidence

## Scope and identity

- Request: restore the seven-day trial presentation before payment and implement the two-day reminder.
- Trial claims require the actual Apple product `byis_pro_monthly_5`, a free P1W/P7D introductory period, one cycle, and RevenueCat eligible status. Unknown/ineligible offers retain non-trial copy. Prices come from the store, not a hardcoded dollar value.
- Reminder is an explicitly enabled iOS local notification, not an email. It uses verified active renewing Apple trial expiry minus 48 hours, never a guessed purchase date. Missing permission, cancellation, native scheduling failures, and accelerated sandbox expiry do not create a false scheduled confirmation. Notification failure never gates practice.
- Account-before-purchase and entitlement checks remain intact. No backend, credentials, catalog, signing, or deployment changes in this candidate.
- Base commit: `c1c17aea5ab039eee15188f4a9bd0d05f43c641e`; dirty working-tree candidate, build number remains 33. This is NOT the uploaded build 33 artifact.
- Initial automated runner Expo fingerprint: `fd65ebf9a484066bf7fe8248e672ed42cf9ef3f9d4e3c85b1f6ec0e9c9b04b03`. Superseded by the final error-copy and offline-refresh safeguard. Final fingerprint: `8030afd86a8c1b982b834c3d6d5258e3404641fdcf5615f5f69859be043bf267`.
- External renderer: `/Users/dylangrimm/.local/share/bysi-recovery/component-deps`; locked React 19.1.0 renderer verification passed.
- Bun 1.4.2; tests run under macOS sandbox with network denied.
- External backend fixture: `/Users/dylangrimm/.local/share/bysi-recovery/spend-alerts-mNLvm1/backend` (local copy, not a hosted deployment test).
- Relevant backend SHA-256 pins:
  - `server/native-free/routes.mjs`: `3d39a008871bb66198eb3e7e3fe6e9fd483d2d0cc9a714e18d8f144049e7d4f0`
  - `tests/fixtures/guest-visit.mjs`: `47eb709dd62406ec3f1575655517db478df9ca55c9c90ced3e8056ddd3f6b3d1`
  - `tests/fixtures/generation-output.mjs`: `fc34abffdaf83a98985ca33bcfb4cb59107b81a503e3e9815a70f32bed4a16d3`
- No provider calls/spend, native archive, EAS build, upload, or TestFlight installation performed this turn. Uploaded source/IPA digest: not applicable yet.

## Reproduction / focused regression

This is a requested feature update, not a reproduced new production incident. Before the change the prepayment screens used generic monthly copy and had no trial reminder scheduling.

- Pure checks: eligible vs unknown/ineligible, exact expiry calculation, non-trial/cancelled/expired/accelerated expiry, duplicate scheduling, permission denial, native errors.
- Native-adapter fixture verifies exact DATE trigger and stable notification ID, persistent opt-in, denied permission, cancellation, preserving the daily reminder, and scheduling errors. OS APIs are mocked; this is not delivered-notification proof.
- Mounted preview checks exercise all three offer screens, required account return, cancelled purchase, unavailable catalog, existing-buyer guards, enabled/denied reminder states, and ineligible fallback.
- First expanded preview test failed because its assertion expected “Notifications are disabled” while the implemented message is “Notifications are off.” Corrected the assertion; rerun: 6 tests passed, 0 failed, 27 expectations. No production code was changed to bypass that assertion.

## Acceptance layers

| Layer | Status | Evidence / limitations |
| --- | --- | --- |
| `bun run test:release` | Passed, final candidate | 2026-09-21 14:23:53–14:28:57 UTC; source unchanged; 7 policy, 36 spoken, 12 connected checks; TypeScript passed; lint 0 errors, 4 existing warnings in unrelated files. Initial candidate also passed 14:11:54–14:17:21 UTC |
| Extended onboarding / purchase / new trial regressions | Partial | 17 passed; 3 legacy joined fixtures could not start because they hardcode `/Users/donaldgrimm/.../test-deps` on another Mac. Not skipped or counted as passes |
| Real providers | Not run | Network denied; auth, AI/voice providers, recorder/player, and store responses are modeled |
| Exact-build iPhone | Pending | No new binary uploaded or installed; actual notification delivery and Apple sandbox purchase unverified |

## Spoken journey and recovery

- Automated connected Record/Stop/approval, both response points, and debrief passed for real conversation, recurring problem, and desired skill.
- All three tracks passed second-voice failure via Keep reading and Try voice again; both Record transitions; provider failure retry with retained reply; context drift protections.
- Existing pooled native-layout-event regression passed.
- Wrong verification/expired proof rejected; Unicode/audio-byte and abort handling regressions passed.
- Fresh full journey through report, result cards, all offer stages, and account entry: all nine `onboardingCompletion` cases passed (three tracks × ordinary offer / injected budget failure / alert-only offer). External store/auth/AI are modeled; purchase is not performed in this matrix.
- Real-provider and physical-device versions of every step remain pending. No typing-only fixture is being presented as proof of phone recording/playback.

## Device acceptance checklist before calling this released

1. Confirm the exact newly uploaded build; current TestFlight build 33 does not contain these local changes.
2. Eligible Apple sandbox account: check actual monthly price and seven-day introductory offer across all three screens; unknown/ineligible account must not receive an unsupported trial promise.
3. Enable/deny notifications; neither path may trap purchase/account navigation. Restore and cancellation must retain their existing safeguards.
4. Complete actual sandbox purchase and reach preserved result / first practice. Sandbox trials can expire in less than 48 hours, so no fake “two days before” schedule is created for those.
5. Verify a date-triggered notification on an installed device separately, including background/foreground and notification settings. Pure adapter tests do not establish delivery.
6. Confirm actual production-length trial expiry scheduling/readback when available; keep this pending rather than altering sandbox dates to manufacture a pass.

## Decision

Local implementation complete. Final automated release gate passed with unchanged source and the final fingerprint above. A second run was deliberately interrupted with SIGINT for the offline-refresh safeguard; it is not a pass. Eight focused trial/account/purchase tests passed after the final production-code change; the newly added offline-refresh assertion then passed in the two native customer-control tests.

The offline-refresh regression invokes the actual `identifyPurchasesUser` with an SDK login failure and asserts no reminder mutation occurs. Existing OS reminders survive a pending/failed refresh; only verified customer data or explicit reset changes them. Native scheduling itself remains modeled.

Three additional legacy fixtures remain infrastructure-blocked as described above; no attempt was made to change their backend contract to manufacture a pass. No real-provider/device acceptance or deployment claim.
