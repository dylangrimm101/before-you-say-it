import curriculumRaw from "@/constants/modularCurriculum.review.json";
import registryRaw from "@/constants/curriculumRegistry.review.json";
import { CURRICULUM_MODULES, type ModuleId } from "@/constants/modules";
import type {
  CurriculumRegistryPayload,
  CurriculumVisibilityMode,
  EffectiveReviewPractice,
  RegistryPractice,
  ReviewCurriculumPayload,
  ReviewPracticeContent,
  ReviewPracticeRuntimeDefinition,
  ReviewPracticeRuntimeStatus,
} from "@/types/modularCurriculum";
import type { PilotAudioLine, PilotModule } from "@/types/pilotCurriculum";

export const REVIEW_CURRICULUM_VERSION = "2026-08-11.1-review" as const;
export const REVIEW_IMPLEMENTATION_BASELINE = "3bed2b05dab5bbdd5ecb37a8643ffeeacf6deba1" as const;
export const REVIEW_CURRICULUM = curriculumRaw as unknown as ReviewCurriculumPayload;
export const REVIEW_CURRICULUM_REGISTRY = registryRaw as unknown as CurriculumRegistryPayload;
export const DEFAULT_CURRICULUM_VISIBILITY: CurriculumVisibilityMode = typeof __DEV__ !== "undefined" && __DEV__ ? "internal_review" : "production";

const GATED_PRACTICE_IDS = new Set<string>(["rww_follow_through", "uir_real_or_equivalent_attempt"]);
const LEGACY_DAY_BY_PRACTICE_ID: Readonly<Record<string, number>> = {
  gtp_conversation_job: 2,
  scp_notice_pressure_move: 3,
  psb_create_choice: 4,
  gtp_event_not_story: 5,
  gtp_point_that_survives: 6,
  mca_answerable_action: 7,
  stc_mild_pushback: 8,
};

const CONTENT_BY_ID = new Map<string, ReviewPracticeContent>(
  REVIEW_CURRICULUM.modules.flatMap((module) => module.practices.map((practice) => [practice.practice_id, practice] as const)),
);

function statusFor(registryPractice: RegistryPractice): ReviewPracticeRuntimeStatus {
  if (registryPractice.status_flags.mechanically_blocked) return "blocked";
  if (GATED_PRACTICE_IDS.has(registryPractice.practice_id)) return "gated";
  return CONTENT_BY_ID.has(registryPractice.practice_id) ? "runnable" : "blocked";
}

export const REVIEW_PRACTICES: readonly EffectiveReviewPractice[] = REVIEW_CURRICULUM_REGISTRY.modules.flatMap((module) =>
  module.practices.map((registryPractice): EffectiveReviewPractice => {
    const content = CONTENT_BY_ID.get(registryPractice.practice_id) ?? null;
    return {
      moduleId: module.module_id,
      moduleOrder: module.order,
      order: registryPractice.order,
      practiceId: registryPractice.practice_id,
      title: content?.title ?? registryPractice.working_title,
      contentVersion: content?.content_version ?? registryPractice.content_version,
      authoringStatus: content?.authoring_status ?? registryPractice.authoring_status,
      runtimeStatus: statusFor(registryPractice),
      launchEligible: false,
      content,
    };
  }),
);

const PRACTICE_BY_ID = new Map<string, EffectiveReviewPractice>(REVIEW_PRACTICES.map((practice) => [practice.practiceId, practice]));

/** Returns one stable curriculum identity, including non-runnable inventory records. */
export function reviewPractice(practiceId: string | null | undefined): EffectiveReviewPractice | undefined {
  return practiceId ? PRACTICE_BY_ID.get(practiceId) : undefined;
}

/** Returns records in package order without exposing review drafts in production mode. */
export function visiblePracticesForModule(moduleId: ModuleId, mode: CurriculumVisibilityMode = DEFAULT_CURRICULUM_VISIBILITY): readonly EffectiveReviewPractice[] {
  const records = REVIEW_PRACTICES.filter((practice) => practice.moduleId === moduleId);
  if (mode === "internal_review") return records;
  return records.filter((practice) => practice.launchEligible && practice.runtimeStatus === "runnable");
}

/** Only runnable records can enter the canonical paid-practice engine. */
export function runnableReviewPractices(moduleId?: ModuleId): readonly EffectiveReviewPractice[] {
  return REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "runnable" && (!moduleId || practice.moduleId === moduleId));
}

export function isRunnableReviewPractice(practiceId: string, mode: CurriculumVisibilityMode = DEFAULT_CURRICULUM_VISIBILITY): boolean {
  const practice = reviewPractice(practiceId);
  if (!practice || practice.runtimeStatus !== "runnable") return false;
  return mode === "internal_review" || practice.launchEligible;
}

/** Selects the next incomplete runnable practice while keeping every practice revisitable. */
export function nextReviewPractice(moduleId: ModuleId, completedPracticeIds: ReadonlySet<string>): EffectiveReviewPractice | undefined {
  const practices = runnableReviewPractices(moduleId);
  return practices.find((practice) => !completedPracticeIds.has(practice.practiceId)) ?? practices[0];
}

/** Internal-review completion excludes gated and mechanically blocked records. */
export function isInternalReviewModuleComplete(moduleId: ModuleId, completedPracticeIds: ReadonlySet<string>): boolean {
  const required = runnableReviewPractices(moduleId);
  return required.length > 0 && required.every((practice) => completedPracticeIds.has(practice.practiceId));
}

/** Converts package content into the existing paid-practice configuration contract. */
export function reviewPracticeRuntime(practiceId: string, mode: CurriculumVisibilityMode = DEFAULT_CURRICULUM_VISIBILITY): ReviewPracticeRuntimeDefinition | null {
  const identity = reviewPractice(practiceId);
  if (!identity?.content || !isRunnableReviewPractice(practiceId, mode)) return null;
  const content = identity.content;
  const moduleDefinition = CURRICULUM_MODULES.find((module) => module.id === identity.moduleId);
  if (!moduleDefinition) return null;
  const legacyDay = LEGACY_DAY_BY_PRACTICE_ID[practiceId];
  const syntheticDay = 100 + REVIEW_PRACTICES.findIndex((practice) => practice.practiceId === practiceId);
  const lessonLines: PilotAudioLine[] = content.lesson_cards.map((text, index) => ({
    audio_id: `review-${practiceId}-lesson-${index + 1}`,
    voice_key: "hope_teacher",
    text,
  }));
  const optionA: PilotAudioLine = { audio_id: `review-${practiceId}-option-a`, voice_key: "hope_teacher", text: content.discrimination_check.options[0] };
  const optionB: PilotAudioLine = {
    audio_id: `review-${practiceId}-option-b`,
    voice_key: "hope_teacher",
    text: content.discrimination_check.options[1],
    ...(content.audio_contract?.discrimination_option_b_has_brief_audible_pause ? { leading_pause_ms: 650 } : {}),
  };
  const counterpartBank = content.preset_scenario.approved_pushback_bank ?? [content.preset_scenario.counterpart_turn];
  const counterpartLines: PilotAudioLine[] = counterpartBank.map((text, index) => ({
    audio_id: `review-${practiceId}-counterpart-${index + 1}`,
    voice_key: "contextual_counterpart",
    text,
  }));
  const counterpartFirst = !content.preset_scenario.user_opening_objective;
  const pilotModule: PilotModule = {
    day: legacyDay ?? syntheticDay,
    legacy_day: legacyDay,
    practice_id: practiceId,
    content_version: content.content_version,
    module_id: identity.moduleId,
    review_only: true,
    counterpart_first: counterpartFirst,
    phase_id: identity.moduleId,
    title: content.title,
    primary_behavior_id: content.primary_behavior_id,
    preserve_uncoached_attempt: false,
    copy: {
      eyebrow: "Internal review",
      heading: content.title,
      body: content.preview,
      primary_button: "Start review practice",
      secondary_button: "Use my conversation",
      practice_points: content.what_you_will_practice ?? [],
      lessons: lessonLines,
      quiz: {
        prompt: content.discrimination_check.prompt,
        option_a: optionA,
        option_b: optionB,
        stronger_option: "B",
        feedback_a: content.discrimination_check.feedback[0],
        feedback_b: content.discrimination_check.feedback[1],
      },
      scenario: {
        heading: content.preset_scenario.heading ?? "Rehearsal",
        title: content.title,
        scenario: content.preset_scenario.briefing ?? content.preview,
        user_job: content.preset_scenario.user_opening_objective ?? content.preset_scenario.user_response_objective,
        attempt_prompt: content.preset_scenario.user_opening_objective,
        response_prompt: content.preset_scenario.user_response_objective,
      },
      transfer: content.transfer_cue,
      finish_button: "Complete review practice",
    },
    practice: {
      reaction_level: 2,
      adam_line: counterpartLines[0],
      ...(counterpartLines.length > 1 ? { approved_pushback_bank: counterpartLines } : {}),
    },
    evaluation: {
      priority_order: content.coaching_contract.priority_order,
      success_criteria: content.coaching_contract.may_evaluate,
      prohibited_inferences: content.coaching_contract.may_not_infer,
    },
    retry: { direction: content.retry.direction },
  };
  return { identity, module: pilotModule };
}

/** Structural validation for the effective review configuration. */
export function modularCurriculumProblems(): string[] {
  const problems: string[] = [];
  const ids = REVIEW_PRACTICES.map((practice) => practice.practiceId);
  const statuses = REVIEW_PRACTICES.reduce<Record<ReviewPracticeRuntimeStatus, number>>((counts, practice) => {
    counts[practice.runtimeStatus] += 1;
    return counts;
  }, { runnable: 0, gated: 0, blocked: 0 });
  if (REVIEW_CURRICULUM.curriculum_version !== REVIEW_CURRICULUM_VERSION) problems.push("wrong curriculum version");
  if (REVIEW_CURRICULUM_REGISTRY.implementation_baseline !== REVIEW_IMPLEMENTATION_BASELINE) problems.push("wrong implementation baseline");
  if (REVIEW_CURRICULUM.modules.length !== 8 || REVIEW_CURRICULUM_REGISTRY.modules.length !== 8) problems.push("expected eight modules");
  if (ids.length !== 53 || new Set(ids).size !== 53) problems.push("expected 53 unique practice IDs");
  if (statuses.runnable !== 43 || statuses.gated !== 2 || statuses.blocked !== 8) problems.push("wrong status counts");
  if (REVIEW_PRACTICES.some((practice) => practice.launchEligible)) problems.push("review practice is launch eligible");
  if (REVIEW_CURRICULUM.calendar_locked || REVIEW_CURRICULUM.paid_day_one_exists) problems.push("calendar or paid Day 1 contract present");
  runnableReviewPractices().forEach((practice) => {
    const content = practice.content;
    if (!content?.lesson_cards.length || !content.discrimination_check || !content.preset_scenario || !content.coaching_contract || !content.retry || !content.comparison || !content.transfer_cue) {
      problems.push(`${practice.practiceId} is missing a runnable contract`);
    }
  });
  if (containsUnsupportedDuration(REVIEW_CURRICULUM.modules)) problems.push("unsupported duration field present");
  return problems;
}

function containsUnsupportedDuration(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsUnsupportedDuration);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => /^(?:duration|duration_minutes|minutes|estimated_minutes|product_duration)$/i.test(key) || containsUnsupportedDuration(child));
}
