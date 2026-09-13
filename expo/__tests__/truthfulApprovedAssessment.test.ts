import { describe, expect, test } from "bun:test";
import { approvedRehearsalComparison, approvedRehearsalIndexImpact, approvedRehearsalConfig, approvedRehearsalCriterion, approvedRehearsalCoachNote, approvedRehearsalStrongVersion } from "@/lib/approvedRehearsals";

import { advanceApprovedRehearsalFirstResponse, attachApprovedRehearsalPushbackOne, attachApprovedRehearsalPushbackTwo, initializeApprovedRehearsalRun, createScenarioPracticeRun, preserveScenarioAttempt } from "@/lib/scenarioPractice";

describe("truthful approved rehearsal assessment", () => {
  test("practice retries produce neither invented measurements nor comparative judgments", () => {
    const config = approvedRehearsalConfig("m1-l2")!;
    let value = createScenarioPracticeRun(config.scenario, "steady", "defensive", "truthful", 1);
    value = preserveScenarioAttempt(value, "response", "No.", 2);
    value = preserveScenarioAttempt(value, "retry", "Bananas are yellow.", 3);
    expect(approvedRehearsalIndexImpact(config, value.run, [{ key: "clarity", value: 65 }])).toBeNull();
    expect(approvedRehearsalIndexImpact(config, value.run, [])).toBeNull();
    const comparison = approvedRehearsalComparison(config, "No.", "Bananas are yellow.");
    expect(comparison.criterionChanged).toBe(false);
    expect(comparison.text).toContain("not assessed");
    expect(comparison.text).toContain("Practice completion");
  });
  test("completion preparation never persists an invented observed behavior", async () => {
    const api = await import("@/lib/approvedRehearsals");
    expect(typeof api.prepareUnassessedApprovedRehearsal).toBe("function");
    const config = approvedRehearsalConfig("m1-l2")!;
  const runId = `spot-${config.lessonId}`;
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
  const opened = preserveScenarioAttempt(identified, "opener", "The approval step needs one owner.", 101);
  const pressured = attachApprovedRehearsalPushbackOne(opened, {
    id: `${runId}-counterpart-turn-1`, text: (config.lessonId === "m1-l2" ? "I don't think one late file proves our approval process is broken." : `I still need a clearer answer about ${config.scenario.title}.`), source: "provider",
    reactionId: `${config.lessonId}-dynamic-pressure-1`, semanticVoiceKey: "contextual_counterpart",
    resolvedAudioId: `${opened.run.curriculumVersion}-${runId}-counterpart-turn-1`,
  }, 102);
  const responded = preserveScenarioAttempt(pressured, "response", "Bananas are yellow.", 103);
  const advanced = advanceApprovedRehearsalFirstResponse(responded, 104);
  const pressuredAgain = attachApprovedRehearsalPushbackTwo(advanced, {
    id: `${runId}-counterpart-turn-2`, text: (config.lessonId === "m1-l2" ? "Does Tuesday's file prove a pattern with final approval?" : `Why does ${config.scenario.goal.toLowerCase()} follow from that?`), source: "provider",
    reactionId: `${config.lessonId}-dynamic-pressure-2`, semanticVoiceKey: "contextual_counterpart",
    resolvedAudioId: `${opened.run.curriculumVersion}-${runId}-counterpart-turn-2`,
  }, 105);
    const value = pressuredAgain;
    const prepared = api.prepareUnassessedApprovedRehearsal(config, value, 4);
    expect(prepared.run.coachingObservation).toBeUndefined();
    expect(prepared.run.state).toBe("hope_coaching");
    expect(prepared.run.approvedRehearsal?.coachedBeat).toBe(3);
    expect(prepared.run.coachNote).toContain("not assessed");
    const { normalizeScenarioPracticeRun } = await import("@/lib/scenarioPractice");
    expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(prepared)))?.run.coachNote).toBe(prepared.run.coachNote);
  });
  test("unverified wording is not classified as success or failure", () => {
    for (const [id, text] of [["m1-l2", "Bananas are yellow."], ["m1-l4", "Bananas are yellow."], ["m2-l2", "You are useless."], ["m2-l4", "Okay, you are an idiot."]] as const) {
      const config = approvedRehearsalConfig(id)!;
      expect(approvedRehearsalCriterion(config, text)).toBeNull();
      const note = approvedRehearsalCoachNote(config, text);
      expect(note.flags[0].status).toBe("not_assessed");
      expect(note.note).toContain("Assessment unavailable");
      expect(note.note).toContain("not assessed");
      expect(note.evidenceQuote).toBe(text);
    }
    const config = approvedRehearsalConfig("m1-l4")!;
    expect(approvedRehearsalCriterion(config, approvedRehearsalStrongVersion(config))).toBeNull();
  });
});
