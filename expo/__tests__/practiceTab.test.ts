import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../${path}`).text();
}

describe("customer Practice tab", () => {
  test("renames Scenarios to Practice and exposes Lessons and Scenarios views", async () => {
    const layout = await source("app/(tabs)/_layout.tsx");
    const practice = await source("app/(tabs)/library.tsx");
    expect(layout).toContain('title: "Practice"');
    expect(layout).toContain('label="Practice"');
    expect(practice).toContain('useState<PracticeView>("lessons")');
    expect(practice).toContain('accessibilityLabel={`Show ${option}`}');
    expect(practice).toContain('option === "lessons" ? "Lessons" : "Scenarios"');
  });

  test("shows the complete sequential curriculum inside the Lessons view", async () => {
    const practice = await source("app/(tabs)/library.tsx");
    expect(practice).toContain("LAUNCH_CURRICULUM_MODULES");
    expect(practice).toContain("LAUNCH_DECK_IDS");
    expect(practice).toContain("nextLaunchDeck");
    expect(practice).toContain("convertedLessonProgress");
    expect(practice).toContain("moduleCloseProgress");
    expect(practice).toContain('pathname: "/approved-lesson/[lessonId]"');
    expect(practice).toContain("Two modules. Ten lessons.");
    expect(practice).toContain("styles.moduleBanner");
    expect(practice).toContain("styles.journeyNode");
    expect(practice).toContain("styles.journeyConnector");
    expect(practice).toContain("index % 2 === 0 ? styles.lessonStepLeft : styles.lessonStepRight");
  });

  test("keeps Today on the next incomplete lesson immediately after completion", async () => {
    const today = await source("app/(tabs)/index.tsx");
    expect(today).toContain("nextLaunchDeck(convertedLessonProgress, moduleCloseProgress)");
    expect(today).not.toContain("dailyLessonId");
    expect(today).not.toContain("tomorrow");
  });
});
