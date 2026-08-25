import type { PowerRelation } from "@/types/curriculum";

export type CategoryId = "partner" | "family" | "work" | "friends";

export type Difficulty = "gentle" | "steady" | "challenging";

export type PersonaVoice = "woman-hope" | "man-adam";

/** Counterpart gender. Drives the voice, the prompt and generated names. */
export type Gender = "woman" | "man";

export type ReactionPattern =
  | "defensive"
  | "hears-criticism"
  | "minimizes"
  | "quiet"
  | "louder"
  | "turns-back"
  | "agrees-without-changing"
  | "not-sure";

export interface Scenario {
  id: string;
  category: CategoryId;
  /**
   * Who holds power in this conversation. Shapes how much the counterpart
   * can afford to concede and how much risk the user is carrying.
   */
  power?: PowerRelation;
  /** Short imperative title, e.g. "Ask for a fair split of the chores". */
  title: string;
  /** Who the AI plays, e.g. "Sam — your partner of 4 years". */
  counterpart: string;
  /**
   * Set only when the counterpart's gender is fixed by the relationship
   * ("your dad") or by a clearly gendered first name. When set, this wins over
   * the user's onboarding voice choice, so the name and the voice always agree.
   * Leave unset for unisex counterparts, which follow the user's preference.
   */
  counterpartGender?: Gender;
  /** Situation context handed to the model. */
  situation: string;
  /** Behavioural notes for the counterpart. */
  persona: string;
  /** What the user is trying to achieve. */
  goal: string;
  /**
   * Who speaks first. Defaults to "user": the user is preparing to initiate
   * this conversation, so the rehearsal opens with an empty transcript and
   * invites their opening line. Only set "counterpart" when the scenario
   * explicitly gives the user something to respond to.
   */
  opensWith?: "user" | "counterpart";
  /** First line the counterpart says. Used only when `opensWith` is "counterpart". */
  openingLine: string;
  /** Optional only when an approved source authorizes a duration claim. */
  minutes?: number;
  isCustom?: boolean;
}

export interface Turn {
  id: string;
  role: "user" | "them";
  text: string;
  /** Optional coach nudge attached to a counterpart turn. */
  nudge?: string;
}

export interface Flag {
  quote: string;
  issue: string;
  reframe: string;
}

export interface Debrief {
  headline: string;
  scores: {
    clarity: number;
    empathy: number;
    assertiveness: number;
    composure: number;
  };
  wins: string[];
  flags: Flag[];
  script: string[];
  nextRep: string;
}

export interface Session {
  id: string;
  scenarioId: string;
  title: string;
  counterpart: string;
  category: CategoryId;
  difficulty: Difficulty;
  /** Voice persona the user selected for this rehearsal. */
  persona?: PersonaVoice;
  /** Reaction pattern the user is practising against. */
  reaction?: ReactionPattern;
  /** Desired outcome the user named. */
  outcome?: string;
  turns: Turn[];
  debrief?: Debrief;
  startedAt: number;
  endedAt?: number;
}

export type FreezePattern = "freeze" | "apologize" | "sharpen" | "avoid";
export type WinShape = "heard" | "boundary" | "calm" | "yes";

export interface Profile {
  focus: CategoryId;
  pattern: FreezePattern;
  win: WinShape;
  /** Persona voice preference from onboarding. */
  persona: PersonaVoice;
  /** Reaction pattern the user most wants to practise. */
  reaction: ReactionPattern;
  /**
   * Desired outcome text. Memory-only: held for the current app run so
   * prefills work, never written to disk.
   */
  outcome?: string;
  /** Dread scenario text. Memory-only, same as `outcome`. */
  dread?: string;
  createdAt: number;
}

export interface DrillRound {
  /** The line thrown at the user. */
  line: string;
  /** What the user should practise in their reply. */
  focus: string;
}

export interface Drill {
  id: string;
  title: string;
  /** Skill being trained, e.g. "Boundaries". */
  skill: string;
  /** One-line setup shown before the drill. */
  setup: string;
  rounds: DrillRound[];
}

export interface DrillResult {
  drillId: string;
  /** YYYY-MM-DD completion day. */
  date: string;
  /** Average 0-100 score across rounds. */
  score: number;
  completedAt: number;
}

export interface ChallengeLogEntry {
  /** 1-28 challenge day number. */
  day: number;
  /** YYYY-MM-DD completion day. */
  date: string;
  completedAt: number;
}

export interface ReminderSetting {
  enabled: boolean;
  /** 0-23 local hour. */
  hour: number;
  /** 0-59 local minute. */
  minute: number;
}

export interface FreezeState {
  /** Streak freezes in the bank (max 2). */
  available: number;
  /** YYYY-MM-DD days that were frozen (count towards the streak). */
  usedDates: string[];
  /** Highest streak multiple of 7 already rewarded with a freeze. */
  lastMilestone: number;
}

export interface OnboardingForm {
  focus: CategoryId;
  persona: PersonaVoice;
  dread: string;
  reaction: ReactionPattern;
  outcome: string;
  difficulty: Difficulty;
}
