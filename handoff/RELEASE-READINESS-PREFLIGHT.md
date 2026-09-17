# Recovery release preflight — 2026-09-17

**Source-review checkpoint, not permission to build or release.** See the correction addendum in `RECOVERY-TARGETED-REVIEW.md` for commits and newly executed checks. No build, export, upload, submission, OTA, production configuration change, migration, user creation, recording, or provider request was performed.

## Release configuration: verified in this checkout

| Item | Effective selection / finding |
| --- | --- |
| Profile | `testflight`, extending `production`; store distribution, physical iOS, Release, development client false |
| EAS environment | Explicit `production`; not inferred from channel or distribution |
| Channel / OTA | `testflight`; `app.config.ts` forces `updates.enabled=false` for this profile |
| Bundle | `app.rork.8fc4qwsqaurkxk0pimyvx` |
| EAS owner / slug | `dgrim101` / `8fc4qwsqaurkxk0pimyvx` |
| EAS project | `1b655360-557d-4dba-ad69-fbf26120e852` |
| App version / local iOS build | `1.0.0` / `19` |
| Numbering policy | `appVersionSource=local`; profile `autoIncrement=false` overrides parent's true; `requireCommit=true` |
| CLI declaration | `>=16.0.0`, not an exact EAS CLI pin; no CLI was installed in this task |

**Build-number prerequisite fails as-is:** 19 is already historically uploaded. Confirm the highest build in App Store Connect, then approve an unused number above it in `expo/app.json`. Do not assume 24 is unused: the build-23 receipt is incomplete historical evidence, not a current inventory. No version was changed here.

### Required public inputs and actual visibility

Presence of an input in source is not presence in EAS, nor proof it reached a signed binary.

| Name | Source requirement/category | Profile literal | Selected EAS production environment |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Exact normal Auth origin pin | Present | Inaccessible |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public client key; guard requires `sb_publishable_…`, never service-role | Absent | Inaccessible |
| `EXPO_PUBLIC_NATIVE_BILLING_ORIGIN` | Exact production API origin for native free/paid | Present | Inaccessible |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | Public App Store SDK key; guard requires `appl_…` | Absent | Inaccessible |
| `EXPO_PUBLIC_NATIVE_RESULTS` | Optional, default off; only `normal-results-v1` accepted | Absent | Inaccessible |

All four required inputs were absent from this task's inherited shell. No root/app `.env*` file was found. This is **not** evidence they are missing remotely. Remote project-level and account-level production variable presence, visibility and precedence still require readback. Report only names, present/absent, visibility, expected-prefix/pin match and override categories; never output values.

`EXPO_NO_DOTENV=1` is explicitly set in the profile: implicit `.env` loading is disabled, not Expo's static public-variable inlining. EAS must supply values into the build/config process. `supabase.ts` uses static dotted `process.env.EXPO_PUBLIC_…` references, which Expo/Babel can inline. Variables needed during local app-config resolution must be available there; EAS **secret** visibility cannot be read outside EAS servers. These public client inputs should use an appropriate plaintext/sensitive visibility, not secret-only visibility that prevents config resolution. Check `EXPO_NO_CLIENT_ENV_VARS` is not disabling inlining. An ignored dotenv file is not the remedy. [Expo environment usage](https://docs.expo.dev/eas/environment-variables/usage/), [Expo bundling rules](https://docs.expo.dev/guides/environment-variables/).

The current guard rejects truthy `EXPO_PUBLIC_BYSI_BUILD_MODE`, staging variables, Test Store keys, and extra public inputs/legacy endpoint overrides for normal TestFlight. The normal profile itself sets none of these. The task shell also contained none; remote absence is **unverified**. At runtime, a truthy unknown mode or staging native identity can cause `selectAuthEnvironment` to return null even with production credentials present. Keep identity/build-mode mismatches distinct from missing inputs.

## Authentication: unresolved release gate

**TF-AUTH-CONFIG-01 remains unresolved.** `configuration/unavailable` means no selected auth client. Missing/blank inputs and rejected environment selection remain possible until safe startup diagnostics and artifact/input evidence distinguish them. A server rejecting anonymous sign-in is a different stage (`guest-signin`), with allowlisted codes such as `anonymous_provider_disabled` or `captcha_failed`.

The app calls `signInAnonymously()` without a CAPTCHA token. Hosted anonymous sign-ins and new-user signups must be allowed; CAPTCHA requirements, Auth hooks and rate policies must be compatible with this client. If the hosted policy requires a CAPTCHA token, the current client lacks that integration: do not silently disable a security control. Source cannot establish current hosted settings. [Supabase anonymous sign-ins](https://supabase.com/docs/guides/auth/auth-anonymous), [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

Exact D1 diagnostics remain reused, with no competing implementation or delayed-auth workaround. No new build-23 phone logs or signed artifact were available. Its source receipt, local export and reported upload do not independently bind inspected JavaScript to the signed installed binary. Obtain safe diagnostics from the next candidate rather than waiting indefinitely for unavailable old artifacts.

## Backend: contract verified; present deployment inaccessible

Pinned private source: `dylangrimm101/before-you-say-it-web` at `d0a068a1ee849144caf65811f4bf0c457056515a`. Existing GitHub access permitted read-only inspection. No backend files/dependencies were copied into the mobile repository.

- `server/server/native-free/provenance.mjs`, Git blob `2a65d67d46456d023e36e27ad0ac19cb2cb06a39`, was freshly re-read. Result proof binds the contract, both approved learner turns and counterpart responses. Read-only final review resolves the source-level editing conflict without relaxing proofs. This check is not conditional on the v2 RPC selector.
- The source uses authenticated owner verification, `/api/native/free/*`, exact text/role authorization, ordered reservations, recovery/restart, and server proof/checkpoint authority. `BYSI_NATIVE_FREE=registered-v1` and explicit `BYSI_NATIVE_FREE_RPC=recovery-v2` are required for the reviewed recovery path; a flag alone does not prove its SQL installation or permissions.
- Current deployment must be linked by an authenticated alias/deployment readback **and deployed file UID/hash comparison**, not a guessed Git SHA. Then verify the guarded v2 transition, least-privilege role grants, TLS trust, proof-key continuity, eligible guest ownership and configured provider/budget dependencies. The reviewed transition SHA-256 is `2ce83dc7fb6af92c2e852ceaafcc5cb3f9408246d2561268dabc4f6500f4dcdb`.
- Names/categories to inspect include `BYSI_NATIVE_FREE`, `BYSI_NATIVE_FREE_RPC`, native origin/Auth/publishable-key pins, service database/TLS configuration, `BYSI_NATIVE_FREE_PROVENANCE_KEY`, a positive explicit `BYSI_NATIVE_FREE_DAILY_SPEND_CENTS`, the exact seven-key positive `BYSI_NATIVE_FREE_PROVIDER_COST_CENTS` configuration, and transcription/generation/TTS provider and voice configuration. Do not print secrets or send provider probes. Free ownership verification is separate from paid entitlement; do not infer a need to change the paid service selector.
- Saved-result opt-in and whole-account deletion remain separate/deferred capabilities. Do not enable them to complete this bounded free journey.

### Historical evidence, not fresh live verification

Read at the exact private pin:

| Record | Blob / evidence boundary |
| --- | --- |
| `review/DEPLOYED_VERSIONS_AND_TIMELINE.md` | `c82bec6ff50f662ad62b26360f92588d45bde5be`; September 15 authenticated readbacks and retained build-19 IPA inspection |
| `PRODUCTION_ROLLOUT_PROPOSAL.md` | `f079090957fb063dfc823e156e42330f60655f8b`; proposal only, explicitly not execution approval |
| `review/CONFIGURATION.md` | `b0b406113e74bd8018b052d87e4914a19d993055`; names/purposes, not actual hosted values |

The historical deployment was `dpl_D8FQnmr3YtZpyyj5agc4FmiYfWHQ`, READY/production, with 157 source files identified by deployed manifests; no web Git SHA was returned. The rollout proposal records the September 16 source inspection `inspection-20260916T022110Z-0237db7b` and production-only website files that must not be overwritten by a wholesale backend deploy. Neither document proves the reviewed pin is the deployment currently serving production.

The timeline independently recorded build 19 and disabled OTA in its retained signed IPA on September 15. It predates build-23 evidence; it is not today's latest-build inventory. It also records a historical `reservation / 409 / phase` transcription refusal before provider dispatch. That is not evidence of missing audio, an Auth configuration failure, or current tester eligibility. Current GitHub combined status for the pinned commit had no statuses; that is neither deployment proof nor proof of nondeployment.

**BE-RPC-01 remains unresolved.** No fresh hosted alias/source, migration/catalog, grants, provider configuration or guest eligibility readback was possible. Do not treat passing synthetic/offline tests as hosted acceptance. A missing hosted prerequisite requires a separate, explicit backend/configuration change approval.

## Access needed (normal sign-in only)

| Service | Observed access / exact next step |
| --- | --- |
| Expo/EAS | Project environment page redirected to Expo login. Sign in to an account with access to owner `dgrim101`, project `1b655360-557d-4dba-ad69-fbf26120e852`; inspect both project and account **production** variables, presence/visibility only, and release build records. |
| Supabase | Auth settings page redirected to sign-in. Sign in with read access to project `spvksnddzyvycfoefrcf`; inspect Authentication signup/anonymous/CAPTCHA/hook/rate settings. An authorized read-only SQL/catalog connection is separately needed for v2 installation and role evidence. |
| Vercel | Dashboard redirected to login. Sign in with access to project `prj_g5ArX4CdKmZZRfMYg54OpRshp5AY`, team `team_4TFgO2vZCij86BdSdMuKMcFv`; read apex alias/deployment and deployed source identities, plus production variable presence/categories. |
| App Store Connect | App TestFlight URL redirected to login. Sign in to the owning Apple team with access to app `6811494369`; read highest uploaded build, version and processing state. |

No normally configured EAS/Supabase/Vercel CLI or relevant token was available in the task environment. No credentials were extracted from unrelated apps. GitHub directory metadata once returned temporary signed download links in tool output; they were not used or included in these handoff files, and subsequent directory output was filtered to names/hashes. No raw credential or private operational-log collection was attempted.

## Concrete next candidate, only after approval

1. Claude reviews only the correction code/test diff identified in the evidence addendum. Resolve the separately documented default-timeout test instability or explicitly accept its diagnostic evidence; do not silently relabel failed commands as passes.
2. Complete the four access/readback gates above. Approve only necessary EAS public-input visibility/presence/override corrections and an unused iOS build number; no authentication relocation. Any hosted Auth/CAPTCHA or backend deployment/migration mismatch requires its own scoped approval before this client can be accepted.
3. On a clean, reviewed, committed candidate with locked Expo dependencies and an approved EAS CLI satisfying the checkout's constraint, explicitly approve **one** build from `expo/`: `eas build --platform ios --profile testflight`. Do not add `--auto-submit`. This command was **not** run. Submission/upload to App Store Connect remains a separate approval step after inspecting the build; EAS building itself uploads source, so also requires the next authorization.
4. Bind EAS profile/environment/commit receipt to the exact downloaded signed artifact hash. Inspect signed identity, version/build, embedded OTA disabled state and public-input presence/categories without exposing values. A receipt or separate local export alone is insufficient. Then approve submission of that exact candidate, never an ambiguous `--latest` artifact.

## iPhone acceptance (not run)

- Confirm installed version/build and artifact correspondence. Capture only safe startup diagnostic categories if setup fails; separate configuration selection from rejected guest sign-in. Never log tokens, owner IDs or conversations.
- Get Started uses the existing authenticated onboarding structure; all current context questions lead to the intended local scenario, without a paid-generation detour.
- First recording stops into editable review; clearing text retains review and disables approval. Edit and approve once; verify first Hope response and **audible** matching playback.
- Second recording likewise permits correction before approval; verify the second Hope response and **audible** matching playback. Check interruption/permission errors do not invent a successful turn.
- Final review shows the two approved learner lines read-only with the explanation; no final Record Again or unsupported restart promise. Back returns to complete review availability. Repeated approval taps must not create duplicate initial work.
- Approve the exact stored exchange into a debrief; verify the displayed result matches it. Exercise approval-setup failure/Back and genuine counterpart failure separately in an authorized fixture/test environment.
- Separately verify retained-session/cold-resume and owner-isolated recovery without deleting journals, resetting allowance, creating replacement identities or making production configuration changes as a troubleshooting shortcut.

**Decision:** reviewable client corrections are not release readiness. TestFlight Auth configuration, hosted backend compatibility and physical recording/playback/debrief acceptance remain open gates.

## Follow-up after Claude acceptance — 2026-09-17

The user supplied Claude's acceptance of `291f5e4..6a8ddfd`, including reported passing default-deadline checks. Those are independent reviewer results, not a replacement for the retained earlier failures. Two optional approval hardenings are now tracked in the latest addendum to `RECOVERY-TARGETED-REVIEW.md`; neither is an authentication fix or authorization to build.

**Read-only access recheck:** the checkout was still clean at `f95b8031c94e28931d7e0c74f65843468b134041` before edits. No EAS/Supabase/Vercel executable or relevant token was available; required public inputs were still absent locally. Expo again redirected the project environment page to login. Supabase browser inspection and opening Vercel timed out without a usable settings readback; no Apple build inventory was freshly obtained. These failures establish no new fact about remote configuration. The normal sign-in/access steps above remain required, as do TF-AUTH-CONFIG-01, BE-RPC-01, build-number and device gates. No credential search in unrelated apps, new tool installation or production mutation was attempted.

### Staging final editing — investigation only

- Verified client facts: staging free generation dispatches through `requestFreeBysiGeneration`, not the normal native-free runtime. `createFreeAcquisitionTransport` requires `developmentBuild=true`, staging Auth, the exact staging Auth origin and an explicit matching free endpoint. It is development-only even before normal TestFlight's staging-input rejection. Protected final-review selection still excludes this flow; it was not changed.
- The local `freeAcquisition.test.ts` contains an assertion rejecting a forged **counterpart pushback before close**. That is evidence of intended exchange authorization, not a direct test of editing a learner line after the close. Its harness imports `web-signup/hosted-provenance.mjs` and `web-signup/handler.mjs` from an external private checkout; both referenced files are unavailable locally.
- Normally configured GitHub access worked, but the exact private pin `d0a068a1ee849144caf65811f4bf0c457056515a` does not contain those files at `server/server/web-signup/`. Read-only directory listing (tree `5a95f64e242061de73e2e8f610e090c01e9072eb`) contains only `paid-capability.mjs`. The known native-free provenance is not a substitute for the absent staging implementation. No backend code/dependencies were copied or installed and the dependency-incomplete staging integration suite was not represented as runnable or passing.
- **STAGING-EDIT-01 remains an unconfirmed compatibility risk.** Need the exact staging handler/provenance source and its deployment identity, then a disconnected contract test of post-close learner edits. Only after that evidence should a separately scoped staging change be selected. Do not generalize the normal native-free read-only restriction to all legacy flows or claim that staging final editing is supported.

Build profile, number, identity, environment guards, Auth/storage, transport and staging configuration remain unchanged. No build/export/upload/submission or production setting change occurred in this follow-up.
