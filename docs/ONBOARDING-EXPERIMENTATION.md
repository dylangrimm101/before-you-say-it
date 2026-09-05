# BYSI Onboarding Experimentation Operations

## Current state

The codebase now contains a provider-neutral assignment and exposure foundation, but **no experiment is active** and no remote analytics sink exists. `ACTIVE_EXPERIMENTS` remains empty until Dylan approves a specific hypothesis, two variants, measurement contract, privacy disclosure, and stop rule.

This foundation does not change onboarding screens, assign users, transmit events, or publish an OTA update by itself.

## Product principle from the growth evidence

Acquisition and funnel improvements multiply only when the first product experience delivers real value. BYSI should optimize for reaching a truthful spoken-practice outcome—not for maximizing taps, assessment starts, paywall views, or free-result consumption in isolation.

A viral acquisition creative and a converting creative may differ. Preserve source/campaign/placement attribution as coded metadata, but judge onboarding experiments against qualified activation and paid outcomes rather than views alone.

## Recommended first primary metric

**Completed first spoken rehearsal**

This is the first event that proves the user crossed from recognition/setup into the product’s actual mechanism.

Secondary funnel events, each distinct:

1. `onboarding_entry_viewed`
2. `onboarding_meaningful_start` — first answer submitted, not page load
3. `onboarding_completed`
4. `voice_rehearsal_started`
5. `transcript_approved`
6. `free_result_viewed`
7. `paywall_viewed`
8. `trial_started` — storefront/server confirmed
9. `purchase_completed` — RevenueCat/store entitlement confirmed
10. `first_paid_practice_completed`

Do not call a page view a start. Do not call checkout open a purchase. Do not treat free-result completion as paid demand.

## Assignment contract

- Assignment unit: one stable anonymous installation ID until an authenticated identity is deliberately reconciled.
- Sticky: retain the same assignment across restart and ordinary updates.
- Versioned: changing variants or allocation requires a new assignment version.
- Exclusions: Dylan, Hermes, automated QA, App Store reviewers using supplied review credentials, and other internal/test traffic must be tagged or excluded before assignment and analysis.
- Exposure: count once only when the assigned experience actually renders, not when assignment code runs.
- Privacy: persist only coded experiment key, variant key, assignment version, and timestamps. Never include transcript, audio, scenario text, counterpart text, safety answers, email, generated copy, or relationship content.
- Fail closed: malformed, paused, draft, over-allocated, or unknown definitions produce no assignment.

## Experiment design gate

Before activating an experiment, record:

- one hypothesis;
- exactly two variants unless there is a strong statistical reason otherwise;
- the one intended behavioral difference;
- primary metric and guardrail metrics;
- traffic allocation;
- sample and runtime floor;
- stop conditions;
- rollback condition;
- approved screenshots/copy for both variants;
- provider, event endpoint, retention, deletion, and privacy disclosure;
- exact Git commit and matching native runtime.

Do not test a new headline, question order, voice interaction, result framing, and paywall position in one combined variant. The result would not identify which change mattered.

## Measurement infrastructure still requiring approval

A real test still needs an app-owned remote event path or approved experimentation provider. Before adding one:

1. Choose the provider or owned ingestion endpoint.
2. Confirm that it supports sticky assignments and coded exposure/outcome events.
3. Define retention and deletion behavior.
4. Update the public privacy policy and App Store privacy nutrition labels.
5. Enforce a server-side event allowlist and size limits.
6. Reject unknown properties rather than merely stripping them.
7. Separate QA/test traffic at event creation time.
8. Use RevenueCat/store/server confirmation for trial and purchase outcomes.
9. Verify persisted events at the backing store; console logs are not proof.

## Review-prompt learning

A native App Store review prompt can be useful after demonstrated value, but it is separate from onboarding A/B testing. Do not prompt during onboarding, after errors, or before a user receives value. Candidate moments for later review:

- after multiple completed practices;
- after a meaningful streak milestone;
- after a strong evidence-backed improvement moment.

Adding `expo-store-review`, trigger thresholds, and frequency state requires a separate approved UX contract and physical-device test. It is intentionally not active now.

## ASO and acquisition learning

App Store optimization requires more than keywords:

- retention and engagement underpin ranking;
- listing title/keywords/screenshots should match how people search for help;
- Apple Search Ads can extend keyword reach only after activation and conversion are credible;
- UGC should be evaluated separately for reach and conversion;
- internal, scanner, and QA traffic must be excluded from funnel denominators.

These are go-to-market decisions, not reasons to weaken the product or release gates.

## Activation checklist for the first test

- [ ] Dylan approves hypothesis, variants, primary metric, and guardrails.
- [ ] Analytics/experiment provider and privacy treatment are approved.
- [ ] Assignment and event ingestion are implemented with tests.
- [ ] Both variants pass the complete onboarding → spoken rehearsal → result → paywall path.
- [ ] Both variants preserve safety, Back/Close, accessibility, and the earned free result.
- [ ] Exposure fires only after rendered variant confirmation.
- [ ] RevenueCat/server outcomes are canonical for trial/purchase.
- [ ] QA traffic is tagged/excluded.
- [ ] Preview-channel physical-device test passes.
- [ ] Exact commit, runtime, update ID, allocation, and start time are recorded.
- [ ] Production activation receives explicit approval.
