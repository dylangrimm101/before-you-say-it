# Test evidence

Source snapshot: `50d93a660a5e69300043575a869fb564dea7be240dc27cdd93bbba9369b637cc`

| Verification | Exact command | Exit | Complete result |
|---|---|---:|---|
| Corrected focused behavior | `cd expo && bun test __tests__/convertedLesson.test.ts __tests__/clientEnvGuard.test.ts __tests__/approvedLessonDecks.test.ts __tests__/scenarioContinuity.test.ts` | 0 | 35 passed, 0 failed, 374 assertions across 4 files. |
| Complete suite | `cd expo && bun test --reporter=junit --reporter-outfile=/tmp/bysi-full-suite-final.xml` | 0 | 697 passed, 0 failed. |
| TypeScript | `cd expo && bunx tsc --noEmit` | 0 | No diagnostics. |
| Lint | `cd expo && bun run lint` | 0 | No errors or warnings. |
| Rork checks | `runChecks({ appPath: "expo" })` | 0 | Passed; no TypeScript, lint, or project-structure errors. |
| Production export | `cd expo && bunx expo export --platform all --output-dir /tmp/bysi-m1-l1-corrected-export-final` | 0 | Web: 2,973 modules; iOS: 3,347 modules; Android: 3,417 modules. Export completed. Output excluded. |
| Diff whitespace | `git diff --check` | 0 | No output. |
| Secret value scan | `rg -n -I '(rork_sk_[A-Za-z0-9]{20,}|sk-proj-[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9]{20,}|sb_secret_[A-Za-z0-9_-]{20,})' expo --glob '!bun.lock'` | 1 from `rg`, normalized scan result 0 | No matches; `SECRET_VALUE_SCAN_CLEAN`. |
| Environment guard | `bun expo/scripts/sanitize-client-env.ts` plus prohibited-name scan | 0 | `expo/.env` absent after Metro/Rork/export. |
| Git status | `git status --short` | 0 | Included separately; only intended corrected files are changed/untracked. |

The first production-export attempt exceeded the 60-second tool limit while Metro rebuilt an incompatible cache. A clean retry completed all three platform bundles. No build output is packaged.

## Deterministic coverage

Executed tests cover the accepted identity, all eight beats, all three Pushback 1 selections, mandatory Pushback 2, two-response requirement, scoreless flags, adversarial transcript fixtures, comparison truth, two-retry cap, exact pressure/audio IDs, all four safety routes, Adam isolation, run binding, deck digest/path/version binding, exact Cards 21–22 return slice, malformed/mixed progress, prior versions, stale/interleaved writes, strict-deletion failure, legacy scored-byte preservation, explicit wording consent, countable progress facts, and environment sanitation.
