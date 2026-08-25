import {
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeScenarioComparison,
  createScenarioPracticeRun,
  preserveScenarioAttempt,
  scenarioContinuitySnapshot,
  scenarioPracticePresentation,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
} from "@/lib/scenarioPractice";
import type { Scenario } from "@/types/convo";
import type { PilotModuleState } from "@/types/pilotCurriculum";

const QA_ID = "qa-private-run-counterpart-turn-1";
const UUID_ID = "123e4567-e89b-12d3-a456-426614174000";
const PRESENTED_STATES: PilotModuleState[] = [
  "ready_for_response",
  "hope_coaching",
  "ready_for_retry",
  "attempt_comparison",
];

const SOURCE: Scenario = {
  id: "qa-private-scenario",
  category: "work",
  title: "Ask for a clear decision",
  counterpart: "Priya — your manager",
  situation: "A decision is due this week.",
  persona: "Priya wants a concrete proposal.",
  goal: "Agree on a decision or a dated next step.",
  openingLine: "",
  opensWith: "user",
  minutes: 5,
};

function completedRun(pressureId: string = QA_ID): PersistedScenarioPracticeRun {
  let value = createScenarioPracticeRun(SOURCE, "challenging", "not-sure", "qa-private-run", 1);
  value = preserveScenarioAttempt(value, "opener", "I want to agree on a concrete next step.", 2);
  value = attachScenarioCounterpartTurn(value, {
    id: pressureId,
    text: "The budget is tight. What number did you have in mind?",
    source: "provider",
  }, 3);
  value = preserveScenarioAttempt(value, "response", "I am asking for 12 percent or a decision date.", 4);
  value = attachScenarioCoaching(value, "The request is concrete.", "Keep the same clarity in your retry.", "pushback_response", 5);
  value = preserveScenarioAttempt(value, "retry", "Can we agree on 12 percent or set the decision meeting?", 6);
  return completeScenarioComparison(value, 7);
}

function serializedPresentation(value: unknown): string {
  return JSON.stringify(scenarioPracticePresentation(value));
}

describe("scenario paid-practice presentation", () => {
  test("internal identity remains unchanged across response, coaching, retry, and comparison presentation", () => {
    const value = completedRun();
    const identity = scenarioContinuitySnapshot(value);
    PRESENTED_STATES.forEach((state, index) => {
      const staged = transitionScenarioPracticeRun(value, state, 20 + index);
      const before = JSON.stringify(staged);
      scenarioPracticePresentation(staged);
      expect(JSON.stringify(staged)).toBe(before);
      expect(scenarioContinuitySnapshot(staged)).toEqual(identity);
      expect(staged.run.counterpartTurn?.id).toBe(QA_ID);
      expect(staged.run.responseAttempt?.id).toBe("qa-private-run-response");
      expect(staged.run.retryAttempt?.id).toBe("qa-private-run-retry");
    });
  });

  test("visible presentation uses the stable human continuity label", () => {
    const presentation = scenarioPracticePresentation(completedRun());
    expect(presentation.isAvailable).toBe(true);
    if (!presentation.isAvailable) throw new Error("Expected available presentation");
    expect(presentation.counterpart?.continuityLabel).toBe("Same pressure moment");
  });

  test("visible presentation omits the actual pressure-turn identifier", () => {
    const visible = serializedPresentation(completedRun());
    expect(visible).not.toContain(QA_ID);
    expect(visible).toContain("Same pressure moment");
  });

  test("accessibility presentation contains no internal identity", () => {
    const presentation = scenarioPracticePresentation(completedRun());
    if (!presentation.isAvailable) throw new Error("Expected available presentation");
    const accessibility = presentation.counterpart?.accessibilityLabel ?? "";
    expect(accessibility).toContain("Same pressure moment");
    expect(accessibility).not.toContain(QA_ID);
    expect(accessibility).not.toContain("qa-private-run");
    expect(accessibility).not.toContain(SOURCE.id);
  });

  test("malformed runs fail closed without reflecting malformed internal values", () => {
    const malformed = {
      ...completedRun(),
      run: { ...completedRun().run, state: "qa-malformed-private-state", id: UUID_ID },
    };
    const presentation = scenarioPracticePresentation(malformed);
    expect(presentation).toEqual({
      isAvailable: false,
      title: "This scenario run is unavailable.",
      body: "Return to Scenarios and start a fresh rehearsal. No generic practice fixture was substituted.",
    });
    expect(serializedPresentation(malformed)).not.toContain("qa-malformed-private-state");
    expect(serializedPresentation(malformed)).not.toContain(UUID_ID);
  });

  test("QA-prefixed internal identifiers cannot enter visible presentation", () => {
    const visible = serializedPresentation(completedRun(QA_ID));
    expect(visible).not.toMatch(/qa-[a-z0-9-]+/i);
  });

  test("UUID-shaped internal identifiers cannot enter visible presentation", () => {
    const visible = serializedPresentation(completedRun(UUID_ID));
    expect(visible).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  });
});
