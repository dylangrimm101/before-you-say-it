import { CURRICULUM_MODULES, curriculumModule, type ModuleId } from "@/constants/modules";
import type { BysiResultResponse } from "@/lib/ai";
import { conversionEvidence } from "@/lib/conversion";
import type { ActivePracticeSession, FreeJourneyCheckpoint } from "@/lib/practiceSession";
import { completedPracticeSessionToSharedTranscript, createFirstFocus } from "@/lib/sharedProductAdapters";
import { safeLog } from "@/lib/redact";
import type { CategoryId, Debrief, Turn } from "@/types/convo";
import {
  PRESSURE_MOMENT_VERSION,
  PRACTICE_SHIFT_CAVEAT,
  PRACTICE_SHIFT_VERSION,
  SHARED_PRODUCT_CONTRACT_VERSION,
  SIGNAL_VERSION,
  STARTING_INDEX_VERSION,
  calculatePartialStartingIndex,
  validatePracticeShift,
  validatePressureMoment,
  validateSignals,
  type SharedResultContractV1,
  type SharedSignalV1,
} from "@/types/sharedProduct";

export const FREE_JOURNEY_CHECKPOINTS: readonly FreeJourneyCheckpoint[] = [
  "briefing", "rehearsal", "transcript_review", "generating", "pressure_moment", "rewrite", "practice_shift", "starting_index", "complete", "insufficient_evidence",
];

/** Removes every value derived after an upstream intake answer changes. */
export function invalidateFreeJourney(session: ActivePracticeSession, now: number = Date.now()): ActivePracticeSession {
  const { freeRehearsalTurns: _turns, freeRehearsalCompletedAt: _completed, recommendation: _recommendation, sharedResult: _result, insufficientEvidence: _insufficient, postRehearsalState: _postState, attemptOne: _attempt, originalAdamResponse: _response, dayThirtyBaseline: _baseline, coachNote: _note, retryInstruction: _retry, ...base } = session;
  return { ...base, freeJourneyCheckpoint: "briefing", nextState: "awaiting_onboarding_baseline", updatedAt: now };
}

/** Returns the furthest checkpoint that is valid from durable local evidence. */
export function validFreeJourneyCheckpoint(session: ActivePracticeSession): FreeJourneyCheckpoint {
  if (session.insufficientEvidence && session.freeRehearsalCompletedAt) return "insufficient_evidence";
  if (session.sharedResult && session.recommendation && session.freeRehearsalCompletedAt) {
    const requested = session.freeJourneyCheckpoint ?? "pressure_moment";
    return FREE_JOURNEY_CHECKPOINTS.includes(requested) ? requested : "pressure_moment";
  }
  if (session.freeRehearsalCompletedAt && session.freeRehearsalTurns?.length === 4) return "generating";
  const roles = session.freeRehearsalTurns?.map((turn) => turn.role).join(",") ?? "";
  if (roles === "user,them,user,them") return "transcript_review";
  if (session.freeRehearsalTurns?.length) return "rehearsal";
  return session.freeJourneyCheckpoint === "rehearsal" ? "rehearsal" : "briefing";
}

/** Each of the two approved learner turns receives one counterpart turn. */
export function shouldGeneratePushback(turnsBeforeApproval: readonly Turn[]): boolean {
  return turnsBeforeApproval.filter((turn) => turn.role === "user").length < 2;
}

/** Recognizer completion only creates reviewable text and can never approve or submit it. */
export function recognizerEndState(text: string): { pendingText: string; shouldSubmit: false } {
  return { pendingText: text.trim(), shouldSubmit: false };
}

/** Spoken and typed drafts enter the same approved-turn representation. */
export function approvedUserTurn(id: string, text: string): Turn {
  return { id, role: "user", text: text.trim() };
}

function focusKey(moduleId: ModuleId): string {
  return `curriculum-focus-${moduleId}`;
}

function providerModuleId(value: string | undefined): ModuleId | null {
  const normalized = value?.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") ?? "";
  if (!normalized) return null;
  return CURRICULUM_MODULES.find((module) => module.id === normalized || module.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") === normalized)?.id ?? null;
}

const SIGNAL_KEYS: readonly SharedSignalV1["signal_key"][] = [
  "clarity", "specificity", "steadiness", "listening", "boundaries", "repair",
];

function signalKeyForDimension(name: string): SharedSignalV1["signal_key"] | null {
  const normalized = name.trim().toLowerCase();
  return SIGNAL_KEYS.find((key) => key === normalized) ?? null;
}

function score(value: number): number {
  return Math.round(Math.min(100, Math.max(0, value)));
}

export interface ClearerVersionContext {
  category: CategoryId;
  topic: string;
  usefulOutcome: string;
}

const COACHING_PREFIX = /^(?:pick|try|focus|make|keep|start|name|choose|practice|use|avoid|remember|you should|the goal is|the skill is)\b/i;
const SPOKEN_ASK_PREFIX = /^(?:(?:can|could|would|will) (?:you|we)|please\b|i(?:'|’)d like (?:you|us) to)\b/i;

function cleanSpokenLine(value: string | undefined): string {
  return value?.trim().replace(/^[“\"]|[”\"]$/g, "").trim() ?? "";
}

/** True only for a direct line the learner could naturally say to the counterpart. */
export function isDirectSpokenRequest(value: string | undefined): boolean {
  const line = cleanSpokenLine(value);
  return line.length >= 12 && line.length <= 240 && !COACHING_PREFIX.test(line) && SPOKEN_ASK_PREFIX.test(line);
}

/**
 * Returns provider dialogue when it is usable, otherwise creates a concrete,
 * answerable request from the approved ask and scenario context.
 */
export function clearerSpokenRequest(
  originalAsk: string,
  candidate: string | undefined,
  context: ClearerVersionContext,
): string {
  const cleanedCandidate = cleanSpokenLine(candidate);
  if (isDirectSpokenRequest(cleanedCandidate)) return cleanedCandidate;

  const issue = `${originalAsk} ${context.topic} ${context.usefulOutcome}`.toLowerCase();
  const knownChore = ["dishes", "laundry", "trash", "cooking", "cleaning", "pickup", "drop-off"]
    .find((task) => issue.includes(task));
  if (/\b(?:chore|housework|around the house|at home)\b/.test(issue)) {
    return knownChore
      ? `Can you fully own the ${knownChore} this week without me reminding or tracking it?`
      : "Can you take one recurring chore this week without me having to remind or track it?";
  }
  if (/\b(?:scope|priority|priorities|new work|more work|workload)\b/.test(issue)) {
    return "Can we decide what priority moves before I take on the new work?";
  }
  if (/\b(?:pay me back|repay|repayment|owe|owed|money)\b/.test(issue)) {
    return "Can you send the first payment by Friday and tell me when the rest is coming?";
  }
  if (/\b(?:joke|comment|make fun|in front of|family)\b/.test(issue)) {
    return "Can you talk to me privately instead of making comments about my choices in front of other people?";
  }
  if (/\b(?:meeting|combative|interrupt|disagree)\b/.test(issue)) {
    return "Can we disagree about the work without making personal comments or interrupting each other in meetings?";
  }

  const categoryFallbacks: Record<CategoryId, string> = {
    partner: "Can you take ownership of one specific responsibility this week without me having to manage it?",
    work: "Can we agree on one specific next step, who owns it, and when it will happen?",
    friends: "Can you commit to one specific next step by Friday and tell me if that timing won’t work?",
    family: "Can you talk to me privately about this instead of bringing it up in front of other people?",
  };
  return categoryFallbacks[context.category];
}

/** Builds contract-v1 results from the provider result for this exact approved rehearsal. */
export function buildFreeJourneyResult(
  session: ActivePracticeSession,
  debrief: Debrief,
  analysis: BysiResultResponse,
): SharedResultContractV1 {
  const transcript = completedPracticeSessionToSharedTranscript(session);
  const opening = transcript.turns.find((turn) => turn.turn_kind === "opening");
  const pushback = transcript.turns.find((turn) => turn.turn_kind === "pushback");
  const response = transcript.turns.find((turn) => turn.turn_kind === "pressure_response");
  if (!opening || !pushback || !response) throw new Error("A complete approved rehearsal is required.");

  const evidence = conversionEvidence(session.freeRehearsalTurns ?? [], debrief, session.provisionalModuleId);
  const recommendedModuleId = providerModuleId(analysis.recommended_path?.first_module) ?? evidence.focus.id;
  const module = curriculumModule(recommendedModuleId);
  const firstFocusLabel = module?.name ?? analysis.recommended_path?.first_module?.trim() ?? evidence.focus.name;
  const firstFocus = createFirstFocus(focusKey(recommendedModuleId), firstFocusLabel, recommendedModuleId, "suggested");
  const observation = debrief.wins[0]?.trim() || debrief.flags[0]?.issue.trim() || `Your response changed after ${session.counterpartDisplayLabel ?? session.counterpart} pushed back.`;
  const pressureMoment = validatePressureMoment({
    pressure_moment_version: PRESSURE_MOMENT_VERSION,
    headline: debrief.headline.trim() || "One moment changed after the pushback.",
    opening_turn_id: opening.id,
    pushback_turn_id: pushback.id,
    pressure_response_turn_id: response.id,
    observation,
    why_it_matters: `This matters here because your goal is: ${session.usefulOutcome}`,
    confidence_statement: "This is one short exchange. It suggests a starting point, not a fixed trait.",
  }, transcript);

  const providerShift = analysis.practice_shift;
  const practiceShift = validatePracticeShift({
    practice_shift_version: PRACTICE_SHIFT_VERSION,
    headline: providerShift?.headline?.trim() || evidence.focus.headline,
    current_pattern_steps: [
      `Open with: “${opening.approved_text}”`,
      `Meet the pushback: “${pushback.approved_text}”`,
      `Respond under pressure: “${response.approved_text}”`,
    ],
    practice_target_steps: providerShift?.practice_target?.map((step) => step.trim()).filter(Boolean) ?? [
      "Keep the original point in view",
      evidence.immediateAction,
      `Return to your goal: ${session.usefulOutcome}`,
    ],
    success_target: providerShift?.goal_line?.trim() || session.usefulOutcome,
    first_focus_key: firstFocus.first_focus_key,
    first_focus_label: firstFocus.first_focus_label,
    recommended_module_id: firstFocus.recommended_module_id,
    caveat: PRACTICE_SHIFT_CAVEAT,
  });

  if (analysis.mode !== "result") {
    throw new Error("An insufficient-evidence response cannot render the normal baseline.");
  }
  const observedDimensions = analysis.starting_index?.observed_dimensions ?? [];
  const observedByKey = new Map<SharedSignalV1["signal_key"], (typeof observedDimensions)[number]>();
  observedDimensions.forEach((dimension) => {
    const signalKey = signalKeyForDimension(dimension.name);
    if (!signalKey || !Number.isFinite(dimension.score) || !dimension.evidence?.trim()) return;
    observedByKey.set(signalKey, dimension);
    safeLog("[evidence] native Starting Index dimension", {
      step: signalKey,
      status: "observed",
      type: "starting-index-dimension",
    });
  });
  if (observedByKey.size === 0) {
    throw new Error("The result did not include observed Starting Index dimensions.");
  }
  const evidenceTurnIds = transcript.turns.map((turn) => turn.id);
  const signals: SharedSignalV1[] = validateSignals(SIGNAL_KEYS.map((signal_key): SharedSignalV1 => {
    const observed = observedByKey.get(signal_key);
    return observed ? {
      signal_key,
      observation_status: "observed",
      score: score(observed.score),
      evidence_turn_ids: evidenceTurnIds,
      evidence_summary: observed.evidence.trim(),
      signal_version: SIGNAL_VERSION,
    } : {
      signal_key,
      observation_status: "unobserved",
      score: null,
      evidence_turn_ids: [],
      signal_version: SIGNAL_VERSION,
    };
  }), transcript);
  const calculatedIndex = calculatePartialStartingIndex(signals);
  const providerOverall = analysis.starting_index?.overall;

  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: session.id,
    pressure_moment: pressureMoment,
    rewrite: {
      original_ask: opening.approved_text,
      clearer_version: clearerSpokenRequest(
        opening.approved_text,
        analysis.rewrite?.clearer_version ?? debrief.script[0],
        { category: session.category, topic: session.topic, usefulOutcome: session.usefulOutcome },
      ),
    },
    practice_shift: practiceShift,
    signals,
    starting_index: {
      ...calculatedIndex,
      index_value: typeof providerOverall === "number" && Number.isFinite(providerOverall)
        ? score(providerOverall)
        : calculatedIndex.index_value,
      ...(analysis.starting_index?.label?.trim() ? { label: analysis.starting_index.label.trim() } : {}),
      ...(analysis.starting_index?.coverage_note?.trim() ? { coverage_note: analysis.starting_index.coverage_note.trim() } : {}),
      ...(analysis.starting_index?.focus_dimension?.trim() ? { focus_dimension: analysis.starting_index.focus_dimension.trim() } : {}),
      ...(analysis.starting_index?.unobserved_dimensions ? { unobserved_dimensions: analysis.starting_index.unobserved_dimensions.map((value) => value.trim()).filter(Boolean) } : {}),
      ...(analysis.starting_index?.score_note?.trim() ? { score_note: analysis.starting_index.score_note.trim() } : {}),
      index_version: STARTING_INDEX_VERSION,
    },
    first_focus: firstFocus,
  };
}

/** Marks generation as invalid so a stale completion cannot navigate to results. */
export function cancelPendingResult(session: ActivePracticeSession, now: number = Date.now()): ActivePracticeSession {
  return { ...session, freeJourneyCheckpoint: "transcript_review", postRehearsalState: "transcript_review", sharedResult: undefined, insufficientEvidence: undefined, recommendation: undefined, updatedAt: now };
}
