# Guest subscription preview correction — local candidate

## Build 30 submitted — September 20, 2026 UTC

Following explicit user approval, EAS build
`2d5fb3bf-de7e-4b84-8621-cc6322fb133d` finished at `07:59:12.545Z`.
Uploaded source HEAD: `f42de20e66c4f4e8c282815e0e985b0bae92820d`;
Expo tree and implementation/preparation pins below are unchanged.
The local EAS archive matched 583 tracked files (565 Expo), zero extras, with
private backend, environment and signing files excluded.

The downloaded IPA passed deep/strict signature verification, exact existing
profile/certificate checks, version `1.0.0` / build `30`, production public-input
presence and disabled OTA checks. IPA SHA-256:
`70e8b32e6ca525856d85f7556ce74bb6c4b90d1bd32f6acd6d15a9350e0ff7eb`.

Exact-build submission `fe330bfa-b39c-4a8a-ac18-081cd9d0cfcb` finished successfully
at `08:03:29.432Z` for App Store Connect app `6811494369`. No backend change,
database migration, configuration/credential change, tester-group change,
public App Store review, Git push or merge. Private release receipts:
`/Users/dylangrimm/.local/share/bysi-recovery/build30-release-bJB1CC`.

Apple processing and tester availability are not independently confirmed:
the App Store Connect browser session was signed out. Real device, account
confirmation, StoreKit purchase/restore and hosted paid-access acceptance remain
pending. Successful submission and static configuration checks do not close the
historical TestFlight authentication issue. The preparation section below records
the earlier local checkpoint, not current cloud status.

## Build 30 preparation update — September 20, 2026 UTC

The initial investigation below is retained as history. Its four reported legacy
test blockers are now resolved; the candidate is committed locally, not uploaded.

- Implementation: `06e4a299c011a189c4d635eda4ff2f27441e1b65`.
- Build preparation: `d85530cbc9617056d5248d5925466fd71dc35196`.
- Prepared Expo tree: `609f8b55afc968cce4d9435a7ce016ffb1021de2`.
- Between those commits, the entire Expo diff is solely `app.json` iOS build
  number `29` → `30`. Bundle/EAS identity, OTA policy and signing settings are unchanged.
- Main remains `e0dcdc07d816f05b341e2bb19e0100a20ab47585`. Documentation is separate.

Final candidate checks, network denied:

| Check | Result |
| --- | --- |
| Subscription/navigation/billing/identity | 16 passed, 50 assertions |
| Auth/owner/privacy/recovery | 43 passed, 229 assertions |
| Spoken control regression | 27 passed, 110 assertions |
| Connected spoken/SQL/proof regression | 12 passed, 30 assertions |
| TestFlight/environment guards | 8 passed, 62 assertions |
| TypeScript + canonical Expo lint | Passed; 4 pre-existing warnings |
| Pinned renderer integrity + Git whitespace | Passed |

That is 106 selected tests, not a claim that all historical suites pass. Receipts
and scrubbed test outputs: `/Users/dylangrimm/.local/share/bysi-recovery/build30-check-xDat9u`.
These checks ran against the exact final application/test bytes before commit;
the run receipts explicitly identify an uncommitted Build 30 working tree.

Harness repairs preserved product assertions: signup no longer imports unused
native screens; native AppState/application mocks match the current runtime;
the AI mock reuses the actual contract builder; a successfully confirmed mock
account now includes `email_confirmed_at`. Without that field the native session
starter correctly rejects the purported confirmed account. No auth rule was
changed to accommodate the test. The SQL-backed fixture requires explicit
`BYSI_BILLING_BACKEND` and `BYSI_TEST_DEPS` absolute paths instead of Mac-mini paths.
Both synthetic production and sandbox cases now pass purchase, restore,
revocation, server-issued identity and access precedence checks.

The billing fixture used the existing private
`close-response-fix-Hq1Avr/test-backend` composition and pinned PGlite 0.5.8.
Its complete RevenueCat source directory and native API routes were compared
byte-for-byte with that release's backend source and match. No backend code or
dependencies were installed, copied into Expo, edited or deployed.

Read-only EAS preflight at 2026-09-20T03:11:01Z found no existing Build 30,
the expected account/project environment, all required public client values
present with valid formats, and no account-level public overrides. Values were
not printed. Receipt: `build30-release-bJB1CC/eas-final-preflight.json` under the
same private recovery directory. This is configuration evidence, not live login,
real StoreKit purchase, paid hosted access, or device acceptance.

Remaining: explicit cloud-build/TestFlight approval, exact upload/artifact audit,
and physical-device review of price → required account → Apple purchase → paid
access, including cancellation and restore. The separate historical front-door,
context and native-benefit suites still require their missing retained backend
test helpers; they are not counted above. No public App Store release, backend
change, or additional real-provider spend is included in this preparation.

## Initial investigation and historical results

September 19, 2026, America/New_York (checks continued September 20 UTC).

Base: `4a82c74e872119085e92188574993279ff2c53ab`, branch
`codex/recovery-aug28-journey`. Changes are uncommitted. Main remains
`e0dcdc07d816f05b341e2bb19e0100a20ab47585`. No build number, backend,
production configuration, deployment, or TestFlight artifact was changed.

## Behavior

Review monthly subscription → existing three-step offer with store-supplied
localized price/terms → Continue to account → verified sign-in or confirmed
signup → existing account/billing checks → final monthly terms. Purchase still
requires a separate explicit Subscribe monthly action. Guest Restore also asks
for account verification; it does not invoke the purchase SDK anonymously.

The status screens now have safe-area spacing, a heading, scrolling and Back.
The offer no longer has an unconditional redundant login button at the top.
Missing catalog data never produces an invented price or enabled purchase CTA.

The subscription return is a fixed internal destination, not an arbitrary URL.
Only a recognized module and recommended-path gate are carried. Guest-owned
result objects are not copied through route parameters. A failed result claim
keeps its recovery destination. Generic result-saving login retains its original
destination, and the staging bridge is not redirected into this production flow.

For a matching, verified owner handoff, the root navigator preserves subscription
intent through login and acknowledges the existing secure handoff when returning
to the offer after the guest debrief was reviewed. It does not force the same
debrief again or change the result/entitlement. Unrelated cold-start handoffs
still route to their exact saved debrief. Existing acknowledgement retains its
owner/lease checks; no authentication/storage implementation was changed.

## Files

- `expo/app/paywall.tsx`: guest preview, account interception, safe-area billing status.
- `expo/components/NativeBillingGate.tsx`: optional public preview/status wrapper;
  verified entitlement, error, restore, web-purchase and owner-isolation checks remain.
- `expo/app/continue-from-web.tsx`: verified subscription return and signup availability.
- `expo/app/_layout.tsx`: preserve the explicit return through matching owner handoff.
- `expo/lib/subscriptionNavigation.ts`: allowlisted internal return parameters.
- New `subscriptionPreview.fixture.tsx` / `subscriptionPreview.test.ts`: mounted
  actual result CTA, paywall, gate and login screens; restricted-return unit check.
- `appRootNavigation.fixture.ts`: actual root navigation handoff regression.
- Historical front-door, context-recovery and native-benefit fixtures: update
  old login-before-price assertions and distinguish inspecting the saved result
  from the new automatic subscription destination.

## Evidence and limitations

All executed automated checks used the pinned Bun 1.4.2/runtime dependencies,
clean environment and OS-denied network. No provider calls or purchases occurred.

- Regression reproduced against the untouched HEAD billing gate using an in-memory
  loader (no checkout rollback): the test fails on the old login-before-price text.
- 11 subscription/navigation/billing/identity tests passed, including the mounted
  regression. It clicks the actual Review monthly subscription CTA, sees the
  synthetic localized store price, reviews terms, fails/retries sign-in, returns
  to the offer, tests signup, cancellation, restore interception, missing catalog,
  earned-result requirement, generic login, owner isolation and existing-buyer guards.
- The existing standalone mounted NativeBillingGate regression also passed.
- `bun run test:spoken`: 27 passed.
- `bun run test:spoken-joined`: 12 passed, all three tracks, both spoken control
  sequences, both responses/audio seams, final debrief, failure/retry and context
  drift. Local SQL/proof/transport composition uses the existing private test
  backend; auth, recording bytes, provider responses and native playback are simulated.
- `bun run check`: TypeScript and canonical Expo lint passed, with four existing
  warnings in approved-lesson, approved-rehearsal and OriginalFollowThrough.
- Four legacy cases attempted but **not passing**: registeredSignup has a missing
  TurboModuleRegistry mock; monthlyPurchase lacks the normalFreeRecoveryContract
  mock export; both SQL-backed unified billing cases reference unavailable original
  Mac-mini PGlite/backend paths. The two mock failures were also reproduced with
  untouched HEAD application sources loaded in memory. No backend was installed
  or copied into this repository to manufacture a pass.
- Historical front-door/context/native-benefit suites were not executed here;
  their retained backend dependencies are not present at the referenced locations.
  Updated expectations are not claimed as passing integration evidence.

This is **not** an all-suite-green or physical-device acceptance claim. The new
fixture uses simulated store/auth and a minimal synthetic completed result; its
`$7.49` is a fixture price, not a statement about the live App Store price.
Safe-area spacing is asserted with a 59-point top inset, not rendered on an iPhone.
Real StoreKit product loading, confirmation-email round trip, sandbox purchase,
hosted entitlement verification and the exact new TestFlight binary remain
unverified. No historical TestFlight authentication issue is declared resolved.

Before release: resolve applicable legacy harness gaps, obtain build/upload
approval, and test the exact new binary from the reported result CTA through
price review, account return and Apple sandbox purchase/restore. Keep physical
spoken acceptance on all three tracks separate from these simulated passes.
