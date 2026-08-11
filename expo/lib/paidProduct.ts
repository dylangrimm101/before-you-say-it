import { CURRICULUM_MODULES, curriculumModule, type CurriculumModule, type ModuleId } from "@/constants/modules";
import { PROGRESS_SIGNAL_LABELS, PROGRESS_SIGNAL_ORDER, type ProgressEvidenceRow } from "@/lib/progressEvidence";
import type { ActivePracticeSession } from "@/lib/practiceSession";
import type { PilotDayRun, PilotModuleState } from "@/types/pilotCurriculum";
import type { SharedResultContractV1, SharedSignalKey } from "@/types/sharedProduct";

export type PaidActivity = "lesson" | "practice" | "rehearsal" | "review";

const ACTIVITY_STATES: Record<PaidActivity, readonly PilotModuleState[]> = {
  lesson: ["module_preview", "hope_lesson"],
  practice: ["quiz", "quiz_feedback"],
  rehearsal: ["preset_scenario", "ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "adam_response", "ready_for_response", "listening_response", "confirm_response_transcript", "hope_coaching", "day3_note_check", "day3_neutral_retry", "ready_for_retry", "listening_retry", "confirm_retry_transcript", "play_adam_after_opener_retry", "microphone_error", "no_speech", "transcription_error", "playback_error", "network_error", "model_error"],
  review: ["attempt_comparison", "transfer_cue", "complete"],
};

export const PAID_ACTIVITY_ORDER: readonly PaidActivity[] = ["lesson", "practice", "rehearsal", "review"];

/** Maps every persisted paid-run state onto its approved product surface. */
export function paidActivityForState(state: PilotModuleState): PaidActivity {
  return PAID_ACTIVITY_ORDER.find((activity) => ACTIVITY_STATES[activity].includes(state)) ?? "rehearsal";
}

export interface InterruptedPresentation {
  activity: PaidActivity;
  title: string;
  completed: readonly string[];
  stoppedAt: string;
  remains: readonly string[];
  continueLabel: `Continue ${PaidActivity}`;
}

const ACTIVITY_LABELS: Record<PaidActivity, string> = {
  lesson: "Lesson",
  practice: "Practice",
  rehearsal: "Rehearsal",
  review: "Review",
};

/** Explains a real persisted checkpoint without changing or replaying it. */
export function interruptedPresentation(run: PilotDayRun): InterruptedPresentation {
  const activity = paidActivityForState(run.state);
  const index = PAID_ACTIVITY_ORDER.indexOf(activity);
  const completed = PAID_ACTIVITY_ORDER.slice(0, index).map((item) => ACTIVITY_LABELS[item]);
  const remains = PAID_ACTIVITY_ORDER.slice(index + 1).map((item) => ACTIVITY_LABELS[item]);
  return {
    activity,
    title: curriculumModule(run.moduleId)?.name ?? `Practice ${run.day}`,
    completed,
    stoppedAt: checkpointLabel(run.state, run.lessonIndex),
    remains,
    continueLabel: `Continue ${activity}`,
  };
}

function checkpointLabel(state: PilotModuleState, lessonIndex: number): string {
  if (state === "module_preview") return "Before the lesson started";
  if (state === "hope_lesson") return `Lesson concept ${lessonIndex + 1}`;
  if (state === "quiz") return "Before choosing a practice answer";
  if (state === "quiz_feedback") return "After choosing a practice answer";
  if (state === "preset_scenario") return "At the rehearsal briefing";
  if (state.startsWith("listening")) return "During a spoken turn";
  if (state.startsWith("confirm")) return "At transcript review";
  if (state === "hope_coaching" || state === "day3_note_check" || state === "day3_neutral_retry") return "At feedback";
  if (state === "ready_for_retry" || state === "play_adam_after_opener_retry") return "Before the same-moment retry";
  if (state === "attempt_comparison") return "At first-attempt versus retry review";
  if (state === "transfer_cue") return "At the carry-forward step";
  if (state === "complete") return "After completion";
  if (state === "microphone_error" || state === "no_speech" || state === "transcription_error" || state === "playback_error" || state === "network_error" || state === "model_error") return "At a recoverable rehearsal step";
  return "In the rehearsal";
}

export type PathModuleStatus = "recommended" | "current" | "completed" | "available" | "locked" | "interrupted";

export interface PathModulePresentation {
  module: CurriculumModule;
  status: PathModuleStatus;
  destination: `/module/${ModuleId}`;
}

/** Builds the eight-module path only from curriculum, completion, focus, and persisted checkpoints. */
export function pathPresentation(
  session: ActivePracticeSession | null,
  completedModuleIds: ReadonlySet<ModuleId>,
  hasProAccess: boolean,
): readonly PathModulePresentation[] {
  const recommendedId = session?.sharedResult?.first_focus?.recommended_module_id;
  return CURRICULUM_MODULES.map((module) => {
    const run = session?.pilotRuns[module.id];
    let status: PathModuleStatus;
    if (completedModuleIds.has(module.id) || run?.state === "complete") status = "completed";
    else if (run && run.state !== "module_preview") status = "interrupted";
    else if (run) status = "current";
    else if (module.id === recommendedId) status = "recommended";
    else status = hasProAccess ? "available" : "locked";
    return { module, status, destination: `/module/${module.id}` };
  });
}

export const SIGNAL_BEHAVIOR: Record<SharedSignalKey, string> = {
  clarity: "Whether the main point or conversational job stays identifiable.",
  specificity: "Whether the words name observable details and an answerable next step.",
  listening: "Whether the response shows contact with what was actually said before moving on.",
  steadiness: "Whether the relevant point remains available when pressure or pushback arrives.",
  boundaries: "Whether a limit, pause, or no is stated clearly without unnecessary justification.",
  repair: "Whether the response names what happened and offers a usable next move after a rupture.",
};

export interface DimensionEvidencePresentation {
  key: SharedSignalKey;
  label: string;
  meaning: string;
  value: number | null;
  evidenceTurnIds: readonly string[];
  evidenceTexts: readonly string[];
  practiceCount: number;
  currentFocus: string | null;
}

/** Produces one signal detail from approved signal and transcript records only. */
export function dimensionEvidencePresentation(
  key: SharedSignalKey,
  result: SharedResultContractV1 | undefined,
  approvedTextByTurnId: ReadonlyMap<string, string> = new Map<string, string>(),
): DimensionEvidencePresentation {
  const signal = result?.signals.find((item) => item.signal_key === key);
  const isObserved = signal?.observation_status === "observed" && signal.score !== null && signal.evidence_turn_ids.length > 0;
  const evidenceTurnIds = isObserved ? signal.evidence_turn_ids : [];
  return {
    key,
    label: PROGRESS_SIGNAL_LABELS[key],
    meaning: SIGNAL_BEHAVIOR[key],
    value: isObserved ? signal.score : null,
    evidenceTurnIds,
    evidenceTexts: evidenceTurnIds.flatMap((id) => {
      const text = approvedTextByTurnId.get(id);
      return text ? [text] : [];
    }),
    practiceCount: isObserved ? 1 : 0,
    currentFocus: result?.first_focus?.first_focus_label ?? null,
  };
}

export function isSharedSignalKey(value: unknown): value is SharedSignalKey {
  return typeof value === "string" && (PROGRESS_SIGNAL_ORDER as readonly string[]).includes(value);
}

/** Returns the canonical row for a requested signal. */
export function progressRow(rows: readonly ProgressEvidenceRow[], key: SharedSignalKey): ProgressEvidenceRow | undefined {
  return rows.find((row) => row.key === key);
}
