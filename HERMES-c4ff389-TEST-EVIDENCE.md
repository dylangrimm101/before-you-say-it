# Test evidence

Revision: `c4ff389158bee97dcd5d602aee5cad4db735364e`

| Category | Command | Exit | Complete summary |
|---|---|---:|---|
| M1 L1 conversion | `cd expo && bun test __tests__/convertedLesson.test.ts` | 0 | 8 pass, 0 fail, 40 assertions. Proves current disputed identity, not the acceptance identity or eight-beat exchange. |
| Approved decks | `cd expo && bun test __tests__/approvedLessonDecks.test.ts` | 0 | 9 pass, 0 fail, 203 assertions. |
| Stale writes | `cd expo && bun test __tests__/staleWriteProtection.test.ts` | 0 | 6 pass, 0 fail, 45 assertions. Covers older persistence, not `cc.convertedLessonProgress.v1`. |
| Migration/privacy/audio | `cd expo && bun test __tests__/reviewCurriculumMigration.test.ts __tests__/serverTranscription.test.ts __tests__/sessionMigration.test.ts __tests__/baselineAudio.test.ts` | 0 | 39 pass, 0 fail, 184 assertions. |
| Transcription/privacy | `cd expo && bun test __tests__/serverTranscription.test.ts` | 0 | 7 pass, 0 fail, 50 assertions. |
| TypeScript | `cd expo && bunx tsc --noEmit` | 0 | No diagnostics. |
| Lint | `cd expo && bun run lint` | 0 | No lint findings. |
| Expo/Rork checks | `runChecks({ appPath: "expo" })` | 0 | Zero TypeScript, lint, or structure errors. |
| Production export | `cd expo && bunx expo export --platform all --output-dir /tmp/bysi-m1-l1-c4ff389-export-v3` | 0 | Web, iOS, and Android bundles completed. Output excluded. |
| Diff whitespace | `git diff --check HEAD^ HEAD` | 0 | No output. |

## Complete suite comparison

Implementation revision: 1 fail, 354 pass, 2778 assertions, 355 tests across 50 files. Direct parent: 1 fail, 346 pass, 2738 assertions, 347 tests across 49 files. Both fail the same pre-existing assertion at `expo/__tests__/conversion.test.ts:149`: expected paywall source to contain `Start with a clear ask.` The conversion diff changes neither that test nor `expo/app/paywall.tsx`.

## Missing verification

- No dedicated deterministic all-four-answer safety-routing test; fourth answer currently routes back.
- No interleaved-write test for converted progress.
- No byte-equivalence fixture proving legacy scored-history bytes remain identical.
- No eight-beat, Pushback 1 bank, optional final retry, or hard-cap test because those behaviors are absent.

Secret-value and destination scans found no credential values or newly introduced network destinations. Expo tooling had repopulated ignored `expo/.env`; it was sanitized before tests and packaging. Source-level prevention is not implemented.
