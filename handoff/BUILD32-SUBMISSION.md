# Build 32 — TestFlight test candidate

User explicitly requested “Upload it now” after disclosure of the failed isolated
provider gate. Uploaded as a test candidate, not an accepted production release.

## Source and artifact

- Branch: `codex/recovery-aug28-journey`.
- Application fix: `31ef4baa25fd364f40e6295492be357e511ee744`.
- Testing workflow: `896a89c5564ad27d7d13e111310c2c1796287ca7`.
- Preparation/upload SHA: `e885a1bf521ecb824f98eeb01bfb012571323c78`.
- Expo tree: `96a74023eb88833547ea9fb030e8df99ca3b2aea`.
- Preparation changes only `expo/app.json` buildNumber 31 → 32.
- Main unchanged at `e0dcdc07d816f05b341e2bb19e0100a20ab47585`; upload tree clean.
- Archive: 592 tracked files, 571 Expo files, exact byte/mode match to source.
- EAS build: `4eada79a-502b-4d9f-9449-33f47ecd7265`, FINISHED
  September 20, 2026 at 16:45:26 UTC.
- IPA SHA-256: `254c6818398836f942fd1e9b90372960532ed13057cf0af083f57d4821e27fab`.
- Identity: `app.rork.8fc4qwsqaurkxk0pimyvx`, version 1.0.0, build 32.
- Deep/strict signature verification passed; existing certificate and profile
  matched exactly; four expected production public inputs present; OTA disabled.
- Submission: `dde38785-bba1-44fb-a0f6-602bda2ae97f`, FINISHED
  September 20, 2026 at 16:49:39 UTC, ASC app `6811494369`.
- Existing EAS submission credential reused; no credential, tester-group,
  production backend, database, or environment setting changes. No Git push.

## Evidence and limitations

Fresh clean-source automated gate: 6 release-policy + 35 spoken + 12 connected
tests passed, TypeScript and canonical lint passed with four existing warnings.
Run 16:32:20–16:38:08 UTC; Expo fingerprint
`c5ad0d007e09d3d707b78d6227102e9a7ec21d3213ffa04b013bd96f5d94106c`.
Network denied; simulated recording/player and provider boundaries explicitly
remain distinct from physical-iPhone acceptance.

The isolated real-provider gate FAILED: first track second-response generation
returned 502 / counterpart_quality after internal repair. Two other tracks passed
both responses/audio/result. This backend rejection remains unresolved. See
`SECOND-VOICE-CONTINUATION-FIX.md`; upload authorization does not waive the finding
or convert provider acceptance to a pass.

Private release receipts:
`/Users/dylangrimm/.local/share/bysi-recovery/build32-release-nuPfT4`.
EAS submission completion confirms upload, not Apple processing completion or
installed-device acceptance. App Store Connect browser was at login, so final
TestFlight availability was not independently confirmed. Tester must install
1.0.0 (32) and verify both spoken turns, second audio recovery, explicit final
review and debrief. Historic authentication acceptance remains independently tracked.
