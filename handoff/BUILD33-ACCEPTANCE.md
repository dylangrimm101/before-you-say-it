# Build 33 candidate — September 21, 2026

Status: final prepared-source gate and signed artifact checks passed. EAS build
and Apple submission FINISHED. NOT accepted on device; Apple processing/tester
availability not independently confirmed (App Store Connect browser signed out).

## Scope and authorization

User requested retesting with the expanded checklist and then a TestFlight upload
if the candidate supports it. This authorizes a candidate for physical-device
acceptance, not a claim that the unavailable native simulator checks passed.
No new tool installation, backend deployment, production settings, live provider
spending, or real purchase is included.

The only runtime application change relative to build 32 is ResultCardStack.tsx:
copy numeric layout measurements before queued state updates can outlive the
native event. Test additions cover released events and connected onboarding.
The preparation change will separately increment iOS build 32 to 33. OTA stays
disabled; authentication, transport, billing identity and provider code remain
unchanged. Main must remain e0dcdc07d816f05b341e2bb19e0100a20ab47585.

## Evidence and limitations

Private receipts: /Users/dylangrimm/.local/share/bysi-recovery/build33-release-Ji588q.
Original source: acf121e3e6c607bc4d01990978842a5ed4d5fd43, with previously recorded
uncommitted crash/test changes.
Fix commit: 38a6b6e222568e61a15342339de35b8515c005eb.
Preparation commit: 5a9a10202d7dbf19ec56d5c2982efa9bcf9d9ff8.
Their diff is only expo/app.json iOS buildNumber 32 to 33.
Prepared Expo tree: fe6a84ae9e225563c695c8dcb5a7eb874d8c28ac.
Exact uploaded source/documentation commit:
6a93d54f4b257cb6a21b43e0ec9832a628009b43.
EAS build: 7c10521a-e3c5-40a5-81b2-495f3b5fe8f8, FINISHED at
2026-09-21T10:54:13.108Z. Version 1.0.0, iOS build 33.
IPA SHA-256: 1fe091d37c50b14f4ff05983cc197ca8c8365f36e9a2cfb2ac7ffd1c33e93a46.
Upload manifest SHA-256: 73892323f41b683e5edd7c804a5148794b8f759daf70efec8db78e5a237e9a2a.
All 598 uploaded files (572 Expo files) match the frozen source bytes/modes;
no extra files, private backend, environment, dependencies or signing material.
Signed artifact passed deep/strict verification, same certificate and exact
provisioning profile as the approved preceding builds. All four expected public
production inputs present; OTA disabled. These are static checks, not Auth acceptance.
Submission c23708f7-faa4-419c-b37b-109c8aeef1ba targets ASC app 6811494369.
Submission FINISHED at 2026-09-21T10:58:09.735Z, confirmed by readback at
10:59:06.659Z with no error. Exact submitted build ID and source match above.
Existing submission credential reused; no settings, signing links, groups, backend,
database or production configuration changed. No Git push or merge.

- Before-fix reproduction: external loader selects the unchanged build-32
  ResultCardStack source without rolling back working files. Current regression
  throws null nativeEvent.layout during queued state processing (exit 1).
  This confirms a defect, not symbolicated attribution of the reported iPhone crash.
- Three continuous mounted screen journeys passed through both Record/Stop/
  approval sequences, both responses/playback callbacks, report/cards/offers,
  signup/confirmation/login, simulated purchase, success and first practice.
- Additional account/payment/auth checks: 41 pass, 0 fail, 181 assertions.
- Broad 21-file initial run: 118 pass, 6 fail, 4 errors. Five-second runner
  timeouts occurred during concurrent database-heavy suites, followed by
  overlapping asynchronous fixture failures. Preserved in broader-mobile.log.
  Rerun with 60-second outer runner allowance passed: 124 tests, 1,871 assertions,
  35.97 seconds. Two expensive asset checks took 9.66 and 8.74 seconds, beyond
  the original five-second runner limit. Application deadlines and assertions
  are unchanged, including the stalled-body deadline assertion. The original
  timeout/async interference remains recorded, not a product-acceptance pass.
- Connected onboarding matrix: all 9 tests / 18 assertions passed, including
  historical cap denial and current alert-only continuation on each track.
- Backend packet MANIFEST.json: all 186 entries verified, no mismatches.
  Source is spend-alerts-mNLvm1/backend. Historical deployment receipt identifies
  dpl_8VvSf9tmVdt2DQWUQkvYTwYMRFyu; no fresh production probe implied.
- Historical isolated real-provider receipt for that unchanged backend passed
  all three tracks (9 AI and 6 voice calls). No new live-provider run this task.
  It does not erase the earlier build-32 provider rejection or establish phone audio.
- EAS preflight: no existing build 33, expected production public inputs only,
  project origin/key-format checks passed, account-level environment empty.
  Existing submission credential confirmed without changing it.

## Acceptance layers

| Layer | Status | Boundaries |
|---|---|---|
| Automated baseline release gate | PASS | 7 policy + 36 spoken/layout + 12 joined checks; TypeScript and lint passed, four existing warnings; native primitives, Auth, providers and StoreKit simulated |
| Final frozen build-33 release gate | PASS | Same 55 tests, TypeScript and canonical lint; four existing warnings; source remained unchanged and clean |
| Connected three-track account/payment continuation | PASS | Screens manually mounted; no native navigation or real email/purchase |
| Real providers | Historical reference only | Unchanged backend; no new paid calls |
| Native simulator | BLOCKED | Full Xcode/runtime/controller absent; no simulator operated |
| Physical iPhone build 33 | NOT TESTED | Requires uploaded, processed, installed exact artifact |

Use NATIVE-ACCEPTANCE-MATRIX.md and SPOKEN-RELEASE-CHECKLIST.md for remaining IDs.
Do not mark account email links, microphone, audible playback, permission/lifecycle,
Apple sandbox purchase/restore, or all lesson navigation passed from component tests.

Baseline gate: 2026-09-21T10:32:12.815Z through 10:40:29.666Z, exit 0,
unchanged Expo fingerprint 9e35e108afeda06c90f983158ef8e57a45e57c691ba43669b4b505d26a458295.
Final prepared-source gate: 2026-09-21T10:41:42.472Z through 10:46:57.344Z,
exit 0; unchanged clean-source fingerprint
628a40dc3d6fde45b93efb50133c0bec5a5692974041d66cdb0af2a235e21cc6.
The three-track continuous driver, 9 onboarding cases, 41 account/billing checks
and 124 broader regressions ran before the build-number-only preparation; their
runtime application bytes are identical to this uploaded candidate.

## Device acceptance after availability

Confirm 1.0.0 (33) is installed. Retest the original See the practice plan crash,
scroll both stacked cards and continue through the offer/account flow. Complete
both spoken turns and audible responses on each track; separately record actual
email-link and approved Apple sandbox purchase/restore behavior. Capture failing
step/time/support code if any; preserve evidence and do not call the candidate accepted.
