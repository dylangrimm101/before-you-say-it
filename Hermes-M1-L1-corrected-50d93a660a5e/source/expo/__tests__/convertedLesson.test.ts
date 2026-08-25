import { describe, expect, test } from "bun:test";

import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import {
  M1_L1_CONVERSION,
  approvedCustomWording,
  convertedProgressFacts,
  m1L1BehaviorFlags,
  m1L1CoachNote,
  m1L1Comparison,
  m1L1EvidenceTrap,
  normalizeConvertedLessonProgress,
  routeForM1L1Safety,
  selectM1L1PushbackOne,
  semanticVoiceForScenario,
  validateM1L1Completion,
  type ConvertedLessonProgress,
} from "@/lib/convertedLesson";
import {
  commitConvertedProgress,
  resetConvertedProgressQueueForTests,
  type ConvertedProgressStorage,
} from "@/lib/convertedProgressRepository";
import { convertedHandoffDeckHtml, isApprovedM1L1DeckDigest, returnedDeckHtml } from "@/lib/approvedDeckLoader";
import {
  advanceM1L1FirstResponse,
  attachM1L1Coaching,
  attachM1L1PushbackOne,
  attachM1L1PushbackTwo,
  createScenarioPracticeRun,
  initializeM1L1Run,
  preserveM1L1Retry,
  preserveM1L1SecondResponse,
  preserveScenarioAttempt,
} from "@/lib/scenarioPractice";
import type { PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";

function fixtureDeck(): string {
  const cards = Array.from({ length: 22 }, (_, index) => `  { n:${index + 1}, type:'Card ${index + 1}' }`).join(",\n");
  const template = `const CARDS = [\n${cards}\n];\nclass Component {\n  state = { i:0, picks:{} };\n  view() { return { openHandoff:() => { this.setState({ handoffOpen:true }); }, handoffContinue:() => {} }; }\n}`;
  return `<html><script type="__bundler/template">${JSON.stringify(template)}</script></html>`;
}

function acceptedRun(id = "accepted-run"): PersistedScenarioPracticeRun {
  let value = initializeM1L1Run(createScenarioPracticeRun(M1_L1_CONVERSION.scenario, "steady", "defensive", id, 1), 1);
  const context = value.run.scenarioContext!;
  value = { ...value, run: { ...value.run, convertedModuleId: M1_L1_CONVERSION.moduleId, practiceId: M1_L1_CONVERSION.practiceId, contentVersion: M1_L1_CONVERSION.contentVersion, scenarioContext: { ...context, counterpartId: "adam", counterpartName: "Adam", counterpartRole: "your colleague", category: "work" } } };
  value = preserveScenarioAttempt(value, "opener", "The file handoff is too late. Yesterday it arrived at 4:20. Can we move it to noon?", 2);
  value = attachM1L1PushbackOne(value, selectM1L1PushbackOne(value.run.attempt!.transcript, id), 3);
  value = preserveScenarioAttempt(value, "response", "I hear quarter close is heavy. The handoff is still the point. Can we move it to noon?", 4);
  value = advanceM1L1FirstResponse(value, 5);
  value = attachM1L1PushbackTwo(value, m1L1EvidenceTrap(id), 6);
  value = preserveM1L1SecondResponse(value, "I hear that. Yesterday the file arrived at 4:20. Can we move the handoff to noon?", 7);
  const note = m1L1CoachNote(value.run.m1L1!.secondResponseAttempt!.transcript, 5)!;
  value = attachM1L1Coaching(value, `${note.worked} ${note.change}`, note.retryDirection, 5, note.flags, note.selectedDimension, 8);
  value = preserveM1L1Retry(value, "I hear that. Yesterday the file arrived at 4:20. Can we move the handoff to noon?", 9);
  const comparison = m1L1Comparison(value.run.m1L1!.secondResponseAttempt!.transcript, value.run.retryAttempt!.transcript, note.selectedDimension, 5);
  return { ...value, run: { ...value.run, state: "attempt_comparison", comparison } };
}

function progress(overrides: Partial<ConvertedLessonProgress> = {}): ConvertedLessonProgress {
  return {
    lessonId: "m1-l1",
    moduleId: "bysi_m01_get_to_the_point",
    practiceId: "bysi_m01_l01_buried_point",
    contentVersion: "m1-l1-v2.1-2026-08-24",
    runId: "run-1",
    lessonCardCheckpoint: 22,
    quizGatesCompleted: true,
    rehearsalCompleted: true,
    retryCompleted: true,
    comparisonViewed: true,
    savedMoveId: "one-point-one-proof-one-move",
    transferChoice: "say",
    completedAt: 100,
    sourceLineage: "approved-html-deck-pinned",
    ...overrides,
  };
}

class MemoryStorage implements ConvertedProgressStorage {
  value: string | null = null;
  async getItem(): Promise<string | null> { return this.value; }
  async setItem(_key: string, value: string): Promise<void> { this.value = value; }
}

describe("accepted M1 L1 narrow correction", () => {
  test("uses the accepted identity, work context, no invented duration, and remains development-only", () => {
    expect(M1_L1_CONVERSION.moduleId).toBe("bysi_m01_get_to_the_point");
    expect(M1_L1_CONVERSION.practiceId).toBe("bysi_m01_l01_buried_point");
    expect(M1_L1_CONVERSION.coachedBehaviorId).toBe("point_proof_move");
    expect(M1_L1_CONVERSION.context).toBe("work");
    expect(M1_L1_CONVERSION.counterpartId).toBe("adam");
    expect(M1_L1_CONVERSION.scenario.minutes).toBeUndefined();
    expect(M1_L1_CONVERSION.launchEligible).toBe(false);
  });

  test("selects one approved Pushback 1 only from observable opening features and keeps stable identity", () => {
    const direct = selectM1L1PushbackOne("The handoff is late. Yesterday it came at 4:20. Can we move it to noon.", "r");
    const indirect = selectM1L1PushbackOne("Do you think maybe the handoff could change?", "r");
    const motive = selectM1L1PushbackOne("You never respect my review time.", "r");
    expect([direct.text, indirect.text, motive.text]).toEqual([...M1_L1_CONVERSION.pushbackOneBank]);
    expect(selectM1L1PushbackOne("You never respect my review time.", "r")).toEqual(motive);
    expect(motive.resolvedAudioId).toBe("m1-l1-v2-1-r-pushback-1-3");
  });

  test("executes all eight authored beats with two pressures and two pre-coaching responses", () => {
    const value = acceptedRun();
    expect(value.run.attempt).toBeDefined();
    expect(value.run.m1L1?.pushbackOne?.text).toBe(M1_L1_CONVERSION.pushbackOneBank[1]);
    expect(value.run.responseAttempt).toBeDefined();
    expect(value.run.m1L1?.pushbackTwo?.text).toBe("You're acting like this happens all the time.");
    expect(value.run.m1L1?.secondResponseAttempt).toBeDefined();
    expect(value.run.m1L1?.coachedBeat).toBe(5);
    expect(value.run.m1L1?.beat).toBe(8);
    expect(value.run.m1L1?.retryCount).toBe(1);
  });

  test("hard-caps retries at two and preserves exact pressure/audio identity", () => {
    let value = acceptedRun();
    const pressure = value.run.m1L1?.pushbackTwo;
    value = preserveM1L1Retry(value, "Second and final retry.", 10);
    const capped = preserveM1L1Retry(value, "A forbidden third retry.", 11);
    expect(value.run.m1L1?.retryCount).toBe(2);
    expect(capped).toEqual(value);
    expect(value.run.m1L1?.pushbackTwo).toEqual(pressure);
  });

  test("routes all four ephemeral safety choices deterministically", () => {
    expect(routeForM1L1Safety("direct")).toBe("scene");
    expect(routeForM1L1Safety("unsure")).toBe("different-route");
    expect(routeForM1L1Safety("yes")).toBe("different-route");
    expect(routeForM1L1Safety("prefer_not")).toBe("different-route");
  });

  test("isolates Adam from partner, family, and non-converted scenarios", () => {
    expect(semanticVoiceForScenario(M1_L1_CONVERSION.scenario, M1_L1_CONVERSION)).toBe("adam_counterpart");
    expect(semanticVoiceForScenario({ ...M1_L1_CONVERSION.scenario, id: "partner", category: "partner" }, M1_L1_CONVERSION)).toBe("contextual_counterpart");
    expect(semanticVoiceForScenario({ ...M1_L1_CONVERSION.scenario, id: "family", category: "family" }, undefined)).toBe("contextual_counterpart");
  });

  test("produces scoreless flags for vague, case-building, motive, no-move, and clean turns", () => {
    const vague = m1L1BehaviorFlags("Maybe there is sort of a problem here.", 5);
    const caseBuilding = m1L1BehaviorFlags("Yesterday was late and Monday was late and the budget was wrong and everyone noticed.", 5);
    const motive = m1L1BehaviorFlags("You never care about my time.", 5);
    const noMove = m1L1BehaviorFlags("Yesterday the file arrived at 4:20.", 5);
    const clean = m1L1BehaviorFlags("I hear that. Yesterday the file arrived at 4:20. Can we move the handoff to noon?", 5);
    expect(vague.find((f) => f.dimension === "grounding_concreteness")?.status).toBe("not_met");
    expect(caseBuilding.find((f) => f.dimension === "evidence_discipline")?.status).toBe("not_met");
    expect(motive.find((f) => f.dimension === "motive_character_language")?.status).toBe("not_met");
    expect(noMove.find((f) => f.dimension === "move_clarity")?.status).toBe("not_met");
    expect(clean.find((f) => f.dimension === "evidence_discipline")?.status).toBe("met");
    expect(clean.find((f) => f.dimension === "move_clarity")?.status).toBe("met");
    expect(clean.find((f) => f.dimension === "park_and_return")?.status).toBe("met");
  });

  test("keeps Hope's exact quote and bounded 32/20/48-word output", () => {
    const transcript = "I hear that. Yesterday the file arrived at 4:20. Can we move the handoff to noon?";
    const note = m1L1CoachNote(transcript, 5)!;
    expect(transcript).toContain(note.evidenceQuote);
    expect(`${note.worked} ${note.change}`.split(/\s+/).length).toBeLessThanOrEqual(32);
    expect(note.retryDirection.split(/\s+/).length).toBeLessThanOrEqual(20);
    expect(`${note.worked} ${note.change} ${note.retryDirection}`.split(/\s+/).length).toBeLessThanOrEqual(48);
    expect(JSON.stringify(note)).not.toMatch(/score|percent|grade|mastery/i);
  });

  test("derives comparison truthfully from the same selected flag", () => {
    const result = m1L1Comparison("You never care about the handoff.", "Yesterday it arrived at 4:20. Can we move it to noon?", "motive_character_language", 5);
    expect(result.criterionChanged).toBe(true);
    expect(result.selectedDimension).toBe("motive_character_language");
    expect(result.text.split(/\s+/).length).toBeLessThanOrEqual(36);
  });

  test("rejects query-only, unrelated, stale-version, and incomplete completion", () => {
    const valid = acceptedRun();
    expect(validateM1L1Completion(valid.run, valid.run.id).isValid).toBe(true);
    expect(validateM1L1Completion(valid.run, "other").reason).toBe("run_id");
    expect(validateM1L1Completion({ ...valid.run, contentVersion: "old" }, valid.run.id).reason).toBe("manifest_identity");
    expect(validateM1L1Completion({ ...valid.run, m1L1: { ...valid.run.m1L1!, secondResponseAttempt: undefined } }, valid.run.id).reason).toBe("turn_plan");
  });

  test("pins executable deck authenticity to M1 L1 path, version, and SHA-256", () => {
    const path = "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html";
    const digest = "aa4f4016888794b8f43139e8defdc01c14c4455476fa47f7d1ebb94cd412bd9e";
    expect(isApprovedM1L1DeckDigest(path, M1_L1_CONVERSION.contentVersion, digest)).toBe(true);
    expect(isApprovedM1L1DeckDigest(path, "old-version", digest)).toBe(false);
    expect(isApprovedM1L1DeckDigest(path, M1_L1_CONVERSION.contentVersion, "tampered")).toBe(false);
    expect(isApprovedM1L1DeckDigest("other.html", M1_L1_CONVERSION.contentVersion, digest)).toBe(false);
  });

  test("slices handoff before rehearsal and authorizes only Cards 21–22 after return", () => {
    const handoff = convertedHandoffDeckHtml(fixtureDeck(), 20);
    const returned = returnedDeckHtml(fixtureDeck(), 21, 22);
    expect(handoff).toContain("start-rehearsal");
    expect(handoff).not.toContain("{ n:21, type:");
    expect(returned).not.toContain("{ n:20, type:");
    expect(returned).toContain("{ n:21, type:");
    expect(returned).toContain("{ n:22, type:");
  });

  test("strictly normalizes mixed progress and preserves prior versions", () => {
    const old = progress({ contentVersion: "m1-l1-v2.0", completedAt: 50 });
    const malformed = { ...progress(), transferChoice: "score_me" };
    const valid = normalizeConvertedLessonProgress([old, malformed, progress()]);
    expect(valid).toHaveLength(2);
    expect(valid.map((item) => item.contentVersion)).toEqual(["m1-l1-v2.0", "m1-l1-v2.1-2026-08-24"]);
  });

  test("serializes stale/interleaved writes against latest durable data without regression", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryStorage();
    const newer = progress({ completedAt: 200, transferChoice: "write" });
    const stale = progress({ completedAt: 100, transferChoice: "say" });
    await Promise.all([commitConvertedProgress(storage, newer), commitConvertedProgress(storage, stale)]);
    const records = normalizeConvertedLessonProgress(JSON.parse(storage.value ?? "[]"));
    expect(records).toHaveLength(1);
    expect(records[0]?.completedAt).toBe(200);
    expect(records[0]?.transferChoice).toBe("write");
  });

  test("strict deletion failure rejects completion and leaves legacy scored bytes untouched", async () => {
    const scoredBytes = '[{"id":"legacy","overallIndex":72}]';
    let committed = false;
    await expect(finalizeConvertedLesson(progress(), {
      commit: async () => { committed = true; },
      clearActiveRunStrict: async () => { throw new Error("remove failed"); },
    })).rejects.toThrow("remove failed");
    expect(committed).toBe(true);
    expect(scoredBytes).toBe('[{"id":"legacy","overallIndex":72}]');
  });

  test("requires explicit custom wording consent and exposes countable scoreless facts", () => {
    expect(approvedCustomWording("  My chosen line.  ")).toBe("My chosen line.");
    expect(approvedCustomWording(" ")).toBeNull();
    expect(convertedProgressFacts(progress())).toEqual(["Practice completed", "Retry completed", "Move saved", "Lesson completed"]);
  });
});
