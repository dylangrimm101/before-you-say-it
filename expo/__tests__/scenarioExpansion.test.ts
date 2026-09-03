import { describe, expect, test } from "bun:test";

import { CATEGORIES, SCENARIOS } from "@/constants/scenarios";

const NEW_SCENARIO_IDS = [
  "parenting-disagreement", "last-minute-plan-change", "whole-task-ownership", "phone-attention", "work-priority-conflict", "repair-after-snapping",
  "decline-family-invitation", "parenting-criticism", "private-news-boundary", "change-holiday-tradition", "family-money-request",
  "request-time-off", "manager-skepticism", "meeting-interruption", "scope-creep", "price-pushback", "unhappy-client",
  "decline-friend-invitation", "reconnect-after-silence", "join-group-conversation", "leave-conversation-gracefully", "forgotten-name",
] as const;

describe("expanded authored scenario library", () => {
  test("adds exactly twenty-two complete scenarios across the four customer sections", () => {
    expect(CATEGORIES.map((category) => category.id)).toEqual(["partner", "family", "work", "friends"]);
    expect(SCENARIOS).toHaveLength(34);
    expect(NEW_SCENARIO_IDS).toHaveLength(22);
    expect(NEW_SCENARIO_IDS.every((id) => SCENARIOS.some((scenario) => scenario.id === id))).toBe(true);
    expect(Object.fromEntries(CATEGORIES.map((category) => [category.id, SCENARIOS.filter((scenario) => scenario.category === category.id).length]))).toEqual({ partner: 9, family: 8, work: 10, friends: 7 });
  });

  test("gives every scenario enough authored context for a grounded rehearsal", () => {
    expect(new Set(SCENARIOS.map((scenario) => scenario.id)).size).toBe(SCENARIOS.length);
    for (const scenario of SCENARIOS) {
      expect(scenario.title.length, scenario.id).toBeGreaterThan(12);
      expect(scenario.counterpart.length, scenario.id).toBeGreaterThan(4);
      expect(scenario.situation.length, scenario.id).toBeGreaterThan(70);
      expect(scenario.persona.length, scenario.id).toBeGreaterThan(70);
      expect(scenario.goal.length, scenario.id).toBeGreaterThan(35);
      expect(scenario.openingLine.length, scenario.id).toBeGreaterThan(10);
      expect(["user", "counterpart"]).toContain(scenario.opensWith ?? "user");
    }
  });

  test("grounds the two previously ambiguous authored scenarios", () => {
    const parent = SCENARIOS.find((scenario) => scenario.id === "parent-comingclean")!;
    const friend = SCENARIOS.find((scenario) => scenario.id === "friend-drift")!;
    expect(parent.title).toBe("Tell your parents you’re moving away");
    expect(parent.situation).toContain("accepted a job in another city");
    expect(friend.situation).toContain("canceled the birthday weekend");
    expect(friend.persona).toContain("birthday weekend");
  });

  test("shows situation context while browsing and explains who opens the briefing", async () => {
    const library = await Bun.file(`${import.meta.dir}/../app/(tabs)/library.tsx`).text();
    const brief = await Bun.file(`${import.meta.dir}/../app/scenario/[id].tsx`).text();
    expect(library).toContain("scenario.situation");
    expect(library).toContain("recommended.situation");
    expect(brief).toContain("How the scene starts");
    expect(brief).toContain('scenario.opensWith === "counterpart"');
    expect(brief).toContain("You’ll open this conversation in your own words.");
  });

  test("connects the expanded scenarios to relevant practice-focus recommendations", async () => {
    const recommendation = await Bun.file(`${import.meta.dir}/../lib/scenarioRecommendation.ts`).text();
    for (const id of ["whole-task-ownership", "parenting-disagreement", "manager-skepticism", "repair-after-snapping", "reconnect-after-silence"]) {
      expect(recommendation, id).toContain(`\"${id}\"`);
    }
  });
});
