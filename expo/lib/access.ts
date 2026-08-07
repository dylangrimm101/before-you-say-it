/**
 * What a free account can and cannot do.
 *
 * The free tier is deliberately generous in *depth* and strict in *repetition*:
 * a free user gets the whole loop once — onboarding, one spoken rehearsal, one
 * full personalized debrief, the real-conversation script, and a preview of the
 * skill that comes next. What they do not get is a second attempt. Practice is
 * repetition, and repetition is the paid product.
 *
 * Every decision lives here as a pure function so the boundary is testable and
 * identical everywhere it is enforced. Screens must never re-derive it inline.
 */

import { TOTAL_DAYS } from "@/lib/curriculum";

export type Entitlement = "free" | "pro";

/** The gates a free user can run into. Each maps to its own paywall framing. */
export type GateId =
  | "retry"
  | "another-rehearsal"
  | "targeted-feedback"
  | "program";

export interface AccessState {
  entitlement: Entitlement;
  /** How many rehearsals this person has finished, ever. */
  completedReps: number;
}

export interface GateDecision {
  allowed: boolean;
  /** Set only when `allowed` is false — which paywall framing to show. */
  gate?: GateId;
}

const ALLOWED: GateDecision = { allowed: true };

export function isPro(entitlement: Entitlement): boolean {
  return entitlement === "pro";
}

/**
 * Free accounts get exactly one complete rehearsal. This counts *finished*
 * reps, so abandoning a rehearsal midway does not burn the free one — you can
 * always get to the end of your first conversation.
 */
export function freeRepsRemaining(state: AccessState): number {
  if (isPro(state.entitlement)) return Infinity;
  return Math.max(0, 1 - state.completedReps);
}

/** Starting a brand-new rehearsal (from a scenario, the program, or Today). */
export function canStartRehearsal(state: AccessState): GateDecision {
  if (isPro(state.entitlement)) return ALLOWED;
  if (state.completedReps >= 1) return { allowed: false, gate: "another-rehearsal" };
  return ALLOWED;
}

/**
 * Practicing the same conversation again after a debrief. Always paid: the
 * retry is the single most valuable thing in the product, and it is the moment
 * a person most wants it.
 */
export function canRetryRehearsal(state: AccessState): GateDecision {
  if (isPro(state.entitlement)) return ALLOWED;
  return { allowed: false, gate: "retry" };
}

/**
 * Free rehearsals run a fixed exchange — the opener plus two full round
 * trips — then move straight to the debrief, which is where the upsell
 * lives. Pro accounts keep rehearsing as long as they want.
 */
export const FREE_REHEARSAL_USER_TURNS = 2;

/**
 * How many user turns a rehearsal may run before it auto-ends into the
 * debrief. `null` means unlimited (paid).
 */
export function rehearsalTurnCap(entitlement: Entitlement): number | null {
  return isPro(entitlement) ? null : FREE_REHEARSAL_USER_TURNS;
}

/** Working through the legacy 30-day program day by day. */
export function canContinueProgram(state: AccessState): GateDecision {
  if (isPro(state.entitlement)) return ALLOWED;
  if (state.completedReps >= 1) return { allowed: false, gate: "program" };
  return ALLOWED;
}

/**
 * Entering the Days 1–8 pilot.
 *
 * Pilot Day 1 is its own promised free entry experience. A rehearsal completed
 * during onboarding must not consume it. Once the first pilot module is done,
 * continuing to Day 2 is part of the paid program.
 */
export function canContinuePilot(
  state: AccessState,
  completedPilotDays: number,
): GateDecision {
  if (isPro(state.entitlement)) return ALLOWED;
  if (completedPilotDays >= 1) return { allowed: false, gate: "program" };
  return ALLOWED;
}

/**
 * Line-by-line coaching on a specific moment, beyond the one full debrief the
 * free rep includes.
 */
export function canSeeTargetedFeedback(state: AccessState): GateDecision {
  if (isPro(state.entitlement)) return ALLOWED;
  return { allowed: false, gate: "targeted-feedback" };
}

export interface GateCopy {
  /** Eyebrow above the paywall headline. */
  eyebrow: string;
  headline: string;
  body: string;
}

/**
 * Paywall framing per gate. Each one names what the person was just about to
 * do, so the offer reads as a continuation rather than a toll booth. Never
 * scolding, never "you have run out".
 */
export function gateCopy(gate: GateId): GateCopy {
  switch (gate) {
    case "retry":
      return {
        eyebrow: "Practice it again",
        headline: "Run the hard moment back",
        body: "You know where this conversation turned and you have better words for it. Practicing that moment out loud is what makes the new version come out under pressure.",
      };
    case "another-rehearsal":
      return {
        eyebrow: "Keep rehearsing",
        headline: "One conversation is a start",
        body: "You have had your first rehearsal and seen your debrief. Unlimited rehearsals let you practice the conversations you are actually dreading, as often as you need.",
      };
    case "targeted-feedback":
      return {
        eyebrow: "Go deeper",
        headline: "Coaching on the exact moment",
        body: "See line-by-line feedback on any moment in the conversation, and what to say instead when it happens for real.",
      };
    case "program":
      return {
        eyebrow: `${TOTAL_DAYS}-Day Conversation Practice`,
        headline: "Keep the practice going",
        body: `A short guided rep each day, building from a single clear sentence to the conversations you have been avoiding.`,
      };
  }
}

/** Copy for the debrief CTA that starts a fresh attempt at the same scenario. */
export const RETRY_CTA = {
  label: "Practice the better version",
  support:
    "You found the moment that changed the conversation. Now practice handling it differently.",
} as const;

export interface Milestone {
  /** When this becomes true, in the user's terms. */
  when: string;
  /** What changes — a described capability, never a number. */
  detail: string;
}

/**
 * The practice path: three qualitative milestones shown on the debrief.
 *
 * Strictly no predicted scores, percentages, timelines to mastery, or outcome
 * guarantees. We cannot know how a real conversation will go, and implying we
 * can is both dishonest and the fastest way to lose someone's trust after
 * their first hard conversation goes badly.
 */
export function practicePath(): readonly Milestone[] {
  // The program length is read from the curriculum data, never written as a
  // literal, so renaming or resizing the program cannot leave stale copy here.
  return [
    {
      when: "Today",
      detail:
        "You know which moment turned this conversation, and you have words ready for it.",
    },
    {
      when: `After ${TOTAL_DAYS} days of practice`,
      detail:
        "The pause before you react starts to feel like a choice you make, rather than something you got lucky with.",
    },
    {
      when: "With continued practice",
      detail:
        "You go into these conversations without rehearsing them in your head for a week first.",
    },
  ] as const;
}

/** Shown under the practice path. Sets expectations honestly. */
export const PRACTICE_PATH_QUALIFIER =
  "Your progress depends on what you practice and how consistently you return.";
