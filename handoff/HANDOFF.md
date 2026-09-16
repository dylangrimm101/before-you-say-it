# Local mobile handoff — publication blocked

## Authority and identity

- Branch: `handoff/expo-reviewed-20260916`, created from existing `main` at `0681578a7c12fa38af7613825264d9d94a807dac`; main was not moved.
- Reviewed source: `d0a068a1ee849144caf65811f4bf0c457056515a`; implementation: `e863721be645cc187fabb021aa405b0509af13c9`. Their entire Expo trees are identical.
- The final Git commit containing this document is the handoff identity (`git rev-parse HEAD`). Do not confuse it with the source pin or a TestFlight binary.
- Canonical app stays at `expo/`. No flattening or Swift conversion. `rork.json` now selects only Expo.
- Local work only. No push, PR, merge, remote configuration, build, export, signing, upload, OTA or deployment. Publication remains blocked until repository privacy and Rork access are verified, including its active sync branch and branch-selection support. The user is obtaining that response; do not infer it from local Git.

## Complete comparison inventory

`branch-comparison.json` records every pre-handoff local/remote-tracking ref, full reachable commit history, unique commits versus main, their changed paths, common-base deltas, and every mobile path's exact tip/review Git blob IDs and disposition. It covers ALL refs present in this clone, not an assertion of newly fetched remote state. No fetch was performed.

- `main`, `origin/main`, `origin/HEAD`: `0681578a7c12fa38af7613825264d9d94a807dac`; 412 equal mobile files, 64 different, 45 review-only.
- `origin/fix/canonical-lessons-provider-only`: `18a70859e2f3424ba18dcfdb9d3d2629c8ac5772`; 126 equal, 91 different, 304 review-only; one commit not reachable from main.
- `origin/fix/full-app-launch-readiness`: `17e9a0a455ec2e42542642854c64fd0bcdf88fdc`; 179 equal, 64 different, 278 review-only; 19 commits not reachable from main.
- `origin/fix/testflight-foundation`: `4ae50b5faacf7736bf6fcc13718fa332bb51d5b8`; 184 equal, 65 different, 272 review-only; three commits not reachable from main.
- `origin/testflight/146f0350-signed`: `5cc20c1c228f29efa1c1b4b0ab70dea243613526`; 432 equal, 47 different, 42 review-only; 15 commits not reachable from main.

There are no tip-only mobile paths missing from the reviewed source on any of those branches. Unique commit counts are graph facts, not claims that all their content is absent from main.

## Reasoned reconciliation, not a blind main overwrite

The Rork `562ce42` snapshot imported the TestFlight foundation. Relative to its preceding `6f3202e`, main's eventual substantive delta is the `0681578` change to Babel/Metro/package configuration: it removes environment preflight/HTML asset support and adds the unpinned `@rork-ai/toolkit-sdk: latest` wrapper. The later signed branch explicitly reverses these three changes; the reviewed source agrees byte-for-byte with that later configuration. Preserve the reviewed guards, authored HTML support and locked dependencies, not the obsolete wrapper. Existing Rork preview compatibility with this guarded configuration remains unverified; do not add the wrapper back silently.

Earlier feature branches carry canonical lesson scenes/provider responses, two-module curriculum, lesson exits, Today cards, Quick Reps, settings, privacy/storage, routing and commerce protections. Those files remain present in the reviewed successor; unchanged files retain exact bytes, changed files take the reviewed later ownership/recovery/voice implementation. Selected curriculum, lesson, approved-deck offline, privacy, identity and environment regression tests pass in the transferred tree. This is not a claim that every historical visual/provider journey was replayed.

The signed branch's newer entry/login/reset copy, guest talking gates, visible dictation failure, unmount-only cancellation and same-owner Auth-event handling are retained or superseded by reviewed recovery/ownership refinements—not discarded in favor of main. No feature branch is wholesale merged: doing so would reintroduce obsolete backend/evidence/workflow/configuration.

All 521 reviewed mobile files were transferred. `mobile-manifest.json` records exact hashes and deviations. The sole mobile-byte adaptation is removing the machine-local `credentialsSource: local` from `expo/eas.json`; no signing credentials or replacement signing setup are supplied. App build number 19 is inherited source metadata, not a reservation or uploaded successor. Root README, ignore rules, single-app Rork selector and new handoff documents are packaging adaptations.

## Exclusions and history

`exclusions.json` enumerates 786 inherited paths removed from this branch's working tree: obsolete standalone Swift app, backend/functions/shared roots, zipped snapshots, nested duplicate source, root QA and historical evidence/captures. All source roots other than `expo/` are excluded from transfer, including server, SQL/migrations, review/private evidence, test dependencies and release runners. Static mobile fonts/icons/curriculum/design files and synthetic test source are retained.

No private server or SQL is committed. Logs, dependencies, environment/signing files and generated output stay out. **This is not a history rewrite:** inherited removed files remain in main and ancestor commits. Do not call this a scrubbed repository or publish its history as a fresh sanitized archive.

## API and identity pins

- Bundle: `app.rork.8fc4qwsqaurkxk0pimyvx`; owner `dgrim101`; slug `8fc4qwsqaurkxk0pimyvx`; EAS project `1b655360-557d-4dba-ad69-fbf26120e852`.
- Production API origin: `https://beforeyousayit.app`; production Auth: `https://spvksnddzyvycfoefrcf.supabase.co`.
- Free transport: `/api/native/free/*` (session, generate, transcribe, tts, recovery/restart operations). Paid transport remains `/api/native/*` with confirmed registered-owner authorization. Guest eligibility does not grant paid rights.
- Saved result transport: `/api/native/results/*`. `EXPO_PUBLIC_NATIVE_RESULTS=normal-results-v1` is supported but not enabled in the checked-in TestFlight profile. A flag alone cannot create backend routes or owner-authorized data.
- The TestFlight allowlist accepts production Auth URL/publishable key, native billing origin, iOS RevenueCat SDK key and the exact optional results capability. No key values are included. Legacy public generate/transcribe/TTS overrides are rejected; TestFlight OTA remains disabled.
- Staging pins remain isolated in reviewed configuration; never substitute staging Auth, Test Store or the staging bundle for the normal app.
- ElevenLabs remains the spoken counterpart. Physical microphone/upload/playback and genuine Auth/store/provider behavior are not proved by synthetic offline tests.

## Backend dependencies and remaining gates

Recovery depends on the separately reviewed backend's guarded native transition and explicit `BYSI_NATIVE_FREE_RPC=recovery-v2` selector; absent selector remains legacy. Saved results depend on the separate guarded installer, private ownership/claim/discovery/deletion routes and matching capability enablement. Those server files/migrations are not part of this handoff, have not been applied by this task, and must not be recreated in Rork. Whole-account deletion is not accepted or enabled by this mobile transfer.

No unresolved textual merge conflicts. Remaining acceptance limitations: optional composed gates have missing private backend dependency setup, broad direct ESLint has inherited findings, Rork branch/preview compatibility is unverified, and hosted migration/configuration plus installed-device acceptance remain separate. See TESTING.md for exact outcomes, including failures. Local source handoff completion is not TestFlight readiness.

## Trigger inspection

No active `.github/workflows` or `.eas/workflows` files exist in main or the handoff tree. The foundation branch has `.github/workflows/mobile-ci.yml`: pull requests touching Expo/workflow and pushes to main trigger frozen install, tests, check, Expo Doctor and an all-platform export. It is deliberately NOT brought into the handoff. No active local Git hooks or custom hooksPath were found. EAS profile declarations are retained configuration, not automatic triggers. Remote GitHub Apps/Rork/cloud triggers are not established by local inspection; publication remains blocked. No trigger-enabling changes were added.

## Rork acceptance instruction (not authorization to import)

After privacy, access and exact sync-branch support are verified and publication is separately authorized: use the existing Expo project, echo the exact handoff commit and app path, compare without redesign, and report any integration mismatch before editing. Do not convert to Swift/Kotlin, import private backend, enable capabilities, execute build/export/OTA, or move main. An acknowledged commit is not a verified running mobile journey.
