# Build 29 candidate: original rehearsal context and response feedback

## Evidence and limits

The user's middle-track Build 28 attempt on September 19 at 8:28 PM Eastern
produced the content-free diagnostic `exchange_mismatch` on the second Hope
generation. The checkpoint existed; contract equality was false while opener
and first Hope response equality were true. The rejection occurred before
provider generation. The exact phone-side field mutation/trigger remains unknown.

The mounted regression deliberately changes the in-memory contract after the
successful second Record check but before reply approval. Before the fix, the
actual client transport, backend verification, and SQL fixture reproduced the
same 422 and equality pattern. This is a modeled reproduction of the observed
failure class, not a claim to have captured the user's private request contents.

## Correction

Normal native free rehearsals capture the exact original JSON briefing when
generation begins, or the verified checkpoint briefing when restoring. An
owner-and-local-rehearsal-bound in-memory snapshot supplies subsequent recovery,
second response, retry, and final-result requests. UI/store reconstruction cannot
replace that snapshot. No trimming, digest normalization, persistence expansion,
authentication bypass, transcript substitution, or quota change is introduced.
Staging and paid generation paths retain their existing contract selection.

Previously reviewed local response-feedback corrections are included: redundant
Hope activity bubble removal at both playback points, a usable retry button,
verification-specific error text, and checked retry through the existing server
recovery protocol. The bottom speaking/stop indicator and playback-start text
reveal remain. This is not word-level audio alignment.

## Release gates

Run the canonical checks and both spoken suites with network denied, plus
auth/owner/privacy/recovery regressions. The connected suite checks all three
tracks through actual Record/Stop/approval handlers, both generation/TTS points,
final approval and debrief, including animated context drift. Recorder hardware,
providers, native player, and native layout are simulated.

The already-deployed temporary diagnostic is unchanged by this mobile release.
No new backend deployment, database migration, production configuration change,
public App Store submission, or OTA update is required. Use the existing frozen
EAS credentials; inspect the exact source upload and finished IPA before submitting
the specific build to TestFlight. Main and unrelated source remain untouched.

Physical iPhone acceptance remains pending on the new build. Complete all three
spoken tracks; do not call the phone issue or TF-AUTH-CONFIG-01 closed based solely
on automated tests. The mounted-client committed-close retry enhancement noted
by Claude remains separate; server recovery/replay behavior was tested independently.

## Automated results (September 20, 2026 UTC)

- Connected spoken suite: 9 passed, including all three complete tracks, three
  rejection/retry checks, and all three animated context-drift paths through debrief.
- Spoken-control suite: 27 passed, 110 assertions.
- Authentication/owner/privacy/recovery suite: 43 passed, 229 assertions.
- TypeScript and canonical lint passed; four pre-existing unrelated lint warnings.
- Locked component-renderer integrity check and Git whitespace check passed.

All test runs above denied network access. Native recorder/player boundaries and
provider output were fixtures, not a claim of physical microphone or speaker QA.
The first expanded connected run exposed an input-mount timing assumption in the
test harness; the harness now waits for the actual custom-scenario field before
typing. The complete nine-case rerun passed.
