import { describe, expect, test } from "bun:test";

import { SCENARIOS } from "@/constants/scenarios";
import { recommendScenario } from "@/lib/scenarioRecommendation";

describe("focus-led scenario recommendations", () => {
  test("focus and category match leads", () => {
    const result = recommendScenario(SCENARIOS, "make_a_clear_ask", "Make one answerable request", "work", false);
    expect(result.match).toBe("focus-and-category");
    expect(result.scenario?.id).toBe("raise");
    expect(result.reason).toContain("current focus");
  });

  test("focus-only match leads outside an empty category", () => {
    const onlyPartner = SCENARIOS.filter((scenario) => scenario.category === "partner");
    const result = recommendScenario(onlyPartner, "make_a_clear_ask", "Make one answerable request", "work", false);
    expect(result.match).toBe("focus-only");
    expect(result.scenario?.id).toBe("chores");
    expect(result.reason).toContain("outside the selected relationship filter");
  });

  test("category-only fallback is not described as personalized", () => {
    const result = recommendScenario(SCENARIOS, null, null, "friends", false);
    expect(result.match).toBe("category-only");
    expect(result.scenario?.category).toBe("friends");
    expect(result.reason).toBe("A useful place to practice in this part of your life.");
    expect(result.reason).not.toContain("fallback");
  });

  test("no match returns no recommendation", () => {
    const result = recommendScenario([], "make_a_clear_ask", "Make one answerable request", "partner", false);
    expect(result.match).toBe("none");
    expect(result.scenario).toBeNull();
  });

  test("free recommendation preserves its locked state", () => {
    expect(recommendScenario(SCENARIOS, "make_a_clear_ask", "Make one answerable request", "partner", true).isLocked).toBe(true);
  });

  test("Pro recommendation is unlocked", () => {
    expect(recommendScenario(SCENARIOS, "make_a_clear_ask", "Make one answerable request", "partner", false).isLocked).toBe(false);
  });
});
