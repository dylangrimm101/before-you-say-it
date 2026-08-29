import { normalizeLessonFeedback, type LessonFeedbackInput } from "@/lib/lessonFeedback";
import { supabase } from "@/lib/supabase";

/** Submits rating and optional comment only; rehearsal audio and transcripts are never included. */
export async function submitLessonFeedback(input: LessonFeedbackInput): Promise<void> {
  const normalized = normalizeLessonFeedback(input);
  if (!supabase) throw new Error("Feedback service is unavailable");
  const { error } = await supabase.from("lesson_feedback").upsert({
    id: normalized.id,
    lesson_id: normalized.lessonId,
    content_version: normalized.contentVersion,
    rating: normalized.rating,
    comment: normalized.comment || null,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error("Feedback could not be submitted");
}
