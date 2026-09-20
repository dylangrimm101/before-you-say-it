# Spoken-first release acceptance

Speaking is the primary journey. Typing is a separately tested fallback, never a
substitute for either gate below. An automated pass must not be described as a
verified iPhone experience.

## 1. Automated gate — before an authorized TestFlight candidate

Record the exact candidate commit (or explicitly label an uncommitted working-tree
result), build number, test commands, results and known limitations.

From `expo/`, with the checkout's pinned Bun and locked dependencies:

```sh
# Set BYSI_COMPONENT_TEST_DEPS to the previously installed, pinned renderer directory.
bun run verify:buyer-tests
bun run test:spoken
bun run check
```

Run the applicable broader mobile and joined backend regression suites as well.
Do not silently install different dependencies, weaken assertions, or count a
missing/private-backend harness as a pass.

The mounted spoken tests must use the screen's Record and Stop handlers for BOTH
learner turns, verify explicit transcript approval, both Hope playback callbacks,
and final approval into debrief across all three tracks. They must also verify
that a rejected continuation cannot leave recording active behind an error screen.
Recorder/player hardware and provider responses are simulated. Separate native
audio-byte/playback tests and joined transport tests complement this coverage;
none establishes physical-device success.

Passing this gate means **candidate ready for authorized device testing**, not
release accepted. Building/uploading still requires user authorization. A new
TestFlight candidate may be needed to carry out gate 2; label it unverified until
those observations are complete.

## 2. Real-iPhone gate — on the exact installed candidate

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
7. Leave and start another rehearsal; confirm no stale conversation blocks entry.

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
