# BYSI Rork page-by-page visual parity handoff

These screenshots are the source-of-truth web render states for the post-rehearsal/onboarding offer flow. Use them as visual acceptance references, not just text inspiration.

Folder files:

1. `01-complete-transcript.png`
2. `02-loading-personalizing.png`
3. `03-communication-baseline-full.png`
4. `04-rewrite.png`
5. `05-practice-shift.png`
6. `06-paywall-1-practice-plan.png`
7. `07-paywall-2-no-surprise-charge.png`
8. `08-paywall-3-start-trial.png`

Generated from the working web component/render states with representative Route A data. The exact user words can vary, but the native app must match the screen sequence, structure, state transitions, data mapping, and offer semantics.

## Source of truth

Working web app:

```txt
https://beforeyousayit.app/experience
```

Web source:

```txt
app/experience/FunnelExperienceClient.js
```

Relevant render states:

```txt
S.transcript
S.generating
S.pressure
S.rewrite
S.shift
S.pay1
S.pay2
S.pay3
```

## Required native sequence

```txt
complete rehearsal
→ complete transcript / approve transcript
→ loading / Personalizing your practice plan
→ communication baseline / pressure screen
→ rewrite screen
→ practice shift screen
→ paywall 1 / practice plan + 7 days free
→ paywall 2 / no surprise charge reminder
→ paywall 3 / start free trial / store checkout state
```

## Current acceptance issue

The native screenshots still looked like an approximation, not parity. Rork must match the screenshots page by page.

Most important fixes:

1. **Starting Index must map real result data.**
   - Do not show `0 of 6 signals observed` for a normal complete rehearsal.
   - Use `starting_index.observed_dimensions`, scores, evidence, `overall`, `focus_dimension`, and `unobserved_dimensions` returned by `/api/generate`.
   - If the API truly returns insufficient evidence, render a separate insufficient-evidence retry screen, not a normal baseline with an empty index.

2. **Offer flow must match web semantics.**
   - Paywall 1: `Your practice plan`, `Start with [module]`, `7 days free`, `$11.99/month or $89.99/year`.
   - Paywall 2: `No surprise charge`, reminder timeline.
   - Paywall 3: `Start your free trial`, real store product/checkout state or explicit IAP blocker.
   - No user-facing `Unlock all modules for testing`.
   - No accepted-flow `Price unavailable`, `Plans unavailable`, or `Preview only` state.

3. **Practice Shift must use the web layout.**
   - `Without practice` column.
   - `With BYSI practice` column.
   - practice/improvement framing.
   - CTA into trial.

4. **No generic debrief fallback.**
   - Once result exists, do not resume stale transcript/generating/debrief state.
   - Follow deterministic state machine only.

## What Rork must return

Do not mark complete until Rork sends ordered native screenshots/video that match these references:

1. Complete transcript
2. Loading
3. Communication baseline top
4. Starting Index section with observed dimensions/scores/evidence
5. Rewrite
6. Practice Shift
7. Paywall 1
8. Paywall 2
9. Paywall 3

Runtime metadata required:

- `/api/generate` response keys present: `pressure_moment`, `starting_index`, `practice_shift`, `recommended_path`
- observed dimensions count and names
- paywall product IDs/prices/trial values or explicit IAP blocker
- proof no developer unlock/debug purchase UI is in accepted path
- proof Hope/Adam voice still works through `/api/tts`

Acceptance remains incomplete until native visual evidence matches these screenshots.
