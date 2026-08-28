import type { CategoryId, Difficulty, ReactionPattern } from "@/types/convo";

export type KnownPilotBehaviorId =
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

/** Stable curriculum behavior identity; review records extend the original V3 set. */
export type PilotBehaviorId = KnownPilotBehaviorId | (string & {});

export interface PilotAudioLine {
  audio_id: string;
  voice_key: "hope_teacher" | "adam_counterpart" | "contextual_counterpart";
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
  /** Compatibility field for the original day-addressed engine; never a calendar gate. */
  day: number;
  legacy_day?: number;
  practice_id?: string;
  content_version?: string;
  module_id?: import("@/constants/modules").ModuleId;
  review_only?: boolean;
  counterpart_first?: boolean;
  phase_id: string;
  title: string;
  primary_behavior_id: PilotBehaviorId;
  duration_minutes?: [number, number];
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
  /** Stable practice identity; absent only on preserved legacy or ambiguous history. */
  practiceId?: string;
  contentVersion?: string;
  evidenceTags?: string[];
  legacyClassification?: "practice_completion" | "prerequisite_practice_evidence" | "ambiguous_module_history";
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
  | "ready_for_second_pressure"
  | "ready_for_second_response"
  | "listening_second_response"
  | "confirm_second_response_transcript"
  | "hope_coaching"
  | "day3_note_check"
  | "day3_neutral_retry"
  | "ready_for_retry"
  | "listening_retry"
  | "confirm_retry_transcript"
  | "final_retry_available"
  | "replay_pending"
  | "ready_for_final_retry_capture"
  | "listening_final_retry"
  | "confirm_final_retry_transcript"
  | "play_adam_after_opener_retry"
  | "attempt_comparison"
  | "transfer_cue"
  | "complete"
  | "microphone_error"
  | "no_speech"
  | "transcription_error"
  | "playback_error"
  | "network_error"
  | "model_error";

export type PilotAttemptKind = "opener" | "response" | "retry";

export interface PilotAttemptRecord {
  id: string;
  kind: PilotAttemptKind;
  transcript: string;
  representation: "confirmed_transcript";
  confirmedAt: number;
}

/** Immutable scenario identity carried by the canonical paid-practice run. */
export interface ScenarioPracticeContext {
  scenarioId: string;
  category: CategoryId;
  title: string;
  situation: string;
  objective: string;
  difficulty: Difficulty;
  reaction: ReactionPattern;
  counterpartId: string;
  counterpartName: string;
  counterpartLabel: string;
  counterpartRole: string;
  /** Voice resolved when the run is created so resume cannot change counterpart identity. */
  contextualPersona: import("@/types/convo").PersonaVoice;
}

/** One authored or provider-generated pressure turn reused for the retry. */
export interface ScenarioCounterpartTurn {
  id: string;
  text: string;
  source: "provider" | "authored";
  reactionId?: string;
  semanticVoiceKey?: "hope_teacher" | "adam_counterpart" | "contextual_counterpart";
  resolvedAudioId?: string;
  /** Durable authored-order timestamp, assigned only when the turn is attached. */
  authoredAt?: number;
}

export type M1L1DimensionId =
  | "point_placement"
  | "issue_count"
  | "grounding_concreteness"
  | "motive_character_language"
  | "move_clarity"
  | "evidence_discipline"
  | "park_and_return";

export interface M1L1BehaviorFlag {
  dimension: M1L1DimensionId;
  status: "met" | "not_met" | "not_assessable";
  evidenceQuote: string | null;
}

/** Durable one-behavior observation used by shared approved rehearsals. */
export interface PilotCoachingObservation {
  coachedBeat: 3;
  selectedDimension: string;
  status: "met" | "not_met";
  evidenceQuote: string;
}

/** Isolated M1 L1 state; no other lesson or shared scenario consumes it. */
export interface M1L1RehearsalState {
  beat: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  pushbackOne?: ScenarioCounterpartTurn;
  pushbackTwo?: ScenarioCounterpartTurn;
  secondResponseAttempt?: PilotAttemptRecord;
  coachedBeat?: 1 | 3 | 5;
  flags?: M1L1BehaviorFlag[];
  selectedDimension?: M1L1DimensionId;
  /** Durable proof that the approved named move was auto-saved on validated return. */
  approvedMoveSavedAt?: number;
  retryCount: 0 | 1 | 2;
  replayTarget?: "top_of_scene" | "pushback_one" | "evidence_trap";
  replayIsFinal?: boolean;
  replayRequestedAt?: number;
  replayAudioId?: string;
  replayProof?: "playback_completed" | "text_fallback_acknowledged" | "top_of_scene_reset";
  replayCompletedAt?: number;
  finalRetryPressureReplayedAt?: number;
  finalRetryPressureAudioId?: string;
  finalRetryAttempt?: PilotAttemptRecord;
}

export interface PilotDayRun {
  id: string;
  moduleId?: import("@/constants/modules").ModuleId;
  /** Stable lesson-manifest module identity for isolated converted lessons. */
  convertedModuleId?: string;
  practiceId?: string;
  contentVersion?: string;
  day: number;
  curriculumVersion: string;
  state: PilotModuleState;
  scenarioMode: "preset" | "carried_context";
  /** Present only when a scenario enters this canonical paid-practice run. */
  scenarioContext?: ScenarioPracticeContext;
  /** Voice fixed when a modular run is created; contextual playback never re-resolves it. */
  contextualPersona?: import("@/types/convo").PersonaVoice;
  counterpartTurn?: ScenarioCounterpartTurn;
  counterpartIdentity?: string;
  counterpartReactionId?: string;
  resolvedAudioId?: string;
  lessonIndex: number;
  quizChoice?: "A" | "B";
  attempt?: PilotAttemptRecord;
  responseAttempt?: PilotAttemptRecord;
  retryAttempt?: PilotAttemptRecord;
  adamReactionId?: string;
  adamAudioId?: string;
  coachedBehaviorId?: PilotBehaviorId;
  coachedSegment?: "opener" | "pushback_response";
  coachingObservation?: PilotCoachingObservation;
  retryResetId?: string;
  coachNote?: string;
  retryInstruction?: string;
  noteFit?: "accepted" | "rejected";
  comparison?: PilotComparison;
  /** Present only for accepted M1 L1; keeps the seven-step plan isolated. */
  m1L1?: M1L1RehearsalState;
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
