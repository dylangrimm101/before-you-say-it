import { beforeEach, describe, expect, test } from "bun:test";

import {
  ACTIVE_SCENARIO_RUN_KEY,
  QUARANTINED_SCENARIO_RUN_KEY,
  activeRunRevision,
  archiveActiveScenarioRunCAS,
  clearActiveScenarioRunCAS,
  readActiveScenarioRunStrict,
  replaceActiveScenarioRunCAS,
  resetActiveRunQueueForTests,
  type ActiveRunStorage,
} from "@/lib/activeScenarioRunRepository";
import { createScenarioPracticeRun, initializeApprovedRehearsalRun } from "@/lib/scenarioPractice";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import type { Scenario } from "@/types/convo";

class MemoryActiveStorage implements ActiveRunStorage {
  values = new Map<string, string>();
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
  async removeItem(key: string): Promise<void> { this.values.delete(key); }
}

const scenario: Scenario = {
  id: "race", category: "work", title: "Race fixture", counterpart: "Priya — manager",
  situation: "A persisted race fixture.", persona: "Direct", goal: "Keep identity", openingLine: "", opensWith: "user",
};

beforeEach(() => resetActiveRunQueueForTests());

describe("active scenario compare-and-swap repository", () => {
  test("rejects an interleaved stale replacement", async () => {
    const storage = new MemoryActiveStorage();
    const initial = createScenarioPracticeRun(scenario, "steady", "defensive", "run-a", 1);
    await replaceActiveScenarioRunCAS(storage, initial, null);
    const expected = activeRunRevision(initial)!;
    const first = { ...initial, run: { ...initial.run, state: "listening_attempt" as const, updatedAt: 2 } };
    const second = { ...initial, run: { ...initial.run, state: "confirm_attempt_transcript" as const, updatedAt: 3 } };
    const results = await Promise.allSettled([
      replaceActiveScenarioRunCAS(storage, first, expected),
      replaceActiveScenarioRunCAS(storage, second, expected),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
  });

  test("strict cleanup failure leaves the active run durable", async () => {
    const storage = new MemoryActiveStorage();
    const initial = createScenarioPracticeRun(scenario, "steady", "defensive", "run-private", 1);
    await replaceActiveScenarioRunCAS(storage, initial, null);
    await expect(clearActiveScenarioRunCAS(storage, activeRunRevision(initial)!, async () => {
      throw new Error("audio deletion failed");
    })).rejects.toThrow("audio deletion failed");
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(true);
  });

  test("a newer cross-practice run defeats interleaved stale replace, clear, and archive", async () => {
    const storage = new MemoryActiveStorage();
    const oldRun = createScenarioPracticeRun(scenario, "steady", "defensive", "run-old", 1);
    await replaceActiveScenarioRunCAS(storage, oldRun, null);
    const oldRevision = activeRunRevision(oldRun)!;
    const newer = createScenarioPracticeRun({ ...scenario, id: "other-practice" }, "steady", "defensive", "run-new", 10);
    await clearActiveScenarioRunCAS(storage, oldRevision);
    await replaceActiveScenarioRunCAS(storage, newer, null);
    const staleUpdate = { ...oldRun, run: { ...oldRun.run, state: "listening_attempt" as const, updatedAt: 2 } };
    const results = await Promise.allSettled([
      replaceActiveScenarioRunCAS(storage, staleUpdate, oldRevision),
      clearActiveScenarioRunCAS(storage, oldRevision),
      archiveActiveScenarioRunCAS(storage, oldRevision),
    ]);
    expect(results.every((result) => result.status === "rejected")).toBe(true);
    expect((await readActiveScenarioRunStrict(storage))?.run.id).toBe("run-new");
  });

  test("malformed JSON is quarantined rather than treated as an empty writable slot", async () => {
    const storage = new MemoryActiveStorage();
    storage.values.set(ACTIVE_SCENARIO_RUN_KEY, "{bad json");
    await expect(readActiveScenarioRunStrict(storage)).rejects.toThrow("quarantined");
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(QUARANTINED_SCENARIO_RUN_KEY)).toBe(true);
  });

  test("quarantines provider-labelled canned pressure in an active shared-lesson run", async () => {
    const storage = new MemoryActiveStorage();
    const config = approvedRehearsalConfig("m2-l5")!;
    const id = "canned-active";
    const created = initializeApprovedRehearsalRun(createScenarioPracticeRun(config.scenario, "steady", "defensive", id, 1), 1);
    const canned = { id: `${id}-counterpart-turn-1`, text: `W\u200Bhat counts as at risk?`, source: "provider" as const, reactionId: "m2-l5-dynamic-pressure-1", semanticVoiceKey: "contextual_counterpart" as const, resolvedAudioId: `${created.run.curriculumVersion}-${id}-counterpart-turn-1`, authoredAt: 3 };
    storage.values.set(ACTIVE_SCENARIO_RUN_KEY, JSON.stringify({ ...created, run: {
      ...created.run, convertedModuleId: config.moduleId, practiceId: config.practiceId, contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId, scenarioContext: { ...created.run.scenarioContext!, counterpartId: config.counterpartId },
      attempt: { id: `${id}-opener`, kind: "opener", transcript: "Can you own the signup?", representation: "confirmed_transcript", confirmedAt: 2 },
      counterpartTurn: canned, approvedRehearsal: { beat: 2, retryCount: 0, pushbackOne: canned }, updatedAt: 3,
    } }));
    await expect(readActiveScenarioRunStrict(storage)).rejects.toThrow("quarantined");
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(QUARANTINED_SCENARIO_RUN_KEY)).toBe(true);
  });

  test("quarantines approved-lesson state with an unknown scenario identity before pressure", async () => {
    const storage = new MemoryActiveStorage();
    const config = approvedRehearsalConfig("m2-l1")!;
    const id = "unknown-scenario-active";
    const created = initializeApprovedRehearsalRun(createScenarioPracticeRun(config.scenario, "steady", "defensive", id, 1), 1);
    storage.values.set(ACTIVE_SCENARIO_RUN_KEY, JSON.stringify({ ...created, run: {
      ...created.run,
      convertedModuleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId,
      scenarioContext: {
        ...created.run.scenarioContext!,
        scenarioId: "mars-scene",
        situation: "The spaceship leaves Mars tomorrow.",
        counterpartId: config.counterpartId,
      },
    } }));
    await expect(readActiveScenarioRunStrict(storage)).rejects.toThrow("quarantined");
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(false);
    expect(storage.values.has(QUARANTINED_SCENARIO_RUN_KEY)).toBe(true);
  });

  test("clear and archive reject a cross-practice expected identity", async () => {
    const storage = new MemoryActiveStorage();
    const initial = createScenarioPracticeRun(scenario, "steady", "defensive", "run-current", 1);
    await replaceActiveScenarioRunCAS(storage, initial, null);
    const wrong = { runId: "run-other", updatedAt: 1 };
    await expect(clearActiveScenarioRunCAS(storage, wrong)).rejects.toThrow("revision changed");
    await expect(archiveActiveScenarioRunCAS(storage, wrong)).rejects.toThrow("revision changed");
    expect(storage.values.has(ACTIVE_SCENARIO_RUN_KEY)).toBe(true);
  });
});
