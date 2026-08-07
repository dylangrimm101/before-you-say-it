/**
 * Safety and retaliation screening, run before role-play or real-world
 * planning. Deliberately deterministic and local: no model call, no network,
 * no persistence, no analytics. Answers live in component state only and are
 * discarded when the screen unmounts.
 */

export type SafetyRoute =
  | "proceed"
  | "delay_and_prepare"
  | "document_and_seek_support"
  | "use_formal_channel"
  | "do_not_confront"
  | "emergency_support";

export interface SafetyAnswers {
  /** Afraid the other person will punish them for speaking up. */
  fearsRetaliation: boolean;
  /** Threats, stalking, or physical violence in this relationship. */
  threatsOrViolence: boolean;
  /** Coercive control: money, movement, contact, or isolation. */
  coerciveControl: boolean;
  /** Workplace retaliation, or a legal/contractual risk. */
  workplaceOrLegalRisk: boolean;
  /** A direct conversation would be unsafe or inappropriate. */
  unsafeOrInappropriate: boolean;
  /** Anyone is in danger right now. */
  immediateDanger: boolean;
  /** Too activated to have this conversation today. */
  feelsTooActivatedNow: boolean;
}

export const BLANK_SAFETY_ANSWERS: SafetyAnswers = {
  fearsRetaliation: false,
  threatsOrViolence: false,
  coerciveControl: false,
  workplaceOrLegalRisk: false,
  unsafeOrInappropriate: false,
  immediateDanger: false,
  feelsTooActivatedNow: false,
};

export interface SafetyQuestion {
  id: keyof SafetyAnswers;
  prompt: string;
  helper: string;
}

export const SAFETY_QUESTIONS: SafetyQuestion[] = [
  {
    id: "immediateDanger",
    prompt: "Is anyone in danger right now?",
    helper: "You, a child, or the other person — right now, today.",
  },
  {
    id: "threatsOrViolence",
    prompt: "Have there been threats, stalking, or physical violence?",
    helper: "Including things that were passed off as jokes.",
  },
  {
    id: "coerciveControl",
    prompt: "Does this person control your money, movement, or who you see?",
    helper: "Money, phone, car, keys, documents, friends, family.",
  },
  {
    id: "fearsRetaliation",
    prompt: "Are you afraid of what happens to you if you say this?",
    helper: "Punishment, silent treatment, withdrawal, escalation.",
  },
  {
    id: "workplaceOrLegalRisk",
    prompt: "Could this affect your job, immigration status, or a legal matter?",
    helper: "Discrimination, harassment, contracts, custody, safety at work.",
  },
  {
    id: "unsafeOrInappropriate",
    prompt: "Does a direct conversation feel like the wrong move here?",
    helper: "Trust your read. Some conversations should not happen one-on-one.",
  },
  {
    id: "feelsTooActivatedNow",
    prompt: "Are you too activated to have this today?",
    helper: "Shaking, tearful, furious, or running on no sleep.",
  },
];

export interface SafetyOutcome {
  route: SafetyRoute;
  title: string;
  body: string;
  /** Concrete next steps for this route, in order. */
  actions: string[];
  /** Label for the primary button. */
  primaryLabel: string;
}

const OUTCOMES: Record<SafetyRoute, Omit<SafetyOutcome, "route">> = {
  emergency_support: {
    title: "Get help before you get better at this",
    body: "If anyone is in danger right now, this is not a practice problem. Reach a real person who can act today. Nothing in this app is a substitute for that.",
    actions: [
      "In the US, call or text 988 for the Suicide & Crisis Lifeline.",
      "For domestic violence, call 1-800-799-7233 or text START to 88788.",
      "If someone is in immediate physical danger, call 911.",
    ],
    primaryLabel: "I understand",
  },
  do_not_confront: {
    title: "Do not have this conversation directly",
    body: "When there are threats, violence, or control involved, a clearer script does not make you safer — it can make you a target. Rehearsing this would be the wrong kind of help.",
    actions: [
      "Talk to an advocate before you talk to them. In the US: 1-800-799-7233.",
      "Tell one person you trust in the real world what is happening.",
      "Keep a private record somewhere they cannot reach.",
      "If you need a plan, make it a safety plan, not a conversation plan.",
    ],
    primaryLabel: "I understand",
  },
  use_formal_channel: {
    title: "Use a formal channel, not a one-on-one",
    body: "Once your job, status, or a legal matter is involved, an informal conversation can quietly cost you your protections. Put it through a channel that leaves a record.",
    actions: [
      "Write down what happened, with dates, before you talk to anyone.",
      "Take it to a manager, HR, your union rep, compliance, or legal.",
      "Ask what protections you have before you name names.",
      "Keep your own copy, somewhere that is not a work device.",
    ],
    primaryLabel: "I understand",
  },
  document_and_seek_support: {
    title: "Document it, and get someone in your corner first",
    body: "Being afraid of what they will do afterward is real information. Practicing the words does not change the balance of power — support and a record do.",
    actions: [
      "Write down what has already happened, with dates.",
      "Tell one person in the real world before you say anything to them.",
      "Decide in advance what you will do if they retaliate.",
      "Come back to practice once you have someone behind you.",
    ],
    primaryLabel: "I understand",
  },
  delay_and_prepare: {
    title: "Not today — but let's get you ready",
    body: "Having it while you are this activated usually costs you the outcome you want. Practice now, have it when you are steady.",
    actions: [
      "Practice here as many times as you want.",
      "Pick a time when you are fed, rested, and not already upset.",
      "Have the real conversation when you can hear their answer.",
    ],
    primaryLabel: "Practice now, talk later",
  },
  proceed: {
    title: "You're clear to practice",
    body: "Nothing here suggests this conversation is unsafe. Let's get the words right.",
    actions: [],
    primaryLabel: "Start practicing",
  },
};

/**
 * Map answers to a single route. Highest-risk answer always wins, so adding
 * a lower-risk answer can never soften the outcome.
 */
export function routeFor(answers: SafetyAnswers): SafetyOutcome {
  const route = resolveRoute(answers);
  return { route, ...OUTCOMES[route] };
}

function resolveRoute(a: SafetyAnswers): SafetyRoute {
  if (a.immediateDanger) return "emergency_support";
  if (a.threatsOrViolence || a.coerciveControl || a.unsafeOrInappropriate) {
    return "do_not_confront";
  }
  if (a.workplaceOrLegalRisk) return "use_formal_channel";
  if (a.fearsRetaliation) return "document_and_seek_support";
  if (a.feelsTooActivatedNow) return "delay_and_prepare";
  return "proceed";
}

/**
 * Whether ordinary role-play and real-world planning may continue. A hard-stop
 * route must never lead to role-play, a gamified completion, or checkout.
 */
export function allowsOrdinaryPractice(route: SafetyRoute): boolean {
  return route === "proceed" || route === "delay_and_prepare";
}

/** True when the route replaces practice with real-world support. */
export function isHardStop(route: SafetyRoute): boolean {
  return !allowsOrdinaryPractice(route);
}

/**
 * Conservative local check for newly entered practice content. It never logs,
 * persists, or sends the content; a match routes back through the full private
 * safety check before any coaching or comparison continues.
 */
export function newlySpokenContentNeedsSafetyCheck(text: string): boolean {
  return /\b(?:threat(?:en|ened|ening|s)?|kill(?:ed|ing)?|suicid(?:e|al)|self[- ]?harm|stalk(?:ed|ing|er)?|hit me|hurt me|violence|violent|coerc(?:e|ed|ion|ive)|retaliat(?:e|ed|ion)|afraid for my safety|unsafe|child(?:ren)? (?:is|are) in danger|gun|knife)\b/i.test(text);
}
