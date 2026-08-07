/**
 * Disclosure and retention consent. Every value here defaults to the most
 * private option: nothing is disclosed, nothing is retained.
 */

/** The real provider that receives recorded audio, named in the disclosure. */
export const TRANSCRIPTION_PROVIDER = "OpenAI (gpt-4o-mini-transcribe, via the Vercel AI Gateway)";

/** The real providers that receive typed and transcribed text. */
export const ROLEPLAY_PROVIDER = "Google (Gemini)";
export const DEBRIEF_PROVIDER = "Anthropic (Claude)";
export const VOICE_PROVIDER = "ElevenLabs";

export interface ConsentState {
  /** Opt-in: keep the baseline recording on this device for a later comparison. */
  keepBaselineAudio: boolean;
  /** Opt-in: keep the exact text of scenarios the user writes. */
  saveCustomScenarioText: boolean;
  /** When the one-time privacy-migration notice was dismissed. */
  migrationNoticeSeenAt: number | null;
}

export const DEFAULT_CONSENT: ConsentState = {
  keepBaselineAudio: false,
  saveCustomScenarioText: false,
  migrationNoticeSeenAt: null,
};

export function withMigrationNoticeSeen(consent: ConsentState, now: number): ConsentState {
  return { ...consent, migrationNoticeSeenAt: now };
}

/** The one-time upgrade notice shows only when content was actually removed. */
export function needsMigrationNotice(
  consent: ConsentState | null,
  didRemoveContent: boolean,
): boolean {
  if (!didRemoveContent) return false;
  return consent === null || consent.migrationNoticeSeenAt === null;
}

function optionalTimestamp(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Coerce anything read out of storage into a valid state. A malformed or
 * hostile value resolves to the private default, never to an opt-in.
 */
export function normalizeConsent(raw: unknown): ConsentState {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return DEFAULT_CONSENT;
    }
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return DEFAULT_CONSENT;
  }
  const o = value as Record<string, unknown>;
  return {
    keepBaselineAudio: o.keepBaselineAudio === true,
    saveCustomScenarioText: o.saveCustomScenarioText === true,
    migrationNoticeSeenAt: optionalTimestamp(o.migrationNoticeSeenAt),
  };
}
