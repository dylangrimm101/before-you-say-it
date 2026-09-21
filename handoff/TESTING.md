# Local checks and test seams

## Native layout-event regression (September 20)

`test:release` now includes `resultCardStack.test.tsx` via `test:spoken`.
The fixture releases layout events immediately after callbacks and flushes queued
React updates afterward. This caught the build-32 result-card defect that permanent
mock events hid. Keep this lifetime behavior, long-content measurements, CTA
reachability and reduced-motion assertions. The release-policy suite checks that
the regression remains wired into the gate.

Run the full three-track onboarding continuation through report/cards, account,
simulated purchase and first practice separately with the pinned connected driver.
Those manually mounted screen tests are not native navigation or an Apple purchase.
Use the physical-iPhone steps in SPOKEN-RELEASE-CHECKLIST.md before declaring device
acceptance; report unavailable crash evidence and untested stages explicitly.

## Required spoken-flow gate (added September 19, 2026)

The consolidated command is now `bun run test:release` from `expo/`, using the
existing pinned fixture paths and a network-denied environment. It fails on
missing prerequisites, any unsuccessful stage, or an Expo source change mid-run.
Its successful output means automated coverage only. Complete a candidate copy of
`RELEASE-EVIDENCE-TEMPLATE.md` before release claims; provider and physical-device
results cannot be inferred from this command. No dependency installation, build,
upload or production mutation is part of this command.

Workflow validation, September 20, 2026: the final consolidated run completed at
15:46:28Z with 6 gate tests, 35 spoken regressions and 12 connected regressions
passing, plus TypeScript/canonical lint (four existing warnings). Network was
denied. Source remained unchanged throughout the run: working tree based on
`69ff4d72ca7d8ccaccdbec2a7e401cdff3ae3116`, Expo fingerprint
`23b220130ee82efc90ea68ec351a495c2e7aaf648a504165c6914c956ccef069`.
This is an uncommitted source receipt, not a shipped build. Provider/device
acceptance was correctly reported as not assessed.

Negative checks: missing fixtures exited 1; each failed stage stops subsequent
stages. Earlier runner attempts are not passes: the first exposed a URL typing
incompatibility, and an intermediate run passed every stage but still exited 1
because source changed mid-run. The final stable run above supersedes neither
those failure records nor the separate provider/device gates.

Use [SPOKEN-RELEASE-CHECKLIST.md](SPOKEN-RELEASE-CHECKLIST.md) for new candidates.
It now requires separate automated failure/retry, real-provider candidate, and
physical-iPhone gates. Preselected successful AI replies cannot satisfy the
real-provider gate. Run `bun run test:spoken-joined` against the pinned reviewed
backend for all-track second-response failure, duplicate-tap retry, and completion
regressions. Live provider runs require explicit authorization and bounded usage.
From `expo/`, run `bun run test:spoken` with the pinned component-test dependencies,
then `bun run check` and the applicable broader regression/integration suites.
The spoken command uses the existing environment-sanitizing launcher. It exercises
both screen Record handlers across all three tracks; it is not physical microphone
or audible-playback evidence. A typed journey cannot substitute for it or for the
separate, build-specific iPhone acceptance checklist.

The results below are historical receipts, not results for the current candidate.

## Reproduction

From repository root, `python3 handoff/check.py --install` installs exact mobile dependencies with scripts disabled, installs the pinned React 19.1.0 renderer sharing this checkout's React, then runs the selected 21-file offline matrix, explicit TypeScript noEmit and canonical `bun run check`. No build or export is called. Environment/provider inputs are scrubbed and dotenv is disabled. Setup may download packages, but these tests do not call real providers.

Optional: `python3 handoff/check.py --private-source /absolute/path/to/private-reviewed-checkout` requires the separate clean checkout at `d0a068a1ee849144caf65811f4bf0c457056515a` with its locked server and test-deps installed. It copies byte-checked mobile source into an external temporary composition, links private backend/test dependencies there, and runs each composed suite in a separate process. No server/SQL enters this Git tree; no mobile fixture assertion is changed. This preserves reviewed relative imports rather than rewriting them to local private paths. Private output lives outside the committed tree.

## Verified final standalone result

Final attempt `1789556427824567000`:
- Selected mobile recovery/identity/voice/results/curriculum/privacy/environment suite: **122 pass, 0 fail, 1,845 assertions**, across 21 files.
- `bun node_modules/typescript/bin/tsc --noEmit`: exit 0.
- Canonical `bun run check` (TypeScript plus Expo lint): exit 0.
- Exact commands and log hashes: `check-results.json`; logs are private ignored local files, not published evidence.

Earlier attempts are retained rather than erased:
- Attempt `1789556242181161000`: locked install and renderer setup succeeded; 122 tests and typecheck passed; ENOSPC interrupted recording the direct lint result. Dependencies were not reinstalled or replaced to claim success.
- Attempt `1789556339969598000`: direct `eslint .` exited 1 (50 errors, 306 warnings). This broader invocation includes historical fixtures beyond canonical Expo lint's selected source scope. It is not described as green, and no assertions/lint rules were relaxed.
- Optional composed front-door: 18 setup failures, missing private `server/node_modules/next/server.js`.
- Optional composed context recovery: 4 setup failures, same missing Next module.
- Optional composed approved continuation: 7 setup failures, same missing Next module.
- Optional composed return repair: module-load failure for private backend `pg`; the reported 1 failure is not nine exercised behavioral failures.
- Optional composed cold resume: 1 pass; optional saved-result mounted history: 1 pass. These ran before the signing-only EAS field removal; production/test code bytes are unchanged.

The failed composition is incomplete private dependency setup, not evidence that its product assertions passed or failed. Disk headroom was very low; no unrelated user files/caches were deleted to make space. The final mobile-only checks completed. Do not report the full historical `bun test` suite, a full backend suite, or all composed acceptance as green.

## Explicit seams and missing coverage

Standalone tests include pure helpers, source/config assertions and modeled transports. Composed fixtures substitute Auth/provider responses, native recorder/player/storage/navigation boundaries and local PGlite; they do not establish physical speech, audible ElevenLabs playback, real GoTrue email confirmation, sandbox commerce, hosted database wire/roles/concurrency, or installed TestFlight behavior. Imported SDK/runtime modules and local fixture assertions are not equivalent to those services.

`external-test-dependencies.json` enumerates inherited test files with private backend/test-dependency or historical absolute-path references. Keeping those synthetic source fixtures does not make them standalone portable. The optional runner supports the named reviewed relative-path suites only; older historical absolute-path suites require a separately reviewed adapter before claiming reproducibility. Nothing redirects a production mobile import to the private backend.

## Release / publication boundary

No build/export was run, including unsigned Expo export. No EAS or provider operations, deployment, hosted migration, purchase, push or Rork activation. Saved-results flag remains default-off; backend selector/installer and installed-device acceptance remain separate dependencies. Publication stays blocked pending verified repository privacy, Rork access and active branch/branch-selection support, plus explicit publication approval.
