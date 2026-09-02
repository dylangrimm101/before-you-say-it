import { describe, expect, test } from "bun:test";

import { DEFAULT_CONSENT } from "@/lib/consent";
import { sanitizeActivePracticeSessionForPersistence, sanitizeActiveScenarioRunForPersistence, sanitizeSessionForPersistence } from "@/lib/privacyPersistence";
import { createOnboardingPracticeSession } from "@/lib/practiceSession";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import type { Scenario } from "@/types/convo";
import type { SessionRecord } from "@/types/privacy";

const exact = {
  title: "EXACT PRIVATE TITLE",
  situation: "EXACT PRIVATE SITUATION",
  objective: "EXACT PRIVATE OBJECTIVE",
  counterpart: "EXACT PRIVATE COUNTERPART",
};

const scenario: Scenario = {
  id: "custom-private",
  category: "work",
  title: exact.title,
  situation: exact.situation,
  goal: exact.objective,
  counterpart: exact.counterpart,
  persona: `Respond as ${exact.counterpart}`,
  openingLine: "EXACT PRIVATE OPENING",
  opensWith: "user",
  isCustom: true,
};

describe("consent-bound custom scenario persistence", () => {
  test("consent off removes exact custom fields from the durable active run", () => {
    const run = createScenarioPracticeRun(scenario, "steady", "defensive", "private-run", 1);
    const persisted = sanitizeActiveScenarioRunForPersistence(run, DEFAULT_CONSENT);
    const serialized = JSON.stringify(persisted);
    Object.values(exact).forEach((marker) => expect(serialized).not.toContain(marker));
  });

  test("consent off removes exact custom labels from a minimized session", () => {
    const record: SessionRecord = {
      schemaVersion: 2,
      id: "private-session",
      scenarioId: scenario.id,
      title: exact.title,
      counterpart: exact.counterpart,
      category: "work",
      difficulty: "steady",
      skillIds: [],
      turnCount: 1,
      userTurnCount: 1,
      retryCount: 0,
      completed: true,
      startedAt: 1,
      contentRetained: false,
    };
    const persisted = sanitizeSessionForPersistence(record, DEFAULT_CONSENT);
    expect(persisted.title).toBeUndefined();
    expect(persisted.counterpart).toBeUndefined();
  });

  test("consent off removes exact custom fields from the onboarding-to-paid active session", () => {
    const session = createOnboardingPracticeSession("practice", "anon", scenario, exact.objective, "defensive", 1, {
      scenarioSource: "user_supplied",
      scenarioTitle: exact.title,
      counterpartRelationship: exact.counterpart,
      counterpartDisplayLabel: exact.counterpart,
      behavioralGoal: exact.objective,
      persona: "woman-hope",
    });
    const serialized = JSON.stringify(sanitizeActivePracticeSessionForPersistence(session, DEFAULT_CONSENT));
    Object.values(exact).forEach((marker) => expect(serialized).not.toContain(marker));
  });

  test("explicit consent preserves the exact custom fields", () => {
    const consent = { ...DEFAULT_CONSENT, saveCustomScenarioText: true };
    const run = sanitizeActiveScenarioRunForPersistence(createScenarioPracticeRun(scenario, "steady", "defensive", "private-run", 1), consent);
    expect(run.run.scenarioContext?.title).toBe(exact.title);
    expect(run.run.scenarioContext?.situation).toBe(exact.situation);
    expect(run.run.scenarioContext?.objective).toBe(exact.objective);
    expect(run.run.scenarioContext?.counterpartLabel).toBe(exact.counterpart);
  });
});
