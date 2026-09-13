import { RAVI_NATURAL_FACT_VERSION, raviNaturalFactViolations } from "@/lib/raviNaturalFactContract";
import { canonicalCounterpartLine } from "@/lib/counterpartLineCanonicalization";

const COACHING_LEAKAGE = /\b(?:learner|lesson|practice|rehearsal|coach|coaching|rubric|transcript|named move|try saying|you should say|good job|well done)\b/i;
const CHANNEL_LEAKAGE = /\b(?:text(?:ed|ing)?|message(?:d|s|ing)?|dm(?:s|ed|ing)?|chat(?:ted|ting)?|phone call|call(?:ed|ing)?|facetime|zoom|email(?:ed|ing)?|video call)\b/i;

const GROUNDING_STOP_WORDS = new Set([
  "about", "after", "again", "agree", "because", "before", "being", "but", "can", "could", "couldn", "disagree", "does", "doesn", "don", "even", "from", "have", "haven", "into", "isn", "just", "like", "more", "not", "problem", "really", "should", "shouldn", "still", "than", "that", "the", "their", "there", "they", "this", "those", "tomorrow", "very", "want", "wasn", "what", "when", "where", "which", "whole", "why", "will", "with", "won", "would", "wouldn", "you", "your",
]);
const DIALOGUE_ALLOWLIST = new Set([
  "actual", "actually", "answer", "ask", "attach", "cannot", "clear", "clearer", "commit", "decide", "disregard", "explain", "fair", "finish", "follow", "handle", "happen", "know", "mean", "need", "owner", "part", "possible", "prove", "realistic", "resolve", "say", "tell", "think", "yet",
]);

function groundingTerm(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("ed")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

// Comparison only, not a general number dictionary: the authored Ravi fact is
// revisions arriving "until 3". Do not admit "three" elsewhere (e.g. three
// files), infer AM/PM, or turn ubiquitous "one" into a new numeric allowance.
function numericComparisonLine(value: string, groundingContext: string): string {
  const canonical = canonicalCounterpartLine(value);
  const authored = groundingContext.normalize("NFKC").replace(/\p{Default_Ignorable_Code_Point}/gu, "").toLowerCase();
  if (!/\brevisions until 3(?![\p{L}\p{N}]|[:.,/-]\d)/u.test(authored)) return canonical;
  return canonical.replace(/\brevisions until three\b/g, "revisions until 3");
}

function groundingTerms(value: string, groundingContext: string = value): Set<string> {
  // Keep exact compound/meridiem keys: the normal tokenizer would otherwise
  // erase colons and ignore short digits or AM/PM as short dialogue tokens.
  const numericKeys = value.normalize("NFKC").replace(/\p{Default_Ignorable_Code_Point}/gu, "").toLowerCase()
    .match(/\d+(?:[:.,/\-]\d+)+(?:\s*[ap]\.?m\.?)?|\b(?:\d+|three)\s*[ap]\.?m\b\.?/g) ?? [];
  return new Set([...numericComparisonLine(value, groundingContext)
    .split(" ")
    .filter((word) => (word.length >= 3 || /\p{N}/u.test(word)) && !GROUNDING_STOP_WORDS.has(word))
    .map(groundingTerm), ...numericKeys]);
}

function isGroundedInApprovedExchange(reply: string, groundingContext: string): boolean {
  const allowed = groundingTerms(groundingContext);
  const replyTerms = groundingTerms(reply, groundingContext);
  const overlap = [...replyTerms].filter((word) => !/\p{N}/u.test(word) && allowed.has(word));
  const unknown = [...replyTerms].filter((word) => !allowed.has(word) && !DIALOGUE_ALLOWLIST.has(word));
  return new Set(overlap).size >= 2 && unknown.length === 0;
}

/** Shared quality, grounding, and private-corpus gate for approved rehearsal pressures. */
export function approvedRehearsalPressurePassesQuality(reply: string, groundingContext: string, factContract?: string): boolean {
  const clean = reply.trim();
  const words = clean.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) ?? [];
  return clean.length >= 3
    && clean.length <= 320
    && words.length >= 2
    && words.length <= 55
    && !COACHING_LEAKAGE.test(clean)
    && !CHANNEL_LEAKAGE.test(clean)
    && !/^(?:i hear you|you(?:'|’)re right|that(?:'|’)s fair|okay|i get that)\b/i.test(clean)
    && (factContract === RAVI_NATURAL_FACT_VERSION
      ? raviNaturalFactViolations(clean, groundingContext).length === 0
      : isGroundedInApprovedExchange(clean, groundingContext));
}

export function isExcludedApprovedRehearsalLine(value: string, authoredCorpus: readonly string[]): boolean {
  const canonical = canonicalCounterpartLine(value);
  return authoredCorpus.some((line) => canonical === canonicalCounterpartLine(line));
}

export function areDistinctApprovedRehearsalLines(first: string, second: string): boolean {
  return canonicalCounterpartLine(first) !== canonicalCounterpartLine(second);
}
