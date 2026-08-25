import { counterpartName } from "@/lib/rehearsal";

/**
 * Pure, testable helpers for counterpart voice playback. All platform work and
 * all state live in `lib/voice.ts`; nothing here touches an API or a device.
 */

/**
 * Where the counterpart's voice currently is.
 *
 * - `generating` — audio is being produced for a line already on screen.
 * - `blocked` — the browser refused to start playback without a fresh tap.
 * - `failed` — generation or playback errored. The line stays on screen.
 */
export type SpeechPhase = "idle" | "generating" | "speaking" | "blocked" | "failed";

/** The outcome of a playback attempt. Never throws at the call site. */
export type SpeakOutcome = "played" | "blocked" | "failed" | "muted" | "empty";

/** What the speaker control is showing, so its state is never ambiguous. */
export type SpeakerControl = "muted" | "playing" | "replay" | "on";

/**
 * Correct a narrow speech-to-text homophone in outcome statements.
 *
 * The recognizer can hear “I want to more evenly…” as “I went to Moore
 * evenly…”. Restricting the correction to adverbs used with comparison keeps
 * legitimate names such as “I went to Moore College” untouched.
 */
export function cleanOutcomeTranscript(text: string): string {
  return text.replace(
    /\bI went to Moore(?=\s+(?:evenly|equally|fairly|clearly|consistently|effectively|fairly)\b)/gi,
    "I want to more",
  );
}

/** Possessive form of a display name, e.g. "Jordan" → "Jordan's". */
export function possessive(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "";
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

/** Customer-facing control shown when the browser blocked automatic playback. */
export function tapToHearLabel(counterpart: string): string {
  return `Tap to hear ${counterpartName(counterpart)}`;
}

/**
 * Friendly retry copy for an audio failure. The response text stays visible,
 * so this only ever refers to the voice.
 */
export function audioFailureMessage(counterpart: string): string {
  return `${possessive(counterpartName(counterpart))} voice didn't play. Tap to try again.`;
}

/** Reassurance that silence is a mute, not a broken response. */
export function mutedHint(counterpart: string): string {
  return `Muted — tap the speaker to hear ${counterpartName(counterpart)}`;
}

/**
 * True when a playback rejection is the browser's autoplay policy rather than a
 * real failure. Safari rejects with `NotAllowedError` until a user gesture has
 * unlocked the audio element.
 */
export function isAutoplayBlocked(e: unknown): boolean {
  if (e === null || typeof e !== "object") return false;
  const err = e as { name?: unknown; message?: unknown };
  if (err.name === "NotAllowedError") return true;
  if (typeof err.message !== "string") return false;
  return /not allowed|user (?:didn't|did not) interact|gesture|autoplay/i.test(err.message);
}

/**
 * The microphone must never open while the counterpart is talking, otherwise
 * their voice is recorded as the user's line. While locked the mic control is
 * both visibly and functionally disabled: taps on it do nothing at all, and
 * stopping playback is the speaker control's job.
 */
export function micLocked(phase: SpeechPhase): boolean {
  return phase === "speaking" || phase === "generating";
}

/**
 * What to tell the user while the mic is disabled, pointing them at the control
 * that actually stops playback. Null whenever the mic is usable.
 */
export function micDisabledHint(phase: SpeechPhase, counterpart: string): string | null {
  const name = counterpartName(counterpart);
  if (phase === "generating") return `Finding ${possessive(name)} voice — one moment`;
  if (phase === "speaking") return `${name} is speaking — tap the speaker to stop`;
  return null;
}

/** Which of the four unambiguous speaker states to render. */
export function speakerControl(
  muted: boolean,
  phase: SpeechPhase,
  canReplay: boolean,
): SpeakerControl {
  if (phase === "speaking" || phase === "generating") return "playing";
  if (muted) return "muted";
  return canReplay ? "replay" : "on";
}

/** Accessible label matching the visible speaker state. */
export function speakerLabel(control: SpeakerControl, counterpart: string): string {
  const name = counterpartName(counterpart);
  switch (control) {
    case "muted":
      return `Voice off. Tap to hear ${name}.`;
    case "playing":
      return `${name} is speaking. Tap to stop.`;
    case "replay":
      return `Replay ${possessive(name)} last response.`;
    default:
      return "Voice on. Tap to mute.";
  }
}

export interface DataUriParts {
  mime: string;
  base64: string;
}

/** Split a base64 data URI into its media type and payload. */
export function parseDataUri(uri: string): DataUriParts | null {
  const match = /^data:([^;,]+)(?:;[^,]*)*;base64,(.*)$/s.exec(uri.trim());
  if (!match) return null;
  const mime = match[1].trim().toLowerCase();
  const base64 = match[2].trim();
  if (mime.length === 0 || base64.length === 0) return null;
  return { mime, base64 };
}

/** File extension for a returned audio media type. Defaults to mp3. */
export function audioExtensionFor(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("wav")) return "wav";
  if (m.includes("m4a") || m.includes("mp4") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  return "mp3";
}

/**
 * Cache filename for one generated line. The counter keeps successive lines
 * from colliding; nothing the user or model produced shapes the path.
 */
export function speechCacheFileName(token: number, extension: string): string {
  const safeToken = Math.max(0, Math.floor(token));
  const safeExt = /^[a-z0-9]{1,5}$/.test(extension) ? extension : "mp3";
  return `line-${safeToken}.${safeExt}`;
}
