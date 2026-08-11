import type { ModuleId } from "@/constants/modules";
import { REVIEW_CURRICULUM_VERSION, reviewPractice } from "@/lib/modularCurriculum";
import type { PilotProgressEntry } from "@/types/pilotCurriculum";

interface LegacyDestination {
  moduleId: ModuleId;
  practiceId: string;
  classification: "practice_completion" | "prerequisite_practice_evidence";
  evidenceTags?: string[];
}

const LEGACY_DESTINATIONS: Readonly<Record<number, LegacyDestination>> = {
  2: { moduleId: "get_to_the_point", practiceId: "gtp_conversation_job", classification: "practice_completion" },
  3: { moduleId: "stay_clear_under_pushback", practiceId: "scp_notice_pressure_move", classification: "practice_completion" },
  4: { moduleId: "pause_say_no_boundary", practiceId: "psb_create_choice", classification: "prerequisite_practice_evidence" },
  5: { moduleId: "get_to_the_point", practiceId: "gtp_event_not_story", classification: "practice_completion" },
  6: { moduleId: "get_to_the_point", practiceId: "gtp_point_that_survives", classification: "practice_completion" },
  7: { moduleId: "make_a_clear_ask", practiceId: "mca_answerable_action", classification: "practice_completion" },
  8: { moduleId: "start_the_conversation", practiceId: "stc_mild_pushback", classification: "practice_completion", evidenceTags: ["pushback_transfer"] },
};

/**
 * Adds stable practice evidence to historical day records without deleting,
 * reordering, scoring, or coercing ambiguous Module 7/8 history.
 */
export function migrateLegacyPilotProgress(entries: readonly PilotProgressEntry[]): PilotProgressEntry[] {
  return entries.map((entry): PilotProgressEntry => {
    if (entry.practiceId || entry.day === 1) return entry;
    if (entry.day === 8 && (entry.moduleId === "repair_what_went_wrong" || entry.moduleId === "use_it_in_real_life")) {
      return entry.legacyClassification === "ambiguous_module_history"
        ? entry
        : { ...entry, legacyClassification: "ambiguous_module_history" };
    }
    const destination = LEGACY_DESTINATIONS[entry.day];
    if (!destination) return entry;
    const practice = reviewPractice(destination.practiceId);
    return {
      ...entry,
      curriculumVersion: REVIEW_CURRICULUM_VERSION,
      moduleId: destination.moduleId,
      practiceId: destination.practiceId,
      contentVersion: practice?.contentVersion,
      legacyClassification: destination.classification,
      ...(destination.evidenceTags ? { evidenceTags: destination.evidenceTags } : {}),
    };
  });
}

export function completedReviewPracticeIds(entries: readonly PilotProgressEntry[]): ReadonlySet<string> {
  return new Set(entries.flatMap((entry) => entry.practiceId ? [entry.practiceId] : []));
}
