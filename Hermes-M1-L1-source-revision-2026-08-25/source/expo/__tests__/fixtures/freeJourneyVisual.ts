import type { ModuleId } from "@/constants/modules";
import {
  FOCUS_VERSION,
  PRACTICE_SHIFT_CAVEAT,
  PRACTICE_SHIFT_VERSION,
  PRESSURE_MOMENT_VERSION,
  SHARED_PRODUCT_CONTRACT_VERSION,
  SIGNAL_VERSION,
  STARTING_INDEX_VERSION,
  calculatePartialStartingIndex,
  validatePracticeShift,
  validatePressureMoment,
  validateSignals,
  type SharedResultContractV1,
  type SharedSignalV1,
  type SharedTranscriptContractV1,
} from "@/types/sharedProduct";

export const SUCCESSFUL_VISUAL_FIXTURE_COMMIT = "0c03b9b555492a48610aee7a5015e8f5e3e50859" as const;
export const SUCCESSFUL_VISUAL_REHEARSAL_ID = "practice-visual-v2" as const;
export const SUCCESSFUL_VISUAL_APPROVED_TURNS = {
  opening: {
    id: "opening",
    approved_text: "Can we decide which priority moves before more work is added?",
  },
  pushback: {
    id: "pushback",
    approved_text: "The deadline is fixed. Everyone is stretched right now.",
  },
  response: {
    id: "response",
    approved_text: "No, I know, and I get that everyone’s busy… so I guess I just wanted to flag it.",
  },
} as const;

/** Creates the single approved transcript used by successful visual evidence. */
export function createSuccessfulVisualTranscript(): SharedTranscriptContractV1 {
  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: SUCCESSFUL_VISUAL_REHEARSAL_ID,
    turns: [
      { ...SUCCESSFUL_VISUAL_APPROVED_TURNS.opening, sequence: 0, speaker: "user", turn_kind: "opening", approved_at: "2026-08-10T12:00:00.000Z" },
      { ...SUCCESSFUL_VISUAL_APPROVED_TURNS.pushback, sequence: 1, speaker: "counterpart", turn_kind: "pushback", approved_at: "2026-08-10T12:00:01.000Z" },
      { ...SUCCESSFUL_VISUAL_APPROVED_TURNS.response, sequence: 2, speaker: "user", turn_kind: "pressure_response", approved_at: "2026-08-10T12:00:02.000Z" },
    ],
  };
}

/**
 * Test-only visual result with explicit approved-turn evidence.
 * Never import this module from app, components, lib, providers, or production routes.
 */
export function createSuccessfulVisualResult(
  transcript: SharedTranscriptContractV1,
  rehearsalId: string = transcript.rehearsal_id,
): SharedResultContractV1 {
  const opening = transcript.turns.find((turn) => turn.turn_kind === "opening");
  const pushback = transcript.turns.find((turn) => turn.turn_kind === "pushback");
  const response = transcript.turns.find((turn) => turn.turn_kind === "pressure_response");
  if (!opening || !pushback || !response) throw new Error("The visual fixture requires three approved turns.");
  const expected = SUCCESSFUL_VISUAL_APPROVED_TURNS;
  if (
    opening.id !== expected.opening.id || opening.approved_text !== expected.opening.approved_text ||
    pushback.id !== expected.pushback.id || pushback.approved_text !== expected.pushback.approved_text ||
    response.id !== expected.response.id || response.approved_text !== expected.response.approved_text
  ) {
    throw new Error("The successful visual result must use its one approved transcript fixture.");
  }

  const observed = (
    signal_key: SharedSignalV1["signal_key"],
    score: number,
    evidence_turn_ids: string[],
  ): SharedSignalV1 => ({
    signal_key,
    observation_status: "observed",
    score,
    evidence_turn_ids,
    signal_version: SIGNAL_VERSION,
  });
  const notObserved = (signal_key: SharedSignalV1["signal_key"]): SharedSignalV1 => ({
    signal_key,
    observation_status: "unobserved",
    score: null,
    evidence_turn_ids: [],
    signal_version: SIGNAL_VERSION,
  });
  const signals = validateSignals([
    observed("clarity", 72, [opening.id]),
    observed("specificity", 66, [opening.id, response.id]),
    observed("steadiness", 54, [response.id]),
    notObserved("listening"),
    notObserved("boundaries"),
    notObserved("repair"),
  ], transcript);
  const recommendedModuleId: ModuleId = "stay_clear_under_pushback";
  const firstFocusKey = "visual-fixture-specific-after-pushback";
  const firstFocusLabel = "Stay specific after pushback.";

  return {
    contract_version: SHARED_PRODUCT_CONTRACT_VERSION,
    rehearsal_id: rehearsalId,
    pressure_moment: validatePressureMoment({
      pressure_moment_version: PRESSURE_MOMENT_VERSION,
      headline: "You were clear until the pushback.",
      opening_turn_id: opening.id,
      pushback_turn_id: pushback.id,
      pressure_response_turn_id: response.id,
      observation: "You acknowledged the concern, then softened the request until the answerable decision disappeared.",
      why_it_matters: "Without a clear decision to answer, the conversation can move on without resolving your request.",
      confidence_statement: "This is one short exchange. It suggests a starting point, not a fixed trait.",
    }, transcript),
    practice_shift: validatePracticeShift({
      practice_shift_version: PRACTICE_SHIFT_VERSION,
      headline: "Stay specific after pushback.",
      current_pattern_steps: [
        "Clear request",
        "They push back",
        "You acknowledge, then add history",
        "The decision disappears",
      ],
      practice_target_steps: [
        "Clear request",
        "They push back",
        "Acknowledge the concern",
        "Return to one answerable decision",
      ],
      success_target: "Leave with one answerable decision and a clear next step.",
      first_focus_key: firstFocusKey,
      first_focus_label: firstFocusLabel,
      recommended_module_id: recommendedModuleId,
      caveat: PRACTICE_SHIFT_CAVEAT,
    }),
    signals,
    starting_index: {
      ...calculatePartialStartingIndex(signals),
      index_version: STARTING_INDEX_VERSION,
    },
    first_focus: {
      first_focus_key: firstFocusKey,
      first_focus_label: firstFocusLabel,
      recommended_module_id: recommendedModuleId,
      focus_status: "suggested",
      focus_version: FOCUS_VERSION,
    },
  };
}
