import { describe, expect, test } from "bun:test";

import {
  ACTIVE_EXPERIMENTS,
  assignExperiment,
  markExposureOnce,
  resolveStickyAssignment,
  type ExperimentDefinition,
  type ExperimentStorage,
} from "@/lib/experiments";

class MemoryStorage implements ExperimentStorage {
  constructor(readonly values = new Map<string, string>()) {}
  async getItem(key: string): Promise<string | null> { return this.values.get(key) ?? null; }
  async setItem(key: string, value: string): Promise<void> { this.values.set(key, value); }
}

const active: ExperimentDefinition = {
  experimentKey: "onboarding_first_value_v1",
  assignmentVersion: "1",
  status: "active",
  trafficAllocationBasisPoints: 10_000,
  variants: [
    { variantKey: "control", weight: 1 },
    { variantKey: "spoken_value_first", weight: 1 },
  ],
};

describe("privacy-safe experiment foundation", () => {
  test("ships with no active experiment or behavior change", () => {
    expect(ACTIVE_EXPERIMENTS).toEqual([]);
  });

  test("assigns the same subject deterministically and excludes internal traffic", () => {
    const first = assignExperiment(active, "anon-install-123", "2026-09-05T12:00:00.000Z");
    const second = assignExperiment(active, "anon-install-123", "2026-09-06T12:00:00.000Z");
    expect(first?.variant_key).toBe(second?.variant_key);
    expect(assignExperiment(active, "anon-install-123", "2026-09-05T12:00:00.000Z", { exclude: true })).toBeNull();
    expect(assignExperiment({ ...active, status: "draft" }, "anon-install-123", "2026-09-05T12:00:00.000Z")).toBeNull();
  });

  test("keeps an assignment sticky across restarts and reassigns only on version change", async () => {
    const storage = new MemoryStorage();
    const first = await resolveStickyAssignment(storage, active, "anon-install-123", "2026-09-05T12:00:00.000Z");
    const second = await resolveStickyAssignment(storage, active, "anon-install-123", "2026-09-06T12:00:00.000Z");
    const nextVersion = await resolveStickyAssignment(storage, { ...active, assignmentVersion: "2" }, "anon-install-123", "2026-09-07T12:00:00.000Z");
    expect(second).toEqual(first);
    expect(nextVersion?.assignment_version).toBe("2");
  });

  test("records one exposure per assignment without storing the subject identifier", async () => {
    const storage = new MemoryStorage();
    const assignment = assignExperiment(active, "anon-install-123", "2026-09-05T12:00:00.000Z")!;
    expect(await markExposureOnce(storage, assignment, "2026-09-05T12:01:00.000Z")).toBe(true);
    expect(await markExposureOnce(storage, assignment, "2026-09-05T12:02:00.000Z")).toBe(false);
    const persisted = [...storage.values.values()].join("\n");
    expect(persisted).not.toContain("anon-install-123");
  });

  test("serializes concurrent assignment and exposure writes", async () => {
    const storage = new MemoryStorage();
    const secondDefinition: ExperimentDefinition = { ...active, experimentKey: "onboarding_copy_v1" };
    const [first, second] = await Promise.all([
      resolveStickyAssignment(storage, active, "anon-install-123", "2026-09-05T12:00:00.000Z"),
      resolveStickyAssignment(storage, secondDefinition, "anon-install-123", "2026-09-05T12:00:00.000Z"),
    ]);
    const assignmentBytes = [...storage.values.values()].join("\n");
    expect(assignmentBytes).toContain("onboarding_first_value_v1");
    expect(assignmentBytes).toContain("onboarding_copy_v1");
    const exposureResults = await Promise.all([
      markExposureOnce(storage, first!, "2026-09-05T12:01:00.000Z"),
      markExposureOnce(storage, first!, "2026-09-05T12:01:01.000Z"),
    ]);
    expect(exposureResults.sort()).toEqual([false, true]);
    expect(second).not.toBeNull();
  });

  test("serializes separate adapters that share one local backing store", async () => {
    const values = new Map<string, string>();
    const firstStorage = new MemoryStorage(values);
    const secondStorage = new MemoryStorage(values);
    const secondDefinition: ExperimentDefinition = { ...active, experimentKey: "onboarding_copy_v1" };
    const [first] = await Promise.all([
      resolveStickyAssignment(firstStorage, active, "anon-install-123", "2026-09-05T12:00:00.000Z"),
      resolveStickyAssignment(secondStorage, secondDefinition, "anon-install-123", "2026-09-05T12:00:00.000Z"),
    ]);
    const assignmentBytes = [...values.values()].join("\n");
    expect(assignmentBytes).toContain("onboarding_first_value_v1");
    expect(assignmentBytes).toContain("onboarding_copy_v1");
    const exposureResults = await Promise.all([
      markExposureOnce(firstStorage, first!, "2026-09-05T12:01:00.000Z"),
      markExposureOnce(secondStorage, first!, "2026-09-05T12:01:01.000Z"),
    ]);
    expect(exposureResults.sort()).toEqual([false, true]);
  });

  test("fails closed on a corrupt or full exposure ledger", async () => {
    const assignment = assignExperiment(active, "anon-install-123", "2026-09-05T12:00:00.000Z")!;
    const corrupt = new MemoryStorage(new Map([["cc.experimentExposures.v1", "not-json"]]));
    await expect(markExposureOnce(corrupt, assignment, "2026-09-05T12:01:00.000Z")).rejects.toThrow();
    const emptyCorrupt = new MemoryStorage(new Map([["cc.experimentExposures.v1", ""]]));
    await expect(markExposureOnce(emptyCorrupt, assignment, "2026-09-05T12:01:00.000Z")).rejects.toThrow();

    const full = Array.from({ length: 256 }, (_, index) => ({
      experiment_key: `experiment_${index}`,
      variant_key: "control",
      assignment_version: "1",
      exposed_at: "2026-09-05T12:00:00.000Z",
    }));
    const saturated = new MemoryStorage(new Map([["cc.experimentExposures.v1", JSON.stringify(full)]]));
    await expect(markExposureOnce(saturated, assignment, "2026-09-05T12:01:00.000Z")).rejects.toThrow();
  });

  test("removes unknown properties from an existing exposure ledger", async () => {
    const assignment = assignExperiment(active, "anon-install-123", "2026-09-05T12:00:00.000Z")!;
    const exposureKey = "cc.experimentExposures.v1";
    const storage = new MemoryStorage(new Map([[exposureKey, JSON.stringify([{
      experiment_key: assignment.experiment_key,
      variant_key: assignment.variant_key,
      assignment_version: assignment.assignment_version,
      exposed_at: "2026-09-05T12:01:00.000Z",
      email: "user@example.com",
      transcript: "private",
    }])]]));
    expect(await markExposureOnce(storage, assignment, "2026-09-05T12:02:00.000Z")).toBe(false);
    expect(await storage.getItem(exposureKey)).not.toContain("user@example.com");
  });

  test("honors traffic boundaries and weighted variants", () => {
    expect(assignExperiment({ ...active, trafficAllocationBasisPoints: 0 }, "anon", "2026-09-05T12:00:00.000Z")).toBeNull();
    const weighted = { ...active, variants: [{ variantKey: "control", weight: 1 }, { variantKey: "challenger", weight: 3 }] };
    const variants = new Set(Array.from({ length: 200 }, (_, index) =>
      assignExperiment(weighted, `anon-${index}`, "2026-09-05T12:00:00.000Z")?.variant_key,
    ));
    expect(variants).toEqual(new Set(["control", "challenger"]));
  });

  test("strips unknown persisted properties and enforces canonical timestamps", async () => {
    const assignmentKey = "cc.experimentAssignments.v1";
    const storage = new MemoryStorage(new Map([[assignmentKey, JSON.stringify([{
      experiment_key: active.experimentKey,
      variant_key: "control",
      assignment_version: "1",
      assigned_at: "2026-09-05T12:00:00.000Z",
      email: "user@example.com",
      transcript: "private",
    }])]]));
    const assignment = await resolveStickyAssignment(storage, active, "anon-install-123", "2026-09-05T12:00:00.000Z");
    expect(assignment).toEqual({
      experiment_key: active.experimentKey,
      variant_key: "control",
      assignment_version: "1",
      assigned_at: "2026-09-05T12:00:00.000Z",
    });
    expect(await storage.getItem(assignmentKey)).not.toContain("user@example.com");
    expect(() => assignExperiment(active, "anon", "2026-02-30")).toThrow();
    expect(() => assignExperiment(active, "anon", "0")).toThrow();
    const emptyCorrupt = new MemoryStorage(new Map([[assignmentKey, ""]]));
    await expect(resolveStickyAssignment(emptyCorrupt, active, "anon", "2026-09-05T12:00:00.000Z")).rejects.toThrow();
  });

  test("rejects malformed definitions instead of silently assigning", () => {
    expect(() => assignExperiment({ ...active, trafficAllocationBasisPoints: 10_001 }, "anon", "2026-09-05T12:00:00.000Z")).toThrow();
    expect(() => assignExperiment({ ...active, variants: [{ variantKey: "control", weight: 0 }] }, "anon", "2026-09-05T12:00:00.000Z")).toThrow();
    expect(() => assignExperiment({ ...active, variants: [{ variantKey: "contains space", weight: 1 }] }, "anon", "2026-09-05T12:00:00.000Z")).toThrow();
  });
});
