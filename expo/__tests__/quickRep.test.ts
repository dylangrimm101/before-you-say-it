import { describe, expect, test } from "bun:test";

import type { ConvertedLessonProgress } from "@/lib/convertedLesson";
import {
  QUICK_REP_CONFIGS,
  latestCompletedQuickRep,
  quickRepCompletedToday,
  quickRepLogId,
} from "@/lib/quickRep";
import type { DrillResult } from "@/types/convo";

function completion(lessonId: ConvertedLessonProgress["lessonId"], completedAt: number): ConvertedLessonProgress {
  return {
    lessonId,
    moduleId: lessonId.startsWith("m1") ? "bysi_m01_get_to_the_point" : "bysi_m02_make_a_clear_ask",
    practiceId: `practice-${lessonId}`,
    contentVersion: `version-${lessonId}`,
    runId: `run-${lessonId}`,
    lessonCardCheckpoint: 22,
    quizGatesCompleted: true,
    rehearsalCompleted: true,
    retryCompleted: true,
    comparisonViewed: true,
    savedMoveId: `move-${lessonId}`,
    transferChoice: "say",
    completedAt,
    sourceLineage: "approved-html-deck-pinned",
  };
}

describe("lesson-matched Quick Rep", () => {
  test("provides one complete transfer prompt for every interactive lesson", () => {
    expect(QUICK_REP_CONFIGS).toHaveLength(10);
    expect(QUICK_REP_CONFIGS.map((item) => item.lessonId)).toEqual([
      "m1-l1", "m1-l2", "m1-l3", "m1-l4", "m1-l5",
      "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5",
    ]);
    for (const config of QUICK_REP_CONFIGS) {
      expect(config.lessonTitle.trim().length, config.lessonId).toBeGreaterThan(0);
      expect(config.namedMove.trim().length, config.lessonId).toBeGreaterThan(0);
      expect(config.situation.trim().length, config.lessonId).toBeGreaterThan(60);
      expect(config.instruction.trim().length, config.lessonId).toBeGreaterThan(20);
      expect(config.feedbackFocus.trim().length, config.lessonId).toBeGreaterThan(20);
    }
  });

  test("selects the most recently completed lesson rather than the next lesson", () => {
    expect(latestCompletedQuickRep([])).toBeNull();
    expect(latestCompletedQuickRep([
      completion("m1-l1", 100),
      completion("m1-l2", 300),
      completion("m1-l3", 200),
    ])?.lessonId).toBe("m1-l2");
  });

  test("recognizes only today's completion for the same lesson", () => {
    const now = new Date(2026, 8, 3, 20, 30);
    const log: DrillResult[] = [
      { drillId: quickRepLogId("m1-l1"), date: "2026-09-03", score: 72, completedAt: now.getTime() },
    ];
    expect(quickRepCompletedToday(log, "m1-l1", now)).toBe(true);
    expect(quickRepCompletedToday(log, "m1-l2", now)).toBe(false);
    expect(quickRepCompletedToday([{ ...log[0]!, date: "2026-09-02" }], "m1-l1", now)).toBe(false);
  });

  test("keeps Quick Rep optional on Today and preserves the four-card floating stack", async () => {
    const today = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(today).toContain("<QuickRepHomeCard");
    expect(today).toContain('pathname: "/quick-rep/[lessonId]"');
    expect(today).toContain("latestCompletedQuickRep(convertedLessonProgress)");
    expect(today).toContain("quickRepCompletedToday(drillLog");
    expect(today).toContain("TODAY_ACTIVITY_KEYS.map");
    expect(today).not.toContain('TODAY_ACTIVITY_KEYS = ["quick-rep"');
  });

  test("uses voice-first capture, one cue, and the same prompt retry without showing a global score", async () => {
    const route = await Bun.file(`${import.meta.dir}/../app/quick-rep/[lessonId].tsx`).text();
    expect(route).toContain("useDictation()");
    expect(route).toContain("convertedLessonProgress.some");
    expect(route).toContain('access.entitlement !== "pro"');
    expect(route).toContain("drillRoundFeedback(");
    expect(route).toContain("One cue");
    expect(route).toContain("Try the same moment again");
    expect(route).toContain("Check my rep");
    expect(route).toContain("Complete quick rep");
    expect(route).toContain("Audio is transcribed, then discarded");
    expect(route).toContain("sent for Quick Rep feedback");
    expect(route).toContain("You gave the move another try.");
    expect(route).not.toContain("You used the move again.");
    expect(route.match(/accessibilityLiveRegion=/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
    expect(route).toContain("AccessibilityInfo.announceForAccessibility");
    expect(route).toContain("Your words are sent for Quick Rep feedback.");
    expect(route).toContain("Transcribing Quick Rep");
    expect(route).toContain("Transcribing your words…");
    expect(route).toContain("if (dictation.error) AccessibilityInfo.announceForAccessibility(dictation.error)");
    expect(route).toContain("const submittingRef = useRef<boolean>(false)");
    expect(route).toContain("submittingRef.current ||");
    expect(route).toContain("feedbackRequestRef.current += 1");
    expect(route).toContain("requestId !== feedbackRequestRef.current");
    expect(route).toContain("await dictation.cancel()");
    expect(route).toContain("logDrill({");
    expect(route).not.toContain("Your score");
    expect(route).not.toContain("XP");
    expect(route).not.toContain("streak");
  });
});
