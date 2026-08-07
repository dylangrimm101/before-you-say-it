import type { Gender, PersonaVoice } from "@/types/convo";

export interface Persona {
  id: PersonaVoice;
  gender: Gender;
  /** First name used when a scenario does not supply one of its own. */
  name: string;
  /**
   * ElevenLabs voice id. This MUST match `gender` — a mismatch is immediately
   * audible, because the user hears a man after choosing a woman's voice.
   */
  voiceId: string;
  /** Option label shown during onboarding. */
  label: string;
  note: string;
}

/**
 * The two rehearsal voices, in one place.
 *
 * Gender, display name, voice id and prompt wording all live on the same
 * record so they cannot drift apart. Previously the option list, the TTS voice
 * ids and the prompt label were three separate tables, and the prompt one was
 * never actually read.
 */
export const PERSONAS: Persona[] = [
  {
    id: "woman-hope",
    gender: "woman",
    name: "Hope",
    // Sarah — mature, reassuring, confident (female).
    voiceId: "EXAVITQu4vr4xnSDxMaL",
    label: "Woman’s voice — Hope",
    note: "Calm, warm, human",
  },
  {
    id: "man-adam",
    gender: "man",
    name: "Adam",
    // Eric — smooth, trustworthy (male).
    voiceId: "cjVigY5qzO86Huf0OWal",
    label: "Man’s voice — Adam",
    note: "Steady, present, direct",
  },
];

const BY_ID: Record<PersonaVoice, Persona> = PERSONAS.reduce(
  (acc, p) => ({ ...acc, [p.id]: p }),
  {} as Record<PersonaVoice, Persona>,
);

/** The default voice used when a profile has no saved preference. */
export const DEFAULT_PERSONA: PersonaVoice = "woman-hope";

export function personaFor(id: PersonaVoice): Persona {
  return BY_ID[id] ?? BY_ID[DEFAULT_PERSONA];
}

/** Validate an untrusted route or persisted value before using it as a voice. */
export function isPersonaVoice(value: unknown): value is PersonaVoice {
  return value === "woman-hope" || value === "man-adam";
}

export function voiceIdFor(id: PersonaVoice): string {
  return personaFor(id).voiceId;
}

export function genderFor(id: PersonaVoice): Gender {
  return personaFor(id).gender;
}

/** The voice whose gender matches `gender`. */
export function personaForGender(gender: Gender): PersonaVoice {
  return PERSONAS.find((p) => p.gender === gender)?.id ?? DEFAULT_PERSONA;
}

/**
 * Resolve which voice should actually speak for a scenario.
 *
 * Some counterparts are gender-locked by the relationship itself — "your dad",
 * "your older brother" — or by a clearly gendered first name. Letting the
 * onboarding preference win there produces a dad who speaks in a woman's
 * voice, so the scenario's own gender takes precedence. Scenarios with a
 * unisex counterpart (Sam, Alex, Jordan) follow the user's choice.
 */
export function voiceForScenario(
  scenario: { counterpartGender?: Gender },
  preferred: PersonaVoice,
): PersonaVoice {
  return scenario.counterpartGender
    ? personaForGender(scenario.counterpartGender)
    : preferred;
}

/**
 * Resolve the speaking voice for a rehearsal.
 *
 * The onboarding route carries the learner's just-made choice so navigation
 * cannot briefly read an older profile value. Outside onboarding, normal
 * scenario gender rules continue to apply.
 */
export function voiceForRehearsal(
  scenario: { counterpartGender?: Gender } | null,
  preferred: PersonaVoice,
  onboardingSelection?: PersonaVoice,
): PersonaVoice {
  if (onboardingSelection) return onboardingSelection;
  return scenario ? voiceForScenario(scenario, preferred) : preferred;
}

/** How the counterpart's own gender is stated to the model. */
export function genderPromptLine(gender: Gender): string {
  return gender === "woman"
    ? `YOUR GENDER: You are a woman. Never refer to yourself as a man, and never contradict this.`
    : `YOUR GENDER: You are a man. Never refer to yourself as a woman, and never contradict this.`;
}
