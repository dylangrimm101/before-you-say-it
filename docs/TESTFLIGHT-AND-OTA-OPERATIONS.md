# BYSI TestFlight and OTA Operations

## Scope

`expo/` is the canonical application. The root `ios/` directory is frozen historical reference code and must not be built or submitted.

No build, submission, channel promotion, or production update is authorized merely because this file exists. Account authentication, final identifiers, environment configuration, and explicit release approval are separate gates.

## Immutable release identity

Every development build, TestFlight upload, preview update, and production update must be tied to an **exact verified Git commit**. Record the full commit SHA in the release evidence before invoking EAS.

Never build from a dirty tree. `eas.json` enforces `requireCommit: true`.

## Channels

- `preview`: internal validation only. All candidate JavaScript and asset updates land here first.
- `production`: customer channel. Promote only an update already verified on `preview` against the same runtime version and commit.

Development clients are for native-module and physical-device testing. They are not production evidence.

## Runtime policy

BYSI uses the Expo `appVersion` runtime-version policy. A native dependency, permission, entitlement, plugin, Expo SDK, or bundle-identity change requires a new native build and app-version decision; it must not be shipped as an OTA-only change.

## Required gates before an OTA update

1. Fetch and confirm the intended branch and exact commit.
2. Confirm the worktree is clean.
3. Run `bun install --frozen-lockfile` from `expo/`.
4. Run `bun test`.
5. Run `bun run check`.
6. Run `bunx expo-doctor`.
7. Run `bun run export`.
8. Confirm the change contains no native dependency/configuration delta.
9. Publish to `preview`, install it on the matching native runtime, and execute the affected user path.
10. Record the update ID, runtime version, channel, commit SHA, tester, device, and result.
11. Promote to `production` only with explicit release approval.

## Native changes that cannot use OTA alone

- Expo SDK or React Native updates
- Adding, removing, or upgrading native packages
- Microphone, notification, camera, location, photo, or other permission changes
- RevenueCat/native commerce changes
- Bundle identifiers, URL schemes, associated domains, entitlements, icons, or splash configuration
- Privacy-manifest or Info.plist changes

These require a new EAS build and TestFlight acceptance.

## Rollback

If a preview or production update causes a regression:

1. Stop promotion immediately.
2. Capture the failing update ID, channel, runtime version, and exact commit.
3. Use EAS Update rollback/republish tooling to restore the last verified update for that channel and runtime.
4. Verify the restored path on a physical device.
5. Do not patch production directly. Fix on a branch, rerun every gate, publish to `preview`, and re-promote only after approval.

The exact EAS rollback command must be confirmed against the authenticated project and installed EAS CLI at execution time; do not preserve a guessed command in operational documentation.

## First-time project linkage still required

After Dylan authenticates locally:

1. Run `eas init` or link the existing project.
2. Commit the generated Expo owner and `extra.eas.projectId` values.
3. Configure the `development`, `preview`, and `production` EAS environments.
4. Resolve `eas config --platform ios --profile production --non-interactive` and inspect it before building.
5. Confirm update URLs and channel mappings belong to the BYSI project—not a Rork or unrelated Expo project.
