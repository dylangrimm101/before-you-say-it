import type { ApprovedLessonId } from "@/constants/approvedLessons";
import type { Scenario } from "@/types/convo";
import type { PilotDayRun } from "@/types/pilotCurriculum";
import type { SharedSignalKey } from "@/types/sharedProduct";

export type ApprovedRehearsalLessonId = Extract<
  ApprovedLessonId,
  "m1-l2" | "m1-l3" | "m1-l4" | "m1-l5" | "m2-l1" | "m2-l2" | "m2-l3" | "m2-l4" | "m2-l5"
>;

export interface ApprovedRehearsalIndexImpact {
  signalKey: SharedSignalKey;
  signalLabel: string;
  signalValue: number;
  beforeIndex: number | null;
  afterIndex: number;
  delta: number | null;
  explanation: string;
}

export interface ApprovedRehearsalCurrentSignal {
  key: SharedSignalKey;
  value: number;
}

export interface ApprovedRehearsalConfig {
  lessonId: ApprovedRehearsalLessonId;
  moduleId: "bysi_m01_get_to_the_point" | "bysi_m02_make_a_clear_ask";
  practiceId: string;
  contentVersion: string;
  scenario: Scenario;
  counterpartId: string;
  authoredPressureText: string;
  coachedBehaviorId: string;
  namedMoveId: string;
  namedMove: string;
  retryDirection: string;
  rehearsalHandoffCard: number;
  returnCard: number;
  completionCard: number;
  retryCap: 2;
  launchEligible: false;
}

const MODULE_ONE_ID = "bysi_m01_get_to_the_point" as const;
const MODULE_TWO_ID = "bysi_m02_make_a_clear_ask" as const;

const REHEARSALS: Readonly<Record<ApprovedRehearsalLessonId, ApprovedRehearsalConfig>> = {
  "m1-l2": {
    lessonId: "m1-l2",
    moduleId: MODULE_ONE_ID,
    practiceId: "bysi_m01_l02_cut_the_case",
    contentVersion: "m1-l2-approved-2026-08-28",
    scenario: {
      id: "bysi-m01-l02-approval-owner",
      category: "work",
      title: "The approval step",
      counterpart: "Ravi",
      counterpartGender: "man",
      situation: "Wednesday, end of day. You’re talking with Ravi about who should own final approval before client files are sent. You used yesterday’s late file as an example. Ravi points out that the client didn’t send its revisions until 3, so he doesn’t think yesterday proves the approval process is the problem.\n\nYou know yesterday wasn’t the only issue. Tuesday’s file was also late, another file stalled the week before, the specs have been messy since March, and two coworkers have mentioned similar concerns.",
      persona: "Ravi corrects one detail and questions whether a single example supports the pattern. He cannot resolve the decision for the learner.",
      goal: "Use one representative anchor without building the whole case.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "ravi",
    authoredPressureText: "Okay, but that's still one example. What else are you basing this on?",
    coachedBehaviorId: "one_anchor",
    namedMoveId: "one-anchor-folder",
    namedMove: "One anchor. The rest stays in the folder.",
    retryDirection: "Answer the same pressure with one representative anchor. Keep the rest of the case in the folder.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m1-l3": {
    lessonId: "m1-l3",
    moduleId: MODULE_ONE_ID,
    practiceId: "bysi_m01_l03_park_and_return",
    contentVersion: "m1-l3-approved-2026-08-28",
    scenario: {
      id: "bysi-m01-l03-march-appointments",
      category: "family",
      title: "March's appointments",
      counterpart: "Renee — your sister",
      counterpartGender: "woman",
      situation: "Sunday evening, you’re on the phone with Renee, your sister. Dad’s March appointments still need to be divided between you. You handled the last four appointments, and you want to decide who will take which March appointments before you hang up, so nothing is left until the last minute.\n\nRenee has been handling more of the regular check-in calls with Dad, and she’s frustrated that you haven’t been calling him as often.",
      persona: "Renee introduces a second real issue. She notices if the learner parks it without saying when they will return to it.",
      goal: "Acknowledge both issues, finish one, and say when the parked issue returns.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "renee",
    authoredPressureText: "You never even call him.",
    coachedBehaviorId: "park_and_return",
    namedMoveId: "both-on-table-one-at-time",
    namedMove: "Both on the table. One at a time.",
    retryDirection: "Acknowledge the new issue, name what you are finishing now, and say when you will return to the parked issue.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m1-l4": {
    lessonId: "m1-l4",
    moduleId: MODULE_ONE_ID,
    practiceId: "bysi_m01_l04_make_it_repeatable",
    contentVersion: "m1-l4-approved-2026-08-24",
    scenario: {
      id: "bysi-m01-l04-changing-plan",
      category: "partner",
      title: "The changing plan",
      counterpart: "Theo",
      counterpartGender: "man",
      situation: "Thursday night, the house is finally quiet. The plan changed twice this month after you had already rearranged work. By now it has become a month of things in your head.",
      persona: "Theo hears a bounded observation as a wider judgment. The exact relationship role is intentionally left unspecified by the approved deck.",
      goal: "Catch one bounded version and say it back without widening into the whole month.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "theo",
    authoredPressureText: "So you're saying I don't think about your schedule.",
    coachedBehaviorId: "bounded_repeatable_point",
    namedMoveId: "catch-it-say-it-back",
    namedMove: "Catch it. Say it back.",
    retryDirection: "Hold the bounded version. If there is more, say so without turning this response into the whole month.",
    rehearsalHandoffCard: 17,
    returnCard: 18,
    completionCard: 19,
    retryCap: 2,
    launchEligible: false,
  },
  "m1-l5": {
    lessonId: "m1-l5",
    moduleId: MODULE_ONE_ID,
    practiceId: "bysi_m01_l05_fit_in_one",
    contentVersion: "m1-l5-approved-2026-08-24",
    scenario: {
      id: "bysi-m01-l05-friday-kitchen-table",
      category: "partner",
      title: "Friday at the kitchen table",
      counterpart: "Adam",
      counterpartGender: "man",
      situation: "Friday night, kitchen table. The kid went down at seven for once. Neither of you is running on four hours.",
      persona: "Adam offers his own read of the month and tests whether the learner has one identifiable purpose. The exact relationship role is intentionally left unspecified by the approved deck.",
      goal: "Keep one purpose identifiable, or explicitly name that the purpose changed.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "adam-m1-l5",
    authoredPressureText: "Is this you asking, or is this you working up to the signups?",
    coachedBehaviorId: "one_conversation_purpose",
    namedMoveId: "pick-one-keep-rest",
    namedMove: "Pick one. Keep the rest.",
    retryDirection: "Answer the same pressure with one identifiable purpose. Keep the other purposes for another conversation.",
    rehearsalHandoffCard: 18,
    returnCard: 19,
    completionCard: 20,
    retryCap: 2,
    launchEligible: false,
  },
  "m2-l1": {
    lessonId: "m2-l1",
    moduleId: MODULE_TWO_ID,
    practiceId: "bysi_m02_l01_clear_ask",
    contentVersion: "m2-l1-approved-2026-08-24",
    scenario: {
      id: "bysi-m02-l01-thursday-handoff",
      category: "work",
      title: "The Thursday handoff",
      counterpart: "Maya",
      counterpartGender: "woman",
      situation: "Thursday morning, before standup. The handoff brief has landed late three weeks running and the review is at 4. You've mentioned it twice without asking for anything.",
      persona: "Maya cannot do the whole request by Thursday and tests whether the learner can keep one clear action while leaving room for a real answer.",
      goal: "Make one clear ask with one action, one owner, and room for Maya to answer.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "maya",
    authoredPressureText: "I can't do Thursday.",
    coachedBehaviorId: "clear_answerable_ask",
    namedMoveId: "one-action-one-owner-room-to-answer",
    namedMove: "One action. One owner. Room to answer.",
    retryDirection: "Answer the same constraint without adding more jobs or removing Maya's room to answer. Keep one action and clarify where the ask stands.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m2-l2": {
    lessonId: "m2-l2",
    moduleId: MODULE_TWO_ID,
    practiceId: "bysi_m02_l02_say_who",
    contentVersion: "m2-l2-approved-2026-08-24",
    scenario: {
      id: "bysi-m02-l02-cupcake-order",
      category: "friends",
      title: "The cupcake order",
      counterpart: "Renee",
      counterpartGender: "woman",
      situation: "Thursday afternoon, outside the school. You asked the group, there was a pause, and nobody has answered yet. Renee, Cory and Angela are still standing there. The bakery needs the cupcake order confirmed by five.",
      persona: "Renee asks why the request is hers, then explains that she has everyone's cash but the order is under Jen's name and card.",
      goal: "Put the next answerable action to one person instead of sending it back to the group.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "renee-m2-l2",
    authoredPressureText: "Why me?",
    coachedBehaviorId: "named_ask_owner",
    namedMoveId: "say-who-youre-asking",
    namedMove: "Say who you're asking.",
    retryDirection: "Answer the same question by naming the one person who owns the next answerable action. Do not send the request back to everyone.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m2-l3": {
    lessonId: "m2-l3",
    moduleId: MODULE_TWO_ID,
    practiceId: "bysi_m02_l03_when_they_say_they_cant",
    contentVersion: "m2-l3-approved-2026-08-24",
    scenario: {
      id: "bysi-m02-l03-saturday-van",
      category: "family",
      title: "Saturday and the van",
      counterpart: "Marcus — your brother",
      counterpartGender: "man",
      situation: "Thursday night, on the phone with your brother Marcus about Saturday. Ellie gets the keys in the morning and the van goes back Sunday night.",
      persona: "Marcus has a real constraint: Theo has a game and Marcus is not free until two. Those facts remain true for the whole scene.",
      goal: "Hear the constraint, trade one thing, and clearly say where the ask now stands.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "marcus",
    authoredPressureText: "I can't do a whole Saturday. Theo's got a game and I'm not free till two.",
    coachedBehaviorId: "hear_trade_state",
    namedMoveId: "hear-it-trade-one-say-where-it-stands",
    namedMove: "Hear it. Trade one thing. Say where it stands.",
    retryDirection: "Answer the exact same constraint: show that you heard it, trade one part of the ask, and say clearly what remains.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m2-l4": {
    lessonId: "m2-l4",
    moduleId: MODULE_TWO_ID,
    practiceId: "bysi_m02_l04_say_whether_no",
    contentVersion: "m2-l4-approved-2026-08-24",
    scenario: {
      id: "bysi-m02-l04-thursday-pickup",
      category: "partner",
      title: "Thursday pickup",
      counterpart: "Sam",
      situation: "Wednesday night at home, talking to Sam about tomorrow. The client dinner is Thursday and it won't move. Pickup is at 5:30.",
      persona: "Sam answers honestly. The answer can be no, and the learner must not ask for that no again if it was genuinely available.",
      goal: "Make clear whether no is available, then respond consistently when the answer is no.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "sam-m2-l4",
    authoredPressureText: "No, I can't do pickup tomorrow.",
    coachedBehaviorId: "honor_available_no",
    namedMoveId: "say-whether-no-is-available",
    namedMove: "Say whether no is available.",
    retryDirection: "Respond to the same no without asking again or turning it into a penalty. If no was available, acknowledge the answer and stop.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
  "m2-l5": {
    lessonId: "m2-l5",
    moduleId: MODULE_TWO_ID,
    practiceId: "bysi_m02_l05_ask_for_the_loop",
    contentVersion: "m2-l5-approved-2026-08-24",
    scenario: {
      id: "bysi-m02-l05-camp-signup",
      category: "partner",
      title: "Camp signup",
      counterpart: "Sam",
      situation: "A weeknight at the kitchen table with Sam. Camp signup opens next month, early-bird closes six weeks after that, and you have run it the last three summers.",
      persona: "Sam asks what counts as at risk. Once that is clear, the weeks in between belong to Sam.",
      goal: "Define the check-back condition without taking back the steps in between.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "sam-m2-l5",
    authoredPressureText: "What counts as at risk?",
    coachedBehaviorId: "loop_not_last_step",
    namedMoveId: "ask-for-loop-not-last-step",
    namedMove: "Ask for the loop, not the last step.",
    retryDirection: "Answer the same question with only the condition that should bring Sam back to you. Leave the steps in between with him.",
    rehearsalHandoffCard: 20,
    returnCard: 21,
    completionCard: 22,
    retryCap: 2,
    launchEligible: false,
  },
};

export function approvedRehearsalConfig(lessonId: string | null | undefined): ApprovedRehearsalConfig | undefined {
  return lessonId && lessonId in REHEARSALS ? REHEARSALS[lessonId as ApprovedRehearsalLessonId] : undefined;
}

export function approvedRehearsalRuntimeEnabled(lessonId: string | null | undefined): lessonId is ApprovedRehearsalLessonId {
  return __DEV__ && Boolean(approvedRehearsalConfig(lessonId));
}

export function validateApprovedRehearsalCompletion(
  config: ApprovedRehearsalConfig,
  run: PilotDayRun | null | undefined,
  requestedRunId: string | null | undefined,
): boolean {
  if (!run || !requestedRunId || run.id !== requestedRunId) return false;
  const context = run.scenarioContext;
  const pressure = run.counterpartTurn;
  return run.convertedModuleId === config.moduleId
    && run.practiceId === config.practiceId
    && run.contentVersion === config.contentVersion
    && run.counterpartIdentity === config.counterpartId
    && context?.scenarioId === config.scenario.id
    && context.counterpartId === config.counterpartId
    && pressure?.source === "authored"
    && pressure.text === config.authoredPressureText
    && Boolean(run.attempt && run.responseAttempt && run.retryAttempt && run.comparison)
    && (run.attempt?.confirmedAt ?? 0) < (run.responseAttempt?.confirmedAt ?? 0)
    && (run.responseAttempt?.confirmedAt ?? 0) < (run.retryAttempt?.confirmedAt ?? 0)
    && run.state === "attempt_comparison";
}

function hasAny(text: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function approvedRehearsalCriterion(config: ApprovedRehearsalConfig, transcript: string): boolean {
  const text = transcript.trim().toLowerCase();
  if (config.lessonId === "m1-l2") {
    const listSignals = text.match(/\b(also|another|and then|every time|all the times|plus)\b/g)?.length ?? 0;
    return text.length >= 12 && listSignals <= 1;
  }
  if (config.lessonId === "m1-l3") {
    const acknowledges = hasAny(text, [/\bi hear\b/, /\bthat[’']s fair\b/, /\bi get that\b/, /\bthat makes sense\b/, /\bi can see that\b/, /\bi appreciate that\b/, /\bwe should talk about\b/]);
    const returns = hasAny(text, [/\bafter\b/, /\btomorrow\b/, /\btonight\b/, /\bnext\b/, /\bwhen\b/, /\bon \w+day\b/]);
    return acknowledges && returns;
  }
  if (config.lessonId === "m1-l4") {
    const widening = hasAny(text, [/\balways\b/, /\bnever\b/, /\beverything\b/, /\bthe whole month\b/, /\ball the times\b/]);
    return text.length >= 12 && !widening;
  }
  if (config.lessonId === "m1-l5") {
    return hasAny(text, [/\bi'm asking\b/, /\bi am asking\b/, /\bmy ask is\b/, /\bthis is about\b/, /\bwhat i want\b/, /\bone thing\b/]);
  }
  if (config.lessonId === "m2-l1") {
    const keepsOneAction = hasAny(text, [/\bbrief\b/, /\bhandoff\b/, /\bhalf\b/, /\bpart\b/, /\bby \w+day\b/, /\bwhat can\b/]);
    const pilesOn = (text.match(/\b(also|another|plus|and then)\b/g)?.length ?? 0) > 1;
    return keepsOneAction && !pilesOn;
  }
  if (config.lessonId === "m2-l2") {
    return hasAny(text, [/\brenee\b/, /\bjen\b/, /\bcory\b/, /\bangela\b/, /\byou\b/])
      && !hasAny(text, [/\banyone\b/, /\bsomeone\b/, /\beveryone\b/, /\bwhoever\b/]);
  }
  if (config.lessonId === "m2-l3") {
    const hears = hasAny(text, [/\bi hear\b/, /\bi get\b/, /\bunderstand\b/, /\bthat makes sense\b/, /\bokay\b/]);
    const trades = hasAny(text, [/\bafter two\b/, /\bfrom two\b/, /\bsunday\b/, /\bmorning\b/, /\bafternoon\b/, /\binstead\b/, /\bthen\b/]);
    const states = hasAny(text, [/\bcan you\b/, /\bcould you\b/, /\bthe ask\b/, /\bstill need\b/, /\bthat leaves\b/, /\bso we're\b/]);
    return hears && trades && states;
  }
  if (config.lessonId === "m2-l4") {
    return hasAny(text, [/\bokay\b/, /\bthanks for telling me\b/, /\bthank you for telling me\b/, /\bi hear you\b/])
      && !hasAny(text, [/\bare you sure\b/, /\bbut i need\b/, /\bjust this once\b/, /\bplease reconsider\b/]);
  }
  return hasAny(text, [/\banything that changes\b/, /\bif .* changes\b/, /\bat risk\b/, /\bwhat i'd have to do next\b/, /\bwhat i would have to do next\b/]);
}

const INDEX_SIGNAL_BY_LESSON: Readonly<Record<ApprovedRehearsalLessonId, SharedSignalKey>> = {
  "m1-l2": "specificity",
  "m1-l3": "listening",
  "m1-l4": "steadiness",
  "m1-l5": "clarity",
  "m2-l1": "clarity",
  "m2-l2": "clarity",
  "m2-l3": "listening",
  "m2-l4": "listening",
  "m2-l5": "specificity",
};

const INDEX_SIGNAL_LABELS: Readonly<Record<SharedSignalKey, string>> = {
  clarity: "Clarity",
  specificity: "Specificity",
  steadiness: "Steadiness",
  listening: "Listening",
  boundaries: "Boundaries",
  repair: "Repair",
};

const STRONG_VERSION_BY_LESSON: Readonly<Record<ApprovedRehearsalLessonId, string>> = {
  "m1-l2": "Yesterday’s late file is one example of why the approval step needs a clear owner. Can we decide who owns that approval today?",
  "m1-l3": "You’re right that we should talk about calls. Let’s finish splitting March’s appointments now, and I’ll call you tomorrow so we can come back to that.",
  "m1-l4": "I’m not saying you never think about my schedule. I’m talking about the two times this month the plan changed after I had rearranged work.",
  "m1-l5": "I’m asking us to decide one thing tonight: how we’ll handle the current plan. I want to keep the signups for a separate conversation.",
  "m2-l1": "I hear Thursday won’t work. What part of the handoff brief can you complete, and by when?",
  "m2-l2": "Jen, since the order is under your name and card, can you confirm it with the bakery by five?",
  "m2-l3": "I hear that Theo’s game means you’re not free until two. Could you take the van after two, while I cover the morning?",
  "m2-l4": "Okay. Thanks for telling me you can’t do pickup tomorrow. I’ll make another plan.",
  "m2-l5": "Please come back to me only if the timing or cost changes enough to put the signup at risk. Otherwise, you can handle the steps in between.",
};

/** Supplies a deterministic model of the approved lesson move without retaining learner wording. */
export function approvedRehearsalStrongVersion(config: ApprovedRehearsalConfig): string {
  return STRONG_VERSION_BY_LESSON[config.lessonId];
}

/** Calculates one transparent post-lesson Index update from the lesson's observed retry behavior. */
export function approvedRehearsalIndexImpact(
  config: ApprovedRehearsalConfig,
  run: PilotDayRun,
  currentSignals: readonly ApprovedRehearsalCurrentSignal[],
): ApprovedRehearsalIndexImpact | null {
  const original = run.responseAttempt?.transcript;
  const retry = run.retryAttempt?.transcript;
  if (!original || !retry) return null;
  const beforeMet = approvedRehearsalCriterion(config, original);
  const afterMet = approvedRehearsalCriterion(config, retry);
  const signalKey = INDEX_SIGNAL_BY_LESSON[config.lessonId];
  const values = new Map<SharedSignalKey, number>(currentSignals.map((signal) => [signal.key, signal.value]));
  const previousSignal = values.get(signalKey);
  const step = !beforeMet && afterMet ? 18 : afterMet ? 6 : beforeMet ? -12 : 0;
  const signalValue = Math.max(0, Math.min(100, previousSignal === undefined ? (afterMet ? 72 : 52) : previousSignal + step));
  const beforeIndex = values.size > 0 ? Math.round([...values.values()].reduce((sum, value) => sum + value, 0) / values.size) : null;
  values.set(signalKey, signalValue);
  const afterIndex = Math.round([...values.values()].reduce((sum, value) => sum + value, 0) / values.size);
  const delta = beforeIndex === null ? null : afterIndex - beforeIndex;
  const signalLabel = INDEX_SIGNAL_LABELS[signalKey];
  const explanation = delta === null
    ? `Hope established ${signalLabel.toLowerCase()} evidence from how you used “${config.namedMove}” in the retry.`
    : delta > 0
      ? `Your Index increased because the retry made “${config.namedMove}” observable under pressure.`
      : delta < 0
        ? `Your Index adjusted because the retry no longer made “${config.namedMove}” observable.`
        : `Your Index held. Hope added evidence about ${signalLabel.toLowerCase()} and kept the next practice target clear.`;
  return { signalKey, signalLabel, signalValue, beforeIndex, afterIndex, delta, explanation };
}

export function approvedRehearsalCoachNote(config: ApprovedRehearsalConfig, transcript: string): { note: string; retryDirection: string } {
  const met = approvedRehearsalCriterion(config, transcript);
  return {
    note: met
      ? `You kept the response aligned with “${config.namedMove}” Hope checked only that lesson move.`
      : `The approved response is saved. Hope could not yet verify “${config.namedMove}” from this wording, so she is checking no other behavior.`,
    retryDirection: config.retryDirection,
  };
}

export function approvedRehearsalComparison(config: ApprovedRehearsalConfig, before: string, after: string): { behaviorId: string; text: string; criterionChanged: boolean } {
  const beforeMet = approvedRehearsalCriterion(config, before);
  const afterMet = approvedRehearsalCriterion(config, after);
  const criterionChanged = beforeMet !== afterMet;
  const text = !beforeMet && afterMet
    ? `The retry made “${config.namedMove}” observable. That is the only change Hope checked.`
    : beforeMet && afterMet
      ? `The retry held “${config.namedMove}” Hope checked no other behavior.`
      : beforeMet
        ? `The retry no longer made “${config.namedMove}” observable. Hope checked no other behavior.`
        : `The retry still did not make “${config.namedMove}” observable. Hope checked no other behavior.`;
  return { behaviorId: config.coachedBehaviorId, text, criterionChanged };
}
