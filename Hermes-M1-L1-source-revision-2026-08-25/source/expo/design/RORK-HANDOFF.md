# FINAL PURPLE — Rork handoff spec

Authoritative source: `final-purple-standalone.html` (self-contained, no network fetch needed).
This file replaces `final-purple.html` **wholesale**. It is a revision of the whole system, so
re-verify `theme.ts` before touching screens.

---

## 0. Diff against the current build

Observed in the Rork preview on 2026-08-01. All four are wrong:

| # | Current build | Correct |
|---|---|---|
| 1 | Primary button is green (`Start Day 1`) | Purple `#512888`, white label |
| 2 | "28-Day Communication Challenge" | **"30-Day Conversation Practice"** everywhere. No "challenge". |
| 3 | Today is the first screen, program-list layout with day rows + week dots + "Do today's rep to light the flame" | Today is the **last** screen. One hero card + streak line + Next-up list. No flame copy. |
| 4 | White/cream flat cards | Translucent glass over a cool violet gradient field (see §2) |

Also remove: "DAY STREAK" as a large numeral tile, the `#1` badge, per-day progress `0%`.

---

## 1. Tokens (`theme.ts`)

```ts
export const color = {
  field:      '#F2F2F6',   // gradient field base
  fieldDeep:  '#DEDCE8',
  glass:      'rgba(255,255,255,0.52)',
  glassEdge:  'rgba(255,255,255,0.62)',
  glassHigh:  'rgba(255,255,255,0.62)',  // selected rows
  purple:     '#512888',   // primary buttons, active accents
  purpleDeep: '#3C1D66',   // pressed
  text:       '#171A1F',
  textSoft:   '#4B5259',
  textDim:    '#5B646E',   // captions
  dim:        '#646D77',   // eyebrows — do NOT lighten, this is the AA floor
  sage:       '#5C8A6E',   // what worked, positive score
  clay:       '#B4823F',   // caution, verdict tier, tension
  danger:     '#B1402F',
  onAccent:   '#FFFFFF',
};
```

**Contrast rule:** `#646D77` is the lightest gray permitted on the field. Never use
`#98A0A9` or lighter for 11–15px labels.

### Field background (every screen)
```css
background:
  radial-gradient(125% 75% at 15% 0%,   #FDFDFE 0%, rgba(253,253,254,0) 55%),
  radial-gradient(115% 70% at 100% 18%, #DFDCEC 0%, rgba(223,220,236,0) 62%),
  radial-gradient(140% 85% at 55% 105%, #DED5EA 0%, rgba(222,213,234,0) 58%),
  #F2F2F6;
```

### HeroSurface (Today's rep card only — one per screen, max)
```css
background: linear-gradient(158deg, #4A2380 0%, #512888 34%, #63409B 70%, #7B62AC 100%);
border-radius: 28px;
box-shadow: inset 0 1px 0 rgba(255,255,255,.45),
            0 2px 2px  rgba(81,40,136,.10),
            0 14px 30px rgba(81,40,136,.22),
            0 34px 64px rgba(81,40,136,.26);
```
Dark end is at the **top** so the eyebrow/title/meta clear AA. All text on it is white
(eyebrow `rgba(255,255,255,.86)`, description `rgba(255,255,255,.72)`).
Two pale receding layers sit behind it at 30% and 44% white, offset 22px/11px, and
parallax at 0.06× / 0.03× scroll.

### GlassCard (all other cards)
```css
background: rgba(255,255,255,.52);
backdrop-filter: blur(24px);
border: 1px solid rgba(255,255,255,.62);
border-radius: 28px;
box-shadow: 0 1px 1px rgba(28,36,48,.04),
            0 8px 18px rgba(28,36,48,.07),
            0 24px 48px rgba(28,36,48,.09);
```

---

## 2. Type — Plus Jakarta Sans only, 6 steps

| Role | Spec |
|---|---|
| Display | 28 / 1.18 / 600 |
| Title | 20 / 1.28 / 600 |
| Body | 17 / 1.55 / 400 |
| Support | 15 / 1.5 / 400 · textSoft |
| Caption | 13 / 1.45 / 400 · textDim |
| Eyebrow | 11 / 600 / 1.6px tracking / uppercase · dim |

No second typeface. No sizes outside this list.

---

## 3. Geometry

- Horizontal padding **22** on every screen, no exceptions
- Vertical rhythm 8 / 12 / 16 / 24 / 32
- Radius: sm 14 · md 18 · lg 28
- **Primary button: 56 h, 18 radius** · **Ghost: 52 h, 18 radius, 1px `rgba(23,26,31,.20)`**
- Chips / category filters: pill (999)
- Mic: circular, 88 visual in 104 target
- Pill CTA permitted **only** inside HeroSurface (the white `Start today's rep` button)
- Min tap target 44×44 everywhere

---

## 4. Screens (order)

Interactive flow ends on Today:

`Setup 1 → 2 → 3 → 4 → 5 → Rehearsal → Reviewing → Debrief → Paywall → Retry → Today`

1. **Setup 1** — "What conversation do you need to have?" textarea + dictate, 500 char counter
2. **Setup 2** — "Who are you talking with?" Partner / Family / Work / Friends (pills)
3. **Setup 3** — "Who should the counterpart sound like?" Hope / Adam, each w/ 44pt preview play
4. **Setup 4** — "How do they usually react to you?" 8 options incl. "I'm not sure"
5. **Setup 5** — outcome field + practice difficulty (Gentle / Steady / Challenging)
6. **Rehearsal** — 13 states, see §5
7. **Reviewing** — "Reviewing the transcript from this rehearsal."
8. **Debrief** — score ring + verdict, what worked / what to change, script, next skill
9. **Paywall** — free vs. practice, Monthly / Yearly
10. **Today** — hero card + streak line + active scenario + Next-up list
11. Scenarios · Progress · Progress-empty · Drill · Custom builder · Privacy · Safety check
12. Two keyboard states (Setup 1, Composing)

Steps 2–4 advance on tap ("Tap an option to continue" replaces the button).
Steps 1 and 5 have an explicit primary. Back on step 1 is inert.

---

## 5. Rehearsal states

Five named + eight recovery. Dock shows: status dot + eyebrow label + support sentence + controls.

| State | Dock controls | Mic |
|---|---|---|
| Empty | mic, keyboard, speaker | ready, tappable |
| Listening | mic, keyboard, speaker | filled purple, live halo |
| Speech detected | same | live waveform |
| Composing | editable transcript + Say it again / Send it | replaced by field |
| Waiting | thinking dots | **replaced**, not greyed |
| Speaking | Analyze (disabled) / Stop / Mute | **replaced** by playback pair |
| Complete | Analyze / Replay / Back to today | retired |
| Permission, Autoplay blocked, Playback failed, Paused, Mic blocked, Connection lost | recovery buttons | per state |

Rules:
- Recognition **never** auto-submits. Composing always ends in an explicit tap.
- The mic is **removed and replaced** during Waiting and Speaking — never disabled in place.
- Analyze stays disabled while audio plays.
- No chat bubbles. User line = 17/400; counterpart = 20/500. Weight marks the speaker.

---

## 6. Icons (SF Symbols, 1.7 stroke, 22–26 visual, 44 target)

| Name | Use | A11y label |
|---|---|---|
| `mic.fill` | record a turn | "Start recording" |
| `mic.slash` | mic blocked | "Microphone is off — open Settings" |
| `stop.fill` | stop record / playback | "Stop" |
| `play.fill` | preview a voice | "Hear a sample" |
| `speaker.wave` | audio on | "Mute Marcus" |
| `speaker.slash` | muted | "Unmute Marcus" |
| `keyboard` | type instead | "Type this turn instead" |
| `arrow.clockwise` | retry send | "Retry sending" |
| `checkmark` | rep complete | "Rehearsal complete" |

Pressed: 0.972 scale + 6% ink overlay, no color change. Disabled: 38% opacity, hit test removed.
No text glyphs (`abc`, `vol`, `||`) anywhere.

**Status bar:** `9:41` in the designs is illustrative. Use the native status bar and real
safe-area insets — do not hardcode 59 / 34.

---

## 7. Motion

| Moment | Spec |
|---|---|
| Option / CTA press | purple wipes L→R, `background-size 0%→100%`, 440ms `cubic-bezier(.3,0,.2,1)`; label flips to white at 50% |
| Question advance | slide in from right + 0.985→1 scale, 340ms, fires after the wipe (470ms) |
| Mic listening | bars + halo track live input level; ease flat over ~600ms on stop |
| Counterpart reply | words fade in 42ms apart |
| Send it | composing card lifts and settles into the transcript |
| Score ring | arc draws clockwise + number counts, 1100ms ease-out cubic |
| Dimension meters | stagger 70ms apart, slight overshoot |
| Tension meter | animates with overshoot, never jumps |
| Hero layers | parallax 0.06× / 0.03× of scroll |

**Reduce Motion:** all of the above resolve instantly to end state.

---

## 8. Demo data — one authoritative rehearsal

Use these exact values in Debrief **and** Progress. Do not vary them.

```
scenario:   "Get a rent repayment plan"
counterpart:"Marcus" (roommate and friend, Adam's voice)
difficulty: "Steady"
programDay: 1
linesSpoken: 2
overall:    58        tier: "Building"
clarity:    58
empathy:    62
assertive:  45
steady:     68
```

Situation text: "My roommate is two months behind on rent and I keep letting it slide." (62 / 500)
Outcome: "A specific amount and a date he commits to out loud."

Entitlement: free = one spoken rehearsal + one full debrief + script. Paid = spoken retries,
continued rehearsals, the 30-day progression.

---

## 9. Dynamic — never hardcode

pricing · currency · subscription period · trial language · Terms/Privacy URLs · all scores and
tier labels · all feedback text and script lines · scenario records · program day/block/lesson/lock
state · crisis resources (region-resolved; the 988 and DV numbers are US fixtures) · retention copy.

---

## 10. Privacy copy

- Persistent label: **"Private practice"**
- Review screen: "Reviewing the transcript from this rehearsal."
- Instead of "nothing is shared": **"Your practice isn't shared with the person you're rehearsing about."**
- Transcripts are described as kept with the account until deleted; no audio recordings retained.
- Do not assert both device-local and account-scoped storage.

⚠️ **This copy is design intent, not a legal statement.** Confirm audio capture, transcription,
storage location, retention period and deletion behavior against the built architecture and update
the strings to match before shipping.

---

## 11. Overflow

| Case | Behavior |
|---|---|
| Long scenario title | wrap max 3 lines, then ellipsis. Never shrink type. |
| Long counterpart name | header = first name only, one line; relationship moves to scene block |
| Max situation text | 500 chars; field scrolls past 6 lines; counter turns danger at 480; Continue disabled at 0 |
| Larger Dynamic Type | every screen scrolls; buttons grow in height; dock stacks vertically above accessibility XL |
| Long counterpart reply | transcript is the scroll region; auto-scroll only if already at bottom; dock never moves |
| No audio analysis | omit composure entirely (not zero) + caption explaining why |
| 375pt width | 22 padding holds; chip rows scroll horizontally; 64pt row minimums hold |

---

## 12. Keyboard

Fixed: top bar + step progress. CTA rides directly above the keyboard on the safe-area inset.
Scrolls: question + text field only; heading may scroll off.
Dismiss: "Done" in the accessory row, tap outside, or downward drag. Return inserts a newline —
never submits. Dictation and keyboard are mutually exclusive.
Composing field is the same component as Setup 1. "Send it" stays enabled with edited text;
"Say it again" discards the edit and returns to Listening.
