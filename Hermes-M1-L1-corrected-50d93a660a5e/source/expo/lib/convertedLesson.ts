import type { Scenario } from "@/types/convo";
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
export type SafetyChoice = "direct" | "unsure" | "yes" | "prefer_not";

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
  retryCap: 2;
  launchEligible: false;
}

export interface ConvertedLessonProgress {
  lessonId: typeof LESSON_ID;
  moduleId: typeof MODULE_ID;
  practiceId: typeof PRACTICE_ID;
  contentVersion: string;
  runId: string;
  lessonCardCheckpoint: number;
  quizGatesCompleted: true;
  rehearsalCompleted: true;
  retryCompleted: true;
  comparisonViewed: true;
  savedMoveId: ConvertedLessonConfig["namedMoveId"];
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
  coachedBeat: 3 | 5;
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
    situation: "Quarter close is underway. A late file handoff left too little review time, and you need one workable change for the next handoff.",
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
  retryCap: 2,
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

function quoteFor(value: string): string {
  return cleanTranscript(value).split(/\s+/).slice(0, 10).join(" ");
}

function flag(dimension: M1L1DimensionId, status: M1L1BehaviorFlag["status"], transcript: string): M1L1BehaviorFlag {
  return { dimension, status, evidenceQuote: status === "not_assessable" ? null : quoteFor(transcript) };
}

/** Deterministically selects one approved Pushback 1 from observable opening text. */
export function selectM1L1PushbackOne(approvedOpening: string, runId: string): ScenarioCounterpartTurn {
  const opening = cleanTranscript(approvedOpening).toLowerCase();
  const hasMotiveClaim = /\b(always|never|lazy|selfish|care|respect|trying to|on purpose)\b/.test(opening);
  const isIndirect = /\?|\b(maybe|wondering|do you think|have you noticed)\b/.test(opening);
  const index = hasMotiveClaim ? 2 : isIndirect ? 1 : 0;
  const text = M1_L1_CONVERSION.pushbackOneBank[index];
  const id = `${runId}-pushback-1-${index + 1}`;
  return {
    id,
    text,
    source: "authored",
    reactionId: `m1-l1-pushback-1-${index + 1}`,
    semanticVoiceKey: M1_L1_CONVERSION.semanticVoiceKey,
    resolvedAudioId: `m1-l1-v2-1-${id}`,
  };
}

/** Returns the mandatory Beat 4 evidence trap with stable audio identity. */
export function m1L1EvidenceTrap(runId: string): ScenarioCounterpartTurn {
  const id = `${runId}-pushback-2-evidence-trap`;
  return {
    id,
    text: M1_L1_CONVERSION.authoredEvidenceTrap,
    source: "authored",
    reactionId: "m1-l1-evidence-trap",
    semanticVoiceKey: M1_L1_CONVERSION.semanticVoiceKey,
    resolvedAudioId: `m1-l1-v2-1-${id}`,
  };
}

/** Scoreless transcript-observable flags for one confirmed learner segment. */
export function m1L1BehaviorFlags(confirmedTranscript: string, coachedBeat: 3 | 5): M1L1BehaviorFlag[] {
  const transcript = cleanTranscript(confirmedTranscript);
  if (transcript.length < 2) return DIMENSION_PRIORITY.map((dimension) => flag(dimension, "not_assessable", transcript));
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
    flag("point_placement", directPoint ? "met" : "not_met", transcript),
    flag("issue_count", caseBuilding ? "not_met" : "met", transcript),
    flag("grounding_concreteness", grounded ? "met" : "not_met", transcript),
    flag("motive_character_language", motiveClaim ? "not_met" : "met", transcript),
    flag("move_clarity", answerableMove ? "met" : "not_met", transcript),
    flag("evidence_discipline", evidenceDiscipline ? "met" : "not_met", transcript),
    flag("park_and_return", coachedBeat === 5 ? (parksAndReturns ? "met" : "not_met") : "not_assessable", transcript),
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
export function m1L1CoachNote(confirmedTranscript: string, coachedBeat: 3 | 5 = 5): LessonCoachNote | null {
  const transcript = cleanTranscript(confirmedTranscript);
  if (transcript.length < 2) return null;
  const flags = m1L1BehaviorFlags(transcript, coachedBeat);
  const selected = DIMENSION_PRIORITY.find((dimension) => flags.find((item) => item.dimension === dimension)?.status === "not_met")
    ?? DIMENSION_PRIORITY.find((dimension) => flags.find((item) => item.dimension === dimension)?.status === "met")
    ?? "evidence_discipline";
  const selectedFlag = flags.find((item) => item.dimension === selected);
  const evidenceQuote = selectedFlag?.evidenceQuote ?? quoteFor(transcript);
  const isMet = selectedFlag?.status === "met";
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

/** Compares the coached attempt and retry against the same selected scoreless flag. */
export function m1L1Comparison(firstAttempt: string, retry: string, dimension: M1L1DimensionId = "evidence_discipline", coachedBeat: 3 | 5 = 5): M1L1ComparisonResult {
  const before = m1L1BehaviorFlags(firstAttempt, coachedBeat).find((item) => item.dimension === dimension)?.status ?? "not_assessable";
  const after = m1L1BehaviorFlags(retry, coachedBeat).find((item) => item.dimension === dimension)?.status ?? "not_assessable";
  const criterionChanged = before !== after;
  const text = criterionChanged
    ? `First response did not ${labelForDimension(dimension)}. The retry did. That is the only change Hope checked.`
    : `The retry held the same result on ${labelForDimension(dimension)}. Hope checked no other behavior.`;
  return { behaviorId: "point_proof_move", selectedDimension: dimension, text, criterionChanged };
}

/** Safety answers are ephemeral; every non-direct answer reaches the authored alternate route. */
export function routeForM1L1Safety(choice: SafetyChoice): "scene" | "different-route" {
  return choice === "direct" ? "scene" : "different-route";
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

/** Rejects query-only, stale, unrelated, incomplete, or tampered completion attempts. */
export function validateM1L1Completion(run: PilotDayRun | null | undefined, requestedRunId: string | null | undefined): CompletionValidation {
  if (!run || !requestedRunId || run.id !== requestedRunId) return { isValid: false, reason: "run_id" };
  if (run.convertedModuleId !== MODULE_ID || run.practiceId !== PRACTICE_ID || run.contentVersion !== CONTENT_VERSION) return { isValid: false, reason: "manifest_identity" };
  const context = run.scenarioContext;
  if (context?.scenarioId !== SCENARIO_ID || context.category !== "work" || context.counterpartId !== COUNTERPART_ID) return { isValid: false, reason: "scenario_identity" };
  const rehearsal = run.m1L1;
  if (!run.attempt || !run.responseAttempt || !rehearsal?.secondResponseAttempt || !rehearsal.pushbackOne || !rehearsal.pushbackTwo) return { isValid: false, reason: "turn_plan" };
  if (rehearsal.beat !== 8 || rehearsal.retryCount < 1 || !run.retryAttempt || !run.comparison || run.state !== "attempt_comparison") return { isValid: false, reason: "rehearsal_state" };
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
    return item.lessonId === LESSON_ID
      && item.moduleId === MODULE_ID
      && item.practiceId === PRACTICE_ID
      && isString(item.contentVersion)
      && isString(item.runId)
      && Number.isInteger(item.lessonCardCheckpoint)
      && (item.lessonCardCheckpoint ?? 0) >= M1_L1_CONVERSION.completionCard
      && item.quizGatesCompleted === true
      && item.rehearsalCompleted === true
      && item.retryCompleted === true
      && item.comparisonViewed === true
      && item.savedMoveId === M1_L1_CONVERSION.namedMoveId
      && ["say", "write", "save_later"].includes(item.transferChoice ?? "")
      && typeof item.completedAt === "number"
      && Number.isFinite(item.completedAt)
      && item.completedAt > 0
      && item.sourceLineage === "approved-html-deck-pinned"
      && (item.customWording === undefined || (typeof item.customWording === "string" && item.customWording.trim().length > 0 && item.customWording.length <= 240));
  });
}

/** Merges by versioned composite identity and never lets an older duplicate regress completion. */
export function mergeConvertedLessonProgress(existing: unknown, incoming: ConvertedLessonProgress): ConvertedLessonProgress[] {
  const valid = normalizeConvertedLessonProgress(existing);
  const key = `${incoming.lessonId}:${incoming.practiceId}:${incoming.contentVersion}`;
  const current = valid.find((item) => `${item.lessonId}:${item.practiceId}:${item.contentVersion}` === key);
  const winner = current && current.completedAt >= incoming.completedAt ? current : incoming;
  return [...valid.filter((item) => `${item.lessonId}:${item.practiceId}:${item.contentVersion}` !== key), winner]
    .sort((a, b) => a.completedAt - b.completedAt);
}

export function convertedProgressFacts(record: ConvertedLessonProgress): readonly string[] {
  return [
    "Practice completed",
    ...(record.retryCompleted ? ["Retry completed"] : []),
    ...(record.savedMoveId ? ["Move saved"] : []),
    ...(record.lessonCardCheckpoint >= M1_L1_CONVERSION.completionCard ? ["Lesson completed"] : []),
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
