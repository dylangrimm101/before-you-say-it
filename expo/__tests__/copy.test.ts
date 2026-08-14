import { describe, expect, it } from "bun:test";

import { SCENARIOS } from "@/constants/scenarios";

/**
 * Guards the customer-facing voice: American English, second person, and no
 * armchair diagnosis of the other person.
 */

/** Words that would give away a non-American writer. */
const NON_AMERICAN = [
  "mate",
  "bloke",
  "cheers",
  "reckon",
  "brilliant",
  "whilst",
  "chuffed",
  "gutted",
  "sorted",
  "dodgy",
  "innit",
  "mum",
  "quid",
  "fortnight",
  "telly",
  "uni",
  "rubbish",
  "humour",
  "cancelled",
  "apologise",
  "realise",
  "behaviour",
  "recognise",
  "flat",
];

/** Third-person leaks — the app talks to the person, not about them. */
const THIRD_PERSON = ["the user", "user's", "the user's"];

function fields(): { id: string; field: string; text: string }[] {
  return SCENARIOS.flatMap((s) => [
    { id: s.id, field: "title", text: s.title },
    { id: s.id, field: "counterpart", text: s.counterpart },
    { id: s.id, field: "situation", text: s.situation },
    { id: s.id, field: "persona", text: s.persona },
    { id: s.id, field: "goal", text: s.goal },
    { id: s.id, field: "openingLine", text: s.openingLine },
  ]);
}

describe("every scenario reads as American English", () => {
  it("uses no British, Irish or Australian words", () => {
    fields().forEach(({ id, field, text }) => {
      NON_AMERICAN.forEach((word) => {
        const hit = new RegExp(`\\b${word}\\b`, "i").test(text);
        expect(hit, `${id}.${field} contains "${word}": ${text}`).toBe(false);
      });
    });
  });

  it("greets a friend without saying Mate", () => {
    const friend = SCENARIOS.find((s) => s.id === "friend-money");
    expect(friend?.openingLine).toBe(
      "(cheerful) Hey, stranger! Long time. Are we doing Friday or what?",
    );
  });
});

describe("scenarios address the person directly", () => {
  it("never refers to them in the third person", () => {
    fields().forEach(({ id, field, text }) => {
      THIRD_PERSON.forEach((phrase) => {
        expect(
          text.toLowerCase().includes(phrase),
          `${id}.${field} contains "${phrase}": ${text}`,
        ).toBe(false);
      });
    });
  });

  it("writes each situation in second person", () => {
    SCENARIOS.forEach((s) => {
      expect(/\b(you|your|you're|you've)\b/i.test(s.situation), s.id).toBe(true);
    });
  });

  it("describes the counterpart from the reader's point of view, never a user's", () => {
    SCENARIOS.forEach((s) => {
      const label = s.counterpart.toLowerCase();
      expect(label, s.id).not.toContain("user");
      // A relationship suffix must be phrased to the reader ("your partner",
      // "a close friend") rather than about a third party.
      if (label.includes("—")) {
        expect(/\b(your|a|an)\b/.test(label.split("—")[1] ?? ""), s.id).toBe(true);
      }
    });
  });
});

describe("the other person is never diagnosed", () => {
  /** Clinical or trait-labeling language about the counterpart. */
  const DIAGNOSTIC = [
    "narcissist",
    "toxic",
    "manipulative",
    "gaslight",
    "personality disorder",
    "abusive",
    "passive-aggressive",
    "insecure",
    "immature",
    "tends to hear",
    "always hears",
    "incapable",
  ];

  it("uses no clinical or trait-labeling language", () => {
    SCENARIOS.forEach((s) => {
      DIAGNOSTIC.forEach((word) => {
        expect(s.persona.toLowerCase().includes(word), `${s.id}: ${s.persona}`).toBe(
          false,
        );
      });
    });
  });

  it("frames each persona as an observable loop from past attempts", () => {
    SCENARIOS.forEach((s) => {
      expect(
        /past (attempts|mentions|conversations)|before (the|any|either|you|anything)/i.test(
          s.persona,
        ),
        `${s.id} persona is not loop-framed: ${s.persona}`,
      ).toBe(true);
    });
  });
});

/**
 * Typing screens are where the keyboard covers half the display. These are
 * source assertions because the behavior needs a real keyboard to exercise.
 */
describe("typing screens stay usable with the keyboard open", () => {
  /** Every screen with a text field inside a scroll view. */
  const TYPING_SCREENS = ["app/custom.tsx"];

  it("measures the real keyboard overlap instead of scrolling to the end", async () => {
    const hook = await Bun.file(`${import.meta.dir}/../lib/useKeyboardReveal.ts`).text();
    expect(hook).toContain("keyboardDidShow");
    expect(hook).toContain("e.endCoordinates.screenY");
    expect(hook).toContain("measureInWindow");
    // Scrolling to the end overshoots past the footer padding and throws the
    // content off the top of the screen, hiding the question being answered.
    expect(hook).not.toContain("scrollToEnd");
  });

  it("leaves the content alone when there is no overlap", async () => {
    const hook = await Bun.file(`${import.meta.dir}/../lib/useKeyboardReveal.ts`).text();
    expect(hook).toContain("if (overlap <= 0) return;");
  });

  it("keeps onboarding copy inside a bounded card above its action dock", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("styles.questionDeck, { marginBottom: showsFooter ? 20 : insets.bottom + 20 }");
    expect(onboarding).toContain("questionDeck: { flex: 1, position: \"relative\", marginHorizontal: 20 }");
    expect(onboarding).toContain("questionCard: { position: \"absolute\", left: 0, right: 0, bottom: 0");
    expect(onboarding).toContain("contentContainerStyle={styles.cardContent}");
  });

  it("keeps onboarding text entry multiline and keyboard-aware", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).toContain("<KeyboardAvoidingView");
    expect(onboarding).toContain("multiline maxLength={500}");
    expect(onboarding).toContain('keyboardDismissMode="interactive"');
  });

  it("corrects relative to the current offset, never absolutely", async () => {
    const hook = await Bun.file(`${import.meta.dir}/../lib/useKeyboardReveal.ts`).text();
    expect(hook).toContain("scrollY.current = e.nativeEvent.contentOffset.y");
    expect(hook).toContain("scrollY.current + overlap");
  });

  it("never lifts more than the overlap, so the heading cannot be pushed off", async () => {
    const hook = await Bun.file(`${import.meta.dir}/../lib/useKeyboardReveal.ts`).text();
    // Clamped at zero: a correction can only ever move content down to the top.
    expect(hook).toContain("Math.max(0, scrollY.current + overlap)");
  });

  it("is shared by every typing screen rather than reimplemented", async () => {
    for (const screen of TYPING_SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(source, `${screen} must use the shared hook`).toContain("useKeyboardReveal(");
      expect(source, `${screen} must not scroll to the end`).not.toContain("scrollToEnd");
    }
  });

  it("tracks focus per field, so screens with two inputs lift the right one", async () => {
    const custom = await Bun.file(`${import.meta.dir}/../app/custom.tsx`).text();
    expect(custom).toContain("onFocus={() => trackFocus(textCard.current)}");
    expect(custom).toContain("onFocus={() => trackFocus(outcomeCard.current)}");
  });

  it("clears the sticky footer using a measured height, not a magic number", async () => {
    for (const screen of TYPING_SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(source, screen).toContain(
        "onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}",
      );
      // The exact clearance differs per screen; what matters is that it is
      // derived from the measured footer rather than a hardcoded inset.
      expect(source, screen).toMatch(/paddingBottom: footerHeight \+ \d+/);
    }
    // The old guessed insets left fields stranded under the keyboard.
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(onboarding).not.toContain("insets.bottom + 190");
  });

  it("dismisses the keyboard when the onboarding step changes", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(source).toContain("Keyboard.dismiss()");
  });

  it("lets the keyboard be swiped away on every typing screen", async () => {
    for (const screen of TYPING_SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(source, screen).toContain('keyboardDismissMode="interactive"');
    }
  });
});

/**
 * Dictating and typing are two ways to answer the same question, and they must
 * never be on screen at once: raising the keyboard on a mic tap buries the
 * recording state and the line being captured.
 */
describe("tapping the mic never brings up the keyboard", () => {
  /** Every screen where a mic button sits next to a text field. */
  const MIC_SCREENS = [
    "app/drill/[id].tsx",
    "app/rehearse/[id].tsx",
  ] as const;

  it("blurs the field and dismisses the keyboard on every mic tap", async () => {
    for (const screen of MIC_SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      // Blur alone is not enough on iOS, and dismiss alone leaves focus behind,
      // so both are required wherever the mic can be tapped.
      expect(source, `${screen} must blur the field`).toMatch(/\.current\?\.blur\(\)/);
      expect(source, `${screen} must dismiss the keyboard`).toMatch(/Keyboard\.dismiss\(\)/);
    }
  });

  it("keeps the field non-editable while recording, so focus cannot return", async () => {
    const drill = await Bun.file(`${import.meta.dir}/../app/drill/[id].tsx`).text();
    expect(drill).toContain('editable={!scoring && dictation.status !== "recording"}');
  });

  it("shows the answer box as listening while the mic is open", async () => {
    for (const screen of ["app/drill/[id].tsx"]) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(source, screen).toContain('"Listening…"');
    }
  });

  it("does not shadow the keyboard icon with the platform module in rehearsal", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    // This file renders a lucide `Keyboard` icon, so the react-native module has
    // to be aliased or the icon silently becomes a native module at runtime.
    expect(source).toContain("Keyboard as RNKeyboard");
    expect(source).toContain("RNKeyboard.dismiss()");
  });
});

/** The primary action has to look tappable and stay legible in both states. */
describe("the primary button reads as a real button", () => {
  it("has side padding, so it does not collapse to its label width in a row", async () => {
    const source = await Bun.file(`${import.meta.dir}/../components/ui.tsx`).text();
    expect(source).toContain("paddingHorizontal: 28");
  });

  it("draws the disabled state as an outline instead of a pale fill", async () => {
    const source = await Bun.file(`${import.meta.dir}/../components/ui.tsx`).text();
    expect(source).toContain("primaryDisabled");
    // The old pale fill was within a few percent of the paper background, so
    // the button effectively vanished until it became enabled.
    expect(source).not.toContain("backgroundColor: disabled ? C.surfaceHigh : tone");
  });

  it("uses readable type on the disabled state, not the faintest gray", async () => {
    const source = await Bun.file(`${import.meta.dir}/../components/ui.tsx`).text();
    expect(source).toContain("color: disabled ? C.textDim : C.onAccent");
    expect(source).not.toContain("color: disabled ? C.dim : C.onAccent");
  });

  it("can flex inside a row via the pressable, not the animated surface", async () => {
    const ui = await Bun.file(`${import.meta.dir}/../components/ui.tsx`).text();
    // Layout on the inner view does nothing for the room the pressable claims,
    // so callers that place the button in a row need the outer hook.
    expect(ui).toContain("containerStyle");
    expect(ui).toContain("style={containerStyle}");
  });

  it("keeps the onboarding footer opaque enough to sit over scrolling content", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    // The bar is translucent over a real blur on native. Web has no blur to
    // sit on, so it must fall back to a nearly opaque fill or the button ends
    // up reading through the transcript scrolling underneath it.
    expect(source).toContain("BlurView");
    expect(source).toContain('Platform.OS === "web" ? C.barSolid : C.bar');

    const theme = await Bun.file(`${import.meta.dir}/../constants/theme.ts`).text();
    expect(theme).toContain('barSolid: "rgba(247,247,250,0.97)"');
  });
});

describe("the debrief only claims what it can measure", () => {
  it("renders no scores or delivery claims in the conversion debrief", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(source).not.toContain("ScoreRing");
    expect(source).not.toContain("Meter");
    expect(source).not.toContain('label: "Composure"');
    expect(source).not.toContain("audioAnalysed: true");
  });

  it("omits delivery scoring from the progress tab too", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/(tabs)/progress.tsx`).text();
    expect(source).not.toContain('key: "composure"');
    expect(source).not.toContain('label: "Stayed steady"');
    expect(source).not.toContain('label: "Composure"');
    expect(source).not.toMatch(/Delivery|seventh signal/i);
    expect(source).toContain("progressHistoryPresentation(scoredPracticeHistory)");
  });

  it("keeps third-person phrasing out of the roleplay instructions", async () => {
    const source = await Bun.file(`${import.meta.dir}/../constants/scenarios.ts`).text();
    const ai = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    // These strings are fed to the model; "the user" phrasing there tends to
    // echo back into customer-facing output.
    [source, ai].forEach((text) => {
      expect(text).not.toContain("if the user stays");
      expect(text).not.toContain("unless the user");
      expect(text).not.toContain("what the user said");
    });
  });

  it("contrasts the learner’s exact wording with the authored practice target", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    expect(source).toContain("You said");
    expect(source).toContain("One adjustment");
    expect(source).not.toContain("Moments that cost you");
    expect(source).not.toContain("Where you went wrong");
  });

  it("keeps quantified and personality claims out of the conversion screen", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/debrief/[id].tsx`).text();
    ["communication type", "relationship health", "confidence score", "empathy score", "predicted"].forEach((claim) => {
      expect(source.toLowerCase()).not.toContain(claim);
    });
  });

  it("forbids the coach from commenting on tone or delivery", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    expect(source).toContain("You cannot hear the recording");
    expect(source).toContain("Never comment on tone, volume, pace, pitch, delivery, emotion, or confidence");
  });

  it("instructs the scenario builder to use second person and no diagnosis", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    expect(source).toContain("or third-person phrasing about them");
    expect(source).toContain("Do not label, diagnose or pathologize them");
    expect(source).toContain("describe the observable loop, not a diagnosis");
  });
});
