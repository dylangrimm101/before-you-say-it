import { SESSION_SCHEMA_VERSION, type SessionRecord, type SessionScores } from "@/types/privacy";
import type { CategoryId, Debrief, Difficulty, PersonaVoice, ReactionPattern, Turn } from "@/types/convo";

/** How many minimized records are kept on device. */
export const MAX_STORED_SESSIONS = 60;

/** The v1 shape that shipped to testers, retained only so it can be stripped. */
export interface LegacySession {
  id: string;
  scenarioId: string;
  title?: string;
  counterpart?: string;
  category?: CategoryId;
  difficulty?: Difficulty;
  persona?: PersonaVoice;
  reaction?: ReactionPattern;
  outcome?: string;
  turns: Turn[];
  debrief?: Debrief;
  startedAt: number;
  endedAt?: number;
}

export interface MigrationResult {
  records: SessionRecord[];
  /** How many stored records had content bodies removed by this run. */
  removedContentFrom: number;
}

export { SESSION_SCHEMA_VERSION };

/** Scenario the user wrote themselves — its title is their own free text. */
function isUserAuthored(scenarioId: string): boolean {
  return scenarioId.startsWith("custom-");
}

function str(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function num(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function optionalNum(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function clampScore(value: unknown): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return Math.round(Math.min(100, Math.max(0, n)));
}

function readScores(raw: unknown): SessionScores | undefined {
  if (raw === null || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const keys = ["clarity", "empathy", "assertiveness", "composure"] as const;
  if (!keys.every((k) => typeof o[k] === "number")) return undefined;
  return {
    clarity: clampScore(o.clarity),
    empathy: clampScore(o.empathy),
    assertiveness: clampScore(o.assertiveness),
    composure: clampScore(o.composure),
  };
}

function readStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string");
}

/**
 * True when this stored entry still carries content that must be removed.
 *
 * `script` is intentionally not content: it is retained by design (see
 * `SessionRecord.script`), so its presence must not mark a record as needing
 * migration or trigger the "we removed your data" notice.
 */
function carriesContent(o: Record<string, unknown>): boolean {
  if (Array.isArray(o.turns) && o.turns.length > 0) return true;
  if (o.debrief !== undefined && o.debrief !== null) return true;
  if (typeof o.outcome === "string" && o.outcome.length > 0) return true;
  return false;
}

/** Cap kept script lines so a runaway generation cannot bloat storage. */
function readScript(raw: unknown): string[] | undefined {
  const lines = readStringArray(raw)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 8);
  return lines.length > 0 ? lines : undefined;
}

/**
 * Reduce one stored entry to a minimized record. Returns null when the entry
 * is too malformed to be worth keeping.
 */
function toRecord(raw: unknown, preserveCustomScenarioText: boolean): SessionRecord | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;

  const id = str(o.id);
  if (!id) return null;
  const scenarioId = str(o.scenarioId) ?? "unknown";

  // Already minimized — canonicalize it again so old v2 custom labels cannot
  // bypass the current consent-safe shape during migration/recovery.
  if (o.schemaVersion === SESSION_SCHEMA_VERSION && !carriesContent(o)) {
    const userAuthored = isUserAuthored(scenarioId) && !preserveCustomScenarioText;
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id,
      scenarioId,
      title: userAuthored ? undefined : str(o.title),
      counterpart: userAuthored ? undefined : str(o.counterpart),
      category: (str(o.category) as CategoryId | undefined) ?? "partner",
      difficulty: (str(o.difficulty) as Difficulty | undefined) ?? "steady",
      persona: str(o.persona) as PersonaVoice | undefined,
      reaction: str(o.reaction) as ReactionPattern | undefined,
      scores: readScores(o.scores),
      script: readScript(o.script),
      skillIds: readStringArray(o.skillIds),
      turnCount: num(o.turnCount, 0),
      userTurnCount: num(o.userTurnCount, 0),
      retryCount: num(o.retryCount, 0),
      completed: o.completed === true,
      savedSummary: str(o.savedSummary),
      hasKeptAudio: o.hasKeptAudio === true ? true : undefined,
      startedAt: num(o.startedAt, 0),
      endedAt: optionalNum(o.endedAt),
      contentRetained: false,
    };
  }

  const turns = Array.isArray(o.turns) ? o.turns : [];
  const userTurnCount = turns.filter(
    (t) => t !== null && typeof t === "object" && (t as { role?: unknown }).role === "user",
  ).length;

  const debrief =
    o.debrief !== null && typeof o.debrief === "object"
      ? (o.debrief as Record<string, unknown>)
      : null;
  const scores = debrief ? readScores(debrief.scores) : readScores(o.scores);
  // Lift the script out of a legacy debrief body so upgrading users keep the
  // scripts they were already shown, rather than silently losing them.
  const script = readScript(o.script) ?? (debrief ? readScript(debrief.script) : undefined);
  const userAuthored = isUserAuthored(scenarioId) && !preserveCustomScenarioText;

  return {
    schemaVersion: SESSION_SCHEMA_VERSION,
    id,
    scenarioId,
    // Titles of user-written scenarios come from their own words — drop them.
    title: userAuthored ? undefined : str(o.title),
    counterpart: userAuthored ? undefined : str(o.counterpart),
    category: (str(o.category) as CategoryId | undefined) ?? "partner",
    difficulty: (str(o.difficulty) as Difficulty | undefined) ?? "steady",
    persona: str(o.persona) as PersonaVoice | undefined,
    reaction: str(o.reaction) as ReactionPattern | undefined,
    scores,
    script,
    skillIds: readStringArray(o.skillIds),
    turnCount: turns.length,
    userTurnCount,
    retryCount: num(o.retryCount, 0),
    completed: debrief !== null || o.completed === true,
    savedSummary: undefined,
    hasKeptAudio: undefined,
    startedAt: num(o.startedAt, 0),
    endedAt: optionalNum(o.endedAt),
    contentRetained: false,
  };
}

/**
 * One-way migration from whatever is on disk to minimized records.
 *
 * Removes: turn text, coach nudges, debrief headline/wins/flags/quotes/
 * reframes/nextRep, and the user's desired-outcome text.
 *
 * Preserves: id, scenarioId, authored labels, category, difficulty, persona,
 * reaction, the four scores, turn counts, completion state, timestamps —
 * everything streaks, averages, history and progress read — plus the
 * real-conversation script, which is retained by design.
 *
 * Fails safe: unparseable input yields an empty list rather than throwing.
 */
export function migrateSessions(raw: unknown, options: { preserveCustomScenarioText?: boolean } = {}): MigrationResult {
  let value: unknown = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return { records: [], removedContentFrom: 0 };
    }
  }
  if (!Array.isArray(value)) return { records: [], removedContentFrom: 0 };

  let removedContentFrom = 0;
  const records: SessionRecord[] = [];
  value.forEach((entry) => {
    const record = toRecord(entry, options.preserveCustomScenarioText === true);
    if (!record) return;
    if (entry !== null && typeof entry === "object" && carriesContent(entry as Record<string, unknown>)) {
      removedContentFrom += 1;
    }
    records.push(record);
  });

  return { records: records.slice(0, MAX_STORED_SESSIONS), removedContentFrom };
}

/** Trim a live list to the storage cap, newest first. */
export function capRecords(records: SessionRecord[]): SessionRecord[] {
  return records.slice(0, MAX_STORED_SESSIONS);
}
