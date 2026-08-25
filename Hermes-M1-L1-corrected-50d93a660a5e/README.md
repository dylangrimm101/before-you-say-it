# Hermes M1 L1 corrected source/evidence package

This package is pinned to corrected source snapshot SHA-256 `50d93a660a5e69300043575a869fb564dea7be240dc27cdd93bbba9369b637cc`.

## Revision identity

- Corrected source snapshot: `50d93a660a5e69300043575a869fb564dea7be240dc27cdd93bbba9369b637cc`
- Git base at implementation time: `a9d94caa3f3d56d83521512733c190176d3650e6`
- Remote HEAD observed at packaging: `a9d94caa3f3d56d83521512733c190176d3650e6`
- Accepted product baseline merge base: `3bed2b05dab5bbdd5ecb37a8643ffeeacf6deba1`
- Active contract: `INTEGRATION-CONTRACT-v1.0.md`
- Git status is included verbatim in `GIT-STATUS.txt`.

The managed workspace had not assigned a new Git commit SHA during this in-session package build. This report does not fabricate one. The complete 204-file source snapshot, source manifest, tracked binary patch, and artifact hashes deterministically pin the corrected implementation.

## Accepted identity

- module: `bysi_m01_get_to_the_point`
- lesson: `m1-l1`
- practice: `bysi_m01_l01_buried_point`
- content: `m1-l1-v2.1-2026-08-24`
- named move: `One point. One proof. One move.`
- context/counterpart: `work` / `adam`
- runtime: development-only; `launchEligible: false`

## Package layout

- `source/`: complete rerunnable Expo/backend/functions/shared source snapshot, excluding dependencies and private/generated material.
- `source/a9d94ca-to-corrected-tracked.patch`: binary-capable tracked-file patch from the Git base.
- `SOURCE-MANIFEST.sha256`: SHA-256 and byte count for every source file.
- `TEST-EVIDENCE.md`: exact validation commands and outcomes.
- `CORRECTION-MATRIX.md`: all 18 Hermes corrections mapped to source and deterministic proof.
- `PROVIDER-EVIDENCE.md`: sanitized provider smoke result.
- `REAL-DEVICE-EVIDENCE.md`: device-only gaps without simulated substitution.
- `BLOCKER-TABLE.md`: final status using the four authorized state labels.

No `.env`, credential, dependency tree, cache, build output, private history/log, transcript, recording, generated provider audio, or device media is included.

This package is source/test evidence for Hermes review. It does not authorize fan-out, public launch, or production readiness.
