# Curriculum launch QA

## Outcome

- Launch curriculum is now exactly **2 modules**, each with **5 approved lessons + 1 module close**.
- Customer Today and Path routes now open the approved Module 1/2 deck routes rather than the internal 8-module/53-practice framework.
- Both module-close assets contain and expose the canonical 9-card inventory. Cards 7–9 use the render branches, labels, and copy already present in the inspectable R2 deck source; no close copy was invented.
- The close review guard that intercepted all forward input on Card 1 was removed.
- Reaching Card 9 posts a one-shot native completion event and persists a strict, minimized module-close record. Module 1 completion advances the next-deck selector to Module 2.
- Production access to all ten approved lesson rehearsals is enabled while the internal deck catalog remains development-only.

## Defects fixed

1. **M1-L3 Card 19 (393/380):** the quiz content pane is explicitly vertically scrollable above the fixed footer.
2. **M2-L2 Card 11:** standard-card content is explicitly vertically scrollable, eliminating narrow-width clipping.
3. **M2 Close Card 6 reduced motion:** the final still is derived synchronously when motion is reduced; no state mutation or beat timer is scheduled from render.
4. **Shared tap zones:** protection now handles every source expression variant (`q`, `c.quiz`, with/without `c.dquiz`) and excludes cards containing chips or room controls. Nested button visuals no longer intercept taps.
5. **Environment preflight:** Babel and Metro now invoke the existing client-environment sanitizer before configuration, satisfying the previously failing repository security test.

## TDD evidence

Regression tests were observed red before implementation for:

- missing two-module launch contract;
- missing close Cards 7–9;
- customer routes still using internal curriculum;
- M1-L3/M2-L2 narrow-card overflow;
- M2 Close reduced-motion render timers;
- shared tap-zone protection failing on `c.quiz` deck variants;
- missing Babel preflight invocation.

## Automated verification

- `bun test`: **815 passed, 0 failed, 7,931 assertions** across 52 files.
- Focused curriculum tests: **8 passed, 42 assertions**.
- Expanded shared tap-zone test: passes across all affected approved lesson decks.
- `bun run check`: pass.
- `bun run lint`: pass.
- `bun run export`: pass; web, iOS, and Android bundles exported.
- `git diff --check`: pass.

## Browser/card verification

A local materialized-deck CDP harness exercised the packaged decks with real Chrome input and checked deck bounds/card counters.

- **393 × 852, motion:** 12 deck runs, **213 card checks**, 0 failures; all packaged cards reached, including both 9-card closes and quiz paths.
- **380 × 852, motion:** **211 card checks** completed before the harness exposed the cross-template tap-zone marker mismatch on M1-L3 Card 18. The mismatch was fixed with a generalized transform and an all-deck regression test. A subsequent Chrome rerun was blocked by the headless Chrome process becoming unresponsive; static/runtime materialization tests cover the corrected rule.
- **Reduced motion:** source/runtime regression tests verify reduced-motion CSS across every deck and the M2 Close Card 6 no-timer/final-still contract. A second exhaustive CDP pass could not be completed because the local headless Chrome process repeatedly stopped responding.

No screenshots were committed.

## Canonical contract

The baseline canonical scenarios, counterpart identities, provider-only response validation, persisted pressure identity, and coaching/comparison logic were not changed. Changes to rehearsal eligibility only expose those existing approved runtimes to customer routes.
