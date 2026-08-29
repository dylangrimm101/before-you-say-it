import type { ApprovedLessonId } from "@/constants/approvedLessons";

export const LESSON_FEEDBACK_MAX_LENGTH = 1000;

export type FeedbackLessonId = Exclude<ApprovedLessonId, "m1-close" | "m2-close">;

export interface LessonFeedbackInput {
  id: string;
  lessonId: FeedbackLessonId;
  contentVersion: string;
  rating: number;
  comment: string;
}

const FEEDBACK_LESSON_IDS = new Set<FeedbackLessonId>([
  "m1-l1", "m1-l2", "m1-l3", "m1-l4", "m1-l5",
  "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5",
]);

/** Returns true only for the ten interactive lessons; module Close screens are excluded. */
export function isFeedbackLessonId(value: unknown): value is FeedbackLessonId {
  return typeof value === "string" && FEEDBACK_LESSON_IDS.has(value as FeedbackLessonId);
}

/** Normalizes the small feedback payload and rejects transcript-sized or invalid input. */
export function normalizeLessonFeedback(input: LessonFeedbackInput): LessonFeedbackInput {
  const id = input.id.trim();
  const contentVersion = input.contentVersion.trim();
  const comment = input.comment.trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Feedback identity is invalid");
  if (!isFeedbackLessonId(input.lessonId)) throw new Error("Lesson feedback is unavailable");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Choose between one and five stars");
  if (contentVersion.length < 1 || contentVersion.length > 120) throw new Error("Lesson version is invalid");
  if (comment.length > LESSON_FEEDBACK_MAX_LENGTH) throw new Error("Feedback is too long");
  return { ...input, id, contentVersion, comment };
}

