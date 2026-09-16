# D1 diagnostic candidate — direct Expo EAS handoff

Prepared 2026-09-16. **Preparation only: no EAS native build, Rork publishing retry, TestFlight upload, or public App Store submission was started.**

## Immutable candidate and branch status

- App: Before You Say It **1.0.0 (24)**.
- Exact existing commit: **`c504d722cb05bfb6af57d3d947ff48ce741a6202`**.
- Entire committed `expo` tree: **`43570d287d4d19ca003cf423bdd6f7df769f2ce1`**.
- Dedicated branch to create: **`release/d1-eas-24`**.
- **The GitHub branch has not been created or remotely verified here.** This environment cannot directly create/push Git branches. The Mac steps below create the branch at the already-existing exact commit; no new app commit is needed.
- All **14** file hashes in the candidate's committed `handoff/testflight24-candidate.json` were verified against Git objects at that commit. This is stronger than relying on the working directory or the earlier record's base-commit field.
- Current workspace Babel/Metro were restored byte-for-byte to that commit, and the **entire tracked app directory** was compared against it with no remaining difference. No D1, auth/session, selector, app identity, EAS profile, lesson, package, or lockfile changes were made.

The pinned commit already contains the intended configurations:

- `expo/babel.config.js` blob: `e5aeeeaacaaebe6c53ed6e38050814cac0bf3090`.
- `expo/metro.config.js` blob: `c1037982fac61f18101a94f6ec6091f26328d0a8`.
- Both invoke `runClientEnvPreflight(__dirname)`; Metro retains HTML assets and the existing isolated dotenv-module block rule. No toolkit Metro wrapper. The inert toolkit dependency remains exactly `0.3.0`.
- D1 remains configuration-failure-only, credential-free, and a snapshot of the inputs actually consumed at startup. No fallback or bypass.

**Do not build the moving main branch, a current workspace ZIP, or an older D1 base commit by assumption. Use the exact commit above.** If your GitHub repository does not contain that object, stop and resolve repository synchronization before building.

## Existing identity and build profile

Use the existing normal app, not the separately isolated staging app:

- Bundle identifier: `app.rork.8fc4qwsqaurkxk0pimyvx`.
- EAS project: `1b655360-557d-4dba-ad69-fbf26120e852`.
- EAS owner: `dgrim101`; slug: `8fc4qwsqaurkxk0pimyvx`.
- Apple team: `86T6AJ43A5`; App Store Connect app: `6811494369`.
- Working directory for EAS: repository's **`expo/`** directory.
- Build profile: **`testflight`**, not `production`, `preview`, or either staging profile.
- The profile extends `production` but explicitly sets `autoIncrement: false`, `developmentClient: false`, `distribution: store`, `environment: production`, `channel: testflight`, iOS `Release`, and `simulator: false`.
- `cli.appVersionSource` is `local`; `cli.requireCommit` remains `true`. Effective version/build must remain **1.0.0 / 24**.
- OTA is disabled by the release app configuration. Saved results remain unset/off.

The original profile does not pin the EAS server image, Node, or Bun version. Preserve it for this candidate; record the actual EAS image/tool versions with the eventual artifact. An identical source commit is not a promise of bit-identical native output across build services.

## Exact release environment requirements

The following are **mobile-public inputs**. Public prefixes mean values can be recovered from the installed app; they are not a place for server secrets.

1. **`EXPO_PUBLIC_SUPABASE_URL`** — existing approved normal Supabase URL, exactly the value already committed in `build.testflight.env` in `eas.json`. The profile supplies it to EAS bundling. If also defined in EAS production, it must match; never replace it with staging.
2. **`EXPO_PUBLIC_SUPABASE_ANON_KEY`** — the **existing approved normal publishable client key**. Despite the legacy variable name, the reviewed guard requires the `sb_publishable_…` format. Supply it in the normal EAS project's **production** environment. Do not generate a replacement, use a fixture, substitute a different project's key, or change the guard to accept a JWT.
3. **`EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`** — existing iOS public SDK key, with `appl_…` format. It is also required by the release guard even though the immediate diagnostic concerns auth. Supply it in that same EAS production environment. No Test Store key.
4. **`EXPO_PUBLIC_NATIVE_BILLING_ORIGIN`** — existing reviewed normal billing/free-service origin, exactly the value already committed in `build.testflight.env`. The profile supplies it; any duplicate EAS value must agree.

Configure client keys in the Expo dashboard as **Sensitive** (or Plain text), **not Secret**. Sensitive visibility masks routine cloud logs while remaining available to local config resolution and `env:exec`. It does not make a public mobile key confidential. URL/origin can be Plain text.

For this normal candidate, these must be **unset**, not `production`, `false`, `0`, whitespace, or an empty-value substitute:

- `EXPO_PUBLIC_BYSI_BUILD_MODE`.
- `EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE` and **all `EXPO_PUBLIC_STAGING_*`** names.
- `EXPO_PUBLIC_NATIVE_RESULTS` and unreviewed capability/endpoint overrides.
- `EXPO_NO_DOTENV` and `EXPO_NO_CLIENT_ENV_VARS`.

Inspect both **project-scoped and account-scoped** EAS production variables. Inherited staging values are not fixed by clearing only your Mac shell. Do not edit the separate staging project or its isolation settings to repair the normal project. Stop rather than silently remove shared account-wide values that another app relies on.

**Never substitute** `SUPABASE_SERVICE_ROLE_KEY`, `SERVICE_ROLE_KEY`, an `sb_secret_…` key, `SUPABASE_ACCESS_TOKEN`, `OPENAI_API_KEY`, a RevenueCat server secret, or `EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY` for any mobile input. None belongs in this EAS mobile production environment. The existing known-ambient filtering, allowlists, URL/key checks, and staging rejection remain unchanged.

Rork/editor values and Mac shell values do **not** automatically reach EAS cloud builds. The public keys must exist in the EAS project's production environment, while the fixed profile supplies URL/origin. Confirm existing values privately in their approved source and enter them through the Expo dashboard; do not paste them into this document, a Git commit, a shell command, or shared logs.

## Standalone verifier and evidence boundaries

Download `handoff/verify-d1-eas.cjs` from this handoff to **`$HOME/bysi-d1-handoff/verify-d1-eas.cjs`**, outside the fresh checkout. Also retain this document and `handoff/d1-eas-candidate.json`. These are companion handoff files, **not files in the historical candidate commit**. Do not add them to the pinned branch merely to run them.

Verifier SHA-256: **`62de5bcca72fdd20847effa607b118a3c5d93029dc54696d56b3e7394c5e835d`**.

The verifier:

- Checks the exact checkout commit, clean status, entire app tree, all 14 recorded committed blob hashes, critical working-file hashes, and the existing toolchain guard.
- Refuses unreviewed native directories, a new app-level `.easignore`, and dotenv files in a fresh release checkout. This avoids accidentally mixing local development files with EAS values; it **does not disable dotenv in Expo** and never rewrites it.
- Reproduces the `testflight` profile inputs, preserves all app release guards, checks normal identity, and confirms OTA/results stay off.
- Compares the public auth URL/key to a credential-free SHA-256 fingerprint of the previously reviewed inputs. This detects a different well-formed public key, not just bad syntax. It is a baseline comparison, not independent proof of Supabase project ownership or key validity.
- Creates a fresh local production iOS JavaScript export with cache cleared, source maps, no minification, and no Hermes bytecode **for inspection only**. It does not set these inspection options on the eventual EAS native build.
- Uses the export's source map to locate and execute the **actual exported** Supabase startup module, auth selector, D1 helper, and storage-factory code. This is not a separately compiled source fixture or a string-presence-only assertion.
- Runs with an empty device `process.env`, confirms normal selection and exact embedded URL/key at the `createClient()` call, checks D1 classifications, and constructs the installed real Supabase SDK client. The SDK version is checked against the pinned lock; the fresh frozen dependency install is still required.
- Supplies native identity/constants in the harness and disables SDK persistence/auto-refresh while intercepting network access. It intentionally does **not** claim native storage, backend login, or signed-device verification.
- Prints only safe classifications, paths, hashes, and counts. It saves a safe `d1-verification.json` inside its temporary export directory. Keep raw bundles/source maps private; they contain public client configuration and app source.

Expected successful export report includes `normalAuthSelected: true`, `embeddedInputsMatch: true`, `approvedPublicAuthInputFingerprintMatched: true`, one client creation, zero network/storage calls, and `signedAppVerified: false`.

Local preparation used a restored app tree matching the pin, not a checkout with HEAD moved to it; its report honestly says `exactCheckout: false`. **On the Mac, omit `--allow-restored-worktree`; `exactCheckout` must be true.** The local workspace flag is not acceptable for the final fresh-checkout gate.

## Mac mini — fresh checkout and dedicated GitHub branch

Use the existing GitHub repository, with its history. Do not create a public copy. Install Git, Node **22.22.0** and Bun **1.3.9** (the versions used for local validation). EAS CLI **24.6.0** is explicitly selected below. Its package metadata and `env:exec` command syntax were checked; the EAS CLI itself was not run in this workspace. An Expo cloud build does not require Xcode on the Mac; local native compilation is not covered here.

Create `~/bysi-d1-handoff` and download the companion files there first. Replace the repository URL placeholder below. Run each section only after the preceding one succeeds.

```sh
REPOSITORY_URL='YOUR_EXISTING_GITHUB_REPOSITORY_URL'
PIN='c504d722cb05bfb6af57d3d947ff48ce741a6202'
BRANCH='release/d1-eas-24'

git clone "$REPOSITORY_URL" "$HOME/bysi-d1-eas"
cd "$HOME/bysi-d1-eas"
git cat-file -e "${PIN}^{commit}"
git switch -c "$BRANCH" "$PIN"
test "$(git rev-parse HEAD)" = "$PIN"
test "$(git rev-parse HEAD:expo)" = '43570d287d4d19ca003cf423bdd6f7df769f2ce1'
git diff --exit-code "$PIN" -- expo
git status --short
```

`git status --short` must be empty. If any command fails, stop. If the branch already exists, inspect its exact remote commit rather than force-pushing it. Do not cherry-pick from the drifting main branch or create a replacement commit without reviewing it.

Now preserve the existing commit on the dedicated remote branch:

```sh
git push --set-upstream origin "$BRANCH"
git ls-remote --exit-code --heads origin "refs/heads/$BRANCH"
```

The returned first field **must equal** `c504d722cb05bfb6af57d3d947ff48ce741a6202`. Save that readback as the missing remote-preservation evidence. Branch creation does not require a new commit: the restored configurations and D1 already exist in the exact target commit. Do not force-update the branch after pinning; protect it from later edits/build automation.

## Install and verify without starting a native build

```sh
cd "$HOME/bysi-d1-eas/expo"
node --version
bun --version
bun install --frozen-lockfile
git diff --exit-code HEAD -- .
shasum -a 256 "$HOME/bysi-d1-handoff/verify-d1-eas.cjs"
node "$HOME/bysi-d1-handoff/verify-d1-eas.cjs" source "$PWD"
```

Compare the verifier hash to the value above. Do not use `NODE_ENV=production` while installing dependencies: the export verifier needs build/dev dependencies. Do not run an Expo upgrade, toolkit wrapper, `eas init`, `eas build:configure`, or a local prebuild. Abort prompts to relink/create an app/project or auto-commit changes.

Run the selected app regressions without changing the candidate:

```sh
bun test __tests__/authConfigurationDiagnostic.test.ts __tests__/nativeAuth.test.ts __tests__/clientEnvGuard.test.ts
bun test __tests__/releaseEnvironment.test.ts --test-name-pattern 'development and staging|filter does not hide|release rejects a staging|release gate catches|Metro and Babel reject|compiled production|Babel worker'
bun test __tests__/stagingBuild.test.ts --test-name-pattern 'explicit native development staging'
bun scripts/component-test-deps.ts --install
bun test __tests__/setupDiagnosticDetails.test.ts
node node_modules/typescript/bin/tsc --noEmit
```

Component-test dependencies are installed to the script's external temporary prefix, not the app package. These are **focused gates, not full-suite acceptance**. The historical suite includes stale assertions requiring dotenv suppression, absent backend fixtures, and a Bun data-module limitation; none was edited or represented as passing in order to preserve the exact candidate.

Log into Expo under your Mac user's HOME and confirm the existing project. The clean command environment below avoids inheriting development public variables, `NODE_ENV`, or an old Expo token:

```sh
env -i HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" TERM="${TERM:-xterm-256color}" bunx eas-cli@24.6.0 login
env -i HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" TERM="${TERM:-xterm-256color}" bunx eas-cli@24.6.0 project:info
```

Confirm project/owner/slug match the identity section. `TMPDIR` must be an existing writable directory outside the checkout. Review/set only the approved EAS production public inputs in the dashboard as described above. Authentication/signing availability in EAS was **not** established by the earlier Rork publishing readiness checks.

Run **only the local export check**, using the actual retrievable EAS production values:

```sh
env -i HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" TERM="${TERM:-xterm-256color}" bunx eas-cli@24.6.0 env:exec production 'node "$HOME/bysi-d1-handoff/verify-d1-eas.cjs" export "$PWD"'
```

For the pinned EAS CLI 24.6.0, `production` is a **positional argument** to `env:exec`; do not use the `--environment` spelling shown in some newer documentation. Other EAS commands have their own flags.

This step verifies values retrieved from EAS, not editor fixtures. It does not mutate EAS variables or start a native build. Missing keys, wrong baseline fingerprint, staging values, dirty source, or guard failure mean **stop**, not remove a check. `env:exec` cannot inspect Secret-only values or tell you about empty variables it omits; therefore the dashboard review of names, scopes, visibility, and true absence remains required. Keep the production environment unchanged between this check and the eventual build.

## Deliberate build boundary — do not run until ready

Before queuing anything, verify:

- The remote branch still points to the exact pin, and the strict fresh-checkout verifier passes.
- No equivalent EAS or Rork build is queued/running. The last known Apple result was build 23; independently confirm **24 has not since been uploaded or reserved by another attempt**. No live Apple/EAS status check was made for this handoff.
- EAS is using the existing normal project and existing Apple team/bundle identity. Do not create a new app/project, rotate signing assets, or use staging credentials to make a prompt disappear. If EAS lacks access to existing signing assets, resolve that explicitly first.

When you deliberately choose to start **one Expo cloud build from the Mac**, this command repeats the strict export gate immediately before dispatch. It uses no Rork publishing service:

```sh
env -i HOME="$HOME" PATH="$PATH" TMPDIR="${TMPDIR:-/tmp}" TERM="${TERM:-xterm-256color}" bunx eas-cli@24.6.0 env:exec production 'node "$HOME/bysi-d1-handoff/verify-d1-eas.cjs" export "$PWD" && bunx eas-cli@24.6.0 build --platform ios --profile testflight --clear-cache'
```

Do not add `--auto-submit`, `--local`, or change the profile. Record the returned EAS build ID/URL instead of rerunning the command after a slow response. This command creates a signed store-distribution archive; **it does not upload it to TestFlight or submit it for App Store review**. An App Store-distribution IPA is not directly installable by arbitrary sideloading.

## What still requires the actual signed app

1. Read back the EAS build record's Git commit, project, profile, version/build, tool versions, signing identity, and artifact URL. They must identify this candidate. Download and retain that exact IPA; record its SHA-256 rather than rebuilding it for investigation.
2. Verify the signed app's bundle identifier and version/build, and effective embedded OTA-disabled configuration. The local JS export is not proof of the final IPA's embedded JS/Hermes bytes or remote environment.
3. A later **separate, deliberate TestFlight-only upload** must reuse the verified artifact, not create another build. No public App Store review/release is authorized by this handoff.
4. Install that **1.0.0 (24)** and tap **Get started**. If `configuration/unavailable` remains, use **Copy setup details** or a screenshot. D1 will report actual installed identity/version, selection, input presence and failed checks. It cannot certify that a merely present key is valid or belongs to the intended backend.
5. If Get started succeeds, verify real native session storage/relaunch and backend sign-in behavior. Only then proceed to voice capture/transcription/playback. None is established by the offline harness.

D1 in build 24 cannot retrospectively prove what was embedded in build 23. Publishing-service SQL changes, backend migrations, credential rotation, account/provider mutations, saved-results enablement, and auth bypasses are not part of this handoff.

## References checked

- Expo environment variable usage: https://docs.expo.dev/eas/environment-variables/usage/
- Public/secret visibility: https://docs.expo.dev/eas/environment-variables/
- Pinned CLI command implementation: https://unpkg.com/eas-cli@24.6.0/build/commands/env/exec.js
- Bun on EAS: https://docs.expo.dev/guides/using-bun/
- iOS EAS build process: https://docs.expo.dev/build-reference/ios-builds/
