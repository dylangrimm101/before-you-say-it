import type { CategoryId, Difficulty, PersonaVoice, ReactionPattern } from "@/types/convo";

/** Bumped whenever the persisted session shape changes. */
export const SESSION_SCHEMA_VERSION = 2 as const;

export interface SessionScores {
  clarity: number;
  empathy: number;
  assertiveness: number;
  composure: number;
}

/**
 * The minimized session record that is actually persisted. It carries enough
 * to keep streaks, averages, history and completion working, and nothing a
 * person said, wrote, or recorded.
 *
 * Deliberately absent: turns, transcripts, debrief prose, quotes, and the
 * user's desired-outcome text.
 *
 * The one exception is `script` — see the field for why.
 */
export interface SessionRecord {
  schemaVersion: typeof SESSION_SCHEMA_VERSION;
  id: string;
  scenarioId: string;
  /**
   * Authored scenario title. Omitted for user-written scenarios, where the
   * title is derived from their own free text.
   */
  title?: string;
  /** Authored counterpart label. Omitted for user-written scenarios. */
  counterpart?: string;
  category: CategoryId;
  difficulty: Difficulty;
  persona?: PersonaVoice;
  reaction?: ReactionPattern;
  /** Behavior-level result only — four 0-100 numbers, no excerpts. */
  scores?: SessionScores;
  /** Curriculum skills practiced. Populated from Phase 1 onward. */
  skillIds: string[];
  turnCount: number;
  userTurnCount: number;
  retryCount: number;
  completed: boolean;
  /**
   * The suggested opening lines for the real conversation.
   *
   * This is the single piece of generated prose that is kept on the device, and
   * it is kept on purpose: it is the thing people came for, and it is useless if
   * it evaporates before the conversation actually happens. It is model-written
   * suggestion text — not a transcript, not a quote of anything either person
   * said, and not an excerpt of the rehearsal. Deleting the session deletes it.
   */
  script?: string[];
  /** Only ever set when the user explicitly writes and saves their own note. */
  savedSummary?: string;
  /** True only when the user opted in to keep the recording on this device. */
  hasKeptAudio?: boolean;
  startedAt: number;
  endedAt?: number;
  /**
   * False once the transcript and debrief prose have been dropped. Historical
   * records are always false; a live record is never persisted as true.
   */
  contentRetained: boolean;
}
