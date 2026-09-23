# Second voice / continuation correction — September 20, 2026

Application correction: `31ef4baa25fd364f40e6295492be357e511ee744`.
Testing-policy commit: `896a89c5564ad27d7d13e111310c2c1796287ca7`.
Base: `69ff4d72ca7d8ccaccdbec2a7e401cdff3ae3116`, branch
`codex/recovery-aug28-journey`. No build number change, upload, production write,
migration, or backend edit. The separately approved provider run below failed
its release gate; Build 32 has not been started.

## Direct evidence

- Read-only Vercel request logs on deployment
  `dpl_BGNWnqp4GzwjbQtJxRMTt5EYP5Fv` show `/api/native/free/tts` returning
  200 at 13:27:45.674Z, 503 at 13:28:10.872Z, 502 at 13:28:19.620Z, and
  503 at 13:28:21.511Z. This is the reported screenshot window (9:28 EDT).
  No identity, conversation content, credential, or provider body was retrieved.
  These are time-correlated requests, not definitive user/request attribution.
- The locked `whatwg-fetch` 3.6.20 `Response(ArrayBuffer).text()` converts each
  byte to a character instead of UTF-8 decoding. The actual-library regression
  failed before the fix: `I’m` became `Iâ\x80\x99m`, and an em dash was corrupted.
- `normalFreeSession` reconstructed all JSON responses using this ArrayBuffer
  constructor. Corrupted generated text was then fingerprinted locally and sent
  to TTS; the backend still requires exact equality with its original audio text.
- A mounted-screen regression that injected second audio failure and rejected
  audio cleanup could not reach transcript approval through Keep reading on all
  three tracks. The retry-success branch passed before the fix.
- The actual voice module failed its injected listener-cleanup exception test:
  cleanup threw before idle state publication and before player release.

## Interpretation and limitations

The encoding defect reproduces the corruption pattern in the screenshot and
explains an exact-text rejection path. It does not establish the cause of every
historical 502/503; those request records contain no diagnostic event identifying
the failing provider stage. Cleanup failure is a reproduced defensive gap, not
proof that a native listener threw on this particular phone.

## Changes

- `expo/lib/nativeResponseText.ts`: portable, strict UTF-8 decoding; no dependency
  on native TextDecoder/Blob, no normalization, malformed UTF-8 rejected.
- `expo/lib/normalFreeSession.ts`: construct JSON Responses from decoded strings;
  keep successful TTS as exact binary bytes. Limits, Auth, owner fencing, request
  ordering, fingerprints, and server authorization are unchanged.
- `expo/lib/voice.ts`: listener-cleanup exceptions cannot prevent player cleanup;
  stop publishes idle in finally.
- `expo/app/rehearse/[id].tsx`: Keep reading opens final transcript review directly
  when the full exchange is ready, independently of audio cleanup. Approval remains
  explicit. Voice retry remains available. Add accessible recovery-control labels.

## Regression evidence

Private receipts: `/Users/dylangrimm/.local/share/bysi-recovery/voice-continuation-ImA3vZ`.
All local runs deny network and use the checkout's pinned Bun and dependencies.

- Spoken suite: 35 pass, including six mounted second-voice recovery cases across
  all tracks, exact native-library Unicode behavior, binary audio, wrong-text/role/
  stale-turn rejection, and native cleanup failure. An additional retry-refetch
  assertion in the voice fixture passed in a subsequent targeted run.
- Auth/owner/privacy/recovery selection: 16 pass.
- TypeScript and canonical lint: pass; four unchanged warnings.
- Connected backend/SQL suite: 12 pass, including all three full spoken journeys,
  failed second-generation retry, proof rejection/renewal, and context drift.
  Receipt: `joined-1789914997167.json` in the private evidence directory.
- An initial implementation run caught a duplicate local variable declaration;
  corrected before the passing runs. Native test setup also needed native Headers
  rather than mixing Bun Headers into the locked fetch implementation.

Provider replies, microphone hardware and native player behavior are simulated.
The native Response/Headers implementation itself is the installed locked code.
The connected suite uses the existing isolated backend/SQL fixtures, not production.

## Release gates

The user approved a fresh bounded real-provider check (18 AI / 8 voice / $5
maximum, synthetic conversations and isolated database only). Run September 20,
15:50:08–15:52:48 UTC: **FAILED**, not retried until green.

Receipt: `/Users/dylangrimm/.local/share/bysi-recovery/build32-provider-DD1DzF/RESULT.json`.
Backend manifest SHA-256:
`4d616e3164dead2bd9b7e1840457c74d8d0871ef5d2f2b68b6c60e7e6adcbc63`.
Mobile decoder SHA-256:
`5db5fd64b69bd79cc4bf2d4501c0e756ea2e129e1decda8136e6e4c0735fb5d4`.
Configuration was read from the existing deployment named above; no setting changed.

- `real_conversation`: begin, first response and decodable first audio passed;
  second response returned 502 after the backend's one internal repair attempt.
  Allowlisted diagnostic: `generation_response`, `close`, `counterpart_quality`.
- `recurring_problem` and `desired_skill`: both responses, both decodable audio
  files and structured approved-transcript result passed.
- 9 AI calls, 5 voice calls; conservative reserved budget $2.941545, not actual
  billed cost. No customer conversation, production database or physical device used.
- All underlying provider HTTP responses were 200. The failed step was a backend
  rejection of generated dialogue, not a demonstrated provider HTTP outage or TTS
  failure. The aggregate diagnostic does not identify which individual quality
  predicate rejected the reply. Provider text was not retained in these receipts;
  do not infer the exact offending phrase or weaken checks without reproduction.
- This exercised synthetic Partner/household-chores conversations across the three
  tracks, not every scenario, real recording, hosted SQL/Auth, or audible playback.

Release remains held for investigation of the failed real-provider gate. The two
successful tracks do not waive the first-track failure. Physical iPhone acceptance
remains pending. Do not describe these corrections as available in TestFlight.

The same ArrayBuffer-to-text pattern also exists in `nativeBilling.ts`. That
separate signed-in transport was identified but not changed in this focused patch;
it needs a dedicated regression before claiming Unicode safety for paid flows.
