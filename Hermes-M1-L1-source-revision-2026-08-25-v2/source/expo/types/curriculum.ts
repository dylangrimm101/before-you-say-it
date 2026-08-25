import type { CategoryId, Difficulty } from "@/types/convo";

/**
 * The behaviours the program actually trains. These are the units a day
 * targets, a debrief scores, and a later phase will use to pick the one
 * focused note a rehearsal ends on.
 */
export const SKILL_IDS = [
  "goal_clarity",
  "observation_not_judgment",
  "concise_point",
  "clear_request",
  "regulation_and_timing",
  "pace_and_pause",
  "open_question",
  "reflection",
  "validation_without_agreement",
  "response_to_pushback",
  "boundary_or_no",
  "pause_and_return",
  "repair",
  "closure_and_next_step",
] as const;

export type SkillId = (typeof SKILL_IDS)[number];

/**
 * Tracks the program can branch across. `child` is reserved so stored data
 * and adaptations do not need a migration when it ships — it drives no
 * content today.
 */
export const TRACK_IDS = ["partner", "family", "work", "friends", "child"] as const;

export type TrackId = (typeof TRACK_IDS)[number];

/**
 * Who holds power in the conversation. Spelled out rather than
 * "up"/"down"/"level" so the value reads correctly wherever it surfaces,
 * including in a model prompt.
 */
export type PowerRelation =
  | "user_has_more_power"
  | "peer"
  | "counterpart_has_more_power"
  | "mixed_or_unknown";

/**
 * `baseline` (day 1) and `baseline_replay` (day 30) are the same measurement
 * taken twice. The three middle kinds are the authored shared core.
 */
export type CurriculumDayKind =
  | "baseline"
  | "drill"
  | "rehearsal"
  | "custom"
  | "baseline_replay";

/** How one track differs on a shared day. Only the swap, never a new day. */
export interface DayAdaptation {
  /** Scenario id to rehearse instead of the default. Must match the track. */
  refId?: string;
  /** Optional one-line framing shown for this track. */
  note?: string;
}

export interface CurriculumDay {
  /** 1-30. Canonical program numbering. */
  day: number;
  /**
   * The day number this content had in the original 28-day challenge.
   * Absent for the two baseline days. Existing stored progress is keyed on
   * this number, so it must not be re-assigned.
   */
  legacyDay?: number;
  kind: CurriculumDayKind;
  /** Drill or scenario id. Empty for baseline days and the custom finale. */
  refId: string;
  title: string;
  /** Short skill/context line under the title. */
  meta: string;
  minutes: number;
  difficulty?: Difficulty;
  /** Behaviours this day is training. Never empty. */
  skillIds: SkillId[];
  /** True for days whose job is structure rather than authored content. */
  structural?: boolean;
  /** Per-track swaps. Keyed by track; `child` is intentionally unused. */
  adaptations?: Partial<Record<CategoryId, DayAdaptation>>;
}

export interface CurriculumBlock {
  id: string;
  title: string;
  blurb: string;
  /** Fill/stroke tone for dots, icons and the Start button. */
  accent: string;
  /** Darker sibling of `accent` used for type so it stays legible on paper. */
  accentInk: string;
  days: CurriculumDay[];
}

export interface Program {
  id: string;
  /** Customer-facing program name. */
  name: string;
  /** The only source of truth for how long the program is. */
  totalDays: number;
  blocks: CurriculumBlock[];
}

/** A day with its track adaptation already applied. */
export interface ResolvedDay extends CurriculumDay {
  /** The track this was resolved for, when one was given. */
  track?: CategoryId;
  /** Framing from the adaptation, when the track supplied one. */
  note?: string;
}
