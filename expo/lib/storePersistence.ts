import type { ChallengeLogEntry, DrillResult, FreezeState, Profile, Scenario } from "@/types/convo";
import { CHALLENGE_TOTAL_DAYS } from "@/constants/challenge";

export interface StoreStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

/** One queue per storage instance, including deletion/privacy barriers. Rejection
 * reaches the caller but never poisons subsequent operations. No private snapshots
 * are kept by the queue after an operation settles. */
const tails = new WeakMap<StoreStorage, Promise<unknown>>();
export function serializeStoreOperation<T>(storage: StoreStorage, operation: () => Promise<T>): Promise<T> {
  const result = (tails.get(storage) ?? Promise.resolve()).then(operation);
  tails.set(storage, result.then(() => undefined, () => undefined));
  return result;
}

export async function readStoreArray<T>(storage: StoreStorage, key: string): Promise<T[]> {
  const raw = await storage.getItem(key);
  if (raw === null) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error(`Invalid stored array: ${key}`);
  return parsed as T[];
}

/** Call within serializeStoreOperation when grouping multiple keys/cleanup. */
export async function commitStoreArray<T>(storage: StoreStorage, key: string, update: (previous: T[]) => T[], publish: (next: T[]) => void): Promise<void> {
  const previous = await readStoreArray<T>(storage, key);
  const next = update(previous);
  if (next !== previous) await storage.setItem(key, JSON.stringify(next));
  publish(next);
}


function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);

export function normalizeStoredDrills(value: unknown): DrillResult[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is DrillResult => object(v) && typeof v.drillId === "string" && date(v.date) && finite(v.score) && v.score >= 0 && v.score <= 100 && finite(v.completedAt));
}
export function normalizeStoredChallenge(value: unknown): ChallengeLogEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is ChallengeLogEntry => object(v) && finite(v.day) && Number.isInteger(v.day) && v.day >= 1 && v.day <= CHALLENGE_TOTAL_DAYS && date(v.date) && finite(v.completedAt));
}
export function normalizeStoredFreeze(value: unknown): FreezeState | null {
  if (!object(value) || !finite(value.available) || !Number.isInteger(value.available) || value.available < 0 || value.available > 2
    || !Array.isArray(value.usedDates) || !value.usedDates.every(date)
    || !finite(value.lastMilestone) || !Number.isInteger(value.lastMilestone) || value.lastMilestone < 0) return null;
  return { available: value.available, usedDates: value.usedDates.slice(-60), lastMilestone: value.lastMilestone };
}
export function normalizeStoredProfile(value: unknown): Profile | null {
  if (!object(value) || !["partner", "family", "work", "friends"].includes(String(value.focus))
    || !["freeze", "apologize", "sharpen", "avoid"].includes(String(value.pattern))
    || !["heard", "boundary", "calm", "yes"].includes(String(value.win))
    || !["woman-hope", "man-adam"].includes(String(value.persona))
    || !["defensive", "hears-criticism", "minimizes", "quiet", "louder", "turns-back", "agrees-without-changing", "not-sure"].includes(String(value.reaction))
    || !finite(value.createdAt)) return null;
  // Whitelist only coarse fields: malformed hydration never creates a private backup.
  return { focus: value.focus, pattern: value.pattern, win: value.win, persona: value.persona, reaction: value.reaction, createdAt: value.createdAt } as Profile;
}
export function normalizeStoredCustomScenarios(value: unknown): Scenario[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is Scenario => object(v) && ["partner", "family", "work", "friends"].includes(String(v.category))
    && ["id", "title", "counterpart", "situation", "persona", "goal", "openingLine"].every((key) => typeof v[key] === "string"));
}
