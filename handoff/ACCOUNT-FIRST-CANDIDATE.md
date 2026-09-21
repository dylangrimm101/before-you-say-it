# Account-first checkout candidate — September 21, 2026

## Scope and identity

- Reported defect: post-rehearsal offer opened sign-in as the primary action instead of account creation. User supplied iPhone screenshots; installed build not independently confirmed.
- Narrow fix: guest offer sends explicit signup mode; CTA is “Create account to continue”; existing-account sign-in remains secondary. Account verification and explicit purchase remain required. Existing billing-gate login stays login-first.
- Working tree based on `702c6a0f3fffbe9adfacc7408c9c440b22f54937`; uncommitted candidate, app.json still build 34. This is NOT a new uploaded build 34.
- Locked Bun 1.4.2, React 19.1.0 renderer at `/Users/dylangrimm/.local/share/bysi-recovery/component-deps`; connected backend fixture at `/Users/dylangrimm/.local/share/bysi-recovery/spend-alerts-mNLvm1/backend`.
- All candidate tests run with network denied. No production changes, provider spending, email sends, or Apple purchases.
- No candidate EAS build, IPA, upload, or installed-device acceptance yet.

## Reproduction

Mounted `subscriptionPreview.test.ts` failed before the fix at “trial entry must default to account creation” (1 pass, 1 fail). After the fix the same assertion passes. Coverage includes signup as default, secondary sign-in, failed verification remaining on account screen, successful verification returning to account-offer, no automatic purchase, claim failure routing, ordinary result-saving login, missing catalog, restore guard, cancellation, and simulated purchase through first practice.

## Acceptance layers

- Automated focused/broader run: 29 pass, 4 fail across six files. All nine connected onboarding cases and the account/purchase/trial/reminder cases passed. The four failures are older literal source expectations in `remainingNative.test.ts`; expected strings were verified absent in baseline HEAD as well. They were not weakened or counted as passing.
- Release gate: passed September 21, 17:10:37–17:16:11 UTC. Seven policy, 36 spoken, 12 connected regressions; TypeScript and canonical lint passed (four existing warnings, zero errors). Source remained unchanged throughout. Expo SHA-256 `7da050697f44415033c4d7ae3ccd4d124e82b0446c714cd3caf4b5fdc476dd6c`.
- Real providers: not assessed for this candidate; no live authorization used.
- Physical iPhone/email verification/StoreKit purchase: pending. Mounted navigation and simulated responses are not native end-to-end acceptance.

## Connected journey coverage

All three tracks (real, recurring, skill) passed both spoken Record/Stop/approval exchanges, response/playback callbacks, final review, report, cards, three offer screens and create-account entry. Each track also passed the existing result-budget-block reproduction and alert-only-through-offer case. Auth, recording hardware, provider replies, native playback and store catalog are simulated. These connected cases stop at account entry; the separate mounted subscription fixture covers account return, purchase and first practice.

## Known broader-suite failures

`remainingNative.test.ts` still expects four obsolete source strings: `await beginNativeJourney()`, `retry without saying it again`, `label="Next renewal"`, and `user || profile || activePracticeSession || nativeJourneyStarted`. All four were absent before this candidate. This suite is not green; its historical assertions require a separate reviewed maintenance pass.

## Decision

Implementation complete; automated release gate passed. Broader historical source suite retains four documented failures. No claim of real-provider or exact-build iPhone acceptance. User-authorized build/testing does not establish payment or email-delivery success.
