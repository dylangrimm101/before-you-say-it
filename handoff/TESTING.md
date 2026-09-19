# Local checks and test seams

## Required spoken-flow gate (added September 19, 2026)

Use [SPOKEN-RELEASE-CHECKLIST.md](SPOKEN-RELEASE-CHECKLIST.md) for new candidates.
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
