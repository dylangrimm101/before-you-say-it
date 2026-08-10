import { curriculumModule, type ModuleId } from "@/constants/modules";
import { conversionEvidence } from "@/lib/conversion";
import type { ActivePracticeSession, FreeJourneyCheckpoint } from "@/lib/practiceSession";
import { completedPracticeSessionToSharedTranscript, createFirstFocus } from "@/lib/sharedProductAdapters";
import type { Debrief, Turn } from "@/types/convo";
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
  "briefing", "rehearsal", "transcript_review", "generating", "pressure_moment", "practice_shift", "starting_index", "complete",
];

/** Removes every value derived after an upstream intake answer changes. */
export function invalidateFreeJourney(session: ActivePracticeSession, now: number = Date.now()): ActivePracticeSession {
  const { freeRehearsalTurns: _turns, freeRehearsalCompletedAt: _completed, recommendation: _recommendation, sharedResult: _result, attemptOne: _attempt, originalAdamResponse: _response, dayThirtyBaseline: _baseline, coachNote: _note, retryInstruction: _retry, ...base } = session;
  return { ...base, freeJourneyCheckpoint: "briefing", nextState: "awaiting_onboarding_baseline", updatedAt: now };
}

/** Returns the furthest checkpoint that is valid from durable local evidence. */
export function validFreeJourneyCheckpoint(session: ActivePracticeSession): FreeJourneyCheckpoint {
  if (session.sharedResult && session.recommendation && session.freeRehearsalCompletedAt) {
    const requested = session.freeJourneyCheckpoint ?? "pressure_moment";
    return FREE_JOURNEY_CHECKPOINTS.includes(requested) ? requested : "pressure_moment";
  }
  if (session.freeRehearsalCompletedAt && session.freeRehearsalTurns?.length === 3) return "generating";
  const roles = session.freeRehearsalTurns?.map((turn) => turn.role).join(",") ?? "";
  if (roles === "user,them,user") return "transcript_review";
  if (session.freeRehearsalTurns?.length) return "rehearsal";
  return session.freeJourneyCheckpoint === "rehearsal" ? "rehearsal" : "briefing";
}

/** The second approved user turn ends capture; only the opening creates pushback. */
export function shouldGeneratePushback(turnsBeforeApproval: readonly Turn[]): boolean {
  return turnsBeforeApproval.filter((turn) => turn.role === "user").length === 0;
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

/** Builds contract-v1 results without reusing legacy compatibility scores. */
export function buildFreeJourneyResult(session: ActivePracticeSession, debrief: Debrief): SharedResultContractV1 {
  const transcript = completedPracticeSessionToSharedTranscript(session);
  const opening = transcript.turns.find((turn) => turn.turn_kind === "opening");
  const pushback = transcript.turns.find((turn) => turn.turn_kind === "pushback");
  const response = transcript.turns.find((turn) => turn.turn_kind === "pressure_response");
  if (!opening || !pushback || !response) throw new Error("A complete approved rehearsal is required.");

  const evidence = conversionEvidence(session.freeRehearsalTurns ?? [], debrief, session.provisionalModuleId);
  const module = curriculumModule(evidence.focus.id);
  const firstFocusLabel = module?.name ?? evidence.focus.name;
  const firstFocus = createFirstFocus(focusKey(evidence.focus.id), firstFocusLabel, evidence.focus.id, "suggested");
  const observation = debrief.flags[0]?.issue.trim() || `Your response changed after ${session.counterpartDisplayLabel ?? session.counterpart} pushed back.`;
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

  const practiceShift = validatePracticeShift({
    practice_shift_version: PRACTICE_SHIFT_VERSION,
    headline: evidence.focus.headline,
    current_pattern_steps: [
      `Open with: “${opening.approved_text}”`,
      `Meet the pushback: “${pushback.approved_text}”`,
      `Respond under pressure: “${response.approved_text}”`,
    ],
    practice_target_steps: [
      "Keep the original point in view",
      evidence.immediateAction,
      `Return to your goal: ${session.usefulOutcome}`,
    ],
    success_target: session.usefulOutcome,
    first_focus_key: firstFocus.first_focus_key,
    first_focus_label: firstFocus.first_focus_label,
    recommended_module_id: firstFocus.recommended_module_id,
    caveat: PRACTICE_SHIFT_CAVEAT,
  });

  const signals: SharedSignalV1[] = validateSignals([
    "clarity", "specificity", "steadiness", "listening", "boundaries", "repair",
  ].map((signal_key): SharedSignalV1 => ({
    signal_key: signal_key as SharedSignalV1["signal_key"],
    observation_status: "insufficient_evidence",
    score: null,
    evidence_turn_ids: [],
    signal_version: SIGNAL_VERSION,
  })), transcript);

  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: session.id,
    pressure_moment: pressureMoment,
    practice_shift: practiceShift,
    signals,
    starting_index: { ...calculatePartialStartingIndex(signals), index_version: STARTING_INDEX_VERSION },
    first_focus: firstFocus,
  };
}

/** Marks generation as invalid so a stale completion cannot navigate to results. */
export function cancelPendingResult(session: ActivePracticeSession, now: number = Date.now()): ActivePracticeSession {
  return { ...session, freeJourneyCheckpoint: "transcript_review", sharedResult: undefined, recommendation: undefined, updatedAt: now };
}
