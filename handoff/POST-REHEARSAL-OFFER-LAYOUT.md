# Post-rehearsal offer presentation — September 20, 2026

Candidate on `codex/recovery-aug28-journey`, based on
`897c00857b792a39db29d4a9c2989bb30700f389`. Not in the installed Build 30.
Implementation: `feca2ccf9d073fa8d111074d1dfc36c9e3c6af0b`.
Build 31 preparation: `411004f740f86242101a652c2f3add63007737f7`.
The application diff between these two commits changes only iOS build 30 to 31.
Expo tree: `0cdcc87b692270e271c431048b1807e507fa1147`.
User approved proceeding with review and the next TestFlight candidate.
No backend deployment, payment, provider call, authentication-policy change or
production-setting change. Build/submission status will be recorded separately.

## Accepted sequence

Existing rehearsal/debrief → baseline and clearer-request explanation → Starting
Index/practice-path stacking cards → three offer screens → required account
creation/sign-in → return directly to final offer → explicit purchase confirmation
→ verified-success screen → first practice.

- `FreeJourneyResults.tsx`: replaces the static practice-shift view and old
  tap-switched index/path presentation with the same two-card presentation. CTA:
  **See my practice plan**. Actual evidence, index and first focus are retained.
- `ResultCardStack.tsx`: one native scroll surface, measured first-card pinning,
  higher-layer second card, no clipped-subview removal, ordinary document order
  for reduced motion. Long content scrolls before pinning. No new gesture library.
- `paywall.tsx`: three spacious screens with fixed Continue/checkout controls,
  subscription introduction, billing timeline, actual localized store pricing,
  Restore/Terms/Privacy. Existing account-return and purchase guards remain.
- `purchase-success.tsx`: **You’re in.**, actual result summary and existing
  first-practice routing. Existing entitlement gate remains; the presentation
  does not manufacture result data, purchase authority or practice history.

Screenshot adaptations: no hardcoded 64, 3-of-6, price, free trial, reminder date
or charge date. Seven-day eligibility and reminder delivery have not been
established; use accurate monthly-subscription wording rather than promising
them. The graph is explicitly illustrative, not a forecast of the user's score.
No claim of confirmed account storage is added based solely on a local result.

## Verification

Private output: `/Users/dylangrimm/.local/share/bysi-recovery/offer-layout-LZuEBL`.
Locked Bun 1.4.2 and existing renderer dependencies; checks run network-denied.

- Measured stack/mounted test: pass; covers long first card, draw order, CTA and
  reduced motion. Not physical scrolling or screenshot acceptance.
- Subscription mounted flow: account preview, rejected login, account signup,
  email-confirmation return, cancellation, successful purchase and personalized
  success/first practice, owner-store isolation, claim failure, absent catalog,
  existing Apple/web buyer gates. Native SDK, Auth and result hydration simulated.
- Broader billing/result matrix: 32 passed, 3 failed. All three failures reproduce
  independently using source from untouched base commit (baseline.test.ts): stale
  source-string assertions in remainingNative for entry, rehearsal-error wording
  and root account routing. They remain unresolved, not counted as passes.
- Spoken controls: 27 passed, 110 assertions. Recorder/providers/player mocked.
- TypeScript/canonical lint passed with the four pre-existing lint warnings.
- First validation attempts caught JSX/formatting errors and an optional-value
  type error introduced during editing; corrected before the passing checks.

## Remaining acceptance

No new real-provider calls were made (generation/audio code unchanged). No claim
that the earlier live voice check verifies this new UI candidate. Native overlap,
small screens, large text, VoiceOver reading order, actual email confirmation,
StoreKit eligibility/purchase/restore, and on-device saved-result continuity still
need acceptance on a new build. The user must not be told this is already live.

Retain current ownership/authentication and pre-purchase account requirement.
Do not bypass subscriber verification merely to remove an intermediate screen.
