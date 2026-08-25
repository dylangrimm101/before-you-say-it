import { describe, expect, it } from "bun:test";

import {
  DEFAULT_PERSONA,
  PERSONAS,
  genderFor,
  genderPromptLine,
  isPersonaVoice,
  personaForGender,
  personaFor,
  voiceForRehearsal,
  voiceForScenario,
  voiceIdFor,
} from "@/constants/personas";
import { SCENARIOS } from "@/constants/scenarios";
import { playRunBoundPilotAudio } from "@/lib/moduleAudio";
import { playSharedScenarioPressure } from "@/lib/scenarioAudio";
import type { PersonaVoice } from "@/types/convo";

/**
 * A voice/gender mismatch is silent in code but obvious to a customer: they
 * pick a woman's voice and hear a man, or read "Daniel" and hear a woman.
 */
describe("the chosen voice, gender and name always agree", () => {
  it("offers exactly one woman's voice and one man's voice", () => {
    expect(PERSONAS.map((p) => p.gender).sort()).toEqual(["man", "woman"]);
  });

  it("gives every persona a distinct voice id", () => {
    const ids = PERSONAS.map((p) => p.voiceId);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id.length).toBeGreaterThan(10);
  });

  it("labels each option with the gender it actually speaks in", () => {
    for (const p of PERSONAS) {
      const expected = p.gender === "woman" ? "Woman" : "Man";
      expect(p.label, `${p.id} label must say ${expected}`).toContain(expected);
      // The name in the label is what the customer remembers the voice by.
      expect(p.label).toContain(p.name);
    }
  });

  it("keeps the persona id consistent with its gender", () => {
    for (const p of PERSONAS) expect(p.id.startsWith(p.gender)).toBe(true);
  });

  it("resolves a voice id for both personas", () => {
    for (const p of PERSONAS) expect(voiceIdFor(p.id)).toBe(p.voiceId);
  });

  it("falls back to a real persona for an unknown saved value", () => {
    // Older profiles may hold a value that no longer exists.
    const stale = "woman-grace" as (typeof PERSONAS)[number]["id"];
    expect(personaFor(stale).id).toBe(DEFAULT_PERSONA);
  });

  it("maps a gender back to the matching voice", () => {
    expect(genderFor(personaForGender("woman"))).toBe("woman");
    expect(genderFor(personaForGender("man"))).toBe("man");
  });

  it("states the counterpart's gender to the model in both directions", () => {
    expect(genderPromptLine("woman")).toContain("You are a woman");
    expect(genderPromptLine("woman")).not.toContain("You are a man");
    expect(genderPromptLine("man")).toContain("You are a man");
    expect(genderPromptLine("man")).not.toContain("You are a woman");
  });
});

describe("a gender-locked counterpart keeps its own voice", () => {
  it("overrides the preference so a dad never speaks as a woman", () => {
    const dad = SCENARIOS.find((s) => s.id === "parent-comingclean");
    expect(dad?.counterpartGender).toBe("man");
    expect(genderFor(voiceForScenario(dad ?? {}, "woman-hope"))).toBe("man");
  });

  it("overrides the preference so a mom never speaks as a man", () => {
    const mom = SCENARIOS.find((s) => s.id === "mother-boundary");
    expect(mom?.counterpartGender).toBe("woman");
    expect(genderFor(voiceForScenario(mom ?? {}, "man-adam"))).toBe("woman");
  });

  it("follows the customer's choice when the counterpart is unisex", () => {
    const sam = SCENARIOS.find((s) => s.id === "chores");
    expect(sam?.counterpartGender).toBeUndefined();
    expect(voiceForScenario(sam ?? {}, "man-adam")).toBe("man-adam");
    expect(voiceForScenario(sam ?? {}, "woman-hope")).toBe("woman-hope");
  });

  it("locks the gender of every scenario with a gendered relationship word", () => {
    // "your dad" / "your brother" cannot be spoken by either voice.
    const GENDERED = /\b(mom|mother|dad|father|brother|sister|wife|husband|son|daughter|he|she|his|her)\b/i;
    for (const s of SCENARIOS) {
      if (GENDERED.test(s.counterpart)) {
        expect(s.counterpartGender, `${s.id}: "${s.counterpart}" needs a locked gender`).toBeDefined();
      }
    }
  });

  it("keeps a locked gender consistent with the pronouns in its own copy", () => {
    for (const s of SCENARIOS) {
      if (!s.counterpartGender) continue;
      const text = `${s.situation} ${s.persona} ${s.openingLine}`;
      const wrong =
        s.counterpartGender === "woman"
          ? /\b(he|his|him)\b/i
          : /\b(she|her|hers)\b/i;
      expect(wrong.test(text), `${s.id} mixes pronouns for a ${s.counterpartGender}`).toBe(
        false,
      );
    }
  });
});

describe("the selected Hope or Adam role reaches speech", () => {
  it("maps the selected persona to the BYSI TTS role", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/voice.ts`).text();
    expect(source).toContain('persona === "man-adam" ? "adam" : "hope"');
    expect(source).toContain('"https://beforeyousayit.app/api/tts"');
  });

  it("passes work, partner, family, and friends personas at the real shared playback boundary", async () => {
    const calls: PersonaVoice[] = [];
    const player = async (_line: { audio_id: string; voice_key: "contextual_counterpart"; text: string }, options: { contextualPersona: PersonaVoice }) => {
      calls.push(options.contextualPersona);
      return "played" as const;
    };
    const personas: PersonaVoice[] = ["man-adam", "woman-hope", "man-adam", "woman-hope"];
    for (const [index, category] of ["work", "partner", "family", "friends"].entries()) {
      const outcome = await playSharedScenarioPressure({ id: `${category}-turn`, text: "Exact pressure", source: "provider", semanticVoiceKey: "contextual_counterpart", resolvedAudioId: `${category}-audio` }, personas[index]!, player);
      expect(outcome).toBe("played");
    }
    expect(calls).toEqual(personas);
  });

  it("executes work, partner, family, and friends through the modular run-bound player", async () => {
    const calls: PersonaVoice[] = [];
    const player = async (_line: { audio_id: string; voice_key: "contextual_counterpart"; text: string }, options: { contextualPersona?: PersonaVoice }) => {
      if (options.contextualPersona) calls.push(options.contextualPersona);
      return "played" as const;
    };
    const categories = ["work", "partner", "family", "friends"] as const;
    const personas: PersonaVoice[] = ["man-adam", "woman-hope", "man-adam", "woman-hope"];
    for (const [index, category] of categories.entries()) {
      const outcome = await playRunBoundPilotAudio(
        { contextualPersona: personas[index]! },
        { audio_id: `${category}-audio`, voice_key: "contextual_counterpart", text: `${category} pressure` },
        {},
        player,
      );
      expect(outcome).toBe("played");
    }
    expect(calls).toEqual(personas);
  });

  it("treats the explicit onboarding choice as authoritative during navigation", () => {
    expect(isPersonaVoice("woman-hope")).toBe(true);
    expect(isPersonaVoice("man-adam")).toBe(true);
    expect(isPersonaVoice("Adam")).toBe(false);
    expect(
      voiceForRehearsal({ counterpartGender: "man" }, "man-adam", "woman-hope"),
    ).toBe("woman-hope");
    expect(
      voiceForRehearsal({ counterpartGender: "woman" }, "woman-hope", "man-adam"),
    ).toBe("man-adam");
  });

  it("carries the selected voice through the onboarding route handoff", async () => {
    const onboarding = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(onboarding).toContain('entry: "onboarding", persona, practiceSessionId');
    expect(onboarding).toContain("const persona = personaForContext(selectedFocus)");
    expect(rehearsal).toContain('params.entry === "onboarding" && isPersonaVoice(params.persona)');
    expect(rehearsal).toContain("voiceForRehearsal(");
  });

  it("plays onboarding replies in the selected voice instead of forcing Adam", async () => {
    const rehearsal = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    const dailyModule = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(rehearsal).toContain("await speak(spoken, persona");
    expect(rehearsal.indexOf("reveal(res.reply, res.nudge);")).toBeLessThan(rehearsal.indexOf("await speak(spoken, persona, { muted: !voiceOnRef.current });"));
    expect(rehearsal).not.toContain("speakPilotAudio");
    expect(dailyModule).toContain("playRunBoundPilotAudio");
    expect(dailyModule).toContain('voice_key: "adam_counterpart"');
  });

  it("keeps the selected Hope or Adam identity in fallback scenarios", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/ai.ts`).text();
    expect(source).toContain('const voice = personaFor(form.persona ?? "woman-hope")');
    expect(source).toContain("counterpart: `${voice.name}");
    expect(source).toContain("counterpartGender: voice.gender");
  });

  it("uses a contextual free counterpart while retaining persona identity for paid rehearsals", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('params.entry === "onboarding"');
    expect(source).toContain("activePracticeSession?.counterpartDisplayLabel");
    expect(source).toContain("personaFor(persona).name");
    expect(source).toContain("<RehearsalBriefing");
  });

  it("keeps provider voice IDs and credentials out of native source", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/voice.ts`).text();
    expect(source).toContain("roleForPersona(persona)");
    expect(source).not.toContain("EXAVITQu4vr4xnSDxMaL");
    expect(source).not.toContain("ELEVENLABS_API_KEY");
  });

  it("uses the BYSI TTS endpoint for both Hope and Adam", async () => {
    const source = await Bun.file(`${import.meta.dir}/../lib/voice.ts`).text();
    expect(source).toContain('"https://beforeyousayit.app/api/tts"');
    expect(source).toContain("const role = roleForPersona(persona)");
    expect(source).toContain("JSON.stringify({ role, text })");
    expect(source).toContain("text");
    expect(source).not.toContain("eleven_v3");
  });
});

describe("pressable cards claim the width they are supposed to", () => {
  /** Every screen that renders tappable cards. */
  const SCREENS = [
    "app/(tabs)/index.tsx",
    "app/(tabs)/library.tsx",
    "app/(tabs)/progress.tsx",
    "app/onboarding.tsx",
    "app/custom.tsx",
    "app/scenario/[id].tsx",
    "app/debrief/[id].tsx",
    "app/drill/[id].tsx",
    "app/rehearse/[id].tsx",
    "app/privacy.tsx",
    "app/paywall.tsx",
  ];

  it("never puts flex on a PressCard's inner surface", async () => {
    // `style` lands on the inner animated view, which cannot widen the
    // Pressable that actually claims space in a row. Layout needs
    // `containerStyle`. This silently broke the Continue button, the
    // option cards and the dashboard day cards.
    const OFFENDER = /<(?:PressCard|PrimaryButton|GhostButton)\b[^>]*?\sstyle=\{(?:styles\.flex|\{\s*flex:)/s;
    for (const screen of SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(
        OFFENDER.test(source),
        `${screen}: move flex from style to containerStyle`,
      ).toBe(false);
    }
  });

  it("gives the current Today activity a real touch target", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(source).toContain("primaryAction: { height: 52");
    expect(source).toContain("accessibilityLabel={activity.ctaLabel}");
  });

  it("keeps every tap target at least 44pt", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/(tabs)/progress.tsx`).text();
    const hit = source.slice(source.indexOf("deleteHit: {"));
    const box = hit.slice(0, hit.indexOf("}"));
    for (const side of ["width", "height"]) {
      const found = new RegExp(`${side}: (\\d+)`).exec(box);
      expect(Number(found?.[1] ?? 0), `deleteHit ${side}`).toBeGreaterThanOrEqual(44);
    }
  });
});

describe("custom scenario difficulty options are stacked, not squeezed side by side", () => {
  const COLUMN_STYLE: Record<string, string> = {
    "app/custom.tsx": "diffCol",
  };
  const SCREENS = Object.keys(COLUMN_STYLE);

  it("lays the three difficulty cards out in a column on every screen", async () => {
    for (const screen of SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      expect(source, `${screen} should stack the difficulty cards`).toContain(
        COLUMN_STYLE[screen],
      );
      // A row gave "Challenging" only a third of the width, so it clipped.
      expect(source, `${screen} should not lay them out in a row`).not.toContain("diffRow");
    }
  });

  it("explains what each difficulty level does", async () => {
    // Custom scenario setup still explains each advanced intensity option.
    for (const screen of SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      for (const note of [
        "They listen, but they still feel",
        "They deflect and push back",
        "They escalate fast",
      ]) {
        expect(source, `${screen} is missing the "${note}" note`).toContain(note);
      }
    }
  });

  it("never puts flex on a card the press wrapper does not stretch", async () => {
    // `flex: 1` on the inner view is invisible: PressCard's outer Pressable
    // claims the row width, which is what made these three cards uneven.
    for (const screen of SCREENS) {
      const source = await Bun.file(`${import.meta.dir}/../${screen}`).text();
      const start = source.indexOf("diffChip: {");
      if (start === -1) continue;
      const chip = source.slice(start);
      expect(chip.slice(0, chip.indexOf("}")), `${screen} diffChip`).not.toContain("flex: 1");
    }
  });
});

describe("onboarding rehearsal always has a safe exit", () => {
  it("clears an abandoned onboarding rep and replaces to a stable route", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/rehearse/[id].tsx`).text();
    expect(source).toContain('await saveActivePracticeSession(null)');
    expect(source).toContain('router.replace("/onboarding")');
    expect(source).toContain('if (router.canGoBack()) router.back()');
    expect(source).toContain('accessibilityLabel="Close rehearsal"');
  });
});

describe("onboarding presents questions without a fictional coach header", () => {
  it("uses the three approved visible entry answers", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(source).toContain("What brought you here?");
    expect(source).toContain("I have a conversation I need to prepare for");
    expect(source).toContain("The same communication problem keeps happening");
    expect(source).toContain("I know what I want to get better at");
  });

  it("keeps setup questions direct and assigns the approved context voice", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(source).not.toContain("CoachPrompt");
    expect(source).not.toContain("coachAvatar");
    expect(source).not.toContain("Choose the rehearsal voice");
    expect(source).toContain("personaForContext(selectedFocus)");
    expect(source).toContain('const counterpart = persona === "man-adam" ? "Adam" : "Hope"');
  });

  it("confirms every tap-only answer before advancing or finishing", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/onboarding.tsx`).text();
    expect(source).toContain("confirmAndAdvance(2)");
    expect(source).toContain("confirmAndAdvance(3)");
    expect(source).toContain("confirmAndAdvance(4)");
    expect(source).toContain("void finish(value, reaction");
    expect(source).toContain("void finish(focus, value)");
    expect(source).toContain("SELECTION_CONFIRMATION_MS = 140");
    expect(source).toContain("const showsFooter = (isReal && step === 2) || building");
  });
});
