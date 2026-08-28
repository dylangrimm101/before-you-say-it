import { describe, expect, test } from "bun:test";

import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import { normalizeConvertedLessonProgress, type ConvertedLessonProgress } from "@/lib/convertedLesson";
import {
  approvedRehearsalCoachNote,
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
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeScenarioComparison,
  createScenarioPracticeRun,
  normalizeScenarioPracticeRun,
  preserveScenarioAttempt,
} from "@/lib/scenarioPractice";

const JOURNEYS: readonly {
  lessonId: ApprovedRehearsalLessonId;
  opener: string;
  firstResponse: string;
  retry: string;
}[] = [
  { lessonId: "m1-l2", opener: "The approval step needs one owner.", firstResponse: "There are lots of examples and every time it becomes a problem, plus the notes and then the email.", retry: "Yesterday’s late file is one example. Can we decide who owns approval?" },
  { lessonId: "m1-l3", opener: "Can we split March's appointments?", firstResponse: "That's not what we're discussing.", retry: "That’s fair. Let’s finish March’s appointments, and tomorrow we can talk about calls." },
  { lessonId: "m1-l4", opener: "The plan changed twice after I rearranged work.", firstResponse: "You never think about my schedule.", retry: "I mean the two plan changes this month, not your schedule overall." },
  { lessonId: "m1-l5", opener: "I want to talk about the plan.", firstResponse: "It's about the plan and signups and everything else.", retry: "I’m asking for one thing: decide the current plan tonight." },
  { lessonId: "m2-l1", opener: "Can you finish the handoff brief by Thursday?", firstResponse: "No, do everything anyway.", retry: "What part of the brief can you finish by Friday?" },
  { lessonId: "m2-l2", opener: "Can someone confirm the cupcake order?", firstResponse: "Can somebody handle it?", retry: "Jen, can you confirm the order?" },
  { lessonId: "m2-l3", opener: "Can you take the van Saturday?", firstResponse: "That doesn't help.", retry: "I hear the game is fixed. Could you take the van after two, so that leaves the morning with me?" },
  { lessonId: "m2-l4", opener: "Can you do pickup tomorrow?", firstResponse: "But I need you to reconsider.", retry: "Okay. Thanks for telling me." },
  { lessonId: "m2-l5", opener: "Can you own the camp signup?", firstResponse: "Keep me copied on every step.", retry: "Come back if the signup is at risk." },
];

function completedJourney(input: (typeof JOURNEYS)[number]) {
  const config = approvedRehearsalConfig(input.lessonId)!;
  const runId = `spot-${input.lessonId}`;
  const created = createScenarioPracticeRun(config.scenario, "steady", "defensive", runId, 100);
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
  const pressured = attachScenarioCounterpartTurn(opened, {
    id: `${runId}-counterpart-turn-1`,
    text: `Dynamic pressure for ${input.lessonId}`,
    source: "provider",
    reactionId: `${input.lessonId}-dynamic-pressure`,
    semanticVoiceKey: "contextual_counterpart",
    resolvedAudioId: `${opened.run.curriculumVersion}-${runId}-counterpart-turn-1`,
    authoredAt: 102,
  }, 102);
  const responded = preserveScenarioAttempt(pressured, "response", input.firstResponse, 103);
  const note = approvedRehearsalCoachNote(config, input.firstResponse);
  const coached = attachScenarioCoaching(responded, note.note, note.retryDirection, config.coachedBehaviorId, 104);
  const retried = preserveScenarioAttempt(coached, "retry", input.retry, 105);
  const comparedBase = completeScenarioComparison(retried, 106);
  const comparison = approvedRehearsalComparison(config, input.firstResponse, input.retry);
  return {
    config,
    value: { ...comparedBase, run: { ...comparedBase.run, comparison } },
  };
}

function completionRecord(
  journey: ReturnType<typeof completedJourney>,
  customWording?: string,
): ConvertedLessonProgress {
  const { config, value } = journey;
  return {
    lessonId: config.lessonId,
    moduleId: config.moduleId,
    practiceId: config.practiceId,
    contentVersion: config.contentVersion,
    runId: value.run.id,
    lessonCardCheckpoint: config.completionCard,
    quizGatesCompleted: true,
    rehearsalCompleted: true,
    retryCompleted: true,
    comparisonViewed: true,
    savedMoveId: config.namedMoveId,
    ...(customWording ? { customWording } : {}),
    transferChoice: "finish",
    completedAt: 200,
    sourceLineage: "approved-html-deck-pinned",
  };
}

describe("approved lesson preflight journeys", () => {
  test("drives every shared approved lesson through the real state helpers and return gate", () => {
    for (const input of JOURNEYS) {
      const journey = completedJourney(input);
      const { config, value } = journey;
      expect(value.run.state, input.lessonId).toBe("attempt_comparison");
      expect(value.run.counterpartTurn, input.lessonId).toMatchObject({
        text: `Dynamic pressure for ${input.lessonId}`,
        source: "provider",
        reactionId: `${input.lessonId}-dynamic-pressure`,
      });
      expect(value.run.responseAttempt?.transcript, input.lessonId).toBe(input.firstResponse);
      expect(value.run.retryAttempt?.transcript, input.lessonId).toBe(input.retry);
      expect(value.run.comparison, input.lessonId).toEqual(approvedRehearsalComparison(config, input.firstResponse, input.retry));
      expect(validateApprovedRehearsalCompletion(config, value.run, value.run.id), input.lessonId).toBe(true);
      expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(value)))?.run.id, input.lessonId).toBe(value.run.id);

      const impact = approvedRehearsalIndexImpact(config, value.run, []);
      expect(impact, input.lessonId).toMatchObject({ signalValue: 72, beforeIndex: null, afterIndex: 72, delta: null });
    }
  });

  test("normalizes optional-save completion for every shared lesson without retaining transcripts", () => {
    for (const input of JOURNEYS) {
      const journey = completedJourney(input);
      const strongVersion = approvedRehearsalStrongVersion(journey.config);
      const unsaved = normalizeConvertedLessonProgress([completionRecord(journey)])[0];
      const saved = normalizeConvertedLessonProgress([completionRecord(journey, strongVersion)])[0];
      expect(unsaved?.customWording, input.lessonId).toBeUndefined();
      expect(saved?.customWording, input.lessonId).toBe(strongVersion);
      expect(JSON.stringify(unsaved), input.lessonId).not.toContain(input.firstResponse);
      expect(JSON.stringify(unsaved), input.lessonId).not.toContain(input.retry);
      expect(JSON.stringify(saved), input.lessonId).not.toContain(input.firstResponse);
      expect(JSON.stringify(saved), input.lessonId).not.toContain(input.retry);
    }
  });

  test("runs secure completion in cleanup-before-promotion order for every shared lesson", async () => {
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
      expect(calls, input.lessonId).toEqual([
        `pending:${journey.value.run.id}`,
        `clear-start:${journey.value.run.id}`,
        `deleted:${journey.value.run.id}`,
        `clear-end:${journey.value.run.id}`,
        `promote:${journey.value.run.id}`,
      ]);
    }
  });

  test("records only retry evidence and preserves previously observed signals", () => {
    let history: ScoredPracticeRecord[] = [];
    for (const [index, input] of JOURNEYS.entries()) {
      const journey = completedJourney(input);
      const impact = approvedRehearsalIndexImpact(
        journey.config,
        journey.value.run,
        progressHistoryPresentation(history).rows.flatMap((row) => row.value === null ? [] : [{ key: row.key, value: row.value }]),
      )!;
      const retryId = journey.value.run.retryAttempt!.id;
      const record: ScoredPracticeRecord = {
        schemaVersion: SCORED_PRACTICE_HISTORY_VERSION,
        id: journey.value.run.id,
        rehearsalId: journey.value.run.id,
        completedAt: 300 + index,
        scenarioId: journey.config.scenario.id,
        scenarioTitle: journey.config.scenario.title,
        observedSignals: [{ key: impact.signalKey, value: impact.signalValue, evidenceTurnIds: [retryId] }],
        observedSignalSet: [impact.signalKey],
        overallIndex: impact.signalValue,
        evidence: [{ turnId: retryId }],
        currentFocus: `Keep ${impact.signalLabel.toLowerCase()} visible under pushback`,
      };
      history = normalizeScoredPracticeHistory([...history, record]);
      expect(history.at(-1)?.evidence, input.lessonId).toEqual([{ turnId: retryId }]);
      expect(JSON.stringify(history.at(-1)), input.lessonId).not.toContain(input.retry);
    }
    const presentation = progressHistoryPresentation(history);
    expect(presentation.recordCount).toBe(JOURNEYS.length);
    expect(presentation.observedCount).toBe(4);
    expect(presentation.rows.filter((row) => row.value !== null).map((row) => row.key)).toEqual(["clarity", "specificity", "listening", "steadiness"]);
  });
});
