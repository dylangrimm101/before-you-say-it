async function source(path: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../${path}`).text();
}
import {
  LESSON_FEEDBACK_MAX_LENGTH,
  isFeedbackLessonId,
  normalizeLessonFeedback,
} from "@/lib/lessonFeedback";

describe("lesson quality feedback", () => {
  test("is available for exactly the ten interactive lessons and never for Close", () => {
    const interactiveIds = [
      "m1-l1", "m1-l2", "m1-l3", "m1-l4", "m1-l5",
      "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5",
    ];
    expect(interactiveIds.filter(isFeedbackLessonId)).toHaveLength(10);
    expect(isFeedbackLessonId("m1-close")).toBe(false);
    expect(isFeedbackLessonId("m2-close")).toBe(false);
  });

  test("keeps only bounded rating, version, and optional comment metadata", () => {
    const normalized = normalizeLessonFeedback({
      id: "f0d19ca8-61bb-4e48-a18f-33d5d579b9b4",
      lessonId: "m2-l5",
      contentVersion: "m2-l5-detailed-scene-v5-2026-08-29",
      rating: 5,
      comment: "  The pushback felt realistic.  ",
    });
    expect(normalized).toEqual({
      id: "f0d19ca8-61bb-4e48-a18f-33d5d579b9b4",
      lessonId: "m2-l5",
      contentVersion: "m2-l5-detailed-scene-v5-2026-08-29",
      rating: 5,
      comment: "The pushback felt realistic.",
    });
    expect(normalized).not.toHaveProperty("transcript");
    expect(normalized).not.toHaveProperty("audio");
  });

  test("appears only after secure lesson completion and can always be skipped", async () => {
    const screen = await source("app/approved-lesson/[lessonId].tsx");
    expect(screen.indexOf("await finalizeConvertedLesson")).toBeLessThan(screen.indexOf("setFeedbackContext({"));
    expect(screen).toContain("How was this lesson?");
    expect(screen).toContain("Submit feedback");
    expect(screen).toContain('label="Skip"');
    expect(screen).toContain('onDone={() => router.replace("/(tabs)")}');
    expect(screen).toContain("never your rehearsal audio or transcript");
    expect(screen).toContain("const feedbackLessonId = lesson && isFeedbackLessonId(lesson.id)");
  });

  test("rejects missing stars, Close screens, and oversized comments", () => {
    const base = {
      id: "f0d19ca8-61bb-4e48-a18f-33d5d579b9b4",
      lessonId: "m1-l1" as const,
      contentVersion: "m1-l1-v2.1-2026-08-24",
      rating: 3,
      comment: "Useful",
    };
    expect(() => normalizeLessonFeedback({ ...base, rating: 0 })).toThrow();
    expect(() => normalizeLessonFeedback({ ...base, lessonId: "m1-close" as never })).toThrow();
    expect(() => normalizeLessonFeedback({ ...base, comment: "x".repeat(LESSON_FEEDBACK_MAX_LENGTH + 1) })).toThrow();
  });
});
