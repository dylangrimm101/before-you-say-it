# Hermes M1 L1 source and evidence package

This package is pinned to implementation revision `c4ff389158bee97dcd5d602aee5cad4db735364e`.

- Direct parent: `cbab8e97f8d222eba1215150ba314f57263ef722`
- Accepted product baseline reference: `3bed2b05dab5bbdd5ecb37a8643ffeeacf6deba1`
- Active contract: `INTEGRATION-CONTRACT-v1.0.md`
- Runtime classification: development-only
- `launchEligible`: false

## Contents

- `source/expo/`: every Expo source/test file changed by the implementation commit at its repository-relative path.
- `source/c4ff389-parent-to-implementation-expo.patch`: binary-capable parent-to-implementation patch.
- `SOURCE-MANIFEST.sha256`: hashes and byte counts for source evidence.
- `ARTIFACT-MANIFEST.sha256`: hashes and byte counts for package files, excluding itself.
- `TEST-EVIDENCE.md`, `PROVIDER-EVIDENCE.md`, `REAL-DEVICE-EVIDENCE.md`, and `BLOCKER-TABLE.md`: verification record and gaps.

## Identity reconciliation

Committed implementation identity:

- lesson: `m1-l1`
- practice: `gtp_conversation_job`
- content: `m1-l1-v2.1-2026-08-24`
- coached behavior: `conversation_job`

Acceptance review requires practice `bysi_m01_l01_buried_point` under module `bysi_m01_get_to_the_point`, which is not implemented in this revision.

## Exclusions

No `.env`, credentials, dependency tree, cache, build output, private history/log, rehearsal transcript/audio, generated provider audio, or real-device media is included.

This artifact is not evidence of acceptance, fan-out readiness, public-launch authorization, or production readiness.
