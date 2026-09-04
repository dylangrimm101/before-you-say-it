
import type { ApprovedRehearsalLessonId } from "@/lib/approvedRehearsals";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";
import type { DrillResult } from "@/types/convo";

export type QuickRepLessonId = "m1-l1" | ApprovedRehearsalLessonId;

export interface QuickRepConfig {
  lessonId: QuickRepLessonId;
  lessonTitle: string;
  namedMove: string;
  situation: string;
  instruction: string;
  feedbackFocus: string;
  skill: string;
}

export const QUICK_REP_CONFIGS: readonly QuickRepConfig[] = [
  {
    lessonId: "m1-l1",
    lessonTitle: "The Buried Point",
    namedMove: "One point. One proof. One move.",
    skill: "Clarity",
    situation: "Your partner expects you to handle Saturday morning, but a work deadline changed and you need the plan to change too.",
    instruction: "State one point, give one relevant reason, and name the next move you want to make together.",
    feedbackFocus: "Check for one unmistakable point, one supporting proof, and one concrete next move without extra setup.",
  },
  {
    lessonId: "m1-l2",
    lessonTitle: "Cut the Case",
    namedMove: "One anchor. The rest stays in the folder.",
    skill: "Clarity",
    situation: "Your manager asks why a project deadline needs to move after another team delivered its work late.",
    instruction: "Give the one fact that carries the decision, then make the deadline request without building the whole case.",
    feedbackFocus: "Check that one anchor carries the explanation and the speaker does not stack unnecessary evidence or defenses.",
  },
  {
    lessonId: "m1-l3",
    lessonTitle: "Park and Return",
    namedMove: "Both on the table. One at a time.",
    skill: "Steadiness",
    situation: "While you are discussing this weekend's childcare handoff, the other person interrupts to raise an unrelated spending concern.",
    instruction: "Acknowledge the new concern, park it somewhere specific, and return to the childcare decision already on the table.",
    feedbackFocus: "Check for acknowledgment, a credible promise to return, and a clear verbal return to the original subject.",
  },
  {
    lessonId: "m1-l4",
    lessonTitle: "Make It Repeatable",
    namedMove: "Catch it. Say it back.",
    skill: "Listening",
    situation: "A teammate says they can help with the launch, but they are worried the request will quietly expand beyond Friday.",
    instruction: "Say back the concern you heard before you answer it, using language the other person could recognize as theirs.",
    feedbackFocus: "Check that the response accurately reflects the stated concern before explaining, defending, or solving anything.",
  },
  {
    lessonId: "m1-l5",
    lessonTitle: "Fit in One",
    namedMove: "Pick one. Keep the rest.",
    skill: "Clarity",
    situation: "You need to discuss chores, an upcoming family visit, and a budget decision, but there is only time for one conversation tonight.",
    instruction: "Choose the one subject that needs attention now and explicitly leave the other two for a later conversation.",
    feedbackFocus: "Check that the speaker chooses one topic, names it plainly, and keeps the remaining issues out of this conversation.",
  },
  {
    lessonId: "m2-l1",
    lessonTitle: "Clear Ask",
    namedMove: "One action. One owner. Room to answer.",
    skill: "Specificity",
    situation: "The kitchen cleanup keeps remaining unfinished, and you need to ask your partner for a different arrangement this week.",
    instruction: "Ask for one observable action, name who owns it, and leave enough room for a real answer.",
    feedbackFocus: "Check for one concrete action, one explicit owner, and an ask that permits agreement, refusal, or negotiation.",
  },
  {
    lessonId: "m2-l2",
    lessonTitle: "Say Who",
    namedMove: "Say who you're asking.",
    skill: "Specificity",
    situation: "A family group keeps assuming someone will bring your parent to an appointment, but nobody has actually agreed to do it.",
    instruction: "Ask one named person directly instead of sending another request to the whole group.",
    feedbackFocus: "Check that the request names one person and one action rather than assigning responsibility to everyone and no one.",
  },
  {
    lessonId: "m2-l3",
    lessonTitle: "When They Say They Can't",
    namedMove: "Hear it. Trade one thing. Say where it stands.",
    skill: "Negotiation",
    situation: "A coworker says they cannot finish their part by Thursday because another urgent assignment landed this morning.",
    instruction: "Show that you heard the constraint, trade one specific part of the plan, and say clearly where the work now stands.",
    feedbackFocus: "Check for acknowledgment of the constraint, one bounded trade, and an explicit statement of the revised commitment.",
  },
  {
    lessonId: "m2-l4",
    lessonTitle: "Say Whether No",
    namedMove: "Say whether no is available.",
    skill: "Boundaries",
    situation: "A relative keeps answering your invitation with vague reasons they might not be able to come, but never gives a decision.",
    instruction: "Make it safe for them to say no, then ask whether the answer is no, not yet, or something else.",
    feedbackFocus: "Check that refusal is explicitly allowed and the speaker asks for the kind of answer rather than pushing for agreement.",
  },
  {
    lessonId: "m2-l5",
    lessonTitle: "Ask for the Loop",
    namedMove: "Ask for the loop, not the last step.",
    skill: "Ownership",
    situation: "Your partner agrees to book summer camp, but you are still tracking registration dates, forms, payment, and confirmation.",
    instruction: "Ask them to own the complete loop, including planning, follow-through, and telling you when it is closed.",
    feedbackFocus: "Check that the request transfers the full loop and defines a clear close rather than delegating only the final task.",
  },
] as const;

const QUICK_REP_BY_LESSON = new Map<QuickRepLessonId, QuickRepConfig>(
  QUICK_REP_CONFIGS.map((config) => [config.lessonId, config]),
);

export function quickRepConfig(lessonId: string | null | undefined): QuickRepConfig | null {
  return lessonId ? QUICK_REP_BY_LESSON.get(lessonId as QuickRepLessonId) ?? null : null;
}

export function latestCompletedQuickRep(progress: readonly ConvertedLessonProgress[]): QuickRepConfig | null {
  const latest = [...progress]
    .filter((entry) => QUICK_REP_BY_LESSON.has(entry.lessonId as QuickRepLessonId))
    .sort((a, b) => b.completedAt - a.completedAt)[0];
  return latest ? quickRepConfig(latest.lessonId) : null;
}

export function quickRepLogId(lessonId: QuickRepLessonId): string {
  return `quick-rep-${lessonId}`;
}

function localDayKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
}

export function quickRepCompletedToday(
  drillLog: readonly DrillResult[],
  lessonId: QuickRepLessonId,
  now = new Date(),
): boolean {
  const date = localDayKey(now);
  return drillLog.some((entry) => entry.drillId === quickRepLogId(lessonId) && entry.date === date);
}

export function quickRepCompletionDate(now = new Date()): string {
  return localDayKey(now);
}
