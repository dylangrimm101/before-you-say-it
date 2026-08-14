import { describe, expect, it } from "bun:test";

import { fallbackCustomScenario } from "@/lib/ai";

describe("uninterrupted practice routing", () => {
  const onboarding = (): Promise<string> =>
    Bun.file(new URL("../app/onboarding.tsx", import.meta.url).pathname).text();

  it("sends all onboarding tracks directly to the shared rehearsal", async () => {
    const source = await onboarding();
    expect(source).toContain('pathname: "/rehearse/[id]"');
    expect(source).toContain('entry: "onboarding"');
    expect(source).toContain("practiceSessionId");
    expect(source).not.toContain("safety-check");
    expect(source).not.toContain('"/paywall"');
    expect(source).not.toContain('"/scenario/[id]"');
  });

  it("sends library scenarios directly to rehearsal", async () => {
    const source = await Bun.file(new URL("../app/scenario/[id].tsx", import.meta.url).pathname).text();
    expect(source).toContain('pathname: "/rehearse/[id]"');
    expect(source).not.toContain("safety-check");
  });

  it("does not interrupt curriculum transcript confirmation", async () => {
    const source = await Bun.file(new URL("../app/module/[day].tsx", import.meta.url).pathname).text();
    expect(source).not.toContain("safety-check");
    expect(source).not.toContain("newlySpokenContentNeedsSafetyCheck");
    expect(source).toContain("preservePilotAttempt");
  });

  it("resumes an unfinished free journey directly in rehearsal", async () => {
    const source = await Bun.file(new URL("../app/_layout.tsx", import.meta.url).pathname).text();
    expect(source).toContain('pathname: "/rehearse/[id]"');
    expect(source).not.toContain("safety-check");
  });

  it("falls back locally instead of resetting intake when generation fails", async () => {
    const source = await onboarding();
    expect(source).toContain("draft = await buildCustomScenario");
    expect(source).toContain("draft = fallbackCustomScenario(situation.trim(), selectedFocus, form)");
    expect(source.indexOf("fallbackCustomScenario(situation.trim(), selectedFocus, form)")).toBeLessThan(
      source.indexOf("router.replace({"),
    );
  });

  it("keeps generation and rehearsal steady without an onboarding difficulty step", async () => {
    const source = await onboarding();
    expect(source).toContain('const DIFFICULTY: Difficulty = "steady"');
    expect(source).not.toContain("Practice difficulty");
    expect(source).not.toContain("setDifficulty");
    expect(source).toContain("difficulty: DIFFICULTY");
  });

  it("preserves the user's outcome and selected voice in the fallback", () => {
    const scenario = fallbackCustomScenario(
      "I need to talk about an unfair workload.",
      "work",
      { persona: "man-adam", outcome: "Agree on who owns each deadline." },
    );

    expect(scenario.counterpart).toContain("Adam");
    expect(scenario.counterpartGender).toBe("man");
    expect(scenario.goal).toBe("Agree on who owns each deadline.");
    expect(scenario.situation).toBe("I need to talk about an unfair workload.");
    expect(scenario.opensWith).toBe("user");
  });
});
