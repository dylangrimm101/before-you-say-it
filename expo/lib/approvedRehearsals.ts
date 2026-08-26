import type { ApprovedLessonId } from "@/constants/approvedLessons";
import type { Scenario } from "@/types/convo";
import type { PilotDayRun } from "@/types/pilotCurriculum";

export type ApprovedRehearsalLessonId = Extract<ApprovedLessonId, "m1-l2" | "m1-l3" | "m1-l4" | "m1-l5">;

export interface ApprovedRehearsalConfig {
  lessonId: ApprovedRehearsalLessonId;
  moduleId: "bysi_m01_get_to_the_point";
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

const MODULE_ID = "bysi_m01_get_to_the_point" as const;

const REHEARSALS: Readonly<Record<ApprovedRehearsalLessonId, ApprovedRehearsalConfig>> = {
  "m1-l2": {
    lessonId: "m1-l2",
    moduleId: MODULE_ID,
    practiceId: "bysi_m01_l02_cut_the_case",
    contentVersion: "m1-l2-approved-2026-08-24",
    scenario: {
      id: "bysi-m01-l02-approval-owner",
      category: "work",
      title: "The approval step",
      counterpart: "Ravi",
      counterpartGender: "man",
      situation: "Wednesday, end of day. You've told Ravi the approval step needs a clear owner and used yesterday's late file. He isn't brushing you off. He just isn't accepting that example.",
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
    moduleId: MODULE_ID,
    practiceId: "bysi_m01_l03_park_and_return",
    contentVersion: "m1-l3-approved-2026-08-24",
    scenario: {
      id: "bysi-m01-l03-march-appointments",
      category: "family",
      title: "March's appointments",
      counterpart: "Renee — your sister",
      counterpartGender: "woman",
      situation: "Sunday evening, on the phone with your sister. You want March's appointments split before you hang up.",
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
    moduleId: MODULE_ID,
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
    moduleId: MODULE_ID,
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
    const acknowledges = hasAny(text, [/\bi hear\b/, /\bthat's fair\b/, /\bi get that\b/, /\bwe should talk about\b/]);
    const returns = hasAny(text, [/\bafter\b/, /\btomorrow\b/, /\btonight\b/, /\bnext\b/, /\bwhen\b/, /\bon \w+day\b/]);
    return acknowledges && returns;
  }
  if (config.lessonId === "m1-l4") {
    const widening = hasAny(text, [/\balways\b/, /\bnever\b/, /\beverything\b/, /\bthe whole month\b/, /\ball the times\b/]);
    return text.length >= 12 && !widening;
  }
  const onePurpose = hasAny(text, [/\bi'm asking\b/, /\bi am asking\b/, /\bmy ask is\b/, /\bthis is about\b/, /\bwhat i want\b/, /\bone thing\b/]);
  return onePurpose;
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
