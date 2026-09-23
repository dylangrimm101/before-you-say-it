# BYSI consolidated native acceptance matrix

Latest candidate follow-up: [BUILD33-ACCEPTANCE.md](BUILD33-ACCEPTANCE.md).
September 21: user authorized retesting and a new TestFlight candidate while
local Xcode/simulator setup remains deferred. This supersedes the earlier hold
on candidate upload below, but does not waive or pass native/device acceptance.
Disk cleanup recovered space; full Xcode/runtime/controller remain absent.

Status: **BLOCKED at local simulator setup. No simulator launched or operated.**
This supplements, not replaces, SPOKEN-RELEASE-CHECKLIST.md and TESTING.md.
Existing evidence and IDs remain authoritative in their original files.

## Pins and evidence

- Repository /Users/dylangrimm/bysi-laptop, branch codex/recovery-aug28-journey.
- HEAD acf121e3e6c607bc4d01990978842a5ed4d5fd43; app 1.0.0 (32).
- Uncommitted crash fix: ResultCardStack.tsx; regression and release-gate edits.
  Existing recordExchange fixtures/onboardingCompletion changes preserved.
- Historical TestFlight artifact: BUILD32-SUBMISSION.md (e885a1bf521ecb824f98eeb01bfb012571323c78).
  Current uncommitted bytes are NOT that artifact.
- Latest automated receipt: RESULT-CARD-EVENT-CRASH.md, fingerprint
  9e35e108afeda06c90f983158ef8e57a45e57c691ba43669b4b505d26a458295.
- Latest backend release receipt:
  /Users/dylangrimm/.local/share/bysi-recovery/spend-alerts-mNLvm1/RELEASE-COMPLETE.md.
  Deployment dpl_8VvSf9tmVdt2DQWUQkvYTwYMRFyu (historical readback; no new live call).
- Native simulator identity, runtime, installed source hash, backend configuration,
  OTA identity, account and entitlement starting state: NOT ESTABLISHED.
- TestFlight configuration disables OTA in app.config.ts; no simulator runtime
  configuration has been evaluated or assumed equivalent.
- Sources: AGENTS.md; both checklists; BUILD32-ONBOARDING-ACCEPTANCE.md;
  BUILD32-SUBMISSION.md; RESULT-CARD-EVENT-CRASH.md; SECOND-VOICE-CONTINUATION-FIX.md;
  RECOVERY-TARGETED-REVIEW.md and its addenda; POST-REHEARSAL-OFFER-LAYOUT.md;
  SUBSCRIPTION-PREVIEW-FIX.md. Historical failures are not erased by later passes.

## Setup checks actually executed

| ID | Environment/start | Executed | Expected / actual | Status | Evidence |
|---|---|---|---|---|---|
| SETUP-XCODE | Intel x86_64 Mac, macOS 14.8.9 | xcode-select -p; xcodebuild -version; Applications listing; Spotlight bundle lookup | Full Xcode / only /Library/Developer/CommandLineTools selected; Xcode not found in inspected locations | BLOCKED | Terminal observations this task |
| SETUP-RUNTIME | Same Mac | xcrun simctl list runtimes and devices; standard CoreSimulator directory checks | Runtime/device inventory / simctl unavailable, standard directories absent | BLOCKED | Terminal observations; no device erased |
| SETUP-DISK | Data volume | df -h /System/Volumes/Data | Build/install headroom / 8.2 GiB available; insufficient practical headroom assumed pending exact package sizing | BLOCKED | Read-only disk result |
| SETUP-TOOLS | Current enabled tools | Search available tool names/descriptions | Approved simulator controls / none found; native computer UI controls disabled | BLOCKED | Tool discovery |
| SETUP-REVIEW | User-proposed XcodeBuildMCP | Targeted local report-name search; vendor release page | Version-specific security approval / review not located or supplied | BLOCKED | User asked for report/version; v2.7.0 release exists but is NOT approved |
| SETUP-BUILD | Current checkout | Read eas.json, app.config.ts, run-staging-account.ts; check expo/ios | Documented standalone simulator workflow / explicit profiles target devices, no expo/ios | BLOCKED | Source inspection; no build script executed |
| SETUP-STATE | No dedicated simulator yet | No state-changing operation | New dedicated BYSI device / none created | NOT TESTED | No simulator artifact provenance established |

The existing staging script invokes run:ios --device --configuration Debug and
uses staging-only services. It is not a release-like simulator recipe. Do not
run it as an assumed substitute. New prebuild/dependency/config steps require
specific approval; keep generated native output in an isolated checkout.

## Journey coverage

All B rows below mean native simulator; environment/start identity must be pinned
before execution. “None” means no simulator action has occurred. Apply each
G/V/R row to real_conversation, recurring_problem and desired_skill separately;
create per-track receipts rather than claiming one track covers all three.

| ID/layer | Required starting state | Steps actually executed | Required expected outcome / actual | Status | Evidence |
|---|---|---|---|---|---|
| A-AUTO | Pinned dirty source + isolated fixtures | Earlier full gate and three-track continuation | 55 release tests, simulated payment continuation passed / no native execution | PASS | RESULT-CARD-EVENT-CRASH.md (historical automation only) |
| B-G01 | Fresh guest | None | Get Started → intended talking/context flow, no repair/allowance detour / unavailable | BLOCKED | SETUP-* |
| B-G02 | Entry, no account | None | Existing-account CTA opens login / unavailable | BLOCKED | SETUP-* |
| B-V01 | Fresh mic permission | None | Allow → record actual audio → stop → upload → editable transcript / unavailable | BLOCKED | SETUP-* |
| B-V02 | Permission denied | None | Denial visible; approved recovery restores recording, no typed substitute / unavailable | BLOCKED | SETUP-* |
| B-V03 | Opener approved | None | Scene-grounded first response, exact text, verifiable audio / unavailable | BLOCKED | SETUP-* |
| B-V04 | First playback ended | None | Record/stop/edit/approve second turn → response and audio / unavailable | BLOCKED | SETUP-* |
| B-V05 | Second voice failure | None | Keep reading and Try voice again separately → review/debrief; cleanup releases audio / unavailable | BLOCKED | SETUP-*; SECOND-VOICE-CONTINUATION-FIX.md |
| B-V06 | In-flight generation | None | Failure + double Retry → one operation, retained approved reply, no new recording / unavailable | BLOCKED | SETUP-* |
| B-V07 | Playing/recording | None | Stop, background, foreground, exit → correct cleanup and visible state / unavailable | BLOCKED | SETUP-* |
| B-R01 | Completed exchange | None | Both authorized transcripts review/approval once → generated report / unavailable | BLOCKED | SETUP-*; BE-EDIT-01 |
| B-R02 | Rewrite screen | None | Tap See the practice plan; measure/scroll overlapping cards; next CTA works without crash / unavailable | BLOCKED | SETUP-*; RESULT-CARD-EVENT-CRASH.md |
| B-R03 | Report | None | State preserved through offers/account/success as intended, no fabricated result / unavailable | BLOCKED | SETUP-* |
| B-A01 | Guest with report | None | Signup → ordinary confirmation email click → login → intended offer / unavailable | BLOCKED | SETUP-* |
| B-A02 | Registered test user | None | Logout, switch owner, relaunch → correct isolation and entitlement / unavailable | BLOCKED | SETUP-* |
| B-A03 | Approved recovery account | None | Forgot password → ordinary email link → reset → intended return / unavailable | BLOCKED | SETUP-*; no admin/reset helper substitution |
| B-P01 | Verified test account, approved sandbox | None | Explicit purchase → verified entitlement → success → first practice / unavailable | BLOCKED | SETUP-*; no real charge authorized |
| B-P02 | Sandbox purchaser | None | Restore, cancel and interrupted purchase; relaunch/account switch / unavailable | BLOCKED | SETUP-* |
| B-P03 | Approved web buyer | None | Verified web access, no duplicate Apple paywall / unavailable | BLOCKED | SETUP-* |
| B-L01 | Eligible lesson owner | None | Every inventoried entry/content flow completes per current eligibility / unavailable | BLOCKED | Inventory below |
| B-L02 | Progress at meaningful checkpoint | None | Terminate/relaunch; saved result/progress survives where required; no cross-owner data / unavailable | BLOCKED | SETUP-* |
| B-U01 | Each meaningful screen | None | Keyboard, safe area, scroll, large text, essential accessibility / unavailable | BLOCKED | SETUP-* |
| B-U02 | Fresh + returning guests | None | Slow/offline/failed request and expired auth show actionable errors / unavailable | BLOCKED | SETUP-* |
| B-U03 | Pending operation | None | Repeat taps/interruption → no duplicate work or stuck navigation / unavailable | BLOCKED | SETUP-* |
| C-DEVICE | New exact TestFlight candidate | None this task | Actual microphone, audible playback, native crash retest, email link, Apple sandbox purchase/restore / pending | NOT TESTED | Build 32 defect reported; new artifact not built |

B voice PASS requires evidence of capture and audible output, not merely text,
decodable bytes, or a provider 200. If simulator cannot establish either, split
the row and mark that portion BLOCKED for C. Never replace speech with typing.

## Existing issues and conflicts (IDs preserved)

| ID/issue | Severity/customer impact | Disposition and next evidence |
|---|---|---|
| TF-AUTH-CONFIG-01 | High: blocked entry | Preserve unresolved exact-build acceptance. Later user entry success is not universal configuration closure. Simulator cannot replace signed-artifact/device evidence. |
| BE-RPC-01 | High: hosted continuation | Old source-only limitation has newer deployment/migration evidence in private release receipts. Do not silently rewrite historical report; native journey still pending. |
| BE-EDIT-01 | Integrity-sensitive review | Later correction addendum resolved protected normal-free source conflict with stored read-only final review. Preserve pre-submission edits; do not reintroduce blanket final editing. |
| STAGING-EDIT-01 | Separate contract risk | Unconfirmed staging compatibility; do not substitute staging contract for normal production. |
| STT-RETRY-01 | Retry UX/protocol question | Deferred retained-capture design remains; do not invent server semantics. |
| Build32 result-card crash | High: onboarding termination | Local lifecycle root defect reproduced before fix, passes after. Apple incident stack missing; native original-journey retest BLOCKED. See dedicated report for exact steps and trace. |
| Earlier second-response quality rejection | High: rehearsal blocked | Preserve failed build32 provider receipt. Later isolated provider pass exists, not proof incident cannot recur; no native acceptance yet. |
| Historical report spend-limit 429 | High: report blocked | Latest backend release removes monetary reservations; earlier failure retained. Device full-flow verification pending. |
| Offer copy vs screenshots | Commercial accuracy | Current accepted copy uses verified store terms, not guaranteed seven-day trial/reminder. Do not silently restore unverified promises. |
| Historical content/fixture failures | Validation gap | Older source-string failures and default-timeout attempts stay in supporting reports; latest narrow gate is not an all-legacy-suite pass. |

## Inventory: not proof of customer-visible availability

Source inventory is preliminary: module registry plus bundled decks plus legacy
day catalog. Eligibility is a source flag, not permission to unlock content.
Dynamic/native reachability and each content requirement must be verified after
setup. For each item start with an eligible isolated test owner; actual steps
executed = none, runtime/environment = not established, outcome = NOT TESTED.
Inventory entry points: /(tabs), /(tabs)/library, /path, /approved-lessons,
/approved-lesson/[lessonId], /approved-rehearsal/[lessonId], /quick-rep/[lessonId],
/module/[day], /drill/[id], /scenario/[id], /rehearse/[id], /custom,
/account-practice, /interrupted/[moduleId], /saved-result, /(tabs)/progress,
and /progress/dimension/[signal]. Source existence is not proof of reachability.

| Existing practice ID | Module | Title | Source launch eligible | Native status |
|---|---|---|---|---|
| gtp_conversation_job | get_to_the_point | Give the conversation one job | true | NOT TESTED |
| gtp_event_not_story | get_to_the_point | Separate what happened from the story | true | NOT TESTED |
| gtp_point_that_survives | get_to_the_point | Find the point that must survive | true | NOT TESTED |
| gtp_keep_point_present | get_to_the_point | Keep the point in the room | false | NOT TESTED |
| gtp_stop_building_case | get_to_the_point | Stop when the point is clear | false | NOT TESTED |
| mca_find_hidden_ask | make_a_clear_ask | Find the ask inside the frustration | false | NOT TESTED |
| mca_answerable_action | make_a_clear_ask | Make the action answerable | true | NOT TESTED |
| mca_owner_and_timing | make_a_clear_ask | Make ownership and timing clear | false | NOT TESTED |
| mca_room_for_answer | make_a_clear_ask | Leave room for an answer | false | NOT TESTED |
| mca_adjust_constraint | make_a_clear_ask | Adjust after a real constraint | false | NOT TESTED |
| mca_close_next_step | make_a_clear_ask | Close with the actual next step | false | NOT TESTED |
| stc_timing_scope_channel | start_the_conversation | Choose timing, scope, and channel | false | NOT TESTED |
| stc_name_topic | start_the_conversation | Name what this is about | false | NOT TESTED |
| stc_current_example | start_the_conversation | Use one current example | false | NOT TESTED |
| stc_own_perspective | start_the_conversation | Say the impact without claiming motive | false | NOT TESTED |
| stc_one_purpose_or_request | start_the_conversation | Give the opening one purpose | false | NOT TESTED |
| stc_mild_pushback | start_the_conversation | Keep the opening intact under pushback | true | NOT TESTED |
| lar_genuine_question | listen_and_respond | Ask a question whose answer could matter | false | NOT TESTED |
| lar_reflect_and_check | listen_and_respond | Say back the stated concern and check it | false | NOT TESTED |
| lar_receive_complaint | listen_and_respond | When the concern is about you | false | NOT TESTED |
| lar_validate_without_agreeing | listen_and_respond | Acknowledge without pretending to agree | false | NOT TESTED |
| lar_impact_before_intent | listen_and_respond | Hear impact before explaining intent | false | NOT TESTED |
| lar_acknowledge_and_return | listen_and_respond | Respond without losing your own point | false | NOT TESTED |
| scp_notice_pressure_move | stay_clear_under_pushback | Spot what pressure makes you do | true | NOT TESTED |
| scp_narrow_defensiveness | stay_clear_under_pushback | Narrow the all-or-nothing frame | false | NOT TESTED |
| scp_answer_minimizing | stay_clear_under_pushback | Respond when the issue is minimized | false | NOT TESTED |
| scp_order_topic_switch | stay_clear_under_pushback | Handle a counterattack without opening two arguments | false | NOT TESTED |
| scp_vague_agreement_or_refusal | stay_clear_under_pushback | Respond to vague agreement or refusal | false | NOT TESTED |
| scp_unannounced_reaction | stay_clear_under_pushback | Choose a response you were not prompted to use | false | NOT TESTED |
| psb_create_choice | pause_say_no_boundary | Create enough space to choose | true | NOT TESTED |
| psb_request_pause | pause_say_no_boundary | Ask for a pause with a return | false | NOT TESTED |
| psb_receive_pause | pause_say_no_boundary | Receive a pause without chasing or disappearing | false | NOT TESTED |
| psb_request_vs_boundary | pause_say_no_boundary | Know whether this is a request or a boundary | false | NOT TESTED |
| psb_say_no | pause_say_no_boundary | Say no without a hostile essay | false | NOT TESTED |
| psb_accept_no | pause_say_no_boundary | Accept no without forcing resolution | false | NOT TESTED |
| psb_choose_ending | pause_say_no_boundary | Choose the right ending | false | NOT TESTED |
| psb_reclaim_floor | pause_say_no_boundary | Reclaim one bounded sentence after interruption | false | NOT TESTED |
| rww_name_the_miss | repair_what_went_wrong | Name the specific miss | false | NOT TESTED |
| rww_own_without_but | repair_what_went_wrong | Own it without “but” | false | NOT TESTED |
| rww_acknowledge_impact | repair_what_went_wrong | Acknowledge the impact you were told about | false | NOT TESTED |
| rww_changed_behavior | repair_what_went_wrong | Say what will be different next time | false | NOT TESTED |
| rww_reopen_issue | repair_what_went_wrong | Reopen the real issue without using it as an excuse | false | NOT TESTED |
| rww_follow_through | repair_what_went_wrong | Let follow-through complete the repair | false | NOT TESTED |
| uir_choose_conditions | use_it_in_real_life | Choose a safe time, place, and channel | false | NOT TESTED |
| uir_process_goal | use_it_in_real_life | Choose one goal under your control | false | NOT TESTED |
| uir_if_then_plan | use_it_in_real_life | Build one if–then response | false | NOT TESTED |
| uir_alternate_reaction | use_it_in_real_life | Rehearse a different plausible reaction | false | NOT TESTED |
| uir_real_or_equivalent_attempt | use_it_in_real_life | Use the plan or choose a high-fidelity rehearsal | false | NOT TESTED |
| uir_debrief | use_it_in_real_life | Review what actually happened | false | NOT TESTED |
| uir_replay_hardest_moment | use_it_in_real_life | Replay the hardest moment with one adjustment | false | NOT TESTED |
| uir_personal_playbook | use_it_in_real_life | Build a playbook from choices you made | false | NOT TESTED |
| uir_novel_rehearsal | use_it_in_real_life | Apply the skill in a new scenario | false | NOT TESTED |
| uir_baseline_comparison | use_it_in_real_life | Compare with the preserved baseline | false | NOT TESTED |

| Legacy day | Ref | Title | Native status |
|---|---|---|---|
| 1 | baseline | Your first attempt, unedited | NOT TESTED |
| 2 | open-hard | Open the hard conversation | NOT TESTED |
| 3 | name-feeling | Name the feeling, not the blame | NOT TESTED |
| 4 | feedback | Give hard feedback to someone you like | NOT TESTED |
| 5 | no-apology | Say no without apologizing | NOT TESTED |
| 6 | friend-money | Ask a friend for the money back | NOT TESTED |
| 7 | ask-for-help | Ask for help before you drown | NOT TESTED |
| 8 | friend-drift | Name the distance between you | NOT TESTED |
| 9 | broken-record | The broken record | NOT TESTED |
| 10 | chores | Ask for a fair split of the housework | NOT TESTED |
| 11 | ask-number | Say the number first | NOT TESTED |
| 12 | raise | Ask for the raise you've earned | NOT TESTED |
| 13 | receive-criticism | Take the hit without folding | NOT TESTED |
| 14 | sibling-caregiving | Ask your brother to share the caregiving | NOT TESTED |
| 15 | mother-boundary | Set a boundary with your mother | NOT TESTED |
| 16 | de-escalate | Lower the temperature | NOT TESTED |
| 17 | burnout | Tell your boss you're burned out | NOT TESTED |
| 18 | no-apology | Say no without apologizing | NOT TESTED |
| 19 | parent-comingclean | Tell your parents a truth they won't like | NOT TESTED |
| 20 | name-feeling | Name the feeling, not the blame | NOT TESTED |
| 21 | wedding-money | Talk about the money you've been avoiding | NOT TESTED |
| 22 | quit | Resign without burning the bridge | NOT TESTED |
| 23 | open-hard | Open the hard conversation | NOT TESTED |
| 24 | intimacy | Say you feel lonely in the relationship | NOT TESTED |
| 25 | broken-record | The broken record | NOT TESTED |
| 26 | mother-boundary | Set a boundary with your mother | NOT TESTED |
| 27 | de-escalate | Lower the temperature | NOT TESTED |
| 28 | chores | Ask for a fair split of the housework | NOT TESTED |
| 29 | custom | The one you came here for | NOT TESTED |
| 30 | baseline_replay | The same moment, thirty days later | NOT TESTED |

| Bundled deck | Native status |
|---|---|
| BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M1-L2-Cut-the-Case.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M1-L3-Park-and-Return.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M1-L4-Make-It-Repeatable.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M1-L5-Fit-in-One.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M1-Close.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-L1-Clear-Ask.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-L2-Say-Who.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-L3-When-They-Say-They-Cant.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-L4-Say-Whether-No.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-L5-Ask-for-the-Loop.html | NOT TESTED |
| BYSI-Rork-Handoff/decks/M2-Close.html | NOT TESTED |

## Setup decision and permissions

- No tools/dependencies installed, startup hooks enabled, simulator erased,
  app source changed, signing changed, paid calls made or build uploaded this task.
- Native UI control in the currently enabled computer tool is disabled. No
  Mobile MCP/mobilecli, Maestro, or unreviewed replacement will be used.
- Need the user's version-specific XcodeBuildMCP review and reviewed text-only
  systematic-debugging / verification-before-completion / test-driven-development
  instructions; they are not available skills in this session. Do not claim them
  installed or security-reviewed. Follow evidence → hypothesis → reproduction →
  approved minimal change → original/adjacent retest meanwhile.
- Read-only disk inventory approval requested. No deletion authorized.
- Xcode 16.2 is a possible local compatibility candidate for macOS 14.8.9; Expo54
  requires Xcode16.1+. This is NOT installation approval or equivalence to the
  cloud TestFlight toolchain. Verify package size, runtime/architecture and
  reviewed controller requirements before selecting exact versions.
- After review, present exact pinned install, lock/integrity, necessary simulator
  build/UI/log workflows, telemetry-disable setting and scrubbed environment.
  No production secrets in tool environment; only approved test configuration.
- Dedicated simulator only; preserve all existing devices/state. Simulator account
  provisioning and native configuration/build steps require separate exact approval.
- Prior TestFlight-upload approval is held while resolving this new workflow,
  not treated as permission to skip it.

Sources:
https://docs.expo.dev/versions/v54.0.0/
https://developer.apple.com/xcode/system-requirements
https://github.com/getsentry/XcodeBuildMCP/releases/tag/v2.7.0
Vendor release notes are not an independent security review.

## Physical-device follow-up (only gaps remaining after simulator execution)

On the exact newly installed candidate: original practice-plan CTA crash retest;
actual spoken opener/reply and both audible responses; OS permission/interruptions;
ordinary email-link return; authorized TestFlight sandbox purchase/restore and
entitlement/relaunch. Expand only for simulator failures or release-specific gaps,
not by blindly asking the user to repeat already verified simulator-only checks.
Existing checklist still requires the three spoken tracks for final acceptance.
