import type { ConsentState } from "@/lib/consent";
import type { ActivePracticeSession } from "@/lib/practiceSession";
import type { PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";
import type { SessionRecord } from "@/types/privacy";

const PRIVATE_CONTEXT = {
  title: "Your conversation",
  situation: "Private custom scenario",
  objective: "Practice this conversation",
  counterpartName: "Conversation partner",
  counterpartLabel: "Conversation partner",
  counterpartRole: "conversation counterpart",
} as const;

function isCustomScenarioId(scenarioId: string): boolean {
  return scenarioId.startsWith("custom-");
}

/** Removes custom onboarding context while keeping the durable state-machine identity. */
export function sanitizeActivePracticeSessionForPersistence(
  value: ActivePracticeSession,
  consent: ConsentState,
): ActivePracticeSession {
  const userAuthored = value.scenarioSource === "user_supplied" || isCustomScenarioId(value.scenarioId);
  if (consent.saveCustomScenarioText || !userAuthored) return value;
  return {
    ...value,
    counterpart: PRIVATE_CONTEXT.counterpartLabel,
    topic: PRIVATE_CONTEXT.situation,
    usefulOutcome: PRIVATE_CONTEXT.objective,
    scenarioTitle: PRIVATE_CONTEXT.title,
    counterpartRelationship: PRIVATE_CONTEXT.counterpartRole,
    counterpartDisplayLabel: PRIVATE_CONTEXT.counterpartLabel,
    behavioralGoal: PRIVATE_CONTEXT.objective,
    selectionLabel: PRIVATE_CONTEXT.title,
  };
}

/** Removes user-authored scenario text at the final durable-write boundary. */
export function sanitizeActiveScenarioRunForPersistence(
  value: PersistedScenarioPracticeRun,
  consent: ConsentState,
): PersistedScenarioPracticeRun {
  const context = value.run.scenarioContext;
  if (consent.saveCustomScenarioText || !context || !isCustomScenarioId(context.scenarioId)) return value;
  return {
    ...value,
    run: {
      ...value.run,
      scenarioContext: { ...context, ...PRIVATE_CONTEXT },
    },
  };
}

/** Session records never retain custom labels unless the user explicitly opted in. */
export function sanitizeSessionForPersistence(record: SessionRecord, consent: ConsentState): SessionRecord {
  if (consent.saveCustomScenarioText || !isCustomScenarioId(record.scenarioId)) return record;
  const { title: _title, counterpart: _counterpart, ...safe } = record;
  return safe;
}
