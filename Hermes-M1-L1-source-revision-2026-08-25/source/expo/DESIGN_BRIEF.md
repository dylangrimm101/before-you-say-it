# Before You Say It — Redesign Brief

> **Superseded in part.** This was the brief written to *commission* the redesign.
> The redesign has since been delivered and accepted: the source of truth for every
> visual decision is now **`expo/design/final-purple.html`**. Read that file for
> tokens, type, spacing, and per-screen layout before changing any styling — do not
> work from memory or from a summary of it.
>
> Sections 1 (Product), 2 (Platform constraints) and the locked product rules still
> apply. **Section 3 ("Current design language") is obsolete** — it describes the
> retired warm-paper/serif aesthetic and explicitly warns against the purple
> direction that was subsequently chosen. Ignore it.

Hand this to the design tool alongside the screenshots. It defines what the app is,
what must not change, and the exact tokens and constraints the redesign has to live inside.

---

## 1. Product

**Before You Say It** is an iOS/Android app for rehearsing hard conversations out loud
before you actually have them — asking for a raise, setting a boundary with a parent,
breaking bad news, confronting a friend.

The user picks a scenario, speaks their opening line, an AI counterpart answers back in a
real voice, and afterwards they get a debrief scoring how they did plus a script they can
use in real life. The paid program is a **30-Day Conversation Practice**.

**Emotional job:** lower the dread. The user opens this app because something is scary.
The interface should feel calm, private, and steady — like a quiet room, not a coach
yelling at them.

Never call the program a "challenge." It is the **30-Day Conversation Practice**.

---

## 2. Platform constraints — important

This is a **React Native (Expo)** app, not a website. Designs must be implementable with
native mobile primitives.

**Available**
- Native scroll views, sheets, tab bar, modals, text inputs
- Flexbox layout, absolute positioning
- Linear gradients, SVG, shadows, blur
- Animated transitions, spring physics, haptics
- Vector icons (Lucide icon set)

**Not available / avoid**
- Hover states, cursors, right-click
- CSS grid, `position: sticky`, backdrop-filter tricks
- Web page patterns: hero sections with nav bars, footers, breadcrumbs, sidebars,
  multi-column desktop layouts
- Arbitrary custom fonts unless we bundle them (name the font explicitly if you want one)
- Text on top of busy photography

**Design for**
- 393 × 852 pt (iPhone 15/16). Also check 375 pt wide.
- Safe areas: ~59 pt top, ~34 pt bottom
- Thumb reach — primary actions belong in the bottom third
- Minimum 44 × 44 pt touch targets

---

## 3. Current design language

The existing aesthetic is **warm paper, ink type, clay accents** — quiet, editorial, analog.
The redesign brief is "more minimalistic and modern." Keep the warmth; strip the ornament.
Do not swap this for a generic dark-mode SaaS look or a purple-gradient-on-white look.

### Color tokens

| Token | Value | Used for |
|---|---|---|
| `bg` | `#F5EFE4` | App background (warm paper) |
| `bgDeep` | `#EDE4D4` | Gradient bottom |
| `elevated` | `#FBF5E9` | Gradient top |
| `surface` | `#FFFDF7` | Cards |
| `surfaceHigh` | `#F2DFD6` | Raised/selected surfaces |
| `line` | `rgba(38,33,25,0.10)` | Hairline borders |
| `lineStrong` | `rgba(38,33,25,0.20)` | Emphasized borders |
| `text` | `#262119` | Primary type (ink) |
| `textSoft` | `#514A3E` | Secondary type |
| `textDim` | `#746B5C` | Tertiary type |
| `dim` | `#8A8172` | Eyebrows, captions |
| `ember` | `#A94F38` | **Primary accent** (clay red) |
| `emberSoft` | `rgba(169,79,56,0.10)` | Accent tint fill |
| `mint` | `#5F7355` | Success / positive score |
| `mintSoft` | `rgba(95,115,85,0.12)` | Success tint |
| `amber` | `#B4832E` | Caution |
| `crimson` | `#843B2A` | Warning / high tension |
| `blue` | `#4F6C8F` | Informational |
| `onAccent` | `#FBF5E9` | Type on a filled accent surface |

Light theme only today. If you propose dark mode, supply the full parallel token set.

### Typography

- **Display / headings:** Georgia (iOS), serif (Android). The serif is the brand.
- **Body / UI:** system sans (SF Pro / Roboto).
- **Mono:** Menlo / monospace — used sparingly.
- Weights in use: 500, 600, 700.
- Current sizes: 9, 10, 11, 12, 13, 14, 15, 16, 17, 20, 26, 28.
  The scale is noisy — **please rationalize it into ~6 steps.**
- **Eyebrow label:** 11 pt, 600, uppercase, 1.6 letter-spacing — a signature element.

### Spacing, radius, elevation

- Screen horizontal padding: **22 pt** (dominant), sometimes 16/20/24 — **please unify.**
- Gaps in use: 8, 10, 12, 14, 16.
- Radii: `sm 10`, `md 16`, `lg 22`, `xl 28`. `md` is the default.
- Cards: `surface` fill + hairline `line` border, minimal shadow.
- Primary button: 56 pt tall, `md` radius, `ember` fill, soft colored shadow.
- Ghost button: 52 pt tall, `md` radius, 1 pt `lineStrong` border, no fill.

### Motion (already built — keep hooks for it)

- `Reveal` — staggered fade + 16 pt rise on mount, 70 ms per index
- `PressCard` — spring scale to 0.972 on press, with haptics
- `Meter` — horizontal bar animating to value over 900 ms
- `ScoreRing` — SVG ring filling clockwise with a counting number, success haptic on land
- `Waveform` — 5 animated bars while the AI voice generates or speaks
- `Thinking` — 3 breathing dots while the counterpart composes a reply

---

## 4. Component inventory

Reuse these names in the design so the mapping to code is one-to-one:

`Backdrop` (paper gradient wash) · `Eyebrow` · `PressCard` · `PrimaryButton` ·
`GhostButton` · `Reveal` · `Meter` · `ScoreRing` · `Waveform` · `Thinking`

New components are welcome — just name them and specify size, color token, radius,
and state variants (default / pressed / disabled / selected).

---

## 5. Screens to redesign

### Onboarding — 5 steps
Full-screen, one question per step, progress bar at top reading "Step N of 5",
primary action pinned at the bottom.
1. **The dread** — free-text input: what you dread saying. Needs 8+ characters.
2. **Focus** — pick one of several focus options.
3. **Voice** — pick the counterpart's voice: Hope (woman) or Adam (man). Playable preview.
4. **Reaction** — how they usually react to you.
5. **Outcome** — free text, dictation supported: what you want out of this.
   Submitting builds a personalized scenario and drops the user straight into a rehearsal.

### Tab 1 — Today
Streak flame, today's rep prompt, the active scenario card, quick entry to practice.
Copy in play: "One rep today keeps it alive." / "Do today's rep to light the flame."

### Tab 2 — Scenarios (library)
Browsable list of scenario cards grouped by category, plus custom scenarios the user
wrote. Needs a clear entry point to build a new one.

### Tab 3 — Progress
Streak, score trend over recent reps, four skill dimensions
(**Clarity**, **Empathy**, **Assertiveness**, **Stayed steady**), session history with
swipe-to-delete, and a reminders/notifications card. Has an empty state: "No reps logged yet."

### Scenario detail
Title, setup, who the counterpart is, what makes it hard, and a single
"Start the rehearsal" action.

### Rehearsal — the core screen, 5 states
A live conversation. Voice or text. Please treat this as the centerpiece.
1. **Empty** — before the first line; mic is the hero
2. **Composing** — dictated or typed text, editable, explicit submit (never auto-sends)
3. **Waiting** — counterpart thinking (`Thinking` dots); mic must read as disabled
4. **Speaking** — counterpart reply visible and playing (`Waveform`); mic still disabled
5. **Complete** — after the free rep's last reply: a completion card with
   **Analyze your rep** (disabled while audio plays) and an optional **Replay response**.
   Copy: "Nothing moves on until you choose."

Also visible: a live tension meter, and free-tier progress like "free rehearsal · 1 of 2".

### Debrief
The payoff screen. Overall score ring with a verdict tier
("You could have this conversation today." / "Almost there" / "Building" / "Keep repping"),
the four dimension meters, what worked, what to change, a **real-conversation script**
with copy-to-clipboard, a next-skill preview, and "Back to today."

### Drill
A short two-minute focused exercise.

### Custom scenario builder
Form to write your own scenario: situation, counterpart, their typical reaction, desired outcome.

### Paywall
Free vs. paid. Free includes onboarding, one short spoken rehearsal, one full personalized
debrief, the real-conversation script, and a next-skill preview. Paid unlocks retries,
continued spoken rehearsals, targeted feedback, and the 30-day progression.
Tone: calm and honest. No countdown-timer pressure tactics.

### Privacy
Plain-language explanation of what is recorded, what is stored, and how to delete it.
This screen is a trust asset — it should feel considered, not like boilerplate.

### Safety check
Shown when a rehearsal touches something genuinely risky. Serious, warm, non-clinical.
Offers a way out and real resources.

---

## 6. What must not change

These are product rules, not style preferences:

- Speech recognition **never auto-submits**. Submission is always an explicit action.
- The mic is **visibly disabled** while the counterpart is generating or speaking.
- The debrief is **user-initiated** via "Analyze your rep" — never automatic.
- Tone/pacing/composure are **not** scored unless real audio was analyzed.
- Customer-facing name is **Before You Say It**; the program is the
  **30-Day Conversation Practice**.
- No paywall before the first rehearsal.
- No raw errors, JSON, markdown, or role prefixes ever visible in the UI.

---

## 7. What to fix in the redesign

Concrete direction — "minimalistic and modern" applied to this specific app:

1. **Rationalize the type scale** from 12 sizes to ~6.
2. **Unify horizontal padding** to a single value across every screen.
3. **Reduce card weight.** Fewer borders and fills; lean on whitespace and type hierarchy
   for grouping.
4. **One accent, used with restraint.** `ember` should mark the single most important
   action on a screen, not every interactive element.
5. **Make the rehearsal screen calmer.** It currently carries the most chrome and it is
   the moment the user is most anxious. Strip it to: the conversation, the mic, and one
   next action.
6. **Keep the serif.** It is the brand and it separates this from every other AI app.
   Modernize around it rather than replacing it.

---

## 8. Deliverables

Per screen, please provide:
- The layout at 393 × 852 pt
- Every interactive state (default / pressed / disabled / selected / loading / empty / error)
- Exact spacing, sizes, and color tokens by name from §3
- Any new component specified by size, radius, token, and states
- Real copy, not lorem ipsum — the writing carries this product

Deliver as images, a Figma file, or a written spec. Any of the three is implementable.
