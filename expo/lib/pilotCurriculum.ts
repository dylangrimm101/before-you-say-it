import raw from "@/constants/pilotCurriculum.json";
import type {
  PilotAudioLine,
  PilotBehaviorId,
  PilotCoachResponse,
  PilotComparison,
  PilotDayRun,
  PilotModule,
  PilotProgram,
} from "@/types/pilotCurriculum";

export const PILOT_PROGRAM: PilotProgram = raw as unknown as PilotProgram;
export const PILOT_MODULES: PilotModule[] = PILOT_PROGRAM.modules;
export const PILOT_TOTAL_DAYS: number = PILOT_MODULES.length;
export const PILOT_NEUTRAL_COACH_FALLBACK = "I couldn't turn that into a clear, specific note. Please try the moment once more." as const;
export const PILOT_RETRY_INVITATION = "Try that same moment again." as const;

const BY_DAY = new Map<number, PilotModule>(PILOT_MODULES.map((module) => [module.day, module]));
const BANNED_COACHING = /\b(?:score|scored|percent|percentage|great job|excellent work|amazing|beautifully|pivotal|crucial|transformative|groundbreaking|delve|underscore|foster|showcase|additionally|moreover|furthermore|notably|ultimately|at its core|what really matters|the real question is|let's dive in|i hope this helps|let me know if|personality|attachment|trauma|diagnos\w*|confiden\w*|anxi\w*|calm\w*|motive|relationship|will agree|will understand|will respond|future outcome)\b/i;

/** The authored V3 pilot module for a day. */
export function pilotModule(day: number): PilotModule | undefined {
  return BY_DAY.get(day);
}

/** The first unfinished module, or one past the authored pilot. */
export function currentPilotDay(doneDays: ReadonlySet<number>): number {
  let day = 1;
  while (day <= PILOT_TOTAL_DAYS && doneDays.has(day)) day += 1;
  return day;
}

/** Modules unlock in order; completed modules remain available. */
export function isPilotModuleUnlocked(day: number, doneDays: ReadonlySet<number>): boolean {
  if (!Number.isInteger(day) || day < 1 || day > PILOT_TOTAL_DAYS) return false;
  return day === 1 || doneDays.has(day) || doneDays.has(day - 1);
}

/** Structural validation for the approved V3 pack. */
export function pilotProblems(program: PilotProgram = PILOT_PROGRAM): string[] {
  const problems: string[] = [];
  if (program.schema_version !== "3.0") problems.push("wrong schema version");
  if (!program.curriculum_version || program.modules.length !== 8) problems.push("pilot is malformed");
  const audioIds = new Set<string>();
  program.modules.forEach((module, index) => {
    if (module.day !== index + 1) problems.push(`expected day ${index + 1}`);
    if (!module.copy.heading || !module.copy.body || !module.copy.finish_button) problems.push(`day ${module.day} is missing copy`);
    if (module.practice.reaction_level > 2) problems.push(`day ${module.day} exceeds mild resistance`);
    if (module.evaluation.priority_order.length === 0) problems.push(`day ${module.day} has no rubric`);
    audioLines(module).forEach((line) => {
      if (audioIds.has(line.audio_id)) problems.push(`duplicate audio id ${line.audio_id}`);
      audioIds.add(line.audio_id);
      if (!line.audio_id.startsWith("bysi-v3-")) problems.push(`stale audio id ${line.audio_id}`);
    });
  });
  if (!program.modules[0]?.preserve_uncoached_attempt) problems.push("day 1 baseline is not preserved");
  if ((program.modules[7]?.practice.approved_pushback_bank?.length ?? 0) !== 4) problems.push("day 8 pushback bank is incomplete");
  return problems;
}

/** Every fixed line that has a semantic, versioned static-audio mapping. */
export function audioLines(module: PilotModule): PilotAudioLine[] {
  const quiz = module.copy.quiz;
  return [
    ...module.copy.lessons,
    ...(quiz ? [quiz.option_a, quiz.option_b] : []),
    ...(module.practice.adam_line ? [module.practice.adam_line] : []),
    ...(module.practice.approved_pushback_bank ?? []),
  ];
}

/** Deterministically select and later replay one approved Day 8 pushback. */
export function selectDay8Pushback(runId: string, module: PilotModule): PilotAudioLine | null {
  const bank = module.practice.approved_pushback_bank ?? [];
  if (bank.length === 0) return null;
  const hash = Array.from(runId).reduce((total, character) => (total * 31 + character.charCodeAt(0)) >>> 0, 0);
  return bank[hash % bank.length] ?? null;
}

/** Day 8 chronology is selected only from the coached behavior ID. */
export function day8RetryBranch(behaviorId: PilotBehaviorId | undefined): "opener" | "pushback_response" {
  return behaviorId === "integrated_opener" ? "opener" : "pushback_response";
}

/** Select the exact segment retried for Day 2 and Day 8 without changing two behaviors. */
export function pilotRetrySegment(day: number, behaviorId: PilotBehaviorId | undefined): "opener" | "pushback_response" {
  if (day === 2 && behaviorId === "conversation_job") return "opener";
  if (day === 8) return day8RetryBranch(behaviorId);
  return "pushback_response";
}

/** Validate generated Hope feedback before any generated prose reaches the UI. */
export function validatePilotCoachResponse(value: PilotCoachResponse, module: PilotModule, transcript: string): string[] {
  const errors: string[] = [];
  const noteWords = wordCount(value.note);
  const retryWords = wordCount(value.retryInstruction ?? "");
  if (value.day !== module.day) errors.push("wrong day");
  if (value.route !== "coach") errors.push("wrong route");
  if (!value.behaviorId || !module.evaluation.priority_order.includes(value.behaviorId)) errors.push("behavior not allowed");
  if (!value.evidenceQuote || !transcript.includes(value.evidenceQuote)) errors.push("quote is not exact and contiguous");
  if (value.evidenceQuote && !value.note.includes(value.evidenceQuote)) errors.push("note does not contain quote");
  if (!value.retryInstruction) errors.push("missing retry instruction");
  if (value.retryPrompt !== PILOT_RETRY_INVITATION) errors.push("missing retry prompt");
  if (noteWords > 32) errors.push("note exceeds 32 words");
  if (retryWords > 20) errors.push("retry exceeds 20 words");
  if (noteWords + retryWords > 48) errors.push("note and retry exceed 48 words");
  const generated = `${value.note} ${value.retryInstruction ?? ""}`;
  if (BANNED_COACHING.test(generated) || /[%!]|—/.test(generated)) errors.push("prohibited coaching claim or style");
  return errors;
}

/** Approved fail-closed response after two malformed generations. */
export function neutralPilotCoachResponse(module: PilotModule): PilotCoachResponse {
  return {
    route: "clarify",
    day: module.day,
    evidenceQuote: null,
    behaviorId: null,
    note: PILOT_NEUTRAL_COACH_FALLBACK,
    retryInstruction: module.retry.direction,
    retryPrompt: PILOT_RETRY_INVITATION,
  };
}

/** Deterministic comparison limited to one selected behavior and 36 words. */
export function comparePilotAttempts(behaviorId: PilotBehaviorId, before: string, after: string): PilotComparison {
  const changed = normalize(before) !== normalize(after);
  const text = changed
    ? "First attempt: the selected move used the original wording. Retry: the wording changed while the same coached behavior stayed in focus."
    : "First attempt: the selected move used this wording. Retry: you kept the same wording and the same coached behavior.";
  return { behaviorId, text, criterionChanged: changed };
}

/** A completion transition is valid only after an immutable retry exists. */
export function canCompletePilotRun(run: PilotDayRun | undefined): boolean {
  return Boolean(run?.retryAttempt && run.state === "transfer_cue");
}

/** Reject malformed comparisons before rendering. */
export function validatePilotComparison(value: PilotComparison, coachedBehaviorId: PilotBehaviorId): string[] {
  const errors: string[] = [];
  if (value.behaviorId !== coachedBehaviorId) errors.push("comparison behavior changed");
  if (wordCount(value.text) > 36) errors.push("comparison exceeds 36 words");
  if (BANNED_COACHING.test(value.text) || /[%!]/.test(value.text)) errors.push("prohibited comparison claim or style");
  return errors;
}

function normalize(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function wordCount(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}
