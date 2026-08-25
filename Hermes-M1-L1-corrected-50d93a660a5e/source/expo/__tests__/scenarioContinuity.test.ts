import { readFileSync } from "node:fs";
import { join } from "node:path";

import { SCENARIOS } from "@/constants/scenarios";
import { scenarioInteraction } from "@/lib/nativeCommerce";
import {
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeScenarioComparison,
  createScenarioPracticeRun,
  normalizeScenarioPracticeRun,
  preserveScenarioAttempt,
  scenarioContinuitySnapshot,
  scenarioRunForRoute,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
} from "@/lib/scenarioPractice";
import type { Difficulty, Scenario } from "@/types/convo";
import type { PilotModuleState } from "@/types/pilotCurriculum";

const STATES: PilotModuleState[] = [
  "ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "ready_for_response",
  "listening_response", "confirm_response_transcript", "hope_coaching", "ready_for_retry",
  "listening_retry", "confirm_retry_transcript", "attempt_comparison", "transfer_cue", "complete",
];

function scenario(id: string): Scenario {
  const found = SCENARIOS.find((item) => item.id === id);
  if (!found) throw new Error(`Missing scenario ${id}`);
  return found;
}

function completedRun(source: Scenario, difficulty: Difficulty, runId: string): PersistedScenarioPracticeRun {
  let value = createScenarioPracticeRun(source, difficulty, "not-sure", runId, 1);
  value = preserveScenarioAttempt(value, "opener", "I want to talk about a concrete next step.", 2);
  value = attachScenarioCounterpartTurn(value, { id: `${runId}-counterpart-turn-1`, text: source.id === "raise" ? "The budget is tight. What number did you have in mind?" : "I already do plenty around here. What exactly do you want me to own?", source: "provider" }, 3);
  value = preserveScenarioAttempt(value, "response", source.id === "raise" ? "I am asking for 12 percent, or a decision date this month." : "Could you own laundry and kitchen cleanup every week?", 4);
  value = attachScenarioCoaching(value, "The request names a concrete next step.", "Keep the ask concrete in the same moment.", "pushback_response", 5);
  value = preserveScenarioAttempt(value, "retry", source.id === "raise" ? "Can we agree on 12 percent or set the decision meeting for August 25?" : "Can you own laundry and kitchen cleanup starting this week?", 6);
  value = completeScenarioComparison(value, 7);
  return value;
}

function expectIdentityAtEveryState(value: PersistedScenarioPracticeRun, expected: Record<string, string>): void {
  STATES.forEach((state, index) => {
    const staged = transitionScenarioPracticeRun(value, state, 20 + index);
    const restored = normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(staged)) as unknown);
    expect(restored).not.toBeNull();
    expect(scenarioContinuitySnapshot(restored as PersistedScenarioPracticeRun)).toMatchObject(expected);
  });
}

describe("scenario continuity state harness", () => {
  test("raise scenario preserves Priya, manager context, difficulty, pressure turn, responses, and restart through every state", () => {
    const value = completedRun(scenario("raise"), "challenging", "raise-run");
    expectIdentityAtEveryState(value, {
      scenarioId: "raise", category: "work", title: "Ask for the raise you've earned",
      situation: "You have taken on scope well beyond your title for a year. Budget season is closing this month.",
      objective: "Name a specific number and get a commitment or a dated next step.", difficulty: "challenging",
      counterpartName: "Priya", counterpartRole: "your manager", counterpartTurnId: "raise-run-counterpart-turn-1",
      counterpartTurnText: "The budget is tight. What number did you have in mind?",
      firstApprovedResponse: "I am asking for 12 percent, or a decision date this month.",
      retryApprovedResponse: "Can we agree on 12 percent or set the decision meeting for August 25?",
    });
    expect(JSON.stringify(value)).not.toMatch(/Sam|Adam|partner|bedtime|Tuesday|Thursday/);
  });

  test("partner scenario preserves Sam, household context, difficulty, pressure turn, responses, and restart through every state", () => {
    const value = completedRun(scenario("chores"), "gentle", "partner-run");
    expectIdentityAtEveryState(value, {
      scenarioId: "chores", category: "partner", title: "Ask for a fair split of the housework",
      objective: "Get a specific, agreed change in who does what — not just an apology.", difficulty: "gentle",
      counterpartName: "Sam", counterpartRole: "your partner of four years", counterpartTurnId: "partner-run-counterpart-turn-1",
      counterpartTurnText: "I already do plenty around here. What exactly do you want me to own?",
      firstApprovedResponse: "Could you own laundry and kitchen cleanup every week?",
      retryApprovedResponse: "Can you own laundry and kitchen cleanup starting this week?",
    });
    expect(JSON.stringify(value)).not.toMatch(/Priya|manager|raise|budget|Adam/);
  });

  test("a user-supplied conversation keeps its supplied identity instead of an authored scenario", () => {
    const custom: Scenario = {
      id: "custom-qa-neighbor", category: "friends", title: "Ask Casey to lower the music",
      counterpart: "Casey — your neighbor", situation: "The music has continued after midnight three times this week.",
      persona: "Casey has previously agreed in the moment without changing the volume the next night.",
      goal: "Agree on quiet hours after 10 PM.", openingLine: "", opensWith: "user", minutes: 5, isCustom: true,
    };
    const value = completedRun(custom, "steady", "custom-run");
    expectIdentityAtEveryState(value, {
      scenarioId: "custom-qa-neighbor", category: "friends", counterpartName: "Casey",
      counterpartRole: "your neighbor", situation: custom.situation, objective: custom.goal, difficulty: "steady",
    });
    expect(JSON.stringify(value)).not.toMatch(/Priya|Sam|Adam|manager|bedtime|raise/);
  });

  test("locked scenario cannot start while Pro scenario can start", () => {
    expect(scenarioInteraction(true, "raise")).toEqual({ isLocked: true, destination: "/paywall?gate=another-rehearsal" });
    expect(scenarioInteraction(false, "raise")).toEqual({ isLocked: false, destination: "/scenario/raise" });
  });

  test("selected difficulty survives persistence and changes the run context", () => {
    const gentle = createScenarioPracticeRun(scenario("raise"), "gentle", "not-sure", "gentle", 1);
    const challenging = createScenarioPracticeRun(scenario("raise"), "challenging", "not-sure", "hard", 1);
    expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(gentle)))?.run.scenarioContext?.difficulty).toBe("gentle");
    expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(challenging)))?.run.scenarioContext?.difficulty).toBe("challenging");
  });

  test("retry and comparison use the exact same counterpart turn and scenario", () => {
    const value = completedRun(scenario("raise"), "steady", "same-turn");
    expect(value.run.adamReactionId).toBe(value.run.counterpartTurn?.id);
    expect(value.run.adamAudioId).toBe(value.run.counterpartTurn?.id);
    expect(value.run.comparison).toBeDefined();
    expect(scenarioContinuitySnapshot(value)).toMatchObject({ scenarioId: "raise", counterpartName: "Priya", counterpartTurnId: "same-turn-counterpart-turn-1" });
  });

  test("missing, mismatched, or malformed scenario runs fail closed", () => {
    const valid = createScenarioPracticeRun(scenario("raise"), "steady", "not-sure", "valid", 1);
    expect(scenarioRunForRoute(valid, "chores")).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, version: 99 })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, scenarioContext: undefined } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, state: "pilot_fixture" } })).toBeNull();
  });

  test("authored context UI does not claim to be the user's current conversation", () => {
    const library = readFileSync(join(process.cwd(), "app/(tabs)/library.tsx"), "utf8");
    const moduleScreen = readFileSync(join(process.cwd(), "app/module/[day].tsx"), "utf8");
    expect(library).toContain("Continue saved authored scenario");
    expect(moduleScreen).toContain("Build from my situation");
    expect(moduleScreen).not.toContain('label="Use my conversation"');
  });
});
