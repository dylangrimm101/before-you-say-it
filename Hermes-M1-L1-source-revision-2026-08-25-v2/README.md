# Rork M1 L1 narrow source correction

This source-only package responds to `HERMES-VERDICT-Rork-M1-L1-dcadbbaf647b-2026-08-25` and changes only the failed or incomplete areas in that verdict.

## Identity and lineage

- Parent source snapshot: `dcadbbaf647b8925d80d4789918464248eff8414adc7de7febd8007a8d944af7`
- Parent ZIP SHA-256: `a21526331ea1e38281dbb902ee5384a1cc885532d80a7869549865c4237287b0`
- Managed-workspace Git base: `a9d94caa3f3d56d83521512733c190176d3650e6`
- No new Git commit was assigned; no revision SHA is claimed.
- Accepted deck path: `BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html`
- Accepted deck SHA-256: `aa4f4016888794b8f43139e8defdc01c14c4455476fa47f7d1ebb94cd412bd9e`

## Reproduce the snapshot identity

From this directory run:

```sh
sha256sum -c SOURCE-MANIFEST.sha256
sha256sum SOURCE-MANIFEST.sha256
```

The second command's digest must exactly equal `SNAPSHOT-IDENTITY.txt`. The snapshot identity is the SHA-256 of the exact, sorted `SOURCE-MANIFEST.sha256` bytes.

Then verify package documentation and manifests with:

```sh
sha256sum -c ARTIFACT-MANIFEST.sha256
```

## Validation

From `source/expo` run `bun install`, then:

```sh
bun run env:guard
bun run test
bun run check
bun run export
```

The package excludes environment files, credentials, dependencies, generated Expo caches, exports, test results, logs, audio, and transcripts. Runtime remains development-only and launch-ineligible. Real-device acceptance, fan-out, and public launch are not claimed or authorized.
