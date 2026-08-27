import type { ScenarioCounterpartTurn } from "@/types/pilotCurriculum";

export type M1L1PressureKind = "pushback_one" | "evidence_trap";

const TOPIC_WORDS = new Set([
  "close", "deadline", "file", "handoff", "late", "noon", "quarter", "review", "schedule", "time", "timing",
]);
const STOP_WORDS = new Set([
  "about", "after", "again", "also", "been", "before", "being", "could", "from", "have", "into", "just", "like", "more", "really", "still", "than", "that", "their", "there", "they", "this", "those", "very", "want", "what", "when", "where", "which", "with", "would", "your",
]);
const COACHING_LEAKAGE = /\b(?:learner|lesson|practice|rehearsal|coach|coaching|rubric|transcript|one point|one proof|one move|try saying|you should say|good job|well done)\b/i;
const INSTANT_AGREEMENT = /^(?:okay[,!. ]+)?(?:you(?:'|’)re right|i agree|that(?:'|’)s fair|i(?:'|’)m sorry|i apologize|i(?:'|’)ll do that|i will do that|consider it done|sure[,!. ]+i(?:'|’)ll)\b/i;
const TOPIC_CHANGE = /\b(?:relationship|marriage|kids?|chores?|vacation|rent|politics|dinner|pickup|school)\b/i;
const PRESSURE_ONE = /\b(?:but|because|fair|slammed|quarter close|deadline|heavy|realistic|understand|what|when|how)\b/i;
const PRESSURE_TWO = /\b(?:example|basis|basing|happens|often|pattern|time|always|evidence|what else|why|how)\b/i;
const FACT_PATTERN = /\b(?:\d{1,2}(?::\d{2})?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|tomorrow|today)\b/gi;

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z][a-z'-]{2,}/g) ?? [];
}

function meaningfulWords(value: string): Set<string> {
  return new Set(words(value).filter((word) => !STOP_WORDS.has(word)));
}

function facts(value: string): Set<string> {
  return new Set((value.match(FACT_PATTERN) ?? []).map((fact) => fact.toLowerCase()));
}

/** Locally enforces M1 L1 relevance, continuity, pressure, and safety constraints before display. */
export function m1L1DynamicReplyPassesQuality(
  reply: string,
  kind: M1L1PressureKind,
  approvedTranscript: string,
  conversationContext: string,
): boolean {
  const clean = reply.trim();
  const wordCount = words(clean).length;
  if (clean.length < 8 || clean.length > 320 || wordCount < 3 || wordCount > 55) return false;
  if (COACHING_LEAKAGE.test(clean) || INSTANT_AGREEMENT.test(clean) || TOPIC_CHANGE.test(clean)) return false;

  const allowedContext = `${conversationContext} ${approvedTranscript}`;
  const allowedFacts = facts(allowedContext);
  if ([...facts(clean)].some((fact) => !allowedFacts.has(fact))) return false;

  const replyWords = meaningfulWords(clean);
  const transcriptWords = meaningfulWords(approvedTranscript);
  const hasTranscriptOverlap = [...replyWords].some((word) => transcriptWords.has(word));
  const hasScenarioAnchor = [...replyWords].some((word) => TOPIC_WORDS.has(word));
  if (!hasTranscriptOverlap && !hasScenarioAnchor) return false;

  return kind === "pushback_one" ? PRESSURE_ONE.test(clean) : PRESSURE_TWO.test(clean);
}

/** Creates a stable provider turn whose exact text can be replayed after persistence or resume. */
export function m1L1ProviderTurn(runId: string, kind: M1L1PressureKind, text: string): ScenarioCounterpartTurn {
  const ordinal = kind === "pushback_one" ? "1" : "2";
  return {
    id: `${runId}-pushback-${ordinal}-provider`,
    text: text.trim(),
    source: "provider",
    reactionId: `m1-l1-dynamic-pushback-${ordinal}`,
    semanticVoiceKey: "adam_counterpart",
    resolvedAudioId: `${runId}-m1-l1-dynamic-pushback-${ordinal}`,
  };
}

/** Validates stable provider identity and semantic quality when restoring or completing M1 L1. */
export function isValidM1L1ProviderTurn(
  turn: ScenarioCounterpartTurn,
  runId: string,
  kind: M1L1PressureKind,
  approvedTranscript: string,
  conversationContext: string,
): boolean {
  const ordinal = kind === "pushback_one" ? "1" : "2";
  return turn.source === "provider"
    && turn.id === `${runId}-pushback-${ordinal}-provider`
    && turn.reactionId === `m1-l1-dynamic-pushback-${ordinal}`
    && turn.semanticVoiceKey === "adam_counterpart"
    && turn.resolvedAudioId === `${runId}-m1-l1-dynamic-pushback-${ordinal}`
    && m1L1DynamicReplyPassesQuality(turn.text, kind, approvedTranscript, conversationContext);
}
