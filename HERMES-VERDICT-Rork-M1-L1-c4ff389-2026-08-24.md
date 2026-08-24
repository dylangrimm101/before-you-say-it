# Hermes Verification Verdict
## Rork M1 L1 Artifact `c4ff389`

**Artifact:** `rork-m1-l1-hermes-verification-c4ff389.zip`  
**Implementation revision:** `c4ff389158bee97dcd5d602aee5cad4db735364e`  
**Direct parent:** `cbab8e97f8d222eba1215150ba314f57263ef722`  
**Reported baseline:** `3bed2b05dab5bbdd5ecb37a8643ffeeacf6deba1`  
**Verdict:** Rejected for acceptance; useful verified source artifact and incomplete prototype only.  
**Fan-out:** Not authorized.  
**Public launch:** Not authorized.

---

# 1. Artifact verification

Verified:

- downloaded ZIP size: 56,765 bytes;
- SHA-256: `9c1b57c64404fcf01860a09c7003cfed515f311236699d5958912d6199b511e0`;
- ZIP integrity: passed;
- 17 files present;
- `SOURCE-MANIFEST.sha256`: 10 entries, all hashes and byte counts passed;
- `ARTIFACT-MANIFEST.sha256`: 16 entries, all hashes and byte counts passed;
- binary-capable parent-to-implementation patch present;
- patch parses and reports 9 changed Expo files, 606 insertions, and 42 deletions;
- no `.env`, credentials, dependency trees, caches, build output, transcripts, audio, or device media included;
- static scan of added lines found no hardcoded secret, dangerous eval/exec, raw transcript log, `console.log`, or new HTTP destination.

The package is a valid, revision-pinned source/evidence artifact. It is not an accepted implementation.

---

# 2. Evidence limitations

The package contains changed files and a patch, not the complete repository. Hermes could inspect source and test definitions but could not independently rerun the reported Bun, TypeScript, lint, Expo, export, or full-suite commands from this ZIP alone.

Rork reports:

- focused conversion: 8 passed, 40 assertions;
- approved decks: 9 passed, 203 assertions;
- implementation full suite: 354 passed, 1 failed, 2,778 assertions;
- parent full suite: 346 passed, 1 failed, 2,738 assertions;
- same pre-existing paywall assertion failed on both revisions;
- typecheck/lint/Rork checks/export/diff check passed.

The baseline comparison is documented and plausible, but remains reported evidence rather than independently rerun evidence.

No real-device evidence was supplied. Rork correctly did not substitute simulator evidence.

---

# 3. Correctly reported blockers

Rork's blocker table is unusually honest and correctly identifies that this revision does not implement:

- accepted M1 L1 practice identity;
- approved eight-beat exchange;
- Pushback 1 bank and stable selection;
- evidence trap as Pushback 2;
- scoreless Hope priority/assessability flags;
- optional final retry/two-retry cap;
- Adam work-context authorization;
- fourth safety route;
- stale-write-safe converted progress;
- content-version mismatch preservation;
- custom wording consent;
- visible countable progress;
- structural `.env` repopulation prevention;
- real-device microphone/TTS/device evidence.

These are acceptance blockers, not optional polish.

---

# 4. Additional source-level blockers

## 4.1 Privacy deletion is not fail-closed

`expo/providers/store.tsx:346-354` updates in-memory active-run state, attempts AsyncStorage persistence/removal, catches any storage error, logs it, and resolves normally.

`expo/app/approved-lesson/[lessonId].tsx:174-189` commits converted progress, calls `saveActiveScenarioRun(null)`, then marks completion true.

Because `saveActiveScenarioRun` suppresses `removeItem` failure, the UI can show Practice Complete while the content-bearing active rehearsal, including transcripts and pressure text, remains on device.

Required correction:

- add a strict deletion method for completion/discard that throws on durable deletion failure;
- do not clear in-memory state or show completion until durable deletion succeeds;
- show the specified save/deletion failure recovery state;
- add a test where AsyncStorage removal fails and prove completion remains blocked.

## 4.2 Completion does not bind the active run to the converted lesson

`expo/app/approved-lesson/[lessonId].tsx:23` treats `returnFromRehearsal=1` as a return based on query state.

At `:171-187`, completion checks only that an active run has `retryAttempt` and `comparison`. It does not revalidate:

- run practice ID;
- run content version;
- run lesson/scenario identity;
- rehearsal-complete state;
- counterpart/pressure identity.

An unrelated or stale active scenario run could satisfy the completion gate in internal QA.

Required correction:

- validate run ID passed from the rehearsal return;
- require accepted practice ID, content version, lesson ID/scenario ID, authored turn-plan completion, retry, comparison, and expected state;
- reject query-only or unrelated-run completion;
- add direct-navigation and stale-run tests.

## 4.3 Card 21 contradicts the approved optional behavior

`expo/app/approved-lesson/[lessonId].tsx:133-135` marks the saved move handled only when Card 21 no longer contains `___`.

`:172` blocks transfer completion unless `savedMoveHandled` is true.

The approved deck says Card 21 is saved automatically and filling blanks is optional. This implementation can force the optional blanks to be completed before Card 22 can finish.

Required correction:

- automatically persist the approved named move/template on real rehearsal return;
- let the learner continue without filling custom blanks;
- if custom wording is entered, persist it only through explicit `Save this wording` consent;
- do not detect completion by searching the whole page for underscores.

## 4.4 Hope feedback can make a false transcript claim

`expo/lib/convertedLesson.ts:77-87` takes the first ten words of any transcript and always says:

> `You gave Adam a concrete line to answer…`

It does not test whether the line is concrete, contains one point, includes proof, ends in a move, piles examples, asserts motive, or returns after pressure.

This violates transcript-grounded honesty even before the missing seven-dimension mapping is addressed.

Required correction:

- implement scoreless `met`, `not_met`, and `not_assessable` flags for the approved M1 L1 dimensions;
- select one correction from observable evidence;
- never call wording concrete unless the transcript supports that claim;
- add adversarial vague, case-building, motive-claim, no-move, and clean-turn fixtures.

## 4.5 Comparison is not a behavior comparison

`expo/lib/convertedLesson.ts:91-95` truncates the first eight words of each response and asks the learner to review which opening keeps the point in view.

`ScenarioPaidPractice.tsx:218-220` writes `criterionChanged: false` unconditionally.

This does not determine what changed or held on the coached behavior and does not fulfill the concrete comparison contract.

Required correction:

- compare the exact coached attempt segment and retry;
- derive a concrete first observation and retry change/held behavior from the same scoreless flag;
- set criterion state honestly;
- remain within the 36-word limit.

## 4.6 Exact retry does not preserve resolved audio identity

The run persists pressure text and a reaction ID, but `ScenarioPaidPractice.tsx:172` and `:277` call TTS again with hardcoded `man-adam`. No resolved audio ID/cache key is persisted before first playback.

The retry therefore preserves text, not the full text/identity/voice/audio contract, and may produce different delivery.

Required correction:

- persist counterpart identity, pressure-turn ID, reaction variant ID, semantic voice key, and resolved audio/cache ID before playback;
- reuse the same resolved asset for exact retry when available;
- retain visible-text fallback.

## 4.7 Unsupported duration was introduced

`expo/lib/convertedLesson.ts:62` sets `minutes: 7`.

The approved M1 L1 v2.1 authoring spec does not authorize a seven-minute duration, and the canonical curriculum rules prohibit unsupported duration claims.

Required correction:

- remove the duration or cite the exact later approved source authorizing it;
- do not expose an invented time commitment.

## 4.8 Converted progress loads without runtime validation

`expo/providers/store.tsx:146-149` parses persisted converted progress and casts any array directly to `ConvertedLessonProgress[]`.

Malformed, stale, or injected records are accepted into state without validating practice ID, content version, completion fields, timestamps, transfer values, or source lineage.

Required correction:

- add a strict normalizer/validator;
- reject malformed/unknown records fail-closed;
- preserve valid records while dropping invalid entries;
- add corruption and mixed-validity tests.

## 4.9 “Atomic” progress writes are stale-closure vulnerable

`expo/providers/store.tsx:358-362` builds the next array from the React closure `convertedLessonProgress`, writes it, then sets state.

Concurrent/interleaved commits can overwrite newer progress. The included stale-write tests explicitly do not cover this key.

Required correction:

- serialize/merge against the latest durable value or use the project's existing stale-write-safe mechanism;
- add the required A/B stale-write test where stale A arrives after B and cannot regress B.

## 4.10 Tests overstate behavioral proof

Several new tests assert source strings rather than execute behavior. Examples:

- safety test checks that source contains `I'm not sure` and lacks `safetyAnswer`;
- voice test checks source contains calls/labels;
- pressure test constructs state directly rather than driving the route/state machine;
- identity test locks the disputed wrong ID.

These tests can pass while routing, permission recovery, deletion, and authored turn sequencing are wrong.

Required correction:

- add route/component/state-machine tests that execute transitions and failures;
- keep static contract assertions only as supplementary checks.

## 4.11 Remote executable deck is not authenticity-pinned

`expo/lib/approvedDeckLoader.ts:3-21` downloads a public ZIP and executes its JavaScript inside the lesson WebView. The loader checks structure/card boundaries but does not verify a pinned digest or signature before the deck can send native bridge messages.

`expo/app/approved-lesson/[lessonId].tsx:203-216` enables JavaScript and accepts WebView messages that can launch rehearsal and participate in completion.

The returned deck path is not sliced to the expected post-rehearsal range; it loads the full remote template and changes only the initial card index.

Required correction:

- bundle the accepted deck with the app or verify a pinned SHA-256/signature before execution;
- bind the digest to lesson ID/content version;
- reject any mismatch fail-closed;
- validate native bridge messages against the active run and explicit allowed state;
- slice/authorize the returned deck to the exact accepted post-rehearsal cards.

## 4.12 Hardcoded Adam voice leaks into the shared component

`ScenarioPaidPractice.tsx:172` and `:277` call `speak(..., "man-adam")` without guarding that voice selection to the accepted converted work scenario.

Because `ScenarioPaidPractice` is shared, non-converted scenarios can also receive Adam's voice.

Required correction:

- resolve a semantic voice key from the persisted contextual counterpart;
- restrict Adam to the approved work-context manifest;
- persist and reuse that key/audio identity;
- add partner/family/non-converted regression tests proving they do not receive Adam by default.

## 4.13 Progress writes destroy prior-version history

`expo/providers/store.tsx:358-362` filters only by `practiceId`. A new content-version completion replaces the prior-version record for that practice.

This conflicts with content-version mismatch preservation and can erase historical lineage.

Required correction:

- define the product-approved composite identity for progress records;
- preserve prior-version history or migrate it explicitly rather than replacing it silently;
- merge against latest durable state;
- add mixed-version and interleaved-write tests.

## 4.14 Starting another run can overwrite the only active run

`approved-rehearsal/[lessonId].tsx:20-44` creates and saves a new run when the current slot is not resumable for M1 L1. There is no warning/preservation path for another active practice.

Required correction:

- detect any different active run;
- offer resume, save/leave, or explicit discard;
- do not overwrite the single active-run slot silently;
- add cross-practice active-run tests.

---

# 5. Current acceptance classification

```text
Artifact integrity: Verified
Revision-pinned source: Verified
Static security scan: Verified, no finding
Reported focused tests: Implemented, independently rerun evidence incomplete
Accepted practice identity: Not implemented
Approved eight-beat rehearsal: Not implemented
Hope scoreless behavior mapping: Not implemented
Fourth safety route: Not implemented
Strict transcript/audio deletion: Not implemented
Stale-write-safe converted progress: Not implemented
Content-version mismatch preservation: Not implemented
Custom wording consent: Not implemented
Visible countable progress: Not implemented
Real-device microphone/TTS: Blocked
Fan-out: Not authorized
Public launch: Not authorized
```

---

# 6. Required next action

Rork must implement the complete narrow correction request against a new revision, not merely produce more evidence for `c4ff389`.

The correction must include:

1. accepted identity or exact supersession reconciliation;
2. full authored eight-beat exchange and existing Pushback 1 bank;
3. scoreless M1 L1 evidence flags and honest coaching/comparison;
4. Adam restricted to the accepted work context;
5. all four safety routes;
6. strict fail-closed content deletion;
7. active-run identity binding at return/completion;
8. optional Card 21 blanks plus explicit custom-wording consent;
9. stale-write-safe and validated converted progress;
10. content-version mismatch preservation;
11. environment repopulation prevention;
12. visible countable progress;
13. correction of unsupported duration;
14. pinned/bundled authenticity for the executable approved deck;
15. contextual voice isolation so Adam cannot leak into shared non-work scenarios;
16. prior-version progress preservation;
17. cross-practice active-run preservation;
18. real-device evidence after source/test review passes.

Return a new revision-pinned source/evidence ZIP. Do not fan out to the other decks.
