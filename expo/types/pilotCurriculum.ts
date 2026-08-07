export type PilotBehaviorId =
  | "baseline_integrity"
  | "conversation_job"
  | "timing_scope_channel"
  | "pressure_pattern"
  | "choice_point"
  | "observation_not_story"
  | "one_point"
  | "answerable_request"
  | "integrated_opener"
  | "pushback_response";

export interface PilotAudioLine {
  audio_id: string;
  voice_key: "hope_teacher" | "adam_counterpart";
  text: string;
  leading_pause_ms?: number;
}

export interface PilotQuiz {
  prompt: string;
  option_a: PilotAudioLine;
  option_b: PilotAudioLine;
  stronger_option: "B";
  feedback_a: string;
  feedback_b: string;
}

export interface PilotScenarioCopy {
  heading: string;
  title?: string;
  scenario: string;
  user_job: string;
  attempt_prompt?: string;
  response_prompt: string;
}

export interface PilotPractice {
  reaction_level: 1 | 2;
  adam_line?: PilotAudioLine;
  approved_pushback_bank?: PilotAudioLine[];
}

export interface PilotEvaluation {
  priority_order: PilotBehaviorId[];
  success_criteria: string[];
  prohibited_inferences: string[];
}

export interface PilotRetry {
  direction: string;
  opener_direction?: string;
  response_direction?: string;
}

export interface PilotCopy {
  eyebrow: string;
  heading: string;
  body: string;
  primary_button: string;
  secondary_button: "Use a different conversation" | "Use my conversation";
  practice_points: string[];
  lessons: PilotAudioLine[];
  quiz?: PilotQuiz;
  scenario?: PilotScenarioCopy;
  transfer: string;
  finish_button: string;
}

export interface PilotModule {
  day: number;
  phase_id: string;
  title: string;
  primary_behavior_id: PilotBehaviorId;
  duration_minutes: [number, number];
  preserve_uncoached_attempt: boolean;
  copy: PilotCopy;
  practice: PilotPractice;
  evaluation: PilotEvaluation;
  retry: PilotRetry;
}

export interface PilotProgram {
  schema_version: string;
  curriculum_version: string;
  audio_cache_version: string;
  program_name: string;
  track: string;
  modules: PilotModule[];
}

/** Persisted completion metadata. It deliberately contains no learner content. */
export interface PilotProgressEntry {
  curriculumVersion: string;
  /** Modular destination. Legacy day-only records are migrated additively. */
  moduleId?: import("@/constants/modules").ModuleId;
  day: number;
  behaviorId: PilotBehaviorId;
  date: string;
  completedAt: number;
}

export type PilotModuleState =
  | "module_preview"
  | "hope_lesson"
  | "quiz"
  | "quiz_feedback"
  | "preset_scenario"
  | "ready_for_attempt"
  | "listening_attempt"
  | "confirm_attempt_transcript"
  | "adam_response"
  | "ready_for_response"
  | "listening_response"
  | "confirm_response_transcript"
  | "hope_coaching"
  | "day3_note_check"
  | "day3_neutral_retry"
  | "ready_for_retry"
  | "listening_retry"
  | "confirm_retry_transcript"
  | "play_adam_after_opener_retry"
  | "attempt_comparison"
  | "transfer_cue"
  | "complete"
  | "microphone_error"
  | "transcription_error"
  | "model_error";

export type PilotAttemptKind = "opener" | "response" | "retry";

export interface PilotAttemptRecord {
  id: string;
  kind: PilotAttemptKind;
  transcript: string;
  representation: "confirmed_transcript";
  confirmedAt: number;
}

export interface PilotDayRun {
  id: string;
  moduleId?: import("@/constants/modules").ModuleId;
  day: number;
  curriculumVersion: string;
  state: PilotModuleState;
  scenarioMode: "preset" | "carried_context";
  lessonIndex: number;
  quizChoice?: "A" | "B";
  attempt?: PilotAttemptRecord;
  responseAttempt?: PilotAttemptRecord;
  retryAttempt?: PilotAttemptRecord;
  adamReactionId?: string;
  adamAudioId?: string;
  coachedBehaviorId?: PilotBehaviorId;
  coachNote?: string;
  retryInstruction?: string;
  noteFit?: "accepted" | "rejected";
  comparison?: PilotComparison;
  completedAt?: number;
  createdAt: number;
  updatedAt: number;
}

export interface PilotCounterpartResponse {
  route: "roleplay" | "safety_interrupt";
  spokenText: string | null;
  reactionLevel: number | null;
  reactionId: string;
  audioId: string | null;
  shouldEnd: boolean;
}

export interface PilotCoachResponse {
  route: "coach" | "safety" | "refusal" | "clarify";
  day: number;
  evidenceQuote: string | null;
  behaviorId: PilotBehaviorId | null;
  note: string;
  retryInstruction: string | null;
  retryPrompt: "Try that same moment again." | null;
}

export interface PilotComparison {
  behaviorId: PilotBehaviorId;
  text: string;
  criterionChanged: boolean;
}
