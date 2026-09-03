import fs from "node:fs";
import path from "node:path";

import { scenarioStartDisposition } from "@/lib/scenarioLifecycle";
import { validatedNativeIntentPath } from "@/lib/nativeIntent";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import { SCENARIOS } from "@/constants/scenarios";

const root = path.resolve(__dirname, "..");
const source = (relativePath: string): string => fs.readFileSync(path.join(root, relativePath), "utf8");

function run(id: string, scenarioId = SCENARIOS[0]!.id) {
  return createScenarioPracticeRun(SCENARIOS.find((item) => item.id === scenarioId) ?? SCENARIOS[0]!, "steady", "not-sure", id, 1_000, "woman-hope");
}

describe("normal paid scenario lifecycle", () => {
  test("creates when no active run exists and resumes the exact unfinished scenario", () => {
    expect(scenarioStartDisposition(null, SCENARIOS[0]!.id)).toEqual({ kind: "create" });
    expect(scenarioStartDisposition(run("one"), SCENARIOS[0]!.id)).toEqual({ kind: "resume", runId: "one" });
  });

  test("retires a completed or different normal run before creating another", () => {
    const active = run("done");
    const completed = { ...active, run: { ...active.run, state: "complete" as const, updatedAt: 2_000 } };
    expect(scenarioStartDisposition(completed, SCENARIOS[0]!.id)).toEqual({ kind: "retire_then_create", runId: "done" });
    expect(scenarioStartDisposition(run("old", SCENARIOS[0]!.id), SCENARIOS[1]!.id)).toEqual({ kind: "retire_then_create", runId: "old" });
  });

  test("does not silently discard an active lesson rehearsal", () => {
    const lesson = run("lesson");
    lesson.run.convertedModuleId = "make_a_clear_ask";
    lesson.run.practiceId = "m1-l1";
    expect(scenarioStartDisposition(lesson, SCENARIOS[1]!.id)).toEqual({ kind: "protected_conflict", runId: "lesson" });
  });

  test("the runtime provides explicit save-and-leave and abandon paths and clears completion", () => {
    const runtime = source("components/ScenarioPaidPractice.tsx");
    expect(runtime).toContain("Save and leave");
    expect(runtime).toContain("Abandon rehearsal");
    expect(runtime).toContain("clearActiveScenarioRunStrict");
    expect(runtime).toContain("We couldn’t finish this scenario safely");
  });
});

describe("validated native intent routing", () => {
  test.each([
    ["/settings", "/settings"],
    ["beforeyousayit://scenario/feedback?level=gentle", "/scenario/feedback?level=gentle"],
    ["https://beforeyousayit.app/drill/clarity", "/drill/clarity"],
    ["/(tabs)/progress", "/(tabs)/progress"],
  ])("preserves supported destination %s", (input, expected) => {
    expect(validatedNativeIntentPath(input)).toBe(expected);
  });

  test.each([
    "javascript:alert(1)",
    "/qa-access",
    "/internal-review-evidence?sheet=path",
    "/approved-lessons",
    "/../../settings",
    "/unknown",
    "https://evil.example/settings",
  ])("falls back safely for unsupported or internal input %s", (input) => {
    expect(validatedNativeIntentPath(input)).toBe("/");
  });

  test("native intent delegates to the validator instead of redirecting every path to root", () => {
    expect(source("app/+native-intent.tsx")).toContain("validatedNativeIntentPath(path)");
  });
});

describe("launch route recovery and account truth", () => {
  test("missing drills and production-closed internal screens return to a normal destination", () => {
    expect(source("app/drill/[id].tsx")).toContain('label="Back to Library"');
    for (const file of ["app/approved-lessons.tsx", "app/qa-access.tsx", "app/internal-review-evidence.tsx"]) {
      expect(source(file)).toContain('label="Back to Today"');
    }
  });

  test("settings derives account copy from the authenticated user", () => {
    const settings = source("app/settings.tsx");
    expect(settings).toContain("useAuth()");
    expect(settings).toContain('user ? "Account"');
    expect(settings).toContain("Signed in as");
    expect(settings).toContain("On this device");
  });
});

describe("selection semantics and responsive Today cards", () => {
  test("choice controls expose radio and selected accessibility state", () => {
    for (const file of ["app/onboarding.tsx", "app/scenario/[id].tsx", "app/paywall.tsx"]) {
      const value = source(file);
      expect(value).toContain('accessibilityRole="radio"');
      expect(value).toContain("accessibilityState={{ selected");
    }
  });

  test("Today cards use a minimum height rather than a clipping fixed height", () => {
    const today = source("app/(tabs)/index.tsx");
    expect(today).toContain("minHeight: TODAY_CARD_HEIGHT");
    expect(today).not.toContain("card: { height: TODAY_CARD_HEIGHT");
    expect(today).toContain("pinnedTranslation(order, scrollOffset)");
    expect(today).not.toContain("numberOfLines={3}");
  });
});
