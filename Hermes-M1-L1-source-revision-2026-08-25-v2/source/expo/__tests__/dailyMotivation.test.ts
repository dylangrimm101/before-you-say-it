import { DAILY_MOTIVATIONS, dailyMotivation } from "@/lib/dailyMotivation";

describe("daily dashboard motivation", () => {
  test("includes enough original messages to avoid a short repetitive loop", () => {
    expect(DAILY_MOTIVATIONS.length).toBeGreaterThanOrEqual(30);
    expect(new Set(DAILY_MOTIVATIONS).size).toBe(DAILY_MOTIVATIONS.length);
  });

  test("stays stable throughout the same local calendar day", () => {
    const morning = new Date(2026, 7, 2, 7, 15);
    const evening = new Date(2026, 7, 2, 22, 45);
    expect(dailyMotivation(morning)).toBe(dailyMotivation(evening));
  });

  test("changes on the next local calendar day", () => {
    const today = new Date(2026, 7, 2, 23, 59);
    const tomorrow = new Date(2026, 7, 3, 0, 1);
    expect(dailyMotivation(today)).not.toBe(dailyMotivation(tomorrow));
  });

  test("Today leads with the evidence-backed module and locked activity hierarchy", async () => {
    const today = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(today).toContain("todayRecommendedModuleId");
    expect(today).toContain("Communication Index");
    expect(today).toContain("TODAY_ACTIVITY_KEYS");
    expect(today).toContain("View your path");
  });

  test("does not use missed-day pressure, a giant recommendation card, or fixture history", async () => {
    const today = (await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text()).toLowerCase();
    expect(today).not.toContain("keep the streak");
    expect(today).not.toContain("recommended start");
    expect(today).not.toContain("heroSurface".toLowerCase());
    expect(today).not.toContain("58, 61, 57, 63, 60, 62, 62");
  });
});
