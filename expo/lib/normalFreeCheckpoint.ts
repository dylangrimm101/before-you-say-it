import type { OnboardingEntryRoute } from "@/constants/modules";
import { PILOT_PROGRAM } from "@/lib/pilotCurriculum";
import type { ActivePracticeSession } from "@/lib/practiceSession";
import { applyRecovery, type RecoveryState } from "@/lib/phaseRecovery";
import type { CategoryId, Difficulty, PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";

type Contract = Record<string, unknown>;

const categories = new Set<CategoryId>(["partner", "family", "work", "friends"]);
const routes = new Set<OnboardingEntryRoute>(["real_conversation", "recurring_problem", "desired_skill"]);
const reactions = new Set<ReactionPattern>(["defensive", "hears-criticism", "minimizes", "quiet", "louder", "turns-back", "agrees-without-changing", "not-sure"]);
const difficulties = new Set<Difficulty>(["gentle", "steady", "challenging"]);

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function category(value: unknown): CategoryId | null {
  const item = text(value)?.toLowerCase();
  return item && categories.has(item as CategoryId) ? item as CategoryId : null;
}

function entryRoute(value: unknown): OnboardingEntryRoute | null {
  const item = text(value);
  return item && routes.has(item as OnboardingEntryRoute) ? item as OnboardingEntryRoute : null;
}

function reaction(value: unknown): ReactionPattern {
  const item = text(value);
  return item && reactions.has(item as ReactionPattern) ? item as ReactionPattern : "not-sure";
}

function difficulty(value: unknown): Difficulty {
  const item = text(value);
  return item && difficulties.has(item as Difficulty) ? item as Difficulty : "steady";
}

function personaFromAudioRole(value: unknown): PersonaVoice {
  const role = text(value)?.toLowerCase() ?? "";
  return role.includes("adam") || role.includes("man") ? "man-adam" : "woman-hope";
}

function checkpointContract(state: RecoveryState): Contract | null {
  const contract = state.checkpoint?.contract;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) return null;
  return contract as Contract;
}

export function authoritativeNormalFreeContract(session: ActivePracticeSession | null | undefined): Contract | undefined {
  const contract = session?.normalFreeContract;
  return contract && typeof contract === "object" && !Array.isArray(contract) ? contract : undefined;
}

export function recoveredNormalFreePractice(
  state: RecoveryState,
  anonymousUserId: string,
  fallbackPracticeSessionId: string,
  now: number = Date.now(),
  localTurns: Turn[] = [],
): { scenario: Scenario; session: ActivePracticeSession; turns: Turn[]; difficulty: Difficulty; reaction: ReactionPattern; persona: PersonaVoice } | null {
  if (state.status !== "resume" || !state.sessionId) return null;
  const contract = checkpointContract(state);
  const restored = applyRecovery(state, localTurns);
  if (!contract || !restored.ready || restored.turns.length === 0) return null;
  const scenarioText = text(contract.scenario);
  const counterpart = text(contract.counterpart);
  const goal = text(contract.success_target);
  const context = category(contract.context);
  const route = entryRoute(contract.entry_route);
  if (!scenarioText || !counterpart || !goal || !context || !route) return null;
  const scenarioId = `normal-free-${state.sessionId}`;
  const scenario: Scenario = {
    id: scenarioId,
    category: context,
    title: "Your saved conversation",
    counterpart,
    situation: scenarioText,
    persona: text(contract.counterpart_persona) ?? `Respond as ${counterpart} in this private rehearsal.`,
    goal,
    opensWith: contract.opens_with === "counterpart" ? "counterpart" : "user",
    openingLine: typeof contract.opening_line === "string" ? contract.opening_line : "",
    minutes: 5,
    isCustom: true,
  };
  const selectedDifficulty = difficulty(contract.difficulty);
  const selectedReaction = reaction(contract.reaction_pattern);
  const selectedPersona = personaFromAudioRole(state.audio?.role);
  const session: ActivePracticeSession = {
    schemaVersion: 6,
    id: fallbackPracticeSessionId,
    anonymousUserId,
    scenarioId,
    category: context,
    counterpart,
    topic: scenarioText,
    usefulOutcome: goal,
    expectedReaction: selectedReaction,
    safetyStatus: "cleared",
    moduleVersion: PILOT_PROGRAM.curriculum_version,
    entryRoute: route,
    scenarioSource: "user_supplied",
    scenarioTitle: scenario.title,
    counterpartRelationship: text(contract.context) ?? "Conversation partner",
    counterpartDisplayLabel: counterpart,
    behavioralGoal: goal,
    persona: selectedPersona,
    freeRehearsalTurns: restored.turns,
    freeJourneyCheckpoint: "rehearsal",
    normalFreeContract: contract,
    ...(Number.isSafeInteger(state.checkpoint?.revision) ? { normalFreeCheckpointRevision: state.checkpoint!.revision } : {}),
    ...(typeof state.phase === "string" ? { normalFreeCheckpointPhase: state.phase } : {}),
    pilotRuns: {},
    nextState: "awaiting_onboarding_baseline",
    createdAt: now,
    updatedAt: now,
  };
  return { scenario, session, turns: restored.turns, difficulty: selectedDifficulty, reaction: selectedReaction, persona: selectedPersona };
}
