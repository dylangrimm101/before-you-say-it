import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import { normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";
import {
  approvedRehearsalCoachExchange,
  approvedRehearsalComparison,
  approvedRehearsalConfig,
  approvedRehearsalIndexImpact,
  approvedRehearsalStrongVersion,
  validateApprovedRehearsalCompletion,
  type ApprovedRehearsalLessonId,
} from "@/lib/approvedRehearsals";
import {
  normalizeScoredPracticeHistory,
  progressHistoryPresentation,
  SCORED_PRACTICE_HISTORY_VERSION,
  type ScoredPracticeRecord,
} from "@/lib/scoredPracticeHistory";
import {
  advanceApprovedRehearsalFirstResponse,
  attachApprovedRehearsalCoaching,
  attachApprovedRehearsalPushbackOne,
  attachApprovedRehearsalPushbackTwo,
  completeScenarioComparison,
  confirmApprovedRehearsalReplay,
  createScenarioPracticeRun,
  initializeApprovedRehearsalRun,
  normalizeScenarioPracticeRun,
  preserveApprovedRehearsalRetry,
  preserveApprovedRehearsalSecondResponse,
  preserveScenarioAttempt,
  stageApprovedRehearsalReplay,
} from "@/lib/scenarioPractice";

const JOURNEYS: readonly {
  lessonId: ApprovedRehearsalLessonId;
  opener: string;
  firstResponse: string;
  secondResponse: string;
  retry: string;
}[] = [
  { lessonId: "m1-l2", opener: "The approval step needs one owner.", firstResponse: "There are lots of examples and every time it becomes a problem.", secondResponse: "There are also several more examples and another email.", retry: "Yesterday’s late file is one example. Can we decide who owns approval?" },
  { lessonId: "m1-l3", opener: "Can we split March's appointments?", firstResponse: "That's not what we're discussing.", secondResponse: "We are not discussing calls.", retry: "That’s fair. Let’s finish March’s appointments, and tomorrow we can talk about calls." },
  { lessonId: "m1-l4", opener: "The plan changed twice after I rearranged work.", firstResponse: "You never think about my schedule.", secondResponse: "You always change everything.", retry: "I mean the two plan changes this month, not your schedule overall." },
  { lessonId: "m1-l5", opener: "I want to talk about the plan.", firstResponse: "It's about the plan and signups and everything else.", secondResponse: "There are several things to cover.", retry: "I’m asking for one thing: decide the current plan tonight." },
  { lessonId: "m2-l1", opener: "Can you finish the handoff brief by Thursday?", firstResponse: "No, do everything anyway.", secondResponse: "Do all of it and also send another report.", retry: "What part of the brief can you finish by Friday?" },
  { lessonId: "m2-l2", opener: "Can someone confirm the cupcake order?", firstResponse: "Can somebody handle it?", secondResponse: "Anyone in the group can do it.", retry: "Jen, can you confirm the order?" },
  { lessonId: "m2-l3", opener: "Can you take the van Saturday?", firstResponse: "That doesn't help.", secondResponse: "No, that still does not help.", retry: "I hear the game is fixed. Could you take the van after two, so that leaves the morning with me?" },
  { lessonId: "m2-l4", opener: "Can you do pickup tomorrow?", firstResponse: "But I need you to reconsider.", secondResponse: "Are you sure? Please reconsider.", retry: "Okay. Thanks for telling me." },
  { lessonId: "m2-l5", opener: "Can you own the camp signup?", firstResponse: "Keep me copied on every step.", secondResponse: "Send me every step for approval.", retry: "Come back if the signup is at risk." },
];

function completedJourney(input: (typeof JOURNEYS)[number]) {
  const config = approvedRehearsalConfig(input.lessonId)!;
  const runId = `spot-${input.lessonId}`;
  const created = initializeApprovedRehearsalRun(createScenarioPracticeRun(config.scenario, "steady", "defensive", runId, 100), 100);
  const identified = {
    ...created,
    run: {
      ...created.run,
      convertedModuleId: config.moduleId,
      practiceId: config.practiceId,
      contentVersion: config.contentVersion,
      counterpartIdentity: config.counterpartId,
      scenarioContext: { ...created.run.scenarioContext!, counterpartId: config.counterpartId },
    },
  };
  const opened = preserveScenarioAttempt(identified, "opener", input.opener, 101);
  const pressured = attachApprovedRehearsalPushbackOne(opened, {
    id: `${runId}-counterpart-turn-1`, text: `Dynamic pressure for ${input.lessonId}`, source: "provider",
    reactionId: `${input.lessonId}-dynamic-pressure-1`, semanticVoiceKey: "contextual_counterpart",
    resolvedAudioId: `${opened.run.curriculumVersion}-${runId}-counterpart-turn-1`,
  }, 102);
  const responded = preserveScenarioAttempt(pressured, "response", input.firstResponse, 103);
  const advanced = advanceApprovedRehearsalFirstResponse(responded, 104);
  const pressuredAgain = attachApprovedRehearsalPushbackTwo(advanced, {
    id: `${runId}-counterpart-turn-2`, text: `Dynamic second pressure for ${input.lessonId}`, source: "provider",
    reactionId: `${input.lessonId}-dynamic-pressure-2`, semanticVoiceKey: "contextual_counterpart",
    resolvedAudioId: `${opened.run.curriculumVersion}-${runId}-counterpart-turn-2`,
  }, 105);
  const respondedAgain = preserveApprovedRehearsalSecondResponse(pressuredAgain, input.secondResponse, 106);
  const note = approvedRehearsalCoachExchange(config, { opener: input.opener, firstResponse: input.firstResponse, secondResponse: input.secondResponse });
  const coached = attachApprovedRehearsalCoaching(respondedAgain, note.note, note.retryDirection, note.coachedBehaviorId, {
    coachedBeat: note.coachedBeat, selectedDimension: note.selectedDimension, status: note.flags[0].status, evidenceQuote: note.evidenceQuote,
  }, 107);
  const replayed = confirmApprovedRehearsalReplay(stageApprovedRehearsalReplay(coached, 108), "text_fallback_acknowledged", 109);
  const retried = preserveApprovedRehearsalRetry(replayed, input.retry, 110);
  const comparedBase = completeScenarioComparison(retried, 111);
  return {
    config,
    value: { ...comparedBase, run: { ...comparedBase.run, comparison: approvedRehearsalComparison(config, note.evidenceQuote, input.retry) } },
    note,
  };
}

function completionRecord(journey: ReturnType<typeof completedJourney>, customWording?: string): ConvertedLessonProgress {
  const { config, value } = journey;
  return {
    lessonId: config.lessonId, moduleId: config.moduleId, practiceId: config.practiceId, contentVersion: config.contentVersion,
    runId: value.run.id, lessonCardCheckpoint: config.completionCard, quizGatesCompleted: true, rehearsalCompleted: true,
    retryCompleted: true, comparisonViewed: true, savedMoveId: config.namedMoveId, ...(customWording ? { customWording } : {}),
    transferChoice: "finish", completedAt: 200, sourceLineage: "approved-html-deck-pinned",
  };
}

describe("approved lesson two-pressure journeys", () => {
  test("drives every shared lesson through two pressures, exact-beat coaching, replay, retry, and return validation", () => {
    for (const input of JOURNEYS) {
      const { config, value, note } = completedJourney(input);
      expect(value.run.state, input.lessonId).toBe("attempt_comparison");
      expect(value.run.approvedRehearsal?.pushbackOne?.reactionId, input.lessonId).toBe(`${input.lessonId}-dynamic-pressure-1`);
      expect(value.run.approvedRehearsal?.pushbackTwo?.reactionId, input.lessonId).toBe(`${input.lessonId}-dynamic-pressure-2`);
      expect(value.run.approvedRehearsal?.secondResponseAttempt?.transcript, input.lessonId).toBe(input.secondResponse);
      expect(value.run.coachingObservation, input.lessonId).toEqual({ coachedBeat: note.coachedBeat, selectedDimension: config.coachedBehaviorId, status: "not_met", evidenceQuote: note.evidenceQuote });
      expect(value.run.approvedRehearsal?.replayProof, input.lessonId).toBe("text_fallback_acknowledged");
      expect(value.run.retryAttempt?.transcript, input.lessonId).toBe(input.retry);
      expect(validateApprovedRehearsalCompletion(config, value.run, value.run.id), input.lessonId).toBe(true);
      expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(value)))?.run.id, input.lessonId).toBe(value.run.id);
      expect(approvedRehearsalIndexImpact(config, value.run, []), input.lessonId).toMatchObject({ signalValue: 72, beforeIndex: null, afterIndex: 72, delta: null });
    }
  });

  test("normalizes optional-save completion without retaining any exchange transcript", () => {
    for (const input of JOURNEYS) {
      const journey = completedJourney(input);
      const strongVersion = approvedRehearsalStrongVersion(journey.config);
      const unsaved = normalizeConvertedLessonProgress([completionRecord(journey)])[0];
      const saved = normalizeConvertedLessonProgress([completionRecord(journey, strongVersion)])[0];
      expect(unsaved?.customWording, input.lessonId).toBeUndefined();
      expect(saved?.customWording, input.lessonId).toBe(strongVersion);
      for (const transcript of [input.opener, input.firstResponse, input.secondResponse, input.retry]) {
        expect(JSON.stringify(saved), input.lessonId).not.toContain(transcript);
      }
    }
  });

  test("runs secure completion in cleanup-before-promotion order", async () => {
    for (const input of JOURNEYS) {
      const journey = completedJourney(input);
      const revision = activeRunRevision(journey.value)!;
      const calls: string[] = [];
      await finalizeConvertedLesson(completionRecord(journey), {
        expectedActiveRevision: revision,
        writePending: async (_record, expected) => { calls.push(`pending:${expected.runId}`); },
        markPrivateContentDeleted: async (runId) => { calls.push(`deleted:${runId}`); },
        clearActiveRunStrict: async (runId, cleanup) => { calls.push(`clear-start:${runId}`); await cleanup(); calls.push(`clear-end:${runId}`); },
        promotePending: async (runId) => { calls.push(`promote:${runId}`); },
      });
      expect(calls, input.lessonId).toEqual([`pending:${journey.value.run.id}`, `clear-start:${journey.value.run.id}`, `deleted:${journey.value.run.id}`, `clear-end:${journey.value.run.id}`, `promote:${journey.value.run.id}`]);
    }
  });

  test("records only retry evidence and preserves previously observed signals", () => {
    let history: ScoredPracticeRecord[] = [];
    for (const [index, input] of JOURNEYS.entries()) {
      const journey = completedJourney(input);
      const impact = approvedRehearsalIndexImpact(journey.config, journey.value.run, progressHistoryPresentation(history).rows.flatMap((row) => row.value === null ? [] : [{ key: row.key, value: row.value }]))!;
      const retryId = journey.value.run.retryAttempt!.id;
      history = normalizeScoredPracticeHistory([...history, {
        schemaVersion: SCORED_PRACTICE_HISTORY_VERSION, id: journey.value.run.id, rehearsalId: journey.value.run.id,
        completedAt: 300 + index, scenarioId: journey.config.scenario.id, scenarioTitle: journey.config.scenario.title,
        observedSignals: [{ key: impact.signalKey, value: impact.signalValue, evidenceTurnIds: [retryId] }], observedSignalSet: [impact.signalKey],
        overallIndex: impact.signalValue, evidence: [{ turnId: retryId }], currentFocus: `Keep ${impact.signalLabel.toLowerCase()} visible under pushback`,
      }]);
      expect(history.at(-1)?.evidence, input.lessonId).toEqual([{ turnId: retryId }]);
      expect(JSON.stringify(history.at(-1)), input.lessonId).not.toContain(input.retry);
    }
    expect(progressHistoryPresentation(history).recordCount).toBe(JOURNEYS.length);
  });
});
