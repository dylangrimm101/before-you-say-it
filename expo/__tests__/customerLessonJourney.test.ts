import { describe, expect, test } from "bun:test";

import type { ApprovedLessonDeck } from "@/constants/approvedLessons";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import { CUSTOMER_LESSON_CARD_COPY, customerLessonActivityCopy } from "@/lib/customerLessonExperience";
import { installTapTutorialDismissal } from "@/lib/approvedDeckLoader";

async function source(path: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../${path}`).text();
}

describe("customer lesson journey", () => {
  test("keeps the customer tap tutorial and dismisses it before advancing Card 1", () => {
    const fixture = `state = { i:0, hint:true }; showHint:st.hint && i === 0, restart:() => this.setState({ i:0, hint:true })`;
    const result = installTapTutorialDismissal(`${fixture}\ngo(d) {\n this.advance(d);\n}`);
    expect(result).toContain("showHint:st.hint && i === 0");
    expect(result).toContain("if (this.state.hint && this.state.i === 0)");
    expect(result).toContain("this.setState({ hint:false });");
  });

  test("customer lesson leaves the deck chrome unobstructed and contains no internal QA controls", async () => {
    const route = await source("app/approved-lesson/[lessonId].tsx");
    expect(route).not.toContain("INTERNAL QA");
    expect(route).not.toContain("qaBadge");
    expect(route).not.toContain("approved source deck");
    expect(route).not.toContain("Opening approved deck");
    expect(route).not.toContain("customerLessonHeader");
    expect(route).not.toContain("backButton");
    expect(route).not.toContain("menuButton");
    expect(route).not.toContain("lessonMenu");
    expect(route).not.toContain("MoreHorizontal");
    expect(route).toContain("hasCompletedLesson");
    expect(route).toContain("completionCommitted || hasCompletedLesson");
    expect(route).toContain("Do this lesson again");
  });

  test("restores the scroll-driven floating Today card stack", async () => {
    const today = await source("app/(tabs)/index.tsx");
    expect(today).toContain("pinnedTranslation(order, scrollOffset)");
    expect(today).toContain("const scrollOffset = useRef<Animated.Value>");
    expect(today).toContain("onScroll={onDeckScroll}");
    expect(today).toContain("scrollEventThrottle={16}");
    expect(today).toContain("scrollOffset={scrollOffset}");
  });

  test("maps every lesson's Today cards to that lesson's move and rehearsal", () => {
    for (const lessonId of ["m1-l2", "m1-l3", "m1-l4", "m1-l5", "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5"] as const) {
      const rehearsal = approvedRehearsalConfig(lessonId)!;
      const lessonNumber = Number(lessonId.slice(-1));
      const deck: ApprovedLessonDeck = {
        id: lessonId,
        module: lessonId.startsWith("m1-") ? 1 : 2,
        lesson: lessonNumber,
        title: `Full title for ${lessonId}`,
        shortName: `Short name for ${lessonId}`,
        namedMove: rehearsal.namedMove,
        cardCount: 22,
        contentAnchorPx: 80,
        reviewThroughCard: 20,
        rehearsalReturnCard: 21,
        isCloseDeck: false,
        archivePath: `${lessonId}.html`,
        thumbnail: null,
      };
      const copy = customerLessonActivityCopy(deck, rehearsal);
      const exact = CUSTOMER_LESSON_CARD_COPY[lessonId]!;
      expect(copy.lesson.title, lessonId).toBe(deck.title);
      expect(copy.lesson.body, lessonId).toBe(deck.namedMove!);
      expect(copy.practice.title, lessonId).toBe(exact.practiceTitle);
      expect(copy.practice.body, lessonId).toBe(exact.practiceBody);
      expect(copy.rehearsal.title, lessonId).toBe(exact.rehearsalTitle);
      expect(copy.rehearsal.body, lessonId).toContain(rehearsal.scenario.counterpart);
      expect(copy.review.title, lessonId).toBe("Your saved move");
      expect(copy.review.body, lessonId).toBe(exact.reviewBody);
    }
  });

  test("routes a current lesson rehearsal directly to its lesson-specific runtime", async () => {
    const today = await source("app/(tabs)/index.tsx");
    expect(today).toContain("activeLessonRun");
    expect(today).toContain("activeLessonRun?.state");
    expect(today).toContain("run.contentVersion === rehearsalConfig.contentVersion");
    expect(today).toContain("run.scenarioContext?.scenarioId === rehearsalConfig.scenario.id");
    expect(today).toContain('pathname: "/approved-rehearsal/[lessonId]"');
    expect(today).toContain("customerLessonActivityCopy");
    expect(today).not.toContain("const moduleDay: PilotModule | undefined = undefined");
    expect(today).not.toContain("todayActivityPresentation(undefined, false)");
  });

  test("lesson rehearsal presents the lesson move before the generic conversation shell", async () => {
    const route = await source("app/approved-rehearsal/[lessonId].tsx");
    const runtime = await source("components/ScenarioPaidPractice.tsx");
    expect(route).toContain("lessonTitle: lesson.shortName");
    expect(route).toContain("lessonMove: lesson.namedMove");
    expect(runtime).toContain("lessonTitle?: string");
    expect(runtime).toContain("lessonMove?: string");
    expect(runtime).toContain("Lesson rehearsal");
  });
});
