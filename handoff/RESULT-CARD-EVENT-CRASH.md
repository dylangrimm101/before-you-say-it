# Build 32 practice-plan transition: layout-event defect

User reported an immediate TestFlight crash when pressing “See the practice
plan” in build 32. Apple crash-stack evidence remains unavailable; do not call
the specific incident symbolicated or definitively attributed.

## Direct evidence

- HEAD: acf121e3e6c607bc4d01990978842a5ed4d5fd43.
- The CTA in FreeJourneyResults enters practice_shift and mounts ResultCardStack.
- All three original ResultCardStack layout handlers capture the event inside a
  functional state updater, which may execute after its callback returns.
- Locked React Native 0.81.5 ReactFabric-prod.js releases non-persistent events
  and sets nativeEvent to null in SyntheticEvent.destructor.
- The mounted regression was changed to null nativeEvent after each layout
  callback within one React act batch. Against the unchanged component it failed
  with `TypeError: null is not an object (evaluating 'event.nativeEvent.layout')`
  at ResultCardStack.tsx:32, reached through React updateReducerImpl.
- After copying numeric measurements synchronously in all three handlers, the
  identical regression passed: 1 test, 2 assertions. Existing long-card pinning,
  reachable CTA, and reduced-motion assertions remain intact.
- Earlier tests used permanently live plain event objects and missed this
  lifecycle. The new regression models event release, not native rendering.

## Scope

Only production change: components/ResultCardStack.tsx. No auth, provider,
transport, spending, payment, or backend change. The focused regression changes
__tests__/resultCardStack.fixture.tsx. Pre-existing dirty connected-test files
are preserved and are not part of this production fix.

## Acceptance

Future candidates run `__tests__/resultCardStack.test.tsx` with the pinned external
renderer as part of test:spoken and test:release. Never replace
its released-event behavior with indefinitely live event objects.

Focused before/after reproduced. Full network-denied release gate passed from
2026-09-21T01:18:17.418Z to 01:25:32.911Z: 6 gate-policy tests, 35 spoken tests,
12 joined recovery/SQL tests, TypeScript and canonical lint (four existing
warnings, zero errors). Source stayed unchanged during the run; uncommitted Expo
fingerprint fdd397b450617f1406770d1853a0005af1fc3e8be5cb4b393ba6afa3efe77e56.

Separately, all three tracks passed the existing external continuous onboarding
driver through both recorded turns, report/cards, offer screens, account signup/
confirmation/login, simulated purchase, success, and first-practice navigation.
Driver: /Users/dylangrimm/.local/share/bysi-recovery/spend-alerts-mNLvm1/full-onboarding.fixture.ts.
Backend fixture: that packet's backend directory, matching deployed candidate
dpl_8VvSf9tmVdt2DQWUQkvYTwYMRFyu. Renderer: external component-deps;
pinned Bun 1.4.2. Both commands ran under sandbox-exec with network denied.
Recording, playback, Auth, provider replies, and StoreKit were simulated; screen
mounts substitute for native navigation. The dedicated card test separately
injects the native-event lifetime that the wider fixtures do not simulate.

No new paid provider check or physical-device run is implied. No commit, build,
upload, or deployment has been performed for this fix. A new native candidate
will be needed for phone acceptance because TestFlight OTA remains disabled.

## Checklist/gate rerun

The native-event regression is now mandatory in test:spoken/test:release, and a
release-policy assertion checks that wiring. The checklist explicitly separates
native event lifecycle, mounted layout/navigation, physical iPhone operation,
crash-report attribution, and actual Apple sandbox purchase acceptance.

Final rerun: 2026-09-21T01:38:13.766Z–01:44:55.104Z, exit 0. Seven policy tests,
36 spoken/native-boundary tests (including released layout events), 12 connected
tests, TypeScript and canonical lint passed. Four existing lint warnings remain.
Source unchanged during run; uncommitted Expo fingerprint
9e35e108afeda06c90f983158ef8e57a45e57c691ba43669b4b505d26a458295.
The separate three-track continuous driver also reran successfully through
simulated payment/first-practice navigation. Same pinned fixtures and network
denial as above. Real providers and physical-device acceptance were not assessed.
No new build, commit, upload, or deployment was made.
