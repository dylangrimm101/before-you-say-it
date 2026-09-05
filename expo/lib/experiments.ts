import type { ExperimentAssignmentV1 } from "@/types/sharedProduct";

export interface ExperimentStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ExperimentVariant {
  variantKey: string;
  weight: number;
}

export interface ExperimentDefinition {
  experimentKey: string;
  assignmentVersion: string;
  status: "draft" | "active" | "paused";
  trafficAllocationBasisPoints: number;
  variants: readonly ExperimentVariant[];
}

export interface AssignmentOptions {
  exclude?: boolean;
}

interface ExposureRecord {
  experiment_key: string;
  variant_key: string;
  assignment_version: string;
  exposed_at: string;
}

const ASSIGNMENTS_KEY = "cc.experimentAssignments.v1";
const EXPOSURES_KEY = "cc.experimentExposures.v1";
const SAFE_KEY = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const MAX_ASSIGNMENTS = 32;
const MAX_EXPOSURES = 256;
const storageQueues = new Map<string, Promise<void>>();

/** No experiment is activated until its variants, metric, privacy, and stop rule are approved. */
export const ACTIVE_EXPERIMENTS: readonly ExperimentDefinition[] = [];

async function withStorageLock<T>(storage: ExperimentStorage, key: string, work: () => Promise<T>): Promise<T> {
  void storage;
  const previous = storageQueues.get(key) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.catch(() => {}).then(() => gate);
  storageQueues.set(key, queued);
  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
    if (storageQueues.get(key) === queued) storageQueues.delete(key);
  }
}

function assertDefinition(definition: ExperimentDefinition): void {
  if (!SAFE_KEY.test(definition.experimentKey)) throw new Error("Experiment key is invalid");
  if (!SAFE_KEY.test(definition.assignmentVersion)) throw new Error("Assignment version is invalid");
  if (!Number.isInteger(definition.trafficAllocationBasisPoints)
    || definition.trafficAllocationBasisPoints < 0
    || definition.trafficAllocationBasisPoints > 10_000) {
    throw new Error("Experiment traffic allocation is invalid");
  }
  if (definition.variants.length < 2 || definition.variants.length > 8) {
    throw new Error("Experiment must define between two and eight variants");
  }
  const keys = new Set<string>();
  definition.variants.forEach((variant) => {
    if (!SAFE_KEY.test(variant.variantKey) || keys.has(variant.variantKey)) throw new Error("Experiment variant key is invalid");
    if (!Number.isInteger(variant.weight) || variant.weight <= 0 || variant.weight > 10_000) throw new Error("Experiment variant weight is invalid");
    keys.add(variant.variantKey);
  });
}

function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193);
  }
  return result >>> 0;
}

function validTimestamp(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return false;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function isAssignment(value: unknown): value is ExperimentAssignmentV1 {
  if (!value || typeof value !== "object") return false;
  const assignment = value as Partial<ExperimentAssignmentV1>;
  return typeof assignment.experiment_key === "string"
    && SAFE_KEY.test(assignment.experiment_key)
    && typeof assignment.variant_key === "string"
    && SAFE_KEY.test(assignment.variant_key)
    && typeof assignment.assignment_version === "string"
    && SAFE_KEY.test(assignment.assignment_version)
    && typeof assignment.assigned_at === "string"
    && validTimestamp(assignment.assigned_at);
}

function parseAssignments(raw: string | null): ExperimentAssignmentV1[] {
  if (raw === null) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || value.length > MAX_ASSIGNMENTS || !value.every(isAssignment)) {
      throw new Error("Stored experiment assignments are invalid");
    }
    return value.map((assignment) => ({
      experiment_key: assignment.experiment_key,
      variant_key: assignment.variant_key,
      assignment_version: assignment.assignment_version,
      assigned_at: assignment.assigned_at,
    }));
  } catch {
    throw new Error("Stored experiment assignments are invalid");
  }
}

function isExposure(value: unknown): value is ExposureRecord {
  if (!value || typeof value !== "object") return false;
  const exposure = value as Partial<ExposureRecord>;
  return typeof exposure.experiment_key === "string" && SAFE_KEY.test(exposure.experiment_key)
    && typeof exposure.variant_key === "string" && SAFE_KEY.test(exposure.variant_key)
    && typeof exposure.assignment_version === "string" && SAFE_KEY.test(exposure.assignment_version)
    && typeof exposure.exposed_at === "string" && validTimestamp(exposure.exposed_at);
}

function parseExposures(raw: string | null): ExposureRecord[] {
  if (raw === null) return [];
  try {
    const value = JSON.parse(raw) as unknown;
    if (!Array.isArray(value) || value.length > MAX_EXPOSURES || !value.every(isExposure)) {
      throw new Error("Stored experiment exposures are invalid");
    }
    return value.map((exposure) => ({
      experiment_key: exposure.experiment_key,
      variant_key: exposure.variant_key,
      assignment_version: exposure.assignment_version,
      exposed_at: exposure.exposed_at,
    }));
  } catch {
    throw new Error("Stored experiment exposures are invalid");
  }
}

function assignmentMatchesDefinition(assignment: ExperimentAssignmentV1, definition: ExperimentDefinition): boolean {
  return assignment.experiment_key === definition.experimentKey
    && assignment.assignment_version === definition.assignmentVersion
    && definition.variants.some((variant) => variant.variantKey === assignment.variant_key);
}

export function assignExperiment(
  definition: ExperimentDefinition,
  subjectId: string,
  assignedAt: string,
  options: AssignmentOptions = {},
): ExperimentAssignmentV1 | null {
  assertDefinition(definition);
  if (definition.status !== "active" || options.exclude || !subjectId.trim()) return null;
  if (!validTimestamp(assignedAt)) throw new Error("Assignment timestamp is invalid");
  const allocationBucket = hash(`${definition.experimentKey}:${definition.assignmentVersion}:${subjectId}:allocation`) % 10_000;
  if (allocationBucket >= definition.trafficAllocationBasisPoints) return null;

  const totalWeight = definition.variants.reduce((sum, variant) => sum + variant.weight, 0);
  const variantBucket = hash(`${definition.experimentKey}:${definition.assignmentVersion}:${subjectId}:variant`) % totalWeight;
  let cursor = 0;
  const selected = definition.variants.find((variant) => {
    cursor += variant.weight;
    return variantBucket < cursor;
  })!;
  return {
    experiment_key: definition.experimentKey,
    variant_key: selected.variantKey,
    assignment_version: definition.assignmentVersion,
    assigned_at: assignedAt,
  };
}

export async function resolveStickyAssignment(
  storage: ExperimentStorage,
  definition: ExperimentDefinition,
  subjectId: string,
  assignedAt: string,
  options: AssignmentOptions = {},
): Promise<ExperimentAssignmentV1 | null> {
  assertDefinition(definition);
  if (definition.status !== "active" || options.exclude || !subjectId.trim()) return null;
  return withStorageLock(storage, ASSIGNMENTS_KEY, async () => {
    const raw = await storage.getItem(ASSIGNMENTS_KEY);
    const assignments = parseAssignments(raw);
    const canonical = JSON.stringify(assignments);
    if (raw !== null && raw !== canonical) await storage.setItem(ASSIGNMENTS_KEY, canonical);
    const existing = assignments.find((assignment) => assignmentMatchesDefinition(assignment, definition));
    if (existing) return existing;
    const assigned = assignExperiment(definition, subjectId, assignedAt, options);
    if (!assigned) return null;
    if (assignments.length >= MAX_ASSIGNMENTS) throw new Error("Experiment assignment ledger is full");
    const next = [assigned, ...assignments.filter((assignment) => assignment.experiment_key !== definition.experimentKey)];
    await storage.setItem(ASSIGNMENTS_KEY, JSON.stringify(next));
    return assigned;
  });
}

/** Records only coded experiment metadata; the assignment subject is never persisted here. */
export async function markExposureOnce(
  storage: ExperimentStorage,
  assignment: ExperimentAssignmentV1,
  exposedAt: string,
): Promise<boolean> {
  if (!isAssignment(assignment) || !validTimestamp(exposedAt)) throw new Error("Experiment exposure is invalid");
  return withStorageLock(storage, EXPOSURES_KEY, async () => {
    const raw = await storage.getItem(EXPOSURES_KEY);
    const exposures = parseExposures(raw);
    const canonical = JSON.stringify(exposures);
    if (raw !== null && raw !== canonical) await storage.setItem(EXPOSURES_KEY, canonical);
    const exists = exposures.some((exposure) =>
      exposure.experiment_key === assignment.experiment_key
      && exposure.variant_key === assignment.variant_key
      && exposure.assignment_version === assignment.assignment_version,
    );
    if (exists) return false;
    if (exposures.length >= MAX_EXPOSURES) throw new Error("Experiment exposure ledger is full");
    const next: ExposureRecord[] = [{
      experiment_key: assignment.experiment_key,
      variant_key: assignment.variant_key,
      assignment_version: assignment.assignment_version,
      exposed_at: exposedAt,
    }, ...exposures];
    await storage.setItem(EXPOSURES_KEY, JSON.stringify(next));
    return true;
  });
}
