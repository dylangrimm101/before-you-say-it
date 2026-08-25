# Hermes M1 L1 Source-Only Correction Revision

Date: 2026-08-25
Scope: the 19 corrections required by the Hermes verdict for snapshot `50d93a660a5e`.

This artifact contains a rerunnable source snapshot, deterministic source manifest, artifact manifest, correction matrix, and validation evidence. It contains no `.env`, dependency directory, generated export, real-device evidence, or launch/fan-out claim.

## Source identity derivation

1. Verify every line of `SOURCE-MANIFEST.sha256` from the artifact root with `sha256sum -c SOURCE-MANIFEST.sha256`.
2. The corrected snapshot identity is the SHA-256 of the exact `SOURCE-MANIFEST.sha256` bytes: `sha256sum SOURCE-MANIFEST.sha256`.
3. Verify the complete package with `sha256sum -c ARTIFACT-MANIFEST.sha256`.

The manifest is sorted using the C locale and records paths relative to this artifact root. This recipe makes the custom snapshot identity independently reproducible without Git metadata.

## Validation summary

- Focused correction suite: 99 passed, 0 failed, 447 assertions.
- Complete Bun suite: 713 passed, 0 failed across 45 files.
- TypeScript strict check: passed.
- Expo lint: passed with no diagnostics.
- Rork checks: passed with no errors.
- Web, iOS, and Android export: passed.
- Client environment sanitizer: prohibited private values removed from `.env`; `.env` is excluded from this artifact.
- Real-device/provider acceptance: intentionally not claimed; remains the next gate after source acceptance.
