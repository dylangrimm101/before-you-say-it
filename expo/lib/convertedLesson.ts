import type { Scenario } from "@/types/convo";
import { approvedRehearsalConfig, type ApprovedRehearsalLessonId } from "@/lib/approvedRehearsals";
import { isValidM1L1ProviderTurn, m1L1DynamicReplyPassesQuality } from "@/lib/m1L1DynamicResponse";
import type {
  M1L1BehaviorFlag,
  M1L1DimensionId,
  PilotAttemptRecord,
  PilotComparison,
  PilotDayRun,
  ScenarioCounterpartTurn,
} from "@/types/pilotCurriculum";

export type ConvertedLessonId = "m1-l1";
export type TransferChoice = "say" | "write" | "save_later";

const LESSON_ID = "m1-l1" as const;
const MODULE_ID = "bysi_m01_get_to_the_point" as const;
const PRACTICE_ID = "bysi_m01_l01_buried_point" as const;
const CONTENT_VERSION = "m1-l1-v2.1-2026-08-24" as const;
const SCENARIO_ID = "bysi-m01-l01-work-handoff" as const;
const COUNTERPART_ID = "adam" as const;

export interface ConvertedLessonConfig {
  lessonId: typeof LESSON_ID;
  moduleId: typeof MODULE_ID;
  practiceId: typeof PRACTICE_ID;
  contentVersion: typeof CONTENT_VERSION;
  title: string;
  scenario: Scenario;
  counterpartId: typeof COUNTERPART_ID;
  context: "work";
  semanticVoiceKey: "adam_counterpart";
  coachedBehaviorId: "point_proof_move";
  pushbackOneBank: readonly [string, string, string];
  authoredEvidenceTrap: "You're acting like this happens all the time.";
  /** Compatibility alias used only by the unreachable shared branch. */
  authoredPressureText: "You're acting like this happens all the time.";
  retryDirection: string;
  namedMoveId: "one-point-one-proof-one-move";
  namedMove: string;
  rehearsalHandoffCard: 20;
  returnCard: 21;
  completionCard: 22;
  retryCap: 1;
  launchEligible: false;
}

export interface ConvertedLessonProgress {
  lessonId: ConvertedLessonId | ApprovedRehearsalLessonId;
  moduleId: string;
  practiceId: string;
  contentVersion: string;
  runId: string;
  lessonCardCheckpoint: number;
  quizGatesCompleted: true;
  rehearsalCompleted: true;
  retryCompleted: true;
  comparisonViewed: true;
  savedMoveId: string;
  customWording?: string;
  transferChoice: TransferChoice;
  completedAt: number;
  sourceLineage: "approved-html-deck-pinned";
}

export interface LessonCoachNote {
  evidenceQuote: string;
  worked: string;
  change: string;
  retryDirection: string;
  coachedBehaviorId: ConvertedLessonConfig["coachedBehaviorId"];
  coachedBeat: 1 | 3 | 5;
  selectedDimension: M1L1DimensionId;
  flags: M1L1BehaviorFlag[];
}

export interface M1L1ComparisonResult extends PilotComparison {
  behaviorId: "point_proof_move";
  selectedDimension: M1L1DimensionId;
}

export interface CompletionValidation {
  isValid: boolean;
  reason?: string;
}

export const M1_L1_CONVERSION: ConvertedLessonConfig = {
  lessonId: LESSON_ID,
  moduleId: MODULE_ID,
  practiceId: PRACTICE_ID,
  contentVersion: CONTENT_VERSION,
  title: "When the Point Gets Buried",
  scenario: {
    id: SCENARIO_ID,
    category: "work",
    title: "The late handoff",
    counterpart: "Adam — your colleague",
    counterpartGender: "man",
    situation: "You’re speaking with Adam, a coworker who sends you a weekly client file. Yesterday it arrived at 4:20 PM, leaving you only 40 minutes to finish your part before the 5:00 PM deadline. This has happened twice this month. You want to ask Adam to send future files by noon.",
    persona: "Adam is a colleague under quarter-close pressure. He can push back, but he cannot resolve the decision for the learner.",
    goal: "Name one point, one concrete proof, and one answerable move.",
    opensWith: "user",
    openingLine: "",
    isCustom: false,
  },
  counterpartId: COUNTERPART_ID,
  context: "work",
  semanticVoiceKey: "adam_counterpart",
  coachedBehaviorId: "point_proof_move",
  pushbackOneBank: [
    "That's not really fair. I've been slammed with quarter close.",
    "Okay... where is this coming from?",
    "So I'm just failing at this now?",
  ],
  authoredEvidenceTrap: "You're acting like this happens all the time.",
  authoredPressureText: "You're acting like this happens all the time.",
  retryDirection: "Answer the same pressure with one point, one concrete proof, and one answerable move.",
  namedMoveId: "one-point-one-proof-one-move",
  namedMove: "One point. One proof. One move.",
  rehearsalHandoffCard: 20,
  returnCard: 21,
  completionCard: 22,
  retryCap: 1,
  launchEligible: false,
};

const DIMENSION_PRIORITY: readonly M1L1DimensionId[] = [
  "evidence_discipline",
  "motive_character_language",
  "issue_count",
  "point_placement",
  "grounding_concreteness",
  "move_clarity",
  "park_and_return",
];

function cleanTranscript(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function exactSentenceSpan(value: string, pattern: RegExp): string | null {
  const match = pattern.exec(value);
  if (!match || match.index === undefined) return null;
  let start = match.index;
  while (start > 0 && !/[.!?]/.test(value[start - 1] ?? "")) start -= 1;
  while (start < value.length && /\s/u.test(value[start] ?? "")) start += 1;
  let end = match.index + match[0].length;
  while (end < value.length && !/[.!?]/.test(value[end] ?? "")) end += 1;
  if (end < value.length) end += 1;
  const span = value.slice(start, end).trim();
  return span.length > 0 ? span : null;
}

/** Returns only an exact contiguous source span that supports this dimension. */
export function evidenceQuoteFor(dimension: M1L1DimensionId, transcript: string): string | null {
  if (dimension === "point_placement") {
    const firstContent = /\S+/u.exec(transcript);
    if (!firstContent) return null;
    return exactSentenceSpan(transcript, new RegExp(firstContent[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "u"));
  }
  const patterns: Partial<Record<M1L1DimensionId, RegExp>> = {
    issue_count: /\b(?:also|another time|everyone|other people|all the times|and)\b/iu,
    grounding_concreteness: /\b(?:last|yesterday|today|monday|tuesday|wednesday|thursday|friday|\d+|file|handoff|deadline)\b/iu,
    motive_character_language: /\b(?:always|never|lazy|selfish|don't care|doesn't care|respect me|on purpose|trying to)\b/iu,
    move_clarity: /\b(?:can you|can we|could you|could we|will you|would you|please|i need|by)\b/iu,
    evidence_discipline: /\b(?:also|another time|everyone|other people|all the times|always|never)\b/iu,
    park_and_return: /\b(?:i hear|that's fair|i understand|i get that|still|my point)\b/iu,
  };
  const pattern = patterns[dimension];
  return pattern ? exactSentenceSpan(transcript, pattern) : null;
}

function flag(dimension: M1L1DimensionId, status: M1L1BehaviorFlag["status"], transcript: string): M1L1BehaviorFlag {
  if (status === "not_assessable") return { dimension, status, evidenceQuote: null };
  const evidenceQuote = evidenceQuoteFor(dimension, transcript);
  return evidenceQuote && transcript.includes(evidenceQuote)
    ? { dimension, status, evidenceQuote }
    : { dimension, status: "not_assessable", evidenceQuote: null };
}

export const M1L1_PUSHBACK_ONE_DEFINITIONS = M1_L1_CONVERSION.pushbackOneBank.map((text, index) => ({
  text,
  reactionId: `m1-l1-pushback-1-${index + 1}`,
  resolvedAudioId: `${CONTENT_VERSION}-m1-l1-pushback-1-${index + 1}-adam-counterpart`,
})) as readonly { text: string; reactionId: string; resolvedAudioId: string }[];

export const M1L1_EVIDENCE_TRAP_DEFINITION = {
  text: M1_L1_CONVERSION.authoredEvidenceTrap,
  reactionId: "m1-l1-evidence-trap",
  resolvedAudioId: `${CONTENT_VERSION}-m1-l1-evidence-trap-adam-counterpart`,
} as const;

/** Deterministically selects one approved Pushback 1 from observable opening text. */
export function selectM1L1PushbackOne(approvedOpening: string, runId: string): ScenarioCounterpartTurn {
  const opening = cleanTranscript(approvedOpening).toLowerCase();
  const hasMotiveClaim = /\b(always|never|lazy|selfish|care|respect|trying to|on purpose)\b/.test(opening);
  const isIndirect = /\b(maybe|wondering|do you think|have you noticed|sort of|kind of)\b/.test(opening);
  const index = hasMotiveClaim ? 2 : isIndirect ? 1 : 0;
  const definition = M1L1_PUSHBACK_ONE_DEFINITIONS[index]!;
  return {
    id: `${runId}-pushback-1-${index + 1}`,
    text: definition.text,
    source: "authored",
    reactionId: definition.reactionId,
    semanticVoiceKey: M1_L1_CONVERSION.semanticVoiceKey,
    resolvedAudioId: definition.resolvedAudioId,
  };
}

/** Returns the mandatory Beat 4 evidence trap with stable cross-run audio identity. */
export function m1L1EvidenceTrap(runId: string): ScenarioCounterpartTurn {
  return {
    id: `${runId}-pushback-2-evidence-trap`,
    text: M1L1_EVIDENCE_TRAP_DEFINITION.text,
    source: "authored",
    reactionId: M1L1_EVIDENCE_TRAP_DEFINITION.reactionId,
    semanticVoiceKey: M1_L1_CONVERSION.semanticVoiceKey,
    resolvedAudioId: M1L1_EVIDENCE_TRAP_DEFINITION.resolvedAudioId,
  };
}

export function isCanonicalM1L1PressureTurn(turn: ScenarioCounterpartTurn | undefined, kind: "pushback_one" | "evidence_trap"): boolean {
  if (!turn || turn.semanticVoiceKey !== M1_L1_CONVERSION.semanticVoiceKey) return false;
  if (turn.source === "provider") {
    const ordinal = kind === "pushback_one" ? "1" : "2";
    return new RegExp(`^.+-pushback-${ordinal}-provider$`).test(turn.id)
      && turn.reactionId === `m1-l1-dynamic-pushback-${ordinal}`
      && turn.resolvedAudioId === `${turn.id.slice(0, -`pushback-${ordinal}-provider`.length)}m1-l1-dynamic-pushback-${ordinal}`
      && m1L1DynamicReplyPassesQuality(turn.text, kind, "", `${M1_L1_CONVERSION.scenario.title} ${M1_L1_CONVERSION.scenario.situation}`);
  }
  const definitions = kind === "pushback_one" ? M1L1_PUSHBACK_ONE_DEFINITIONS : [M1L1_EVIDENCE_TRAP_DEFINITION];
  return definitions.some((definition) => turn.text === definition.text
    && turn.reactionId === definition.reactionId
    && turn.resolvedAudioId === definition.resolvedAudioId);
}

export function hasCanonicalM1L1PressureSequence(run: PilotDayRun): boolean {
  const first = run.m1L1?.pushbackOne;
  const second = run.m1L1?.pushbackTwo;
  if (!first && !second) return true;
  const context = `${M1_L1_CONVERSION.scenario.title} ${M1_L1_CONVERSION.scenario.situation} ${M1_L1_CONVERSION.scenario.persona}`;
  if (first) {
    if (first.source === "provider") {
      if (!run.attempt || !isValidM1L1ProviderTurn(first, run.id, "pushback_one", run.attempt.transcript, context)) return false;
    } else {
      const index = M1L1_PUSHBACK_ONE_DEFINITIONS.findIndex((definition) => definition.reactionId === first.reactionId);
      if (index < 0 || first.id !== `${run.id}-pushback-1-${index + 1}` || !isCanonicalM1L1PressureTurn(first, "pushback_one")) return false;
    }
    if (run.counterpartTurn?.id !== first.id || run.counterpartReactionId !== first.reactionId || run.resolvedAudioId !== first.resolvedAudioId) return false;
  }
  if (second) {
    if (second.source === "provider") {
      const conversation = `${context} ${run.attempt?.transcript ?? ""} ${first?.text ?? ""} ${run.responseAttempt?.transcript ?? ""}`;
      if (!run.responseAttempt || !isValidM1L1ProviderTurn(second, run.id, "evidence_trap", run.responseAttempt.transcript, conversation)) return false;
    } else if (second.id !== `${run.id}-pushback-2-evidence-trap` || !isCanonicalM1L1PressureTurn(second, "evidence_trap")) return false;
  }
  return true;
}

/** Scoreless transcript-observable flags for one confirmed learner segment. */
export function m1L1BehaviorFlags(confirmedTranscript: string, coachedBeat: 1 | 3 | 5): M1L1BehaviorFlag[] {
  const originalTranscript = confirmedTranscript;
  const transcript = cleanTranscript(originalTranscript);
  if (transcript.length < 2) return DIMENSION_PRIORITY.map((dimension) => flag(dimension, "not_assessable", originalTranscript));
  const lower = transcript.toLowerCase();
  const firstSentence = transcript.split(/(?<=[.!?])\s+/)[0] ?? transcript;
  const sentenceCount = transcript.split(/[.!?]+/).filter((part) => part.trim().length > 0).length;
  const evidenceMarkers = lower.match(/\b(last|yesterday|today|monday|tuesday|wednesday|thursday|friday|\d+|at \d|file|handoff|deadline)\b/g)?.length ?? 0;
  const motiveClaim = /\b(always|never|lazy|selfish|don't care|doesn't care|respect me|on purpose|trying to)\b/.test(lower);
  const caseBuilding = sentenceCount > 4 || (lower.match(/\band\b/g)?.length ?? 0) >= 3 || /\b(also|another time|everyone|other people|all the times)\b/.test(lower);
  const answerableMove = /\b(can you|can we|could you|could we|will you|would you|please|i need|by (?:today|tomorrow|monday|tuesday|wednesday|thursday|friday|\d))\b/.test(lower);
  const directPoint = firstSentence.split(/\s+/).length <= 16 && !/^(so|well|i know|i don't know|maybe|this might)/i.test(firstSentence);
  const grounded = evidenceMarkers > 0;
  const parksAndReturns = /\b(i hear|that's fair|i understand|i get that)\b/.test(lower) && /\b(still|my point|the handoff|the file|what i need)\b/.test(lower);
  const evidenceDiscipline = coachedBeat === 5 ? !caseBuilding && !motiveClaim : !caseBuilding;
  return [
    flag("point_placement", directPoint ? "met" : "not_met", originalTranscript),
    flag("issue_count", caseBuilding ? "not_met" : "met", originalTranscript),
    flag("grounding_concreteness", grounded ? "met" : "not_met", originalTranscript),
    flag("motive_character_language", motiveClaim ? "not_met" : "met", originalTranscript),
    flag("move_clarity", answerableMove ? "met" : "not_met", originalTranscript),
    flag("evidence_discipline", evidenceDiscipline ? "met" : "not_met", originalTranscript),
    flag("park_and_return", coachedBeat === 3 || coachedBeat === 5 ? (parksAndReturns ? "met" : "not_met") : "not_assessable", originalTranscript),
  ];
}

function labelForDimension(dimension: M1L1DimensionId): string {
  return ({
    point_placement: "put the point in the first sentence",
    issue_count: "keep one issue in view",
    grounding_concreteness: "use one concrete fact",
    motive_character_language: "describe the event, not Adam's motive or character",
    move_clarity: "end with one answerable move",
    evidence_discipline: "use one proof instead of building the whole case",
    park_and_return: "acknowledge the pushback and return to the point",
  } as const)[dimension];
}

/** Produces one honest note from one exact confirmed beat, with no score. */
export function m1L1CoachNote(confirmedTranscript: string, coachedBeat: 1 | 3 | 5 = 5): LessonCoachNote | null {
  const transcript = cleanTranscript(confirmedTranscript);
  if (transcript.length < 2) return null;
  const flags = m1L1BehaviorFlags(confirmedTranscript, coachedBeat);
  const selected = DIMENSION_PRIORITY.find((dimension) => flags.find((item) => item.dimension === dimension)?.status === "not_met")
    ?? DIMENSION_PRIORITY.find((dimension) => flags.find((item) => item.dimension === dimension)?.status === "met")
    ?? "evidence_discipline";
  const selectedFlag = flags.find((item) => item.dimension === selected);
  const evidenceQuote = selectedFlag?.evidenceQuote;
  if (!evidenceQuote || selectedFlag?.status === "not_assessable") return null;
  const isMet = selectedFlag.status === "met";
  return {
    evidenceQuote,
    worked: isMet ? `In “${evidenceQuote},” you kept ${labelForDimension(selected)}.` : `Hope flagged “${evidenceQuote}.”`,
    change: isMet ? "Keep that same choice in the retry." : `On the retry, ${labelForDimension(selected)}.`,
    retryDirection: `Replay this exact moment and ${labelForDimension(selected)}.`,
    coachedBehaviorId: M1_L1_CONVERSION.coachedBehaviorId,
    coachedBeat,
    selectedDimension: selected,
    flags,
  };
}

export interface M1L1ExchangeTranscripts { opener: string; firstResponse: string }

interface M1L1CoachingCandidate {
  beat: 1 | 3;
  dimension: M1L1DimensionId;
  evidenceQuote: string;
  flags: M1L1BehaviorFlag[];
  score: number;
}

const COACHING_SEVERITY: Readonly<Record<M1L1DimensionId, number>> = {
  evidence_discipline: 86,
  motive_character_language: 100,
  issue_count: 82,
  point_placement: 62,
  grounding_concreteness: 68,
  move_clarity: 78,
  park_and_return: 84,
};

function coachingConfidence(dimension: M1L1DimensionId, transcript: string): number {
  const lower = cleanTranscript(transcript).toLowerCase();
  if (dimension === "motive_character_language") return /\b(always|never|lazy|selfish|don't care|doesn't care|respect me|on purpose|trying to)\b/.test(lower) ? 30 : 12;
  if (dimension === "evidence_discipline" || dimension === "issue_count") {
    const conjunctions = lower.match(/\band\b/g)?.length ?? 0;
    return conjunctions >= 3 || /\b(also|another time|everyone|other people|all the times)\b/.test(lower) ? 26 : 14;
  }
  if (dimension === "park_and_return") {
    const acknowledges = /\b(i hear|that's fair|i understand|i get that)\b/.test(lower);
    const returns = /\b(still|my point|the handoff|the file|what i need)\b/.test(lower);
    return !acknowledges && !returns ? 28 : 20;
  }
  if (dimension === "move_clarity") return 22;
  return 16;
}

function coachingRelevance(dimension: M1L1DimensionId, beat: 1 | 3): number {
  if (beat === 3 && dimension === "park_and_return") return 34;
  if (beat === 3) return 22;
  if (dimension === "move_clarity") return 20;
  return 12;
}

function failedCoachingCandidates(exchange: M1L1ExchangeTranscripts): M1L1CoachingCandidate[] {
  const turns = [
    { beat: 1 as const, transcript: exchange.opener },
    { beat: 3 as const, transcript: exchange.firstResponse },
  ];
  const sourceBeats: Record<M1L1DimensionId, readonly (1 | 3)[]> = {
    evidence_discipline: [3], motive_character_language: [1, 3], issue_count: [1],
    point_placement: [1], grounding_concreteness: [1], move_clarity: [1], park_and_return: [3],
  };
  return turns.flatMap((turn) => {
    const flags = m1L1BehaviorFlags(turn.transcript, turn.beat);
    return flags.flatMap((item): M1L1CoachingCandidate[] => {
      if (item.status !== "not_met" || !item.evidenceQuote || !sourceBeats[item.dimension].includes(turn.beat)) return [];
      return [{
        beat: turn.beat,
        dimension: item.dimension,
        evidenceQuote: item.evidenceQuote,
        flags,
        score: COACHING_SEVERITY[item.dimension] + coachingConfidence(item.dimension, turn.transcript) + coachingRelevance(item.dimension, turn.beat),
      }];
    });
  }).sort((left, right) => right.score - left.score
    || right.beat - left.beat
    || DIMENSION_PRIORITY.indexOf(left.dimension) - DIMENSION_PRIORITY.indexOf(right.dimension));
}

function contextualCoachingCopy(candidate: M1L1CoachingCandidate): Pick<LessonCoachNote, "worked" | "change" | "retryDirection"> {
  const quote = `“${candidate.evidenceQuote}”`;
  const copy: Readonly<Record<M1L1DimensionId, readonly [string, string]>> = {
    evidence_discipline: [`In ${quote}, several pieces of the case compete with the main point.`, "Use one proof, then make one answerable request."],
    motive_character_language: [`In ${quote}, the wording shifts from what happened to a judgment about Adam.`, "Name the observable handoff problem without assigning motive or character."],
    issue_count: [`In ${quote}, more than one issue is competing for attention.`, "Keep the late handoff as the one issue in view."],
    point_placement: [`In ${quote}, the main point arrives after the setup.`, "Lead with the late handoff, then add one supporting fact."],
    grounding_concreteness: [`In ${quote}, the concern is not anchored to a specific handoff fact.`, "Ground the point in one observable detail, such as the 4:20 arrival."],
    move_clarity: [`In ${quote}, Adam does not get one clear next step to answer.`, "End with one answerable request, including the noon handoff."],
    park_and_return: [`In ${quote}, your response engages Adam's explanation but loses the noon request.`, "Acknowledge the constraint briefly, then return to the noon handoff."],
  };
  const [worked, change] = copy[candidate.dimension];
  return { worked, change, retryDirection: `Replay this exact moment. ${change}` };
}

/** Ranks observable failures by severity, signal confidence, and relevance to the live pushback. */
export function m1L1CoachExchange(exchange: M1L1ExchangeTranscripts): LessonCoachNote | null {
  if (cleanTranscript(exchange.opener).length < 2 || cleanTranscript(exchange.firstResponse).length < 2) return null;
  const candidate = failedCoachingCandidates(exchange)[0];
  if (candidate) {
    return {
      evidenceQuote: candidate.evidenceQuote,
      ...contextualCoachingCopy(candidate),
      coachedBehaviorId: M1_L1_CONVERSION.coachedBehaviorId,
      coachedBeat: candidate.beat,
      selectedDimension: candidate.dimension,
      flags: candidate.flags,
    };
  }
  const responseNote = m1L1CoachNote(exchange.firstResponse, 3);
  return responseNote ?? m1L1CoachNote(exchange.opener, 1);
}

/** Supplies a concrete model for the one behavior Hope selected, without changing the learner's retry. */
export function m1L1GoodVersion(dimension: M1L1DimensionId, coachedBeat: 1 | 3 | 5): string {
  if (coachedBeat === 3 || coachedBeat === 5) {
    return ({
      evidence_discipline: "I understand quarter-close is busy. Yesterday’s file arrived at 4:20, and I still need future files by noon so I have time to review them.",
      motive_character_language: "I understand quarter-close is busy. The file arrived at 4:20 yesterday, and I need future files by noon.",
      issue_count: "I understand quarter-close is busy. I want to stay with the handoff timing: can you send future files by noon?",
      point_placement: "I still need future files by noon. I understand quarter-close is busy, but a 4:20 handoff leaves too little review time.",
      grounding_concreteness: "I understand quarter-close is busy. Yesterday’s file arrived at 4:20, leaving me 40 minutes to review it. Can you send future files by noon?",
      move_clarity: "I understand quarter-close is busy. Can you send future client files by noon?",
      park_and_return: "I understand quarter-close makes the timing difficult. I still need future files by noon so I have enough time to review them. Can we make that work?",
    } as const)[dimension];
  }
  return ({
    evidence_discipline: "Yesterday’s file arrived at 4:20, leaving me 40 minutes to review it. Can you send future files by noon?",
    motive_character_language: "The file arrived at 4:20 yesterday, leaving me 40 minutes to review it. Can you send future files by noon?",
    issue_count: "The late file handoff is leaving too little review time. Can you send future files by noon?",
    point_placement: "I need future client files by noon. Yesterday’s 4:20 handoff left me only 40 minutes to review the file.",
    grounding_concreteness: "Yesterday’s file arrived at 4:20, leaving me 40 minutes before the deadline. Can you send future files by noon?",
    move_clarity: "Yesterday’s file arrived at 4:20, leaving too little review time. Can you send future files by noon?",
    park_and_return: "I need future client files by noon so I have enough time to review them before the deadline.",
  } as const)[dimension];
}

/** Compares the same scoreless flag using a complete, explicit transition table. */
export function m1L1Comparison(firstAttempt: string, retry: string, dimension: M1L1DimensionId = "evidence_discipline", coachedBeat: 1 | 3 | 5 = 5): M1L1ComparisonResult {
  const before = m1L1BehaviorFlags(firstAttempt, coachedBeat).find((item) => item.dimension === dimension)?.status ?? "not_assessable";
  const after = m1L1BehaviorFlags(retry, coachedBeat).find((item) => item.dimension === dimension)?.status ?? "not_assessable";
  const label = labelForDimension(dimension);
  let text: string;
  let criterionChanged = false;
  if (before === "not_assessable" || after === "not_assessable") text = `This ${label} comparison is not assessable. Hope checked no other behavior.`;
  else if (before === "not_met" && after === "met") { text = `The retry improved: it did ${label}. That is the only change Hope checked.`; criterionChanged = true; }
  else if (before === "met" && after === "met") text = `The retry held: it continued to ${label}. Hope checked no other behavior.`;
  else if (before === "met" && after === "not_met") { text = `The retry regressed: it no longer ${label}. Hope checked no other behavior.`; criterionChanged = true; }
  else text = `The retry still did not ${label}. Hope checked no other behavior.`;
  return { behaviorId: "point_proof_move", selectedDimension: dimension, text, criterionChanged };
}

/** Adam is authorized only for this exact accepted work manifest. */
export function semanticVoiceForScenario(scenario: Scenario, lesson?: ConvertedLessonConfig): "adam_counterpart" | "contextual_counterpart" {
  return lesson?.practiceId === PRACTICE_ID
    && lesson.context === "work"
    && lesson.counterpartId === COUNTERPART_ID
    && scenario.id === SCENARIO_ID
    && scenario.category === "work"
    ? "adam_counterpart"
    : "contextual_counterpart";
}

/** Strict resume identity for the isolated Adam work runtime. */
export function isAcceptedM1L1ResumeRun(run: PilotDayRun | null | undefined): run is PilotDayRun {
  return Boolean(run
    && run.convertedModuleId === MODULE_ID
    && run.practiceId === PRACTICE_ID
    && run.contentVersion === CONTENT_VERSION
    && run.scenarioContext?.scenarioId === SCENARIO_ID
    && run.scenarioContext.category === "work"
    && run.scenarioContext.counterpartId === COUNTERPART_ID
    && run.counterpartIdentity === COUNTERPART_ID
    && hasCanonicalM1L1PressureSequence(run));
}

/** Rejects query-only, stale, unrelated, incomplete, or tampered completion attempts. */
export function validateM1L1Completion(run: PilotDayRun | null | undefined, requestedRunId: string | null | undefined): CompletionValidation {
  if (!run || !requestedRunId || run.id !== requestedRunId) return { isValid: false, reason: "run_id" };
  if (run.convertedModuleId !== MODULE_ID || run.practiceId !== PRACTICE_ID || run.contentVersion !== CONTENT_VERSION) return { isValid: false, reason: "manifest_identity" };
  const context = run.scenarioContext;
  if (context?.scenarioId !== SCENARIO_ID || context.category !== "work" || context.counterpartId !== COUNTERPART_ID) return { isValid: false, reason: "scenario_identity" };
  const rehearsal = run.m1L1;
  if (!run.attempt || !run.responseAttempt || !rehearsal?.pushbackOne || !rehearsal.pushbackTwo) return { isValid: false, reason: "turn_plan" };
  if (!hasCanonicalM1L1PressureSequence(run)) return { isValid: false, reason: "pressure_authenticity" };
  const ordered = run.attempt.confirmedAt < (rehearsal.pushbackOne.authoredAt ?? 0)
    && (rehearsal.pushbackOne.authoredAt ?? 0) < run.responseAttempt.confirmedAt
    && run.responseAttempt.confirmedAt < (rehearsal.pushbackTwo.authoredAt ?? 0);
  if (!ordered) return { isValid: false, reason: "turn_order" };
  if (![7, 8].includes(rehearsal.beat) || rehearsal.retryCount < 1 || !run.retryAttempt || !run.comparison || run.state !== "attempt_comparison") return { isValid: false, reason: "rehearsal_state" };
  return { isValid: true };
}

function isString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

/** Strictly validates scoreless progress while preserving independently valid versions. */
export function normalizeConvertedLessonProgress(value: unknown): ConvertedLessonProgress[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ConvertedLessonProgress => {
    if (!entry || typeof entry !== "object") return false;
    const item = entry as Partial<ConvertedLessonProgress>;
    const config = item.lessonId === LESSON_ID ? M1_L1_CONVERSION : approvedRehearsalConfig(item.lessonId);
    if (!config) return false;
    return item.moduleId === config.moduleId
      && item.practiceId === config.practiceId
      && (item.lessonId === LESSON_ID ? isString(item.contentVersion) : item.contentVersion === config.contentVersion)
      && isString(item.runId)
      && Number.isInteger(item.lessonCardCheckpoint)
      && (item.lessonCardCheckpoint ?? 0) >= config.completionCard
      && item.quizGatesCompleted === true
      && item.rehearsalCompleted === true
      && item.retryCompleted === true
      && item.comparisonViewed === true
      && item.savedMoveId === config.namedMoveId
      && ["say", "write", "save_later"].includes(item.transferChoice ?? "")
      && typeof item.completedAt === "number"
      && Number.isFinite(item.completedAt)
      && item.completedAt > 0
      && item.sourceLineage === "approved-html-deck-pinned"
      && (item.customWording === undefined || (item.lessonId === LESSON_ID && typeof item.customWording === "string" && item.customWording.trim().length > 0 && item.customWording.length <= 240));
  });
}

/** Merges by versioned composite identity and never lets an older duplicate regress completion. */
export function mergeConvertedLessonProgress(existing: unknown, incoming: ConvertedLessonProgress): ConvertedLessonProgress[] {
  const valid = normalizeConvertedLessonProgress(existing);
  const normalizedIncoming = normalizeConvertedLessonProgress([incoming])[0];
  if (!normalizedIncoming) throw new Error("Invalid incoming converted progress");
  const key = `${normalizedIncoming.lessonId}:${normalizedIncoming.practiceId}:${normalizedIncoming.contentVersion}`;
  const current = valid.find((item) => `${item.lessonId}:${item.practiceId}:${item.contentVersion}` === key);
  const winner = current && current.completedAt >= normalizedIncoming.completedAt ? current : normalizedIncoming;
  return [...valid.filter((item) => `${item.lessonId}:${item.practiceId}:${item.contentVersion}` !== key), winner]
    .sort((a, b) => a.completedAt - b.completedAt);
}

export function convertedProgressFacts(record: ConvertedLessonProgress): readonly string[] {
  const completionCard = record.lessonId === LESSON_ID
    ? M1_L1_CONVERSION.completionCard
    : approvedRehearsalConfig(record.lessonId)?.completionCard ?? Number.MAX_SAFE_INTEGER;
  return [
    "Practice completed",
    ...(record.retryCompleted ? ["Retry completed"] : []),
    ...(record.savedMoveId ? ["Move saved"] : []),
    ...(record.lessonCardCheckpoint >= completionCard ? ["Lesson completed"] : []),
  ];
}

export function approvedCustomWording(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = cleanTranscript(value);
  return clean.length >= 2 && clean.length <= 240 ? clean : null;
}

export function conversionRuntimeEnabled(lessonId: string | null | undefined): lessonId is ConvertedLessonId {
  return __DEV__ && lessonId === M1_L1_CONVERSION.lessonId;
}

export function createM1L1Attempt(id: string, kind: PilotAttemptRecord["kind"], transcript: string, confirmedAt: number): PilotAttemptRecord {
  return { id, kind, transcript: cleanTranscript(transcript), representation: "confirmed_transcript", confirmedAt };
}
