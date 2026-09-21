# Build 32 onboarding acceptance — September 20, 2026

Overall: **NOT accepted end to end through real Apple payment.**

Source under test: application bytes from uploaded commit
`e885a1bf521ecb824f98eeb01bfb012571323c78`; documentation HEAD at start
`acf121e`. This investigation adds test-only fixture modes; no app/backend,
production setting, database balance, or deployment changed.

## Report failure reproduced

Read-only project configuration on deployment
`dpl_BGNWnqp4GzwjbQtJxRMTt5EYP5Fv` reports:

- Shared daily reservation ceiling: 2,000 cents.
- Reservations: pushback 75, close 75, result 175, each voice 15, each recording
  transcription 10 cents. These are reservations, not measured provider charges.
- A complete no-retry spoken journey reserves 375 cents.

The connected screen test uses the actual client transport, route and isolated
SQL. With a synthetic initial ledger of 1,700 cents, both recordings, both Hope
responses and both audio calls succeed. The report would bring reservations from
1,900 to 2,075 cents and is denied with `429 / spend_limit`. Pressing the actual
“Recover my result” control remains blocked by the unchanged ceiling. Report and
payment are not reached. This reproduces the screenshot's failure class; the live
ledger balance and exact incident refusal code have NOT been inspected, so this
is not definitive attribution of the phone incident.

## Connected coverage and boundaries

New `onboardingCompletion.test.ts` ran all three tracks in two modes: 6 assertions
of journey/failure behavior passed (12 expect calls, 161.45 seconds). TypeScript
and canonical lint passed with four existing warnings; `git diff --check` passed.
These are regression passes, not an end-to-end acceptance pass.

1. Fresh ledger, production cost values: Entry/Get Started → context questions →
   both Record/Stop/transcript approvals → both Hope/audio points → final approval
   → generated report → result cards → all three offer screens → account entry.
   No prebuilt report is inserted between rehearsal and offer screens.
2. Synthetic partially used ledger: same spoken journey → report 429 → actual
   recovery button → persistent rejection. A reproduced failure is not a product
   acceptance pass even when the regression assertion passes.

Auth, microphone/player hardware, model replies and StoreKit catalog remain
simulated. Screens are mounted with a test renderer and manually mounted on router
transitions; this is NOT an installed Expo Router/native UI automation run.
The test stops at account entry; it is not one continuous real purchase journey.

Separate account/payment suites cover simulated signup, confirmation, login,
purchase cancellation/retry/success, result continuation, SQL-backed entitlement
and revocation. Initial run: 17 pass, 2 fixture setup failures because the billing
backend path was omitted. Corrected setup: all 3 unified billing tests passed,
including the two previously unavailable SQL cases. No failed attempt discarded.

## Remaining blockers

- Current phone report failure unresolved; no limit raised or guard bypassed.
- Previous real-provider first-track second-response quality rejection unresolved.
- No usable iOS simulator on this Mac (`xcrun simctl` unavailable), and no direct
  control of the user's phone. Real microphone, audible playback, complete native
  navigation, email confirmation and Apple sandbox transaction remain unverified.
- No new paid provider checks, real purchase, user account creation, production
  write, build or upload performed in this investigation.

Do not describe the above component/connected coverage as an end-to-end payment
pass. Actual acceptance requires an identified installed build, completed report,
account creation/verification, Apple sandbox confirmation, server entitlement
verification, purchase-success screen and entry into the first paid practice.
