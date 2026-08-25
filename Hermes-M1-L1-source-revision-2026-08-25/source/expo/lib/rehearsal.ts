import type { Scenario, Turn } from "@/types/convo";

/** Who speaks the first line of a rehearsal. */
export type OpensWith = "user" | "counterpart";

/**
 * Screenplay markers the model sometimes emits that carry no meaning for the
 * user. These are internal generation artifacts and must never reach the UI.
 */
const META_MARKERS = new Set<string>([
  "beat",
  "a beat",
  "beat.",
  "long beat",
  "short beat",
  "another beat",
  "pause for effect",
  "internal",
  "system",
  "assistant",
  "user",
  "stage direction",
  "no response",
]);

/**
 * Beats that describe something real. Rendered as a natural sentence naming
 * the counterpart rather than a bare parenthetical.
 */
const BEAT_VERBS: Record<string, string> = {
  pause: "pauses",
  pauses: "pausing",
  "long pause": "pauses",
  "short pause": "pauses",
  silence: "goes quiet",
  sigh: "sighs",
  sighs: "sighs",
  sighing: "sighs",
  laugh: "laughs",
  laughs: "laughs",
  laughing: "laughs",
  scoffs: "scoffs",
  shrugs: "shrugs",
  "shakes head": "shakes their head",
  "looks away": "looks away",
  "voice tightens": "tightens up",
};

const LEADING_BEAT = /^\s*\(([^)]{1,80})\)\s*/;
const ANY_PARENTHETICAL = /\(([^)]{1,80})\)/g;

/** True when a parenthetical is an internal marker with no user-facing value. */
function isMetaMarker(raw: string): boolean {
  return META_MARKERS.has(raw.trim().toLowerCase().replace(/[.!]+$/, ""));
}

/**
 * Strip every trace of transport format from a model reply: code fences, JSON
 * envelopes, field names, braces, role prefixes and internal markers.
 *
 * This is a last line of defense. Structured parsing happens in
 * `parseCounterpartPayload`; this guarantees that even a partially malformed
 * string can never render as raw JSON.
 */
export function sanitizeReply(input: unknown): string {
  if (typeof input !== "string") return "";
  let s = input;

  s = s.replace(/```[a-z]*\s*/gi, "").replace(/```/g, "");

  // A JSON envelope leaked through — take only the reply field.
  const field = s.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (field) {
    try {
      s = JSON.parse(`"${field[1]}"`) as string;
    } catch {
      s = field[1];
    }
  }

  s = s.replace(/"?(?:reply|tension|nudge)"?\s*:\s*/gi, "");
  s = s.replace(/^\s*(?:system|assistant|user)\s*:\s*/i, "");
  s = s.replace(/[{}[\]]/g, "");
  s = s.replace(/,\s*$/, "");
  s = s.replace(/^\s*["']|["']\s*$/g, "");

  // Remove internal parentheticals wherever they appear.
  s = s.replace(ANY_PARENTHETICAL, (match, inner: string) =>
    isMetaMarker(inner) ? " " : match,
  );

  return s.replace(/\s+/g, " ").trim();
}

/** True when a string still carries transport artifacts that must never render. */
export function containsRawArtifacts(text: string): boolean {
  if (/```/.test(text)) return true;
  if (/[{}]/.test(text)) return true;
  if (/"(?:reply|tension|nudge)"/i.test(text)) return true;
  if (/\b(?:reply|tension|nudge)\s*:/i.test(text)) return true;
  return false;
}

/**
 * True when a reply looks cut off mid-thought. Deliberate trail-offs using an
 * em dash or ellipsis are complete; a dangling comma or bare word is not.
 */
export function looksTruncated(text: string): boolean {
  const t = text.trim();
  if (t.length === 0) return true;
  if (/[,;:]$/.test(t)) return true;

  const openCurly = (t.match(/[“]/g) ?? []).length;
  const closeCurly = (t.match(/[”]/g) ?? []).length;
  if (openCurly !== closeCurly) return true;
  if ((t.match(/"/g) ?? []).length % 2 !== 0) return true;

  // Intentional trail-off or a properly terminated sentence.
  return !/[.!?…—–"'”’)\]]$/.test(t);
}

export interface CounterpartPayload {
  reply: string;
  tension: number;
  nudge: string;
}

export type ParseFailure =
  | "not-json"
  | "missing-reply"
  | "empty-reply"
  | "truncated";

export type ParseResult =
  | { ok: true; value: CounterpartPayload }
  | { ok: false; reason: ParseFailure };

/**
 * Validate a raw model response against the counterpart-turn schema.
 *
 * Returns a typed failure instead of guessing, so the caller can retry rather
 * than rendering something malformed.
 */
export function parseCounterpartPayload(raw: string): ParseResult {
  const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return { ok: false, reason: "not-json" };

  let obj: unknown;
  try {
    obj = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return { ok: false, reason: "not-json" };
  }
  if (typeof obj !== "object" || obj === null) return { ok: false, reason: "not-json" };

  const record = obj as Record<string, unknown>;
  if (!("reply" in record) || typeof record.reply !== "string") {
    return { ok: false, reason: "missing-reply" };
  }

  const reply = sanitizeReply(record.reply);
  if (reply.length === 0) return { ok: false, reason: "empty-reply" };
  if (looksTruncated(reply)) return { ok: false, reason: "truncated" };

  const tensionRaw = Number(record.tension);
  const tension = Number.isFinite(tensionRaw)
    ? Math.round(Math.min(100, Math.max(0, tensionRaw)))
    : 50;

  const nudgeRaw = typeof record.nudge === "string" ? sanitizeReply(record.nudge) : "";

  return { ok: true, value: { reply, tension, nudge: nudgeRaw } };
}

/** How a scenario begins. Defaults to the user speaking first. */
export function opensWith(scenario: Pick<Scenario, "opensWith">): OpensWith {
  return scenario.opensWith === "counterpart" ? "counterpart" : "user";
}

export interface InitialRehearsalState {
  opensWith: OpensWith;
  /** True when the app must invite the user to deliver their opening line. */
  waitingForUserOpening: boolean;
  currentSpeaker: OpensWith;
  /** The counterpart's scripted first line, or null when the user starts. */
  initialCounterpartLine: string | null;
  partnerGenerationStarted: boolean;
}

/**
 * The turn state a rehearsal starts in, derived purely from scenario
 * configuration. A user-initiated scenario starts with an empty transcript.
 */
export function initialRehearsalState(
  scenario: Pick<Scenario, "opensWith" | "openingLine">,
): InitialRehearsalState {
  const who = opensWith(scenario);
  if (who === "counterpart") {
    const line = sanitizeReply(scenario.openingLine);
    return {
      opensWith: "counterpart",
      waitingForUserOpening: false,
      currentSpeaker: "counterpart",
      initialCounterpartLine: line.length > 0 ? scenario.openingLine.trim() : null,
      partnerGenerationStarted: true,
    };
  }
  return {
    opensWith: "user",
    waitingForUserOpening: true,
    currentSpeaker: "user",
    initialCounterpartLine: null,
    partnerGenerationStarted: false,
  };
}

/**
 * The counterpart's short name for labels, e.g. "Sam — your partner" → "Sam".
 * Descriptive counterparts such as "Your mom" are kept whole.
 */
export function counterpartName(counterpart: string): string {
  const head = counterpart.split(/[—–,(]/)[0]?.trim() ?? "";
  return head.length > 0 ? head : counterpart.trim();
}

/** The same name phrased for use inside a sentence, e.g. "your mom". */
export function counterpartInSentence(counterpart: string): string {
  const name = counterpartName(counterpart);
  return /^your\b/i.test(name) ? name.charAt(0).toLowerCase() + name.slice(1) : name;
}

/** The instruction shown when the user has to open the conversation. */
export function openingPrompt(counterpart: string): string {
  return `You're starting the conversation. What do you want to say to ${counterpartInSentence(
    counterpart,
  )}?`;
}

export interface RenderedMessage {
  /** A natural sentence describing a physical beat, or null. */
  beatLine: string | null;
  /** The spoken words, free of any beat or transport artifact. */
  body: string;
}

/**
 * Split a counterpart reply into an optional natural beat sentence and the
 * spoken body. Internal markers are dropped entirely.
 */
export function renderCounterpartMessage(
  reply: string,
  counterpart: string,
): RenderedMessage {
  const clean = sanitizeReply(reply);
  const match = clean.match(LEADING_BEAT);
  if (!match) return { beatLine: null, body: clean };

  const inner = match[1].trim();
  const body = clean.replace(LEADING_BEAT, "").trim();
  if (isMetaMarker(inner)) return { beatLine: null, body };

  const name = counterpartName(counterpart);
  const key = inner.toLowerCase().replace(/[.!]+$/, "");
  const verb = BEAT_VERBS[key];
  const beatLine = verb ? `${name} ${verb}.` : `${name} — ${inner}.`;
  return { beatLine, body };
}

/**
 * The exact text handed to text-to-speech: the same body rendered in the
 * bubble, with no beats or artifacts.
 */
export function speechTextFor(reply: string, counterpart: string): string {
  return renderCounterpartMessage(reply, counterpart).body;
}

/** Friendly, non-technical recovery copy shown when a turn cannot be produced. */
export function turnFailureMessage(counterpart: string): string {
  return `${counterpartName(counterpart)}'s response didn't come through. Try that turn again.`;
}

/** Whose turn it is, derived from the transcript rather than tracked separately. */
export function currentSpeaker(turns: Turn[], scenario: Pick<Scenario, "opensWith">): OpensWith {
  if (turns.length === 0) return opensWith(scenario) === "counterpart" ? "counterpart" : "user";
  return turns[turns.length - 1].role === "user" ? "counterpart" : "user";
}
