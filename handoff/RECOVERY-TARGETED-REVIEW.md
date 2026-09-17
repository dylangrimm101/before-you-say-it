# Targeted recovery fixes — local review only

2026-09-17. This supersedes the proposed August journey transplant, not the historical handoff receipts. No delayed authentication, layout-gate changes, new intake provider, or August source transplant was implemented. The current onboarding questions and authentication-before-navigation structure remain.

**Later correction checkpoint:** the addendum at the end supersedes this initial checkpoint's final-edit decision and BE-EDIT-01 disposition. Earlier observations and test results below are retained as history, not relabeled as current results. Release access/configuration findings are in `RELEASE-READINESS-PREFLIGHT.md`.

**Latest follow-up:** the final approval-hardening addendum records the optional changes approved after Claude's acceptance, plus fresh default-deadline checks. It does not erase the earlier timeout failures or resolve hosted release gates.

## Provenance and independent verification

- Existing branch: `codex/recovery-aug28-journey`; starting commit: `f93d42c8c01815c96b5af9b11bd926968273cf10`.
- Starting Expo tree: `3b236653484ef36e50705a09bbed1afb12f1e865`. Its 521 files match the recorded `handoff_sha256` values in `handoff/mobile-manifest.json`. The historical manifest remains unchanged; it describes the starting tree, not these fixes.
- `main` remains `e0dcdc07d816f05b341e2bb19e0100a20ab47585`.
- Findings were independently checked against source and exercised locally. Claude's full review text and build-23 device logs were not supplied; this review addresses the findings enumerated by the user, not an unseen review document.
- No private backend code or dependencies were installed, copied into this repository, or modified. Exact pinned private source was inspected read-only through GitHub, not through production endpoints.

Local review units: `97a6de7` carries the D1 diagnostics; `e00232e` carries the targeted journey/text fixes. The following evidence commit adds this note and retry-ordering regressions, with no further production edits. None was pushed.

## Fixed defects and evidence

| Area | Direct evidence before the fix | Implemented change |
| --- | --- | --- |
| Authentication diagnosis | Baseline uses the same unavailable message for null configuration and rejected sign-in. D1's regression tests failed in three cases on that implementation. | Reuse D1's stage-coded failures and configuration report, with the existing authentication and owner checks intact. |
| Custom onboarding | Mounted real-conversation onboarding calls `buildCustomScenario`; its shared implementation defaults to paid generation and fabricates an evaluation transcript. | Use the existing local `fallbackCustomScenario` constructor only for this free intake. The paid builder and onboarding structure are unchanged. |
| Cleared transcript | Mounted recording review disappears when its input is cleared because visibility depends on `pending.length`. | Explicit pending-review state remains active with empty text; submission stays disabled. Pre-submission re-record explicitly exits that state. |
| Final approval | Two calls to the same rendered callback start two conversion builds before a disabled-state render. | A synchronous ref guard admits one approval. Pre-debrief persistence failure releases the guard, cancels the incomplete build, and returns to review with a fixed, non-sensitive error. Debrief's existing request retry remains separate. |
| Final Record again | Its only action closes review; it neither clears the completed exchange nor starts another authorized recording. | Remove this final action. Keep Back, both final editable fields, and genuine pre-submission re-record. Any whole-exchange restart needs a separately reviewed server-aware task. |
| Authorized text | Mounted playback strips outer quotes. The real client transport rejects that modified string before TTS dispatch. Close/result/recovery payload construction also strips the approved counterpart text. | Keep original generated text through native free playback, close/result requests and recovery. No hash, role, phase, owner or operation authorization is relaxed. Legacy/paid display-oriented transcript behavior stays unchanged. |

The five initial screen regressions failed on the relevant baseline code, then passed after the fixes. Additional tests exercise two recording/approval/playback turns, recovered playback, setup-failure retry and unchanged final editing. These are mounted React screens with synthetic native hosts, not device acceptance.

## D1 and build-23 reconciliation

Exact D1 candidate: `d6ebd779dd0922d631b774dd64cd1f8438ced6b3`.

These production files are byte-identical to that candidate: `expo/lib/nativeAuth.ts`, `expo/lib/authConfigurationDiagnostic.ts`, `expo/lib/supabase.ts`, `expo/components/SetupDiagnosticDetails.tsx`, and `expo/app/entry.tsx`. The matching D1 tests were reused; only the five-compilation Babel test's timeout was extended to 30 seconds after its cold run took about six seconds. Assertions were not relaxed.

- `configuration/unavailable` means no selected auth client; `guest-signin/rejected` or an allowlisted provider code is a different condition. The configuration report appears only for the former.
- Diagnostics expose fixed categories, input presence, normal/staging/other identity, and bounded numeric app/build versions. They do not expose credential values, URLs, tokens, user IDs, emails, transcript content or raw exceptions. The report is a startup snapshot, not a new auth gate or automatic logger. Clipboard copying is user-initiated only.
- `handoff/testflight23-candidate.json` at D1 records build 23's nativeAuth blob as `c3ae25a9fa3575bbb3f9b7098b698b5b730d25fb` (D1 stage diagnostics) and Supabase blob as `e07a1a3bc6005a5c56edf618887403930e9ce06c` (this baseline before the expanded report).
- That receipt records a successful local JS export with expected auth inputs and a service-reported signed upload. It explicitly does **not** verify resolution on a signed iPhone, remote dotenv injection, or equivalence between the inspected export and signed artifact. Its immediate Apple readback still listed build 22. No new build-status or production query was made here.
- Build-23 dotenv/configuration changes were not copied. The reviewed environment guards, bundle/EAS identity, lockfiles and disabled OTA behavior remain unchanged.

**TF-AUTH-CONFIG-01 — UNRESOLVED.** D1 diagnoses the failure; carrying diagnostics into this baseline does not fix missing signed-build configuration or prove successful anonymous authentication. Moving authentication later would not fix it either, and was not implemented. Needed next: the installed build's safe diagnostic report plus verified build-input/artifact provenance, under separately authorized device/build checks.

## Authoritative private contract, not deployment evidence

Repository: `dylangrimm101/before-you-say-it-web`, exact handoff source pin `d0a068a1ee849144caf65811f4bf0c457056515a` (implementation predecessor `e863721be645cc187fabb021aa405b0509af13c9`). Read-only files and returned Git blob IDs:

| File under `server/server/native-free/` | Git blob |
| --- | --- |
| `routes.mjs` | `11e193e86b1d8c1a26e59e6b2e1cb7007af3f18f` |
| `generation.mjs` | `dfeaa3cfbc9e4c99b6a2c208ef1a93528c06d9d9` |
| `provenance.mjs` | `2a65d67d46456d023e36e27ad0ac19cb2cb06a39` |
| `runtime.mjs` | `a531a51a4cb545d6aef7dc5e702d63c3ad7a2528` |
| `live-transition.sql` | `067745340aa893191cfd7962a49ca93cb0040a44` |

Direct source evidence:

1. TTS requires strict equality of request text, role and turn with `state.audio`. The client independently binds exact text via its existing digest. The server normalizer collapses whitespace but does not strip surrounding quote characters; an accepted quoted line therefore demonstrates the client mismatch without inventing server normalization.
2. `prepareHostedCapture` binds the contract, first approved learner turn and exact pushback into the close proof; the result proof additionally binds the second approved learner turn and close. Hence counterpart formatting also must not be applied to protocol payloads. This is distinct from editing learner text.
3. The pinned runtime requires `BYSI_NATIVE_FREE=registered-v1`; explicit `BYSI_NATIVE_FREE_RPC=recovery-v2` selects the reviewed v2 RPC. An absent RPC selector remains legacy, and an unrecognized value is rejected.
4. The v2 SQL orders new reservations by phase: opener transcription/pushback at `start`; reply transcription/close/TTS-pushback at `pushback`; result/TTS-close at `close`. Completed same-operation retries replay before the phase check. Outstanding operations block new ones. Reservations, including failed/crashed attempts, count toward the two-per-kind limit; restart does not erase that budget.

**BE-RPC-01 — UNRESOLVED deployment dependency.** These fixes assume production has compatible routes and owner authorization; recovery additionally assumes the guarded v2 transition was installed and the explicit selector is active. Source receipts are not proof of hosted installation, RPC permissions, guest eligibility, provider configuration, budgets, proof renewal or currently deployed source. No selector, migration, spending limit or production setting was queried or changed.

Text-fidelity risk: any unwanted formatting that the server authorizes must be addressed at generation/authorization upstream, not stripped after authorization. This client fix preserves the accepted bytes; it does not promise that every accepted line has ideal spoken formatting. Role mismatches still fail closed.

**BE-EDIT-01 — UNRESOLVED contract conflict.** Against the pinned provenance implementation, changing either learner turn after the close changes the approved-exchange digest and cannot pass the unchanged result proof. This is direct source evidence, not a guessed restriction, but the deployed contract is unverified. Final editing is deliberately preserved. A product/backend decision is still needed on authorized post-generation correction/re-evaluation; do not silently discard edits, normalize proofs, regenerate responses or present the current final-edit path as production-accepted.

## Transcription retries and ordering

Direct client evidence and regression tests:

- The session journal/operation is durably written before dispatch. One queue serializes transcription, generation and TTS; the audio digest is written before queued TTS proceeds.
- A lost transport response retains the operation ID for the same capture identity; a new recording URI gets a different operation ID. An explicit `failed` response clears the failed operation so the next attempt is distinct. Tests verify this without pretending to implement the server.
- The server uses the actual audio bytes and media type for its digest, not the client's URI. Same-URI reuse is safe only for the same immutable capture; it is not authority to change bytes.
- `useDictation.stop` disposes temporary audio after transcription, including on failure. The UI's microphone retry starts a new recording; it cannot replay an already discarded capture. Existing cancellation, cleanup and same-owner-auth tests remain passing.

**STT-RETRY-01 — investigation complete; UX/protocol question remains.** No retained-audio retry or automatic resend was added. Whether to offer bounded same-capture retry before disposal requires an explicit privacy/retention and backend-limits design. No device request trace was available to attribute an observed production failure to ordering. Existing recovery gates and pending/conflict handling were preserved.

## Files and state transitions

Production files (10):

- D1 diagnostics: `expo/app/entry.tsx`, `expo/components/SetupDiagnosticDetails.tsx`, `expo/lib/nativeAuth.ts`, `expo/lib/authConfigurationDiagnostic.ts`, `expo/lib/supabase.ts`.
- Targeted journey/text fixes: `expo/app/onboarding.tsx`, `expo/app/rehearse/[id].tsx`, `expo/lib/ai.ts`, `expo/lib/normalFreeRecoveryPayload.ts`, `expo/lib/voice.ts`.

Test files (9): `nativeAuth.test.ts`, `authConfigurationDiagnostic.test.ts`, `setupDiagnosticDetails.test.ts` and its fixture, `recoveryClientFixes.test.ts` and its fixture, `normalFreeTextFidelity.test.ts` and its fixture, `normalFreeRetryOrdering.test.ts`, all under `expo/__tests__/`.

| Transition | Behavior |
| --- | --- |
| Get started → auth → current context questions | Unchanged; failure remains visible and blocks navigation. |
| Context complete → local scenario → existing practice handoff | Same auth/recovery order; no paid generation for free custom intake. |
| Recording stops → editable pending review | No automatic submission; empty edits remain in review. |
| Approve opener → pushback generation → exact authorized playback | Existing transport/operation ordering retained. |
| Approve second recording → close generation → exact authorized playback | Same; two learner turns remain the cap. |
| Completed exchange → final editable review → approve → debrief | One initial approval; final edits are retained with BE-EDIT-01 explicitly unresolved. |
| Final Record again | Removed, not represented as a server restart. |

Unchanged sensitive boundaries include `expo/app/_layout.tsx`, `expo/providers/auth.tsx`, `expo/lib/authEnvironment.ts`, SecureStore migration, normal free session/runtime, recording cleanup, environment/build guards and app/EAS configuration. No server contract changes, build/export, upload, push, merge or production-service calls were performed.

## Validation and reproduction

- Final combined run after the last fixture changes: **315 pass, 0 fail, 3,129 Bun assertions across 32 files**.
- Existing 21-file focused mobile suite: **124 pass, 0 fail, 1,871 Bun assertions**.
- Additional 11-file targeted suite: **191 pass, 0 fail, 1,258 Bun assertions** (mounted fixtures also use Node assertions).
- TypeScript: exit 0. Canonical `bun run check`: exit 0, with the same four inherited Expo lint warnings (two import-order warnings and two `OriginalFollowThrough` hook warnings).
- Baseline gate logs: local ignored `handoff-local-results/1789646511681120000/`; `results.json` contains command and log hashes. These are targeted checks, not the full historical/private-composed suite or installed-device/provider acceptance.
- Runtime remains isolated Bun `1.4.2+744846f84`; app `bun.lock` SHA-256 remains `ace5c55f08b8a7e6971d0ef1ed01c468bdd8b7eade6732e127642033a38928b9`. Test renderer dependencies were installed from the existing exact test lockfile to an external user-local prefix, sharing the app's React 19.1.0. Global tools and repository dependency manifests were not changed.
- All test/check processes were run with macOS sandbox network denial. Dependency download and read-only GitHub source access were separate from test execution. No backend dependency setup or composed backend execution was performed.

To reproduce: use the isolated Bun directory on PATH; run `python3 handoff/check.py` without `--install` or `--private-source`. For the additional tests, set `BYSI_COMPONENT_TEST_DEPS` to the prepared external renderer prefix and run `bun test --no-env-file` on these files: `normalFreeTextFidelity`, `recoveryClientFixes`, `normalFreeRetryOrdering`, `authConfigurationDiagnostic`, `setupDiagnosticDetails`, `rehearsal`, `speech`, `freeJourney`, `personas`, `secureSessionStorage`, `ownerVoiceCache` (each `__tests__/<name>.test.ts` from `expo/`). Scrub provider/auth environment variables; set `EXPO_NO_DOTENV=1`, `EXPO_NO_TELEMETRY=1`, `EXPO_OFFLINE=1`, `CI=1`; retain network denial. Do not run the historical full suite expecting absent private backend dependencies to work.

Local completion means reviewable source fixes and passing offline checks, not TestFlight readiness. Authentication configuration, deployed backend compatibility, final-edit semantics, physical recording and audible playback remain separate acceptance gates.

## Correction addendum — 2026-09-17, after reviewed `291f5e4`

The requested starting SHA was confirmed as `291f5e4deed39729fa8f64c605ab8fb8c0a975fd`, with a clean worktree on `codex/recovery-aug28-journey`. The current attachment contained the user's correction request, but no separate full independent review; its findings were independently checked against source, mounted regressions and freshly retrieved pinned backend provenance.

### Local review units

- `544106c2d51719679c02e7d6441634207cb1b410` — separate approval-setup errors from counterpart errors; read-only protected final review and exact stored debrief exchange; mounted regressions. Only production change: `expo/app/rehearse/[id].tsx`. Tests: `recoveryClientFixes.test.ts` and `.fixture.ts`.
- `6a8ddfd2192f331f20706da412c0b6a9036a944a` — quoted/whitespace TTS fidelity variants, explicitly client invariants; only `normalFreeTextFidelity.test.ts` and `.fixture.ts`.
- Final code/test SHA: **`6a8ddfd2192f331f20706da412c0b6a9036a944a`**; Expo tree **`899d6d16d0bb167a01ed5ccde1dfa90f4854c600`**. The following handoff-only commit does not change this tree; its final repository SHA is recorded in the delivery message.

Claude's correction-only review range: `git diff 291f5e4deed39729fa8f64c605ab8fb8c0a975fd..6a8ddfd2192f331f20706da412c0b6a9036a944a -- expo/`. Do not include earlier D1/journey commits in this correction review.

### Verified findings and scope

1. **Approval Back defect fixed.** An initial persistence/setup rejection formerly wrote the generic counterpart `error`; Back then selected the “Response unavailable” dock. A dedicated `approvalError` is cleared on approval retry and Back. Genuine counterpart errors are neither cleared nor hidden. Mounted tests reproduce failure → Back → complete-transcript review, no “Back to today”, reopen without stale setup text, and successful retry dispatch.
2. **BE-EDIT-01 source conflict resolved for protected normal free.** The re-read `provenance.mjs` blob `2a65d67d46456d023e36e27ad0ac19cb2cb06a39` verifies an HMAC over the already approved exchange. Final editing cannot preserve that proof. Protected review now shows stored learner turns as selectable text, gives the requested explanation, and passes `turns` unchanged rather than reconstructing them from drafts. No normalization, proof bypass, regeneration or restart was added. Hosted compatibility remains BE-RPC-01, not a claim of deployed acceptance.
3. **Applicability was traced, not inferred from a name.** `normalFreeRuntime.ts` exports `normalFreeRecoveryEnabled=!!transport`, where transport requires the normal origin, selected non-staging Supabase client/environment and `createNormalFreeSession` validation. This is not `BYSI_NATIVE_FREE_RPC`. In this screen, `recoveryRequired` additionally requires `entry=onboarding`. `RehearseRoute` routes non-onboarding known scenarios to the separate paid component; free debrief generation selects `requestNormalFree` under the normal origin/non-staging configuration. Missing transport under a malformed normal setup fails closed; it is not a supported alternate authenticated final-edit path. The proof requirement is independent of legacy/v2 RPC selection. The separate staging transport and unrelated paid flow were not changed or declared backend-accepted here.
4. **Editing preserved at its authorized point.** Mounted tests edit both learner transcripts before their respective submissions, retain those words through both responses/playback points, then verify exact debrief turns. Legacy final-edit coverage still exercises both editable fields and corrected text. Protected synthetic whitespace additionally proves final approval does not trim/reconstruct the stored exchange.
5. **Text-fidelity evidence bounded.** Quoted and whitespace variants use the real client AI/normal-free/TTS path with synthetic authorized server responses and fake playback. The pinned producer normalizes whitespace; the whitespace variant verifies a client boundary invariant, not that a deployed server emits those bytes or that a phone audibly played them.

The first correction regression run before the production edit was **9 pass / 3 fail** across the 12 screen/text tests; approval Back, read-only final review and protected final-review controls failed. After the fix, the same group passed **12/12**. A subsequent fixture strengthening also checks editing the second learner transcript; final suite evidence is recorded below.

No delayed Auth, layout-gate or intake-provider change, historical transplant, same-capture retry, final Record Again, or promise of a new server-authorized rehearsal was added. D1 diagnostic files, owner isolation, SecureStore, recording/audio infrastructure, operation ordering, environment guards, bundle/project identity and disabled TestFlight OTA remain unchanged.

### Newly run checks and retained failures

All execution used isolated Bun `1.4.2+744846f84`, the existing locked dependencies, the external renderer prefix, scrubbed service environment and macOS network denial. No new dependency installation, backend setup or provider call occurred. `expo/bun.lock` still hashes to `ace5c55f08b8a7e6971d0ef1ed01c468bdd8b7eade6732e127642033a38928b9`.

- Initial concurrent default-timeout runs: combined **316 pass / 3 fail / 2 between-test errors**, 3,089 Bun assertions across 319 tests/32 files; focused **121 pass / 3 fail / 2 errors**, 1,793 assertions. Focused log: `handoff-local-results/1789652339026814000/standalone-mobile.log`, SHA-256 `aae8a377210191db00d811ab183397654faab59537c029a047a19860bda1cf41`. The combined output is retained in the task transcript. The initial wrapper ended without recording canonical-check completion; do not treat its printed lint output as an exit-code receipt.
- Sequential unmodified `handoff/check.py`: focused **121 pass / 3 fail / 2 errors**, 1,857 assertions; **TypeScript exit 0; canonical `bun run check` exit 0**, four inherited warnings, no errors. Receipts: `handoff-local-results/1789652606514760000/results.json`. Focused log SHA-256 `65323a8481a8d2c7b1d553990731ead88ce23c57f54e03a4926b6888df22bd27`; empty TypeScript log `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`; canonical log `2d3dfbee6785ee3179b4e88014a1f2030eebc72c8eae69ee46b2066f845f7723`.
- Failure boundary: unchanged `bundledApprovedDeckOffline.test.ts` exceeded Bun's default five-second deadline in “bundled lessons preserve authorized review…” and “native reads only the requested packaged asset…”. Still-running async work then encountered another test's modified manifest/read counters, causing between-test errors and the Android URI assertion failure. This is directly supported by the stacks/shared fixture state; host contention may exacerbate duration but was not proved as the sole cause. Neither that suite nor its loader was edited.

These default commands are **not green**; a longer-deadline diagnostic run does not erase them. No assertions, test fixtures in that suite, application timing, canonical gate script or timeout declarations were weakened. Final sequential diagnostic/targeted results are recorded below.

| Newly run final command group | Result | Log SHA-256 |
| --- | --- | --- |
| Additional 11-file targeted suite, ordinary declared deadlines | **195 pass, 0 fail; 1,262 Bun assertions** | `4d9847d6b446ce0d4d7d2c5b4eb8016a46cc90cf54938aadc533aecdb76b9400` |
| Existing 21-file focused suite, diagnostic CLI `--timeout 30000` | **124 pass, 0 fail; 1,871 assertions** | `1e9a22248a5c23fcc7618d8f84299533cafe11cd4473f3dac4dd1aae108cbf91` |
| Combined 32-file suite, diagnostic CLI `--timeout 30000` | **319 pass, 0 fail; 3,133 assertions** | `3b6fe28f790d5ccddbdedaa90127f4d6df3530ee888eb5b8e3770f234adf1c6b` |

These three runs were sequential, on the final code/test tree, with no test/check assertions changed between the failed default runs and passing diagnostic runs. Exact commands, timings, counts and hashes are in ignored local `handoff-local-results/correction-sequential-lrZjxp/results.json`; logs are `targeted-default.log`, `focused-timeout30s.log`, and `combined-timeout30s.log`. Mounted fixtures additionally use Node assertions not counted by Bun. TypeScript and canonical lint above ran on the same final code/test content; only handoff documents changed afterward. No full private-composed/backend or native/device suite was executed.

### Remaining gates

No additional defect was identified in the corrected approval/final-review scope. The existing default-timeout offline-deck test instability remains a validation issue, not a reason to mask assertions. TF-AUTH-CONFIG-01, BE-RPC-01 and on-device acceptance remain unresolved. STT-RETRY-01 remains an explicitly deferred UX/protocol design; no retained-capture retry was implemented.

See `RELEASE-READINESS-PREFLIGHT.md` for verified source configuration, inaccessible hosted settings, historical deployment boundaries, required access, build-number prerequisite and the exact approval-gated candidate procedure. `main` remains `e0dcdc07d816f05b341e2bb19e0100a20ab47585`; nothing was pushed or merged.

## Approval-hardening addendum — 2026-09-17

User-approved follow-up after Claude accepted the earlier correction diff. Starting branch `codex/recovery-aug28-journey` was clean at `f95b8031c94e28931d7e0c74f65843468b134041`; `main` remained unchanged. Read-only release checks were attempted first; no newly authenticated access was available. The separate staging investigation and exact evidence gaps are recorded in the preflight follow-up.

### Reviewable change

Code/test commit: **`a6a2d894d0bc08719b19d54119157a3a757a1fe9`**. Expo tree: **`6fc40846a4d1913127ff27673a4e17eec17fa496`**. Review only `git diff f95b8031c94e28931d7e0c74f65843468b134041..a6a2d894d0bc08719b19d54119157a3a757a1fe9 -- expo/`. The subsequent evidence-only commit leaves that Expo tree unchanged; its repository SHA is recorded in the delivery message.

Only production file: `expo/app/rehearse/[id].tsx`. Only test files: `expo/__tests__/recoveryClientFixes.test.ts` and `.fixture.ts`.

1. **Unexpected setup rejection releases approval.** Missing scenario or an invalid learner-turn count now rejects analysis setup instead of returning silently. The existing approval catch releases the synchronous guard, restores review and shows the fixed approval error before any conversion build, persistence or generation dispatch. This hardens a currently unreachable normal-flow condition; it is not a newly discovered user-facing failure.
2. **Protected approval validates stored words.** A shared predicate used by both button disabled state and its callback requires exactly two nonblank stored learner turns for read-only final review. It does not depend on edit drafts. Trimming is only a nonblank check: the approved exchange is still submitted unchanged. Editable legacy review continues to validate and apply its drafts; per-turn editing is unchanged.

### Regression evidence

- A deliberately invalid three-learner-turn fixture verifies two consecutive failed approvals each restore review and enter cancellation/error handling, proving the guard is released and no build/navigation/generation starts. This is a defensive invariant test, not evidence the ordinary UI creates a third turn.
- Test-only draft-state fault injection verifies valid stored words can be approved with empty drafts, and blank stored words cannot be approved using non-empty stale drafts, including direct callback invocation. The fixture identifies the opening/response state shape rather than relying on hook indices, forwards all other React hooks, and adds no production test hook.
- Legacy blank draft disables approval; correcting it allows approval with the edited words. Prior tests still cover duplicate taps, setup retry/Back, both editable pre-submission turns, exact final exchange, independent counterpart errors and both playback points.
- Before the production change: **11 pass / 3 fail** in the 14 mounted cases. Failures were the invalid-count recovery and the two protected draft-drift cases. Log: `handoff-local-results/approval-hardening-red-kqMxPt/tests.log`, SHA-256 `d8a587815f2c8f334e713426739affa1381b619131b0ebc697220feae5109867`. The unchanged assertions then passed **14/14** after implementation.

### Fresh final gates — all ordinary deadlines

| Gate | Result | Log SHA-256 |
| --- | --- | --- |
| Existing 21-file focused mobile suite | **124 pass, 0 fail; 1,871 Bun assertions** | `274fa81b253b9d93c9e9d125c27af75cd46751ed1ea3755f9d3237713e1dcd6f` |
| Expanded 11-file targeted suite | **199 pass, 0 fail; 1,266 assertions** | `3379677e6103651a7436bc48d70cbb922eb36f8d0165e334874844b41b111d96` |
| Combined 32-file suite | **323 pass, 0 fail; 3,137 assertions** | `a02f690bc7c16759891d8515145fa9eaac637823e0bf751ea94794a50dec6deb` |
| TypeScript `tsc --noEmit` | **exit 0** | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` |
| Canonical `bun run check` | **exit 0, same four inherited warnings; no errors** | `2d3dfbee6785ee3179b4e88014a1f2030eebc72c8eae69ee46b2066f845f7723` |

Exact commands, counts, durations and hashes: ignored local `handoff-local-results/approval-hardening-final-MTKdu3/results.json`. All groups ran sequentially under network denial, the existing isolated Bun 1.4.2, the existing locked dependencies and external renderer prefix, with service environment scrubbed. No timeout override was needed or used in these final runs. Assertions and existing deadline declarations were not weakened. The earlier default-timeout failures are preserved above; they did not reproduce in this follow-up, which does not independently establish their root cause. No private-composed/backend or physical-device acceptance is claimed.

### Boundaries and remaining work

No staging behavior, authentication timing, provider, intake, layout, backend, recording retention, transport/recovery ordering, SecureStore, owner isolation, D1 diagnostics, app/build identity, environment guard or OTA behavior changed. No tool/dependency installation occurred. The app lockfile and main branch remain unchanged.

Read-only hosted preflight is still access-blocked; **TF-AUTH-CONFIG-01 and BE-RPC-01 remain unresolved**. **STAGING-EDIT-01** is separately tracked as an unconfirmed compatibility risk requiring missing staging handler/provenance and deployment evidence, not a reason to impose a blanket editing restriction. The used build number and physical iPhone checks remain release prerequisites. These two client hardenings do not fix TestFlight Auth configuration. No push, merge, production setting change, migration, build, export, upload, submission or OTA occurred.
