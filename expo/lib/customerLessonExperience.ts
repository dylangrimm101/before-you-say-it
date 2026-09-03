import type { ApprovedLessonDeck, ApprovedLessonId } from "@/constants/approvedLessons";
import type { Scenario } from "@/types/convo";
import type { TodayActivityKey } from "@/lib/today";

export interface CustomerLessonRehearsalSummary {
  scenario: Scenario;
  namedMove: string;
}

export type CustomerLessonActivityCopy = Record<TodayActivityKey, { title: string; body: string }>;

interface LessonCardCopy {
  practiceTitle: string;
  practiceBody: string;
  rehearsalTitle: string;
  reviewBody: string;
}

/** Exact customer-facing landmarks from the approved lesson cards. */
export const CUSTOMER_LESSON_CARD_COPY: Partial<Record<ApprovedLessonId, LessonCardCopy>> = {
  "m1-l1": { practiceTitle: "Which version is building a case?", practiceBody: "They changed the subject. Which response returns to yours?", rehearsalTitle: "Now say it out loud", reviewBody: "One real conversation before tomorrow night" },
  "m1-l2": { practiceTitle: "Which one grounds the point without building a case?", practiceBody: "Which one brings people who aren’t here?", rehearsalTitle: "Now hold it out loud", reviewBody: "Pick the one you’ve got a folder on" },
  "m1-l3": { practiceTitle: "Where does the kitchen go?", practiceBody: "Which one shouldn’t be parked at all?", rehearsalTitle: "Now hold both out loud", reviewBody: "Write the park you’d actually say" },
  "m1-l4": { practiceTitle: "Which one could they say back?", practiceBody: "Which reply shows they caught it?", rehearsalTitle: "Now say it out loud", reviewBody: "Write the big one, then the one part" },
  "m1-l5": { practiceTitle: "Which one is this turn voicing?", practiceBody: "Which one keeps the other two live?", rehearsalTitle: "Now try it out loud", reviewBody: "Start with one thing" },
  "m2-l1": { practiceTitle: "Which slot does each part fill?", practiceBody: "What's wrong with this one?", rehearsalTitle: "Now ask it out loud", reviewBody: "One ask you've been circling" },
  "m2-l2": { practiceTitle: "Which one makes one respondent clear?", practiceBody: "They say it isn’t them. Now what?", rehearsalTitle: "Now put it to one person", reviewBody: "One ask you left with the group" },
  "m2-l3": { practiceTitle: "Which one changes something?", practiceBody: "Which one says what you need without arguing with what they said?", rehearsalTitle: "Now try it when Marcus answers back", reviewBody: "One ask that came back with a reason" },
  "m2-l4": { practiceTitle: "Which branch did his no travel?", practiceBody: "Which one tells her which kind of ask this is?", rehearsalTitle: "Now say it with an answer coming back", reviewBody: "The ask you've been dressing up" },
  "m2-l5": { practiceTitle: "Which one is a loop?", practiceBody: "Which one asks for the loop?", rehearsalTitle: "Now hand it over out loud", reviewBody: "The task you’ve been meaning to hand over" },
};

/** Customer-facing Today copy tied to the exact approved lesson-card landmarks. */
export function customerLessonActivityCopy(
  lesson: ApprovedLessonDeck,
  rehearsal?: CustomerLessonRehearsalSummary,
): CustomerLessonActivityCopy {
  const move = rehearsal?.namedMove ?? lesson.namedMove ?? "Bring the five moves together";
  const scenario = rehearsal?.scenario;
  const cards = CUSTOMER_LESSON_CARD_COPY[lesson.id];
  return {
    lesson: {
      title: lesson.title,
      body: move,
    },
    practice: {
      title: cards?.practiceTitle ?? `Practice: ${move}`,
      body: cards?.practiceBody ?? scenario?.goal ?? "Bring the module’s five moves together in one complete review.",
    },
    rehearsal: {
      title: cards?.rehearsalTitle ?? scenario?.title ?? `Complete ${lesson.shortName}`,
      body: scenario ? `${scenario.title} with ${scenario.counterpart}. ${scenario.goal}` : "Apply the module’s five moves to one complete conversation.",
    },
    review: {
      title: "Your saved move",
      body: cards?.reviewBody ?? `Review ${lesson.shortName} and carry one move forward.`,
    },
  };
}
