import { describe, expect, test } from "bun:test";

import { CURRICULUM_MODULES } from "@/constants/modules";
import {
  REVIEW_CURRICULUM_VERSION,
  REVIEW_PRACTICES,
  isRunnableReviewPractice,
  modularCurriculumProblems,
  runnableReviewPractices,
  visiblePracticesForModule,
} from "@/lib/modularCurriculum";

const EXPECTED_MODULE_IDS = [
  "get_to_the_point",
  "make_a_clear_ask",
  "start_the_conversation",
  "listen_and_respond",
  "stay_clear_under_pushback",
  "pause_say_no_boundary",
  "repair_what_went_wrong",
  "use_it_in_real_life",
] as const;

describe("internal-review modular curriculum schema", () => {
  test("loads the reconciled package with exact count and status parity", () => {
    expect(modularCurriculumProblems()).toEqual([]);
    expect(REVIEW_CURRICULUM_VERSION).toBe("2026-08-11.1-review");
    expect(CURRICULUM_MODULES.map((module) => module.id)).toEqual(EXPECTED_MODULE_IDS);
    expect(REVIEW_PRACTICES).toHaveLength(53);
    expect(new Set(REVIEW_PRACTICES.map((practice) => practice.practiceId)).size).toBe(53);
    expect(REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "runnable")).toHaveLength(43);
    expect(REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "gated")).toHaveLength(2);
    expect(REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "blocked")).toHaveLength(8);
  });

  test("keeps every effective review record non-launch-eligible", () => {
    expect(REVIEW_PRACTICES.every((practice) => practice.launchEligible === false)).toBe(true);
  });

  test("production fails closed while explicit internal review exposes package order", () => {
    for (const moduleId of EXPECTED_MODULE_IDS) {
      expect(visiblePracticesForModule(moduleId, "production")).toEqual([]);
      expect(visiblePracticesForModule(moduleId, "internal_review").map((practice) => practice.order)).toEqual(
        [...visiblePracticesForModule(moduleId, "internal_review")].map((practice) => practice.order).sort((a, b) => a - b),
      );
    }
    expect(runnableReviewPractices()).toHaveLength(43);
  });

  test("gated and blocked records cannot enter either paid runtime mode", () => {
    for (const practice of REVIEW_PRACTICES.filter((item) => item.runtimeStatus !== "runnable")) {
      expect(isRunnableReviewPractice(practice.practiceId, "internal_review")).toBe(false);
      expect(isRunnableReviewPractice(practice.practiceId, "production")).toBe(false);
    }
  });
});
