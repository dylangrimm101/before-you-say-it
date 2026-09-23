# Candidate evidence — fill before release claims

Copy this template to a candidate-specific report. `Pending` is the default, not
a pass. Preserve failed attempts and references to their receipts. Store only
content-free evidence here—no conversations, identities, credentials or tokens.

## Scope and identity

- Reported defect(s), track/context, build and timestamp:
- Narrow fix; unrelated changes excluded:
- Candidate full commit; dirty working tree if applicable:
- Automated runner Expo source fingerprint:
- Exact backend manifest/deployment and relevant configuration evidence:
- Locked runtime/dependency verification:
- Build authorization and provider budget authorization (separate):
- Uploaded source commit/archive digest, EAS build ID, IPA SHA-256:
- IPA version/build and configuration audit receipt:
- TestFlight installed version/build confirmed by tester:

The runner fingerprint covers tracked/nonignored Expo files; it is NOT the
uploaded archive or IPA digest. Recheck the binding after preparation changes.

## Reproduction

| Defect | Pre-fix failing assertion / receipt | Correct runtime boundary | Post-fix regression / receipt | Remaining uncertainty |
| --- | --- | --- | --- | --- |
| Reported issue | Pending | Pending | Pending | Pending |

Use installed native libraries where available; exercise actual mounted controls.
Do not replace the failing boundary with a successful mock. Distinguish actual
incident attribution from an injected failure that reproduces the same symptom.

## Three separate acceptance layers

| Layer | Status | Exact source/backend pins | Receipt | Mocked or untested boundaries |
| --- | --- | --- | --- | --- |
| Automated: `bun run test:release` plus applicable regressions | Pending | Pending | Pending | Recorder/player hardware, Auth and providers are modeled |
| Bounded real providers, isolated synthetic data | Pending | Pending | Pending | Not hosted/device acceptance |
| Physical iPhone, exact installed TestFlight candidate | Pending | Pending | Pending | Record tested device/network/context and omissions |

Provider report must include both generations, both decoded audios, structured
debrief, actual call counts, spend bound and every failure/retry. Provider outages
do not become success because a fallback mock passes.

## Full spoken journey — repeat this table for each acceptance layer

Record receipt/observation references per cell, not only an overall green status.

| Step | Real conversation | Recurring problem | Desired skill |
| --- | --- | --- | --- |
| Get Started and all context questions | Pending | Pending | Pending |
| Record/Stop opener; clear/edit/approve transcript | Pending | Pending | Pending |
| First response text and playback | Pending | Pending | Pending |
| Record/Stop reply; edit/approve transcript | Pending | Pending | Pending |
| Second response text and playback | Pending | Pending | Pending |
| Final transcript review and single approval | Pending | Pending | Pending |
| Debrief and reachable next step | Pending | Pending | Pending |
| Exit and start a fresh rehearsal | Pending | Pending | Pending |

On iPhone, playback means heard from the phone, not an API response or callback.
Observe text/audio timing at BOTH response points. Typing is not a replacement
for either recording turn. Note device/iOS, tester, date/timezone and network.

## Failure/recovery checks

| Case | Layer / regression | Status and receipt |
| --- | --- | --- |
| Generation unavailable → retry twice → one operation, retained reply → debrief | Pending | Pending |
| Second audio unavailable → Keep reading → review/approval/debrief, all tracks | Pending | Pending |
| Second audio unavailable → Try voice again → playback/review/debrief, all tracks | Pending | Pending |
| Slow response, delayed native playback start, stop playback | Pending | Pending |
| Native cleanup exception does not trap navigation | Pending | Pending |
| Unicode JSON via locked native Response/Headers; binary audio unchanged | Pending | Pending |
| Wrong text/role/owner and stale requests still rejected | Pending | Pending |
| Permission denial/recovery, background/foreground, leave while recording | Pending | Pending |

## Decision

- Automated gate: Pending.
- Real-provider gate: Pending.
- Exact-build iPhone gate: Pending.
- Unresolved defects / unavailable checks / next required approval:

Permitted wording: “automated checks passed,” “provider check passed in isolation,”
or “candidate available for device testing.” Do not say “fully verified,” “fixed
on your phone,” or “accepted” while the relevant device observations are pending.
This report does not itself authorize builds, uploads, spending or deployment.
