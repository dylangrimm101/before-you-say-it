import { beforeEach, describe, expect, test } from "bun:test";

import {
  ACTIVE_SCENARIO_RUN_KEY,
  activeRunRevision,
  archiveActiveScenarioRunCAS,
  clearActiveScenarioRunCAS,
  replaceActiveScenarioRunCAS,
  resetActiveRunQueueForTests,
  type ActiveRunStorage,
} from "@/lib/activeScenarioRunRepository";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
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
