import type { Drill } from "@/types/convo";

/**
 * Short daily exercises between full rehearsals — one skill, three quick
 * exchanges, immediate feedback. PatterAI-style reps that take ~2 minutes.
 */
export const DRILLS: Drill[] = [
  {
    id: "no-apology",
    title: "Say no without apologizing",
    skill: "Boundaries",
    setup: "Three asks are coming at you. Decline each one clearly — without a single 'sorry'.",
    rounds: [
      {
        line: "Hey, can you cover my shift Saturday? You're the only one I trust with it.",
        focus: "Decline warmly, no apology, no long excuse.",
      },
      {
        line: "Come on, it's just this once. I'd do it for you.",
        focus: "Hold the no when they push. Repeat, don't re-justify.",
      },
      {
        line: "Wow. I guess I know where we stand then.",
        focus: "Stay kind without taking the guilt bait.",
      },
    ],
  },
  {
    id: "broken-record",
    title: "The broken record",
    skill: "Assertiveness",
    setup: "You need a refund the company owes you. Repeat your ask calmly no matter what they say.",
    rounds: [
      {
        line: "Unfortunately that's outside our refund window, so there's nothing I can do.",
        focus: "State your ask in one clear sentence.",
      },
      {
        line: "I understand you're frustrated, but policy is policy.",
        focus: "Acknowledge, then restate the exact same ask.",
      },
      {
        line: "I can offer you a 10% discount coupon instead. Best I can do.",
        focus: "Decline the deflection and hold the original ask.",
      },
    ],
  },
  {
    id: "name-feeling",
    title: "Name the feeling, not the blame",
    skill: "Empathy",
    setup: "Someone you love is upset with you. Reply with 'I' statements — no 'you always', no defence.",
    rounds: [
      {
        line: "You clearly don't care about this family. You're on your phone all evening.",
        focus: "Name your feeling without counter-attacking.",
      },
      {
        line: "That's not an excuse. I've been asking for months.",
        focus: "Reflect back what they actually want.",
      },
      {
        line: "…I just feel like I'm doing this alone.",
        focus: "Validate first. Solutions can wait.",
      },
    ],
  },
  {
    id: "ask-number",
    title: "Say the number first",
    skill: "Negotiation",
    setup: "Salary conversation. Practice anchoring: say your number early, plainly, and then stop talking.",
    rounds: [
      {
        line: "So, what were you thinking in terms of compensation?",
        focus: "Give a specific number. No ranges, no hedging.",
      },
      {
        line: "That's above what we budgeted for this role, to be honest.",
        focus: "Hold the number. Add one line of evidence, not five.",
      },
      {
        line: "What if we revisit it after your six-month review?",
        focus: "Get something concrete in writing before you agree.",
      },
    ],
  },
  {
    id: "open-hard",
    title: "Open the hard conversation",
    skill: "Clarity",
    setup: "Practice first sentences. Each round, open a different tough topic in one clean sentence.",
    rounds: [
      {
        line: "(your roommate walks in) Oh hey, what's up?",
        focus: "Raise the unpaid rent in one direct, calm sentence.",
      },
      {
        line: "(your friend answers the phone) Hey! Long time. Everything okay?",
        focus: "Tell them something they did hurt you — no burying it.",
      },
      {
        line: "(your boss says) You wanted five minutes?",
        focus: "Ask for the overdue conversation about your workload.",
      },
    ],
  },
  {
    id: "receive-criticism",
    title: "Take the hit without folding",
    skill: "Composure",
    setup: "You're getting criticized. Practice absorbing it without over-apologizing or shutting down.",
    rounds: [
      {
        line: "This report is sloppy. I expected a lot more from you.",
        focus: "Ask one specific question instead of apologizing twice.",
      },
      {
        line: "Honestly it makes me wonder if you're stretched too thin.",
        focus: "Stay factual. Don't audition for your own job.",
      },
      {
        line: "Fine. Just make sure it doesn't happen again.",
        focus: "Close with one concrete commitment, not a promise spiral.",
      },
    ],
  },
  {
    id: "de-escalate",
    title: "Lower the temperature",
    skill: "Composure",
    setup: "They're heated. Practice slowing the pace and softening the room without giving in.",
    rounds: [
      {
        line: "Are you serious right now?! We talked about this a hundred times!",
        focus: "Slow down. Short sentence, low heat, no sarcasm.",
      },
      {
        line: "Don't tell me to calm down. That makes it worse.",
        focus: "Validate the anger without accepting the framing.",
      },
      {
        line: "(quieter) I'm just… tired of having this fight.",
        focus: "Meet the softening. Offer one small next step.",
      },
    ],
  },
  {
    id: "ask-for-help",
    title: "Ask for help before you drown",
    skill: "Clarity",
    setup: "You're overloaded. Practice asking for help specifically — not hinting, not martyring.",
    rounds: [
      {
        line: "(your partner) You've seemed off lately. What's going on?",
        focus: "Say what you need. One specific, doable ask.",
      },
      {
        line: "Okay… but I don't really know what you want me to do.",
        focus: "Make the ask smaller and more concrete.",
      },
      {
        line: "I can do that. Why didn't you say something sooner?",
        focus: "Answer honestly without self-flagellating.",
      },
    ],
  },
];

/** Deterministic drill of the day. */
export function drillOfTheDay(now = new Date()): Drill {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start) / 86400000);
  return DRILLS[day % DRILLS.length];
}
