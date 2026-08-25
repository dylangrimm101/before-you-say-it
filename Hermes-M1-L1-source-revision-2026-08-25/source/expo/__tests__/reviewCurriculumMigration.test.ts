import { describe, expect, test } from "bun:test";

import { migrateLegacyPilotProgress } from "@/lib/curriculumMigration";
import { REVIEW_CURRICULUM_VERSION } from "@/lib/modularCurriculum";
import type { PilotProgressEntry } from "@/types/pilotCurriculum";

function legacy(day: number, moduleId?: PilotProgressEntry["moduleId"]): PilotProgressEntry {
  return { curriculumVersion: "BYSI-days-1-8-v3-2026-08-04", ...(moduleId ? { moduleId } : {}), day, behaviorId: "legacy_behavior", date: "2026-08-01", completedAt: day };
}

const EXPECTED = {
  2: ["get_to_the_point", "gtp_conversation_job"],
  3: ["stay_clear_under_pushback", "scp_notice_pressure_move"],
  4: ["pause_say_no_boundary", "psb_create_choice"],
  5: ["get_to_the_point", "gtp_event_not_story"],
  6: ["get_to_the_point", "gtp_point_that_survives"],
  7: ["make_a_clear_ask", "mca_answerable_action"],
  8: ["start_the_conversation", "stc_mild_pushback"],
} as const;

describe("legacy day-to-practice evidence migration", () => {
  test("keeps a clean state clean", () => expect(migrateLegacyPilotProgress([])).toEqual([]));

  test("maps every approved historical day to one stable practice", () => {
    for (const [dayText, [moduleId, practiceId]] of Object.entries(EXPECTED)) {
      const migrated = migrateLegacyPilotProgress([legacy(Number(dayText))])[0];
      expect(migrated?.curriculumVersion).toBe(REVIEW_CURRICULUM_VERSION);
      expect(migrated?.moduleId).toBe(moduleId);
      expect(migrated?.practiceId).toBe(practiceId);
      expect(migrated?.legacyClassification).toBe(Number(dayText) === 4 ? "prerequisite_practice_evidence" : "practice_completion");
    }
  });

  test("adds pushback transfer evidence to Day 8 without completing Modules 5, 7, or 8", () => {
    const migrated = migrateLegacyPilotProgress([legacy(8)])[0];
    expect(migrated?.moduleId).toBe("start_the_conversation");
    expect(migrated?.evidenceTags).toEqual(["pushback_transfer"]);
    expect(["stay_clear_under_pushback", "repair_what_went_wrong", "use_it_in_real_life"]).not.toContain(migrated?.moduleId);
  });

  test("preserves Day 1 and unknown records without reinterpretation", () => {
    const records = [legacy(1), legacy(99)];
    const migrated = migrateLegacyPilotProgress(records);
    expect(migrated[0]).toBe(records[0]);
    expect(migrated[1]).toBe(records[1]);
  });

  test("preserves explicit legacy Module 7 and 8 records as ambiguous history", () => {
    const migrated = migrateLegacyPilotProgress([legacy(8, "repair_what_went_wrong"), legacy(8, "use_it_in_real_life")]);
    expect(migrated[0]?.moduleId).toBe("repair_what_went_wrong");
    expect(migrated[1]?.moduleId).toBe("use_it_in_real_life");
    expect(migrated.every((entry) => !entry.practiceId && entry.legacyClassification === "ambiguous_module_history")).toBe(true);
  });

  test("is idempotent for mixed and duplicate hydration", () => {
    const once = migrateLegacyPilotProgress([legacy(2), legacy(4), legacy(8, "repair_what_went_wrong"), legacy(91)]);
    const twice = migrateLegacyPilotProgress(once);
    expect(twice).toEqual(once);
    expect(JSON.stringify(twice)).toBe(JSON.stringify(once));
  });

  test("does not receive or mutate scored history", () => {
    const scoredHistory = [{ version: 1, rehearsalId: "score-1", score: 64 }];
    const before = JSON.stringify(scoredHistory);
    migrateLegacyPilotProgress([legacy(7)]);
    expect(JSON.stringify(scoredHistory)).toBe(before);
  });
});
