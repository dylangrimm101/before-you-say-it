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

  test("the migrated dashboard leads with the evidence-based module recommendation", async () => {
    const dashboard = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(dashboard).toContain("RECOMMENDED START");
    expect(dashboard).toContain("Your rehearsal selected this starting point");
    expect(dashboard).toContain("CURRICULUM_MODULES");
  });

  test("does not use missed-day pressure or sequential lockouts", async () => {
    const dashboard = (await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text()).toLowerCase();
    expect(dashboard).toContain("nothing locks when you miss a day");
    expect(dashboard).not.toContain("keep the streak");
    expect(dashboard).not.toContain("locked");
  });
});
