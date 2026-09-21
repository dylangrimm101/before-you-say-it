# Spoken-first release acceptance

Speaking is the primary journey. Typing is a separately tested fallback, never a
substitute for any gate below. An automated pass must not be described as a
verified iPhone experience.

Consolidated source/native-simulator/TestFlight status and added coverage:
[NATIVE-ACCEPTANCE-MATRIX.md](NATIVE-ACCEPTANCE-MATRIX.md). This matrix supplements
the requirements below and preserves historical evidence; simulator execution
does not replace physical-device acceptance.

## 1. Automated gate — before an authorized TestFlight candidate

Record the exact candidate commit (or explicitly label an uncommitted working-tree
result), build number, test commands, results and known limitations.

From `expo/`, with the checkout's pinned Bun and locked dependencies:

```sh
# Set BYSI_COMPONENT_TEST_DEPS and BYSI_GUEST_BACKEND to the existing,
# pinned external fixtures. Run in the established network-denied environment.
bun run test:release
```

Run the applicable broader mobile and joined backend regression suites as well.
Do not silently install different dependencies, weaken assertions, or count a
missing/private-backend harness as a pass.

The command verifies test dependencies, the gate's own fail-fast tests, spoken
regressions, joined backend/SQL journeys and canonical TypeScript/lint. It records
the starting source fingerprint/build and fails if Expo source changes during
the run. It installs nothing, calls no build/deploy command, and does not claim
provider or device acceptance. Network denial must be supplied by the caller.
Use `RELEASE-EVIDENCE-TEMPLATE.md` for source/artifact binding and the three separate
acceptance layers. Keep the reported bug's before/after reproduction receipts.

The mounted spoken tests must use the screen's Record and Stop handlers for BOTH
learner turns, verify explicit transcript approval, both Hope playback callbacks,
and final approval into debrief across all three tracks. They must also verify
that a rejected continuation cannot leave recording active behind an error screen.
Recorder/player hardware and provider responses are simulated. Separate native
audio-byte/playback tests and joined transport tests complement this coverage;
none establishes physical-device success.

### Native event and rendering boundary

- The release gate must run the mounted result-card regression. Dispatch layout
  callbacks in one React batch and release each event (`nativeEvent = null`)
  immediately afterward, before deferred state updates flush. Never use only
  permanently live event objects. Copy measurements synchronously in production.
- Verify measured long-card pinning, CTA reachability and reduced-motion access.
  Passing navigation assertions without exercising layout is not native screen
  rendering coverage. Inspect other event-based deferred updates when relevant.
- Preserve a failing-before/passing-after regression for each reproduced crash.
  A local reproduction establishes a defect, not the exact phone incident's cause
  without matching crash evidence. Capture build/time and available Apple report.
- State what the tools actually exercised. Code, mocked components and accessible
  crash reports can reveal native defects, but do not substitute for operating the
  installed iPhone app. Do not label those tests physical-device end-to-end tests.

For voice-failure fixes, inject second-response TTS failure and press BOTH recovery
paths in separate runs on every track: Keep reading through explicit transcript
approval/debrief, and Try voice again through playback/review/debrief. Include a
native cleanup exception; an always-idle mocked speech hook cannot cover this.
Run Unicode text through the checkout's locked `whatwg-fetch` Response/Headers,
not just Bun/Node Response: curly quotes, em dashes, and multibyte characters must
survive generation, TTS authorization, recovery and final-result payloads exactly.
Keep binary audio byte assertions and wrong-text/role/stale-turn rejection checks.

Passing this gate establishes automated coverage only, not real-provider or
release acceptance. Complete gate 2 before claiming provider readiness.
Building/uploading still requires user authorization. A new
TestFlight candidate may be needed to carry out gate 3; label it unverified until
those observations are complete.

## 2. Real-provider candidate gate — no preselected successful replies

Required for changes affecting onboarding, rehearsal generation, transport,
validation, recovery, playback, or result generation. Get authorization for
bounded live provider usage first. Without access/approval, mark this gate pending;
do not replace it with mocks or describe the release as fully verified.

- Pin the mobile source/build, backend source manifest and configuration source.
  Use an isolated database and synthetic conversations, never copied customer
  content. Keep real provider credentials in the backend process, out of Expo,
  reports, logs, and source control. Declare request/spend bounds and stop on them.
- Complete each entry track through both real AI responses, both real audio
  generations, approved final transcript and structured debrief. Decode the audio;
  distinguish decodability from audible playback. Include the reported context and
  varied natural wording, not only strings selected to satisfy validation regexes.
- Record each step's status, failed stage, bounded diagnostic category, actual
  request counts, and repairs/retries. Do not hide a failure by rerunning until green.
- Label the environment precisely: local candidate with real providers is not
  hosted Vercel, production Auth/SQL, physical recording, or iPhone playback.
  List tested track/context combinations and limits; three routes in one context
  do not cover every scenario. Never infer the old incident's cause from a pass.
- For future rehearsals, retain reusable live-check tools in the private backend
  test environment with pinned inputs and content-free receipts. Never put backend
  credentials or private backend code in this mobile repository.

## 3. Real-iPhone gate — on the exact installed candidate

Record installed version/build, source/artifact binding, iPhone model, iOS version,
tester, date/time with timezone, network, selected track and context. Do not collect
credentials, account identifiers or conversation content. Use synthetic spoken
phrases and content-free observations; a screen recording is optional and requires
the tester's consent.

Complete this flow independently for EACH track:

| Track | Installed build | Date/tester | Result / issue |
| --- | --- | --- | --- |
| A conversation I need to prepare for | Not tested | — | Pending |
| The same communication problem keeps happening | Not tested | — | Pending |
| I know what I want to get better at | Not tested | — | Pending |

1. Get Started → select track → answer all context questions → enter rehearsal.
2. Tap Record, **speak aloud**, and Stop. Verify editable transcription; clear it
   once to confirm approval stays disabled, then restore/edit and explicitly approve.
3. Hear Hope's first response from the phone. Observe text appearance relative to
   actual audible playback, not just a spinner or playback callback. Note noticeable
   text/audio lag; do not claim word-level synchronization from callback tests.
4. After Hope finishes, tap Record again, **speak the reply aloud**, and Stop.
   Verify the screen stays in the rehearsal, capture works, and transcript editing
   and explicit approval work. Do not switch to typing to get through this step.
5. Hear Hope's second response and check matching text/audio presentation.
6. Review the full exchange, approve once, and reach debrief without duplicate work.
7. Continue through “See what changes with practice” → “See the practice plan”.
   Verify the card screen renders without termination; scroll the entire evidence
   card and overlapping plan card, then press “See my practice plan”.
8. Complete the offer/account flow through an explicitly authorized Apple sandbox
   purchase, success and first-practice navigation. Record actual versus simulated
   purchase separately; no purchase authorization is granted by this checklist.
9. Leave and start another rehearsal; confirm no stale conversation blocks entry.

Also test microphone permission denial/recovery, brief background/foreground,
leaving while recording, and stopping Hope's playback. Verify the microphone is
released on exit or blocking failure. Do not reset device storage, rotate an auth
identity, alter quotas or change production settings to manufacture a pass.

If any step fails, record build, track, step, timestamp, visible support code (if
present), and microphone-indicator state. Mark that track failed—not passed because
a typed or API-only alternative works. Preserve completed observations separately
from untested steps. After a fix, repeat the failed case AND all three spoken tracks
on the new candidate.

## Acceptance wording

- Automated only: “Automated spoken-flow checks passed; iPhone acceptance pending.”
- Real providers in isolation: explicitly name the candidate, tested track/context
  combinations, generation/audio/result steps, and remaining hosted/device gaps.
- Phone partially tested: list exactly which tracks/steps passed; keep the rest pending.
- Accepted: all three complete spoken journeys and interruption checks passed on
  the identified candidate, with remaining issues explicitly recorded.

Do not close the historic TestFlight authentication issue merely because these
local checks pass. Record device authentication observations independently.
## Connected screen/backend regression

Run `bun run test:spoken-joined` with `BYSI_GUEST_BACKEND` pointing to the reviewed local backend, `BYSI_COMPONENT_TEST_DEPS` to the pinned React renderer dependencies, and the existing locked backend test dependencies available. Run with network denied. Do not install or copy backend code into Expo to satisfy this test.

This test mounts Entry/Auth/Store/Onboarding/Rehearse, presses both Record/Stop/approval handlers, and sends the screen's real AI payloads through the mobile transport, local backend routes, proof checks, and SQL fixture. All three tracks must reach both TTS points and debrief. An injected contract mismatch must be rejected, preserve the new reply, show its verification-specific error, and leave a reachable Check and retry action. A failed server recheck must dispatch no generation; an expired proof may be renewed only by the existing server protocol against the unchanged exchange. Auth, microphone bytes, provider responses, and native playback remain simulated; this is not physical iPhone acceptance.

Also run all three tracks with animated transcript reveal and a progressing clock.
Change the in-memory briefing after the second Record check, before approving the
reply: the original proof-bound JSON contract must remain identical at pushback,
close, and result. This models the diagnosed context-drift failure class, not a
claim that the exact phone-side mutation has been identified. A synthetic wire
mismatch must STILL be rejected; never make this test pass by relaxing server
verification. Test helpers must wait for enabled controls and navigation, not
assume reduced-motion transitions or synchronous storage.

## Failure, retry, and evidence requirements

The connected suite must also force a provider failure at the second response,
assert the actual error/Retry control, press Retry twice before a rerender, and
verify one retry, unchanged approved reply, no extra recording/transcription,
both playback points, final approval and debrief on every track. A retry returning
200 alone is insufficient. Backend tests additionally cover timeout, malformed
provider output, validation rejection, unchanged checkpoints, and replay without
another provider charge. Keep proof/owner rejection tests intact.

For every release, attach a compact matrix with columns: failure or journey,
source/build/backend pin, test layer, mocked boundaries, result, evidence, and
remaining acceptance. Keep automatic success fixtures, failure injection, real
provider output, hosted runtime, and physical-device results separate. All green
local tests cannot close an untested hosted/device step. If diagnostics cannot
distinguish causes, improve allowlisted diagnostics before claiming a root cause;
do not log conversations, keys, tokens, proofs, or account identifiers.

September 2026 lesson: success-only generated replies concealed a mandatory-word
validation defect. The 422 context mismatch and later 502 were separate observed
failures; correcting one was not evidence that the complete flow worked. Treat
newly reached downstream failures as unresolved, not as acceptance of the release.
