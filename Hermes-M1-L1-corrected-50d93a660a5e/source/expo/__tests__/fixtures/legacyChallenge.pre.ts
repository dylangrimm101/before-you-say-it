import type { Difficulty } from "@/types/convo";

export type PreTaskKind = "drill" | "rehearsal" | "custom";

export interface PreChallengeDay {
  /** 1-28. */
  day: number;
  kind: PreTaskKind;
  /** Drill id or scenario id. Empty for the custom finale. */
  refId: string;
  title: string;
  /** Short skill/context line under the title. */
  meta: string;
  minutes: number;
  difficulty?: Difficulty;
}

export interface PreChallengeBlock {
  title: string;
  blurb: string;
  /** Fill/stroke tone for dots, icons and the Start button. */
  accent: string;
  /** Darker sibling of `accent` used for type so it stays legible on paper. */
  accentInk: string;
  days: PreChallengeDay[];
}

/**
 * FROZEN FIXTURE — do not edit.
 *
 * Byte-for-byte reconstruction of `constants/challenge.ts` as it stood
 * immediately before the Phase 1 curriculum migration, recovered by replaying
 * every recorded edit to that file in order. It exists so the migration can be
 * proven lossless against a real "before" rather than an assumption.
 */
export const PRE_CHALLENGE_BLOCKS: PreChallengeBlock[] = [
  {
    title: "Block 1: Find your voice",
    blurb: "Short reps. Low stakes. Say the thing out loud.",
    accent: "#5F7355",
    accentInk: "#3D4C36",
    days: [
      { day: 1, kind: "drill", refId: "open-hard", title: "Open the hard conversation", meta: "Clarity drill", minutes: 2 },
      { day: 2, kind: "drill", refId: "name-feeling", title: "Name the feeling, not the blame", meta: "Empathy drill", minutes: 2 },
      { day: 3, kind: "rehearsal", refId: "feedback", title: "Give hard feedback to someone you like", meta: "Rehearsal · gentle", minutes: 6, difficulty: "gentle" },
      { day: 4, kind: "drill", refId: "no-apology", title: "Say no without apologizing", meta: "Boundaries drill", minutes: 2 },
      { day: 5, kind: "rehearsal", refId: "friend-money", title: "Ask a friend for the money back", meta: "Rehearsal · gentle", minutes: 6, difficulty: "gentle" },
      { day: 6, kind: "drill", refId: "ask-for-help", title: "Ask for help before you drown", meta: "Clarity drill", minutes: 2 },
      { day: 7, kind: "rehearsal", refId: "friend-drift", title: "Name the distance between you", meta: "Rehearsal · gentle", minutes: 7, difficulty: "gentle" },
    ],
  },
  {
    title: "Block 2: Hold your ground",
    blurb: "They push back now. Repeat the ask without shrinking.",
    accent: "#4F6C8F",
    accentInk: "#33475F",
    days: [
      { day: 8, kind: "drill", refId: "broken-record", title: "The broken record", meta: "Assertiveness drill", minutes: 2 },
      { day: 9, kind: "rehearsal", refId: "chores", title: "Ask for a fair split of the housework", meta: "Rehearsal · steady", minutes: 7, difficulty: "steady" },
      { day: 10, kind: "drill", refId: "ask-number", title: "Say the number first", meta: "Negotiation drill", minutes: 2 },
      { day: 11, kind: "rehearsal", refId: "raise", title: "Ask for the raise you've earned", meta: "Rehearsal · steady", minutes: 8, difficulty: "steady" },
      { day: 12, kind: "drill", refId: "receive-criticism", title: "Take the hit without folding", meta: "Composure drill", minutes: 2 },
      { day: 13, kind: "rehearsal", refId: "sibling-caregiving", title: "Ask your brother to share the caregiving", meta: "Rehearsal · steady", minutes: 7, difficulty: "steady" },
      { day: 14, kind: "rehearsal", refId: "mother-boundary", title: "Set a boundary with your mother", meta: "Rehearsal · steady", minutes: 8, difficulty: "steady" },
    ],
  },
  {
    title: "Block 3: Stay steady under fire",
    blurb: "Higher heat. Keep your composure when they don't.",
    accent: "#B4832E",
    accentInk: "#7A5716",
    days: [
      { day: 15, kind: "drill", refId: "de-escalate", title: "Lower the temperature", meta: "Composure drill", minutes: 2 },
      { day: 16, kind: "rehearsal", refId: "burnout", title: "Tell your boss you're burned out", meta: "Rehearsal · steady", minutes: 8, difficulty: "steady" },
      { day: 17, kind: "drill", refId: "no-apology", title: "Say no without apologizing", meta: "Boundaries drill · again, harder", minutes: 2 },
      { day: 18, kind: "rehearsal", refId: "parent-comingclean", title: "Tell your parents a truth they won't like", meta: "Rehearsal · challenging", minutes: 7, difficulty: "challenging" },
      { day: 19, kind: "drill", refId: "name-feeling", title: "Name the feeling, not the blame", meta: "Empathy drill · under pressure", minutes: 2 },
      { day: 20, kind: "rehearsal", refId: "wedding-money", title: "Talk about the money you've been avoiding", meta: "Rehearsal · challenging", minutes: 8, difficulty: "challenging" },
      { day: 21, kind: "rehearsal", refId: "quit", title: "Resign without burning the bridge", meta: "Rehearsal · steady", minutes: 6, difficulty: "steady" },
    ],
  },
  {
    title: "Block 4: The real conversations",
    blurb: "Full difficulty. This is what you trained for.",
    accent: "#A94F38",
    accentInk: "#843B2A",
    days: [
      { day: 22, kind: "drill", refId: "open-hard", title: "Open the hard conversation", meta: "Clarity drill · no warm-up", minutes: 2 },
      { day: 23, kind: "rehearsal", refId: "intimacy", title: "Say you feel lonely in the relationship", meta: "Rehearsal · challenging", minutes: 8, difficulty: "challenging" },
      { day: 24, kind: "drill", refId: "broken-record", title: "The broken record", meta: "Assertiveness drill · they escalate", minutes: 2 },
      { day: 25, kind: "rehearsal", refId: "mother-boundary", title: "Set a boundary with your mother", meta: "Rehearsal · challenging", minutes: 8, difficulty: "challenging" },
      { day: 26, kind: "drill", refId: "de-escalate", title: "Lower the temperature", meta: "Composure drill · full heat", minutes: 2 },
      { day: 27, kind: "rehearsal", refId: "chores", title: "Ask for a fair split of the housework", meta: "Rehearsal · challenging", minutes: 7, difficulty: "challenging" },
      { day: 28, kind: "custom", refId: "", title: "The one you came here for", meta: "Your real conversation · full rehearsal", minutes: 8, difficulty: "challenging" },
    ],
  },
];

export const PRE_CHALLENGE_TOTAL_DAYS = 28;

export function preChallengeDayByNumber(day: number): PreChallengeDay | undefined {
  for (const block of PRE_CHALLENGE_BLOCKS) {
    const found = block.days.find((d) => d.day === day);
    if (found) return found;
  }
  return undefined;
}
