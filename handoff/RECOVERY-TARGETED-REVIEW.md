# Targeted recovery fixes — local review only

2026-09-17. This supersedes the proposed August journey transplant, not the historical handoff receipts. No delayed authentication, layout-gate changes, new intake provider, or August source transplant was implemented. The current onboarding questions and authentication-before-navigation structure remain.

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
