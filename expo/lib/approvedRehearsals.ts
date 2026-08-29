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

export type ApprovedRehearsalCriterionStatus = "met" | "not_met";

export interface ApprovedRehearsalBehaviorFlag {
  dimension: string;
  status: ApprovedRehearsalCriterionStatus;
  evidenceQuote: string;
}

/** M1 L1-shaped evidence note used by every shared approved rehearsal. */
export interface ApprovedRehearsalCoachNote {
  evidenceQuote: string;
  worked: string;
  change: string;
  note: string;
  retryDirection: string;
  coachedBehaviorId: string;
  coachedBeat: 1 | 3;
  selectedDimension: string;
  flags: readonly [ApprovedRehearsalBehaviorFlag];
}

export interface ApprovedRehearsalConfig {
  lessonId: ApprovedRehearsalLessonId;
  moduleId: "bysi_m01_get_to_the_point" | "bysi_m02_make_a_clear_ask";
  practiceId: string;
  contentVersion: string;
  scenario: Scenario;
  counterpartId: string;
  authoredPressureText: string;
  authoredPressureTwoText: string;
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
    contentVersion: "m1-l2-two-pressure-m1-l1-parity-v4-2026-08-29",
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
    authoredPressureTwoText: "So are you saying there are more examples I need to hear before we decide?",
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
    contentVersion: "m1-l3-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m01-l03-march-appointments",
      category: "family",
      title: "March's appointments",
      counterpart: "Renee — your sister",
      counterpartGender: "woman",
      situation: "Sunday evening, you’re on the phone with your sister, Renee. Dad’s March appointments still need to be divided, and you handled the last four. You want to agree on who will take each March appointment before you hang up. Renee has been handling more of Dad’s regular check-in calls and may raise that you haven’t been calling as often.",
      persona: "Renee introduces a second real issue. She notices if the learner parks it without saying when they will return to it.",
      goal: "Acknowledge both issues, finish one, and say when the parked issue returns.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "renee",
    authoredPressureText: "You never even call him.",
    authoredPressureTwoText: "When exactly are we coming back to the calls, then?",
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
    contentVersion: "m1-l4-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m01-l04-changing-plan",
      category: "partner",
      title: "The changing plan",
      counterpart: "Theo",
      counterpartGender: "man",
      situation: "Thursday night, you’re talking with Theo, your partner, after the house is quiet. Twice this month, Theo agreed to handle school pickup, so you rearranged work around that plan. Both times, he changed the plan after your schedule was already set, leaving you to move meetings again. You want future changes discussed before either of you commits—not to suggest that Theo never considers your schedule.",
      persona: "Theo is the learner’s partner. He hears the two school-pickup changes as a wider judgment about whether he considers the learner’s schedule.",
      goal: "Catch one bounded version and say it back without widening into the whole month.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "theo",
    authoredPressureText: "So you're saying I don't think about your schedule.",
    authoredPressureTwoText: "Are you talking about those two changes, or everything lately?",
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
    contentVersion: "m1-l5-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m01-l05-friday-kitchen-table",
      category: "partner",
      title: "Friday at the kitchen table",
      counterpart: "Adam",
      counterpartGender: "man",
      situation: "Friday night, you’re at the kitchen table with Adam, who shares responsibility for your child’s calendar, after the kid has gone to bed. This month, most of the calendar has fallen to you—including camp signups, the dentist, and both birthday RSVPs. You want several things addressed, but raising all of them at once could leave none of them clear. Choose one purpose for tonight and keep the others for later. Adam has his own read of the month and may question which issue you actually want him to address.",
      persona: "Adam shares responsibility for the child’s calendar. He offers his own read of the month and tests whether the learner can identify one purpose while keeping the other concerns for later.",
      goal: "Keep one purpose identifiable, or explicitly name that the purpose changed.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "adam-m1-l5",
    authoredPressureText: "Is this you asking, or is this you working up to the signups?",
    authoredPressureTwoText: "Which one do you actually want us to decide tonight?",
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
    contentVersion: "m2-l1-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m02-l01-thursday-handoff",
      category: "work",
      title: "The Thursday handoff",
      counterpart: "Maya",
      counterpartGender: "woman",
      situation: "Thursday morning, before standup, you’re speaking with Maya, your teammate who prepares the revised two-page handoff brief for a 4 PM review. The brief has arrived late three weeks in a row, and you’ve mentioned the pattern twice without making a specific request. You need to leave the conversation knowing what Maya can deliver in time for today’s review and by when. Maya may say she cannot finish the whole brief today, so make one clear, answerable ask while leaving room for a real constraint.",
      persona: "Maya is the learner’s teammate and prepares the revised two-page handoff brief. She cannot finish the whole brief today and tests whether the learner can keep one clear action while leaving room for a real constraint.",
      goal: "Make one clear ask with one action, one owner, and room for Maya to answer.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "maya",
    authoredPressureText: "I can't do Thursday.",
    authoredPressureTwoText: "What exactly are you asking me to commit to now?",
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
    contentVersion: "m2-l2-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m02-l02-cupcake-order",
      category: "friends",
      title: "The cupcake order",
      counterpart: "Renee — another parent",
      counterpartGender: "woman",
      situation: "Thursday afternoon, outside the school after pickup, you’re standing with Renee, Cory, Angela, and Jen. The group’s cupcake order must be confirmed with the bakery by 5 PM. You already asked whether someone could handle it, but after a pause no one answered. Renee has collected everyone’s cash, while the order is under Jen’s name and card. You need to leave knowing who will take the next answerable action. Address one person directly rather than sending the request back to the group; Renee may ask why the request belongs to her.",
      persona: "Renee is another parent in the group. She asks why the request is hers, then explains that she has everyone's cash but the order is under Jen's name and card.",
      goal: "Put the next answerable action to one person instead of sending it back to the group.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "renee-m2-l2",
    authoredPressureText: "Why me?",
    authoredPressureTwoText: "The order is under Jen's name and card, so who needs to do the next step?",
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
    contentVersion: "m2-l3-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m02-l03-saturday-van",
      category: "family",
      title: "Saturday and the van",
      counterpart: "Marcus — your brother",
      counterpartGender: "man",
      situation: "Thursday night, you’re on the phone with your brother, Marcus, arranging who will handle the van on Saturday. Ellie will have the keys that morning, and the van must be returned Sunday night, so Saturday’s plan needs to be settled before the weekend. You want to leave with a clear agreement about which part of Saturday Marcus can take. Marcus may say he cannot do the whole day because Theo has a game and he is not free until 2 PM. Hear the constraint, trade one part of the original ask, and clearly restate what you are still asking him to do.",
      persona: "Marcus has a real constraint: Theo has a game and Marcus is not free until two. Those facts remain true for the whole scene.",
      goal: "Hear the constraint, trade one thing, and clearly say where the ask now stands.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "marcus",
    authoredPressureText: "I can't do a whole Saturday. Theo's got a game and I'm not free till two.",
    authoredPressureTwoText: "All right, what part are you still asking me to take?",
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
    contentVersion: "m2-l4-detailed-scene-v5-2026-08-29",
    scenario: {
      id: "bysi-m02-l04-thursday-pickup",
      category: "partner",
      title: "Thursday pickup",
      counterpart: "Sam",
      situation: "Wednesday night at home, you’re talking with Sam, your partner, about school pickup tomorrow. You have a client dinner on Thursday that cannot move, and pickup is at 5:30. You need to know whether Sam can handle pickup, but you can make another arrangement if the answer is no. Ask directly while making clear that no is genuinely available. Sam may say they cannot do pickup and then check whether no is actually okay. If you offered room to say no, honor the answer without asking again or adding a penalty.",
      persona: "Sam answers honestly that they cannot do pickup, then checks whether no is genuinely available. If the learner offered room to say no, Sam expects that answer to be honored without another ask or a penalty.",
      goal: "Make clear whether no is available, then respond consistently when the answer is no.",
      opensWith: "user",
      openingLine: "",
      isCustom: false,
    },
    counterpartId: "sam-m2-l4",
    authoredPressureText: "No, I can't do pickup tomorrow.",
    authoredPressureTwoText: "I need to know whether no is actually okay here.",
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
    contentVersion: "m2-l5-two-pressure-m1-l1-parity-v4-2026-08-29",
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
    authoredPressureTwoText: "So if none of that happens, do you want me to handle the steps without checking each one?",
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
  const lesson = run.approvedRehearsal;
  const pressureOne = lesson?.pushbackOne;
  const pressureTwo = lesson?.pushbackTwo;
  const observation = run.coachingObservation;
  const observedTranscript = observation?.coachedBeat === 1
    ? run.attempt?.transcript
    : run.responseAttempt?.transcript;
  const hasValidObservation = Boolean(observation
    && [1, 3].includes(observation.coachedBeat)
    && observation.selectedDimension === config.coachedBehaviorId
    && observation.evidenceQuote === observedTranscript
    && observation.status === (approvedRehearsalCriterion(config, observation.evidenceQuote) ? "met" : "not_met")
    && run.coachedSegment === (observation.coachedBeat === 1 ? "opener" : "pushback_response")
    && run.coachedBehaviorId === config.coachedBehaviorId
    && lesson?.coachedBeat === observation.coachedBeat
    && lesson.selectedDimension === config.coachedBehaviorId);
  const hasValidPressureOne = Boolean(pressureOne
    && run.counterpartTurn?.id === pressureOne.id
    && pressureOne.id === `${run.id}-counterpart-turn-1`
    && pressureOne.reactionId === `${config.lessonId}-dynamic-pressure-1`
    && pressureOne.semanticVoiceKey === "contextual_counterpart"
    && pressureOne.resolvedAudioId === `${run.curriculumVersion}-${run.id}-counterpart-turn-1`
    && pressureOne.text.trim().length >= 3
    && (pressureOne.source === "provider" || (pressureOne.source === "authored" && pressureOne.text === config.authoredPressureText)));
  const hasValidPressureTwo = Boolean(pressureTwo
    && pressureTwo.id === `${run.id}-counterpart-turn-2`
    && pressureTwo.reactionId === `${config.lessonId}-dynamic-pressure-2`
    && pressureTwo.semanticVoiceKey === "contextual_counterpart"
    && pressureTwo.resolvedAudioId === `${run.curriculumVersion}-${run.id}-counterpart-turn-2`
    && pressureTwo.text.trim().length >= 3
    && (pressureTwo.source === "provider" || (pressureTwo.source === "authored" && pressureTwo.text === config.authoredPressureTwoText)));
  const expectedReplayAudioId = observation?.coachedBeat === 1
    ? `top-of-scene:${run.id}`
    : pressureOne?.resolvedAudioId;
  const hasValidReplay = Boolean(lesson?.replayProof
    && lesson.replayCompletedAt
    && lesson.replayAudioId === expectedReplayAudioId
    && (observation?.coachedBeat === 1 ? lesson.replayProof === "top_of_scene_reset" : lesson.replayProof !== "top_of_scene_reset"));
  return run.convertedModuleId === config.moduleId
    && run.practiceId === config.practiceId
    && run.contentVersion === config.contentVersion
    && run.counterpartIdentity === config.counterpartId
    && context?.scenarioId === config.scenario.id
    && context.counterpartId === config.counterpartId
    && hasValidPressureOne
    && hasValidPressureTwo
    && hasValidObservation
    && hasValidReplay
    && Boolean(run.attempt && run.responseAttempt && run.retryAttempt && run.comparison)
    && (run.attempt?.confirmedAt ?? 0) < (pressureOne?.authoredAt ?? 0)
    && (pressureOne?.authoredAt ?? 0) < (run.responseAttempt?.confirmedAt ?? 0)
    && (run.responseAttempt?.confirmedAt ?? 0) < (pressureTwo?.authoredAt ?? 0)
    && (pressureTwo?.authoredAt ?? 0) < (run.retryAttempt?.confirmedAt ?? 0)
    && lesson?.retryCount === 1
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

interface ApprovedRehearsalCoachingCopy {
  positiveObservation: string;
  failureObservation: string;
  changeInstruction: string;
}

const COACHING_COPY_BY_LESSON: Readonly<Record<ApprovedRehearsalLessonId, ApprovedRehearsalCoachingCopy>> = {
  "m1-l2": {
    positiveObservation: "held one representative anchor without opening the rest of the case",
    failureObservation: "the response adds or invites more case material instead of holding one representative anchor",
    changeInstruction: "use one representative anchor and leave the rest of the case in the folder",
  },
  "m1-l3": {
    positiveObservation: "acknowledged the second issue and made its return point explicit",
    failureObservation: "the response does not both acknowledge the second issue and say when it will return",
    changeInstruction: "acknowledge the new issue, finish the current one, and name when the parked issue returns",
  },
  "m1-l4": {
    positiveObservation: "kept the point bounded instead of widening it into a judgment",
    failureObservation: "the response widens the bounded event into an overall judgment",
    changeInstruction: "hold the bounded version and keep the wider month out of this response",
  },
  "m1-l5": {
    positiveObservation: "made one conversation purpose identifiable",
    failureObservation: "the response does not yet make one conversation purpose identifiable",
    changeInstruction: "name one purpose and keep the other purposes for another conversation",
  },
  "m2-l1": {
    positiveObservation: "kept one answerable action while leaving room for a real answer",
    failureObservation: "the response does not yet keep one answerable action with room for an answer",
    changeInstruction: "keep one action, one owner, and room for the other person to answer",
  },
  "m2-l2": {
    positiveObservation: "put the next answerable action to one named person",
    failureObservation: "the response sends the action back to the group instead of one named person",
    changeInstruction: "name the one person who owns the next answerable action",
  },
  "m2-l3": {
    positiveObservation: "showed the constraint was heard, traded one part, and restated what remains",
    failureObservation: "the response does not yet show all three parts: hear it, trade one thing, and say where the ask stands",
    changeInstruction: "show what you heard, trade one part, and clearly state what remains",
  },
  "m2-l4": {
    positiveObservation: "treated the available no as a real answer without asking again",
    failureObservation: "the response does not yet honor the available no as a complete answer",
    changeInstruction: "acknowledge the no and stop without asking again or adding a penalty",
  },
  "m2-l5": {
    positiveObservation: "defined only the condition for coming back and left the middle steps alone",
    failureObservation: "the response keeps control of the middle steps instead of defining only the return condition",
    changeInstruction: "name only the condition that should bring the other person back",
  },
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
  const coachedBeat = run.coachingObservation?.coachedBeat;
  const original = coachedBeat === 1
    ? run.attempt?.transcript
    : run.responseAttempt?.transcript;
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

/**
 * Produces the same scoreless, exact-wording coaching shape as M1 L1 while
 * evaluating only this lesson's approved move at the pressure-response beat.
 */
export function approvedRehearsalCoachNote(config: ApprovedRehearsalConfig, transcript: string, coachedBeat: 1 | 3 = 3): ApprovedRehearsalCoachNote {
  const evidenceQuote = transcript.trim();
  const status: ApprovedRehearsalCriterionStatus = approvedRehearsalCriterion(config, evidenceQuote) ? "met" : "not_met";
  const copy = COACHING_COPY_BY_LESSON[config.lessonId];
  const worked = status === "met"
    ? `In “${evidenceQuote}” you ${copy.positiveObservation}.`
    : `In “${evidenceQuote}” ${copy.failureObservation}.`;
  const change = status === "met"
    ? "Keep that same choice in the retry."
    : `On the retry, ${copy.changeInstruction}.`;
  return {
    evidenceQuote,
    worked,
    change,
    note: `${worked} ${change}`,
    retryDirection: coachedBeat === 1
      ? `Reset to the top of the scene and ${copy.changeInstruction}.`
      : `Replay this exact moment and ${copy.changeInstruction}.`,
    coachedBehaviorId: config.coachedBehaviorId,
    coachedBeat,
    selectedDimension: config.coachedBehaviorId,
    flags: [{ dimension: config.coachedBehaviorId, status, evidenceQuote }],
  };
}

/** Selects one exact learner beat from the M1 L1-shaped exchange, prioritizing an observable miss before reinforcing success. */
export function approvedRehearsalCoachExchange(config: ApprovedRehearsalConfig, exchange: { opener: string; firstResponse: string }): ApprovedRehearsalCoachNote {
  const candidates = [
    approvedRehearsalCoachNote(config, exchange.firstResponse, 3),
    approvedRehearsalCoachNote(config, exchange.opener, 1),
  ] as const;
  return candidates.find((candidate) => candidate.flags[0].status === "not_met") ?? candidates[0];
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
