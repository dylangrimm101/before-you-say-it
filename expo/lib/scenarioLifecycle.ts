import type { PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";

export type ScenarioStartDisposition =
  | { kind: "create" }
  | { kind: "resume"; runId: string }
  | { kind: "retire_then_create"; runId: string }
  | { kind: "protected_conflict"; runId: string };

function isLessonRun(value: PersistedScenarioPracticeRun): boolean {
  return Boolean(value.run.convertedModuleId || value.run.practiceId || value.run.approvedRehearsal);
}

/** Keeps the exact unfinished scenario, while preventing the single active slot from becoming a permanent lock. */
export function scenarioStartDisposition(
  active: PersistedScenarioPracticeRun | null | undefined,
  requestedScenarioId: string,
): ScenarioStartDisposition {
  if (!active) return { kind: "create" };
  if (isLessonRun(active)) return { kind: "protected_conflict", runId: active.run.id };
  if (active.run.scenarioContext?.scenarioId === requestedScenarioId && active.run.state !== "complete") {
    return { kind: "resume", runId: active.run.id };
  }
  return { kind: "retire_then_create", runId: active.run.id };
}
