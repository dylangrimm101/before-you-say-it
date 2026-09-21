# Build 33 candidate — September 21, 2026

Status: baseline checks passed; final prepared-source gate pending. NOT uploaded
or accepted on device.

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
Final upload/documentation commit and artifact pins pending.

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
| Connected three-track account/payment continuation | PASS | Screens manually mounted; no native navigation or real email/purchase |
| Real providers | Historical reference only | Unchanged backend; no new paid calls |
| Native simulator | BLOCKED | Full Xcode/runtime/controller absent; no simulator operated |
| Physical iPhone build 33 | NOT TESTED | Requires uploaded, processed, installed exact artifact |

Use NATIVE-ACCEPTANCE-MATRIX.md and SPOKEN-RELEASE-CHECKLIST.md for remaining IDs.
Do not mark account email links, microphone, audible playback, permission/lifecycle,
Apple sandbox purchase/restore, or all lesson navigation passed from component tests.

Baseline gate: 2026-09-21T10:32:12.815Z through 10:40:29.666Z, exit 0,
unchanged Expo fingerprint 9e35e108afeda06c90f983158ef8e57a45e57c691ba43669b4b505d26a458295.
The final build-number preparation requires a new frozen-source gate receipt.

## Device acceptance after availability

Confirm 1.0.0 (33) is installed. Retest the original See the practice plan crash,
scroll both stacked cards and continue through the offer/account flow. Complete
both spoken turns and audible responses on each track; separately record actual
email-link and approved Apple sandbox purchase/restore behavior. Capture failing
step/time/support code if any; preserve evidence and do not call the candidate accepted.
