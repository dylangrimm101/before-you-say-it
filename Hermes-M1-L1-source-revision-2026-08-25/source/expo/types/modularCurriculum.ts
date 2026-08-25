import type { ModuleId } from "@/constants/modules";
import type { PilotBehaviorId, PilotModule } from "@/types/pilotCurriculum";

export type CurriculumVisibilityMode = "production" | "internal_review";
export type ReviewPracticeRuntimeStatus = "runnable" | "gated" | "blocked";

export interface ReviewDiscriminationCheck {
  prompt: string;
  options: [string, string];
  stronger_option_index: 1;
  feedback: [string, string];
  scored: false;
}

export interface ReviewPresetScenario {
  scenario_key: string;
  heading?: string;
  briefing?: string;
  counterpart_turn: string;
  user_opening_objective?: string;
  user_response_objective: string;
  approved_pushback_bank?: string[];
}

export interface ReviewCoachingContract {
  priority_order: PilotBehaviorId[];
  may_evaluate: string[];
  may_not_infer: string[];
  exact_confirmed_quote_required: true;
  one_behavior_only: true;
  note_word_limit: 32;
  retry_instruction_word_limit: 20;
  combined_word_limit: 48;
}

export interface ReviewPracticeContent {
  practice_id: string;
  content_version: string;
  authoring_status: string;
  launch_eligible: false;
  source_lineage: string[];
  primary_behavior_id: PilotBehaviorId;
  title: string;
  preview: string;
  what_you_will_practice?: string[];
  lesson_cards: string[];
  discrimination_check: ReviewDiscriminationCheck;
  preset_scenario: ReviewPresetScenario;
  coaching_contract: ReviewCoachingContract;
  retry: {
    same_pressure_turn_required: true;
    direction: string;
    invitation: "Try that same moment again.";
    branches?: { opener: string; pushback_response: string };
  };
  comparison: { one_behavior_only: true; word_limit: 36 };
  transfer_cue: string;
  safety_contract?: string[];
  audio_contract?: {
    discrimination_option_b_has_brief_audible_pause?: boolean;
    rehearsal_pause_duration_scored?: false;
    manual_recording_latency_is_not_conversational_evidence?: true;
  };
}

export interface ReviewModuleContent {
  schema_version: string;
  curriculum_version: string;
  module_id: ModuleId;
  title: string;
  promise: string;
  completion_capability: string;
  calendar_locked: false;
  revisitable: true;
  practices: ReviewPracticeContent[];
  source_file: string;
}

export interface ReviewCurriculumPayload {
  schema_version: string;
  curriculum_version: string;
  public_launch_authorized: false;
  free_onboarding_rehearsal_is_baseline: true;
  paid_day_one_exists: false;
  calendar_locked: false;
  module_count: 8;
  runnable_practice_count: 43;
  gated_practice_count: 2;
  blocked_practice_count: 8;
  modules: ReviewModuleContent[];
}

export interface RegistryStatusFlags {
  approved: boolean;
  approved_behavior: boolean;
  review_ready: boolean;
  planned: boolean;
  safety_review_required: boolean;
  mechanically_blocked: boolean;
  copy_adaptation_required: boolean;
  contextual_adaptation_required: boolean;
}

export interface RegistryPractice {
  order: number;
  practice_id: string;
  working_title: string;
  primary_behavior_id: PilotBehaviorId;
  source_lineage: string;
  authoring_status: string;
  status_flags: RegistryStatusFlags;
  content_version: string;
  launch_eligible: boolean;
  customer_facing_day_label: null;
  duration_claim: null;
}

export interface RegistryModule {
  order: number;
  title: string;
  module_id: ModuleId;
  promise: string;
  completion_capability: string;
  practices: RegistryPractice[];
}

export interface CurriculumRegistryPayload {
  schema_version: string;
  curriculum_version: string;
  implementation_baseline: string;
  navigation_model: "eight_revisitable_modules";
  calendar_locked: false;
  streak_required: false;
  unmeasured_duration_claims_allowed: false;
  modules: RegistryModule[];
}

export interface EffectiveReviewPractice {
  moduleId: ModuleId;
  moduleOrder: number;
  order: number;
  practiceId: string;
  title: string;
  contentVersion: string;
  authoringStatus: string;
  runtimeStatus: ReviewPracticeRuntimeStatus;
  launchEligible: false;
  content: ReviewPracticeContent | null;
}

export interface ReviewPracticeRuntimeDefinition {
  identity: EffectiveReviewPractice;
  module: PilotModule;
}
