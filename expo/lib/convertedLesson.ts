import type { Scenario } from "@/types/convo";

export type ConvertedLessonId = "m1-l1";
export type TransferChoice = "say" | "write" | "save_later";

export interface ConvertedLessonConfig {
  lessonId: ConvertedLessonId;
  practiceId: "gtp_conversation_job";
  contentVersion: "m1-l1-v2.1-2026-08-24";
  title: string;
  scenario: Scenario;
  coachedBehaviorId: "conversation_job";
  authoredPressureText: string;
  retryDirection: string;
  namedMoveId: "one-point-one-proof-one-move";
  namedMove: string;
  rehearsalHandoffCard: 20;
  returnCard: 21;
  completionCard: 22;
  launchEligible: false;
}

export interface ConvertedLessonProgress {
  lessonId: ConvertedLessonId;
  practiceId: ConvertedLessonConfig["practiceId"];
  contentVersion: ConvertedLessonConfig["contentVersion"];
  lessonCardCheckpoint: number;
  quizGatesCompleted: true;
  rehearsalCompleted: true;
  retryCompleted: true;
  comparisonViewed: true;
  savedMoveId: ConvertedLessonConfig["namedMoveId"];
  transferChoice: TransferChoice;
  completedAt: number;
  sourceLineage: "approved-html-deck";
}

export interface LessonCoachNote {
  evidenceQuote: string;
  worked: string;
  change: string;
  retryDirection: string;
  coachedBehaviorId: ConvertedLessonConfig["coachedBehaviorId"];
}

export const M1_L1_CONVERSION: ConvertedLessonConfig = {
  lessonId: "m1-l1",
  practiceId: "gtp_conversation_job",
  contentVersion: "m1-l1-v2.1-2026-08-24",
  title: "When the Point Gets Buried",
  scenario: {
    id: "converted-m1-l1-bedtime-handoff",
    category: "partner",
    title: "The bedtime handoff",
    counterpart: "Adam – your partner",
    counterpartGender: "man",
    situation: "Sunday evening in the kitchen. The dishes are done and your child is asleep. You have wanted to raise the bedtime handoff for two weeks.",
    persona: "Adam is tired and initially treats the issue as an overstatement. He does not resolve the disagreement for the learner.",
    goal: "Name one point, one concrete proof, and one answerable move.",
    opensWith: "user",
    openingLine: "You're acting like this happens all the time.",
    minutes: 7,
    isCustom: false,
  },
  coachedBehaviorId: "conversation_job",
  authoredPressureText: "You're acting like this happens all the time.",
  retryDirection: "Lead with the bedtime point, then give one concrete example and one answerable next step.",
  namedMoveId: "one-point-one-proof-one-move",
  namedMove: "One point. One proof. One move.",
  rehearsalHandoffCard: 20,
  returnCard: 21,
  completionCard: 22,
  launchEligible: false,
};

/** Produces one transcript-grounded coaching note without scores or inferred tone. */
export function m1L1CoachNote(confirmedTranscript: string): LessonCoachNote | null {
  const transcript = confirmedTranscript.trim();
  if (transcript.length < 2) return null;
  const evidenceQuote = transcript.split(/\s+/).slice(0, 10).join(" ");
  return {
    evidenceQuote,
    worked: `You gave Adam a concrete line to answer in “${evidenceQuote}”.`,
    change: "Keep the conversation on one bedtime point instead of expanding the case.",
    retryDirection: M1_L1_CONVERSION.retryDirection,
    coachedBehaviorId: M1_L1_CONVERSION.coachedBehaviorId,
  };
}

/** Compares only the coached behavior and never creates a score or global claim. */
export function m1L1Comparison(firstAttempt: string, retry: string): string {
  const firstLead = (firstAttempt.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "").split(/\s+/).slice(0, 8).join(" ");
  const retryLead = (retry.trim().split(/(?<=[.!?])\s+/)[0]?.trim() ?? "").split(/\s+/).slice(0, 8).join(" ");
  return `First attempt began “${firstLead}” Retry began “${retryLead}” Review which opening keeps one bedtime point in view.`;
}

export function conversionRuntimeEnabled(lessonId: string | null | undefined): lessonId is ConvertedLessonId {
  return __DEV__ && lessonId === M1_L1_CONVERSION.lessonId;
}
