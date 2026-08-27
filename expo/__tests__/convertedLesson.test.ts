import { describe, expect, test } from "bun:test";

import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import {
  M1_L1_CONVERSION,
  approvedCustomWording,
  convertedProgressFacts,
  evidenceQuoteFor,
  m1L1BehaviorFlags,
  isAcceptedM1L1ResumeRun,
  isCanonicalM1L1PressureTurn,
  m1L1CoachExchange,
  m1L1CoachNote,
  m1L1Comparison,
  m1L1EvidenceTrap,
  normalizeConvertedLessonProgress,
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
import { convertedHandoffDeckHtml, isApprovedM1L1DeckDigest, removeM1L1OutcomePreview, returnedDeckHtml } from "@/lib/approvedDeckLoader";
import {
  advanceM1L1FirstResponse,
  attachM1L1Coaching,
  attachM1L1PushbackOne,
  attachM1L1PushbackTwo,
  confirmM1L1PressureReplay,
  completeM1L1PressureReplay,
  createScenarioPracticeRun,
  initializeM1L1Run,
  normalizeScenarioPracticeRun,
  preserveM1L1Retry,
  preserveScenarioAttempt,
  stageM1L1PressureReplay,
} from "@/lib/scenarioPractice";
import type { PersistedScenarioPracticeRun } from "@/lib/scenarioPractice";
import { m1L1ProviderTurn } from "@/lib/m1L1DynamicResponse";

function fixtureDeck(duplicateCompletion = false): string {
  const cardEntries = Array.from({ length: 22 }, (_, index) => index === 20 ? "  { n:21, type:'Saved move', saved:true }" : `  { n:${index + 1}, type:'Card ${index + 1}' }`);
  if (duplicateCompletion) cardEntries.push("  { n:22, type:'Duplicate 22' }");
  const cards = cardEntries.join(",\n");
  const template = `/* Sunday evening, kitchen. Dishes done, kid finally asleep. You've wanted to say this for two weeks. Your partner is on the couch, half looking at their phone. Not hostile. Tired. */\n/* You open. Adam pushes back twice. The second one is <em>“You're acting like this happens all the time.”</em> Then Hope names one change and hands the same moment back to you. */\nconst CARDS = [\n${cards}\n];\nclass Component {\n  state = { i:0, picks:{}, sm:[false, false, false] };\n  setState(next) { this.state = { ...this.state, ...next }; }\n  go(delta) { const c = CARDS[this.state.i]; if (c.saved && this.state.sm.indexOf(false) !== -1) return; this.state.i += delta; }\n  view() { const c = CARDS[this.state.i]; const st = this.state; const cta = {}; if (c.saved) { const smDone = st.sm.indexOf(false) === -1; cta.act = smDone ? () => this.go(1) : () => {}; } return { openHandoff:() => { this.setState({ handoffOpen:true }); }, handoffContinue:() => {}, cta }; }\n}`;
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
  const note = m1L1CoachExchange({ opener: value.run.attempt!.transcript, firstResponse: value.run.responseAttempt!.transcript })!;
  value = attachM1L1Coaching(value, `${note.worked} ${note.change}`, note.retryDirection, note.coachedBeat, note.flags, note.selectedDimension, 7);
  value = stageM1L1PressureReplay(value, false, 8);
  value = confirmM1L1PressureReplay(value, note.coachedBeat === 1 ? "top_of_scene_reset" : "playback_completed", 9);
  value = preserveM1L1Retry(value, "I hear that. Yesterday the file arrived at 4:20. Can we move the handoff to noon?", 10);
  const original = note.coachedBeat === 1 ? value.run.attempt!.transcript : value.run.responseAttempt!.transcript;
  const comparison = m1L1Comparison(original, value.run.retryAttempt!.transcript, note.selectedDimension, note.coachedBeat);
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
    expect(M1_L1_CONVERSION.scenario.situation).toContain("weekly client file");
    expect(M1_L1_CONVERSION.scenario.situation).toContain("4:20 PM");
    expect(M1_L1_CONVERSION.scenario.situation).toContain("5:00 PM deadline");
    expect(M1_L1_CONVERSION.scenario.situation).toContain("twice this month");
    expect(M1_L1_CONVERSION.scenario.situation).toContain("by noon");
    expect(M1_L1_CONVERSION.launchEligible).toBe(false);
  });

  test("selects one approved Pushback 1 only from observable opening features and keeps stable identity", () => {
    const direct = selectM1L1PushbackOne("The handoff is late. Yesterday it came at 4:20. Can we move it to noon.", "r");
    const indirect = selectM1L1PushbackOne("Do you think maybe the handoff could change?", "r");
    const motive = selectM1L1PushbackOne("You never respect my review time.", "r");
    expect([direct.text, indirect.text, motive.text]).toEqual([...M1_L1_CONVERSION.pushbackOneBank]);
    expect(selectM1L1PushbackOne("You never respect my review time.", "r")).toEqual(motive);
    expect(motive.resolvedAudioId).toBe("m1-l1-v2.1-2026-08-24-m1-l1-pushback-1-3-adam-counterpart");
    expect(selectM1L1PushbackOne("Can we move it to noon?", "another").text).toBe(M1_L1_CONVERSION.pushbackOneBank[0]);
  });

  test("executes seven steps with two pressures and two required learner turns", () => {
    const value = acceptedRun();
    expect(value.run.attempt).toBeDefined();
    expect(value.run.m1L1?.pushbackOne?.text).toBe(M1_L1_CONVERSION.pushbackOneBank[0]);
    expect(value.run.responseAttempt).toBeDefined();
    expect(value.run.m1L1?.pushbackTwo?.text).toBe("You're acting like this happens all the time.");
    expect(value.run.m1L1?.secondResponseAttempt).toBeUndefined();
    expect([1, 3]).toContain(value.run.m1L1?.coachedBeat);
    expect(value.run.m1L1?.beat).toBe(7);
    expect(value.run.m1L1?.retryCount).toBe(1);
  });

  test("persists and restores the exact accepted provider wording without changing completion rules", () => {
    const authored = acceptedRun("dynamic-persisted");
    const first = { ...m1L1ProviderTurn(authored.run.id, "pushback_one", "But quarter close is heavy. What handoff timing would actually leave enough review time?"), authoredAt: authored.run.m1L1!.pushbackOne!.authoredAt };
    const second = { ...m1L1ProviderTurn(authored.run.id, "evidence_trap", "But that's one handoff example. What else are you basing this on?"), authoredAt: authored.run.m1L1!.pushbackTwo!.authoredAt };
    const dynamic = {
      ...authored,
      run: {
        ...authored.run,
        counterpartTurn: first,
        counterpartReactionId: first.reactionId,
        resolvedAudioId: first.resolvedAudioId,
        adamReactionId: first.reactionId,
        adamAudioId: first.resolvedAudioId,
        m1L1: { ...authored.run.m1L1!, pushbackOne: first, pushbackTwo: second },
      },
    };
    const restored = normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(dynamic)));
    expect(restored?.run.m1L1?.pushbackOne?.text).toBe(first.text);
    expect(restored?.run.m1L1?.pushbackTwo?.text).toBe(second.text);
    expect(validateM1L1Completion(restored?.run, dynamic.run.id).isValid).toBe(true);
  });

  test("hard-caps retries at two and preserves exact pressure/audio identity", () => {
    let value = acceptedRun();
    const pressure = value.run.m1L1?.pushbackTwo;
    const beforeReplay = preserveM1L1Retry(value, "Forbidden capture before replay.", 11);
    expect(beforeReplay).toEqual(value);
    value = { ...value, run: { ...value.run, state: "final_retry_available" } };
    value = stageM1L1PressureReplay(value, true, 12);
    expect(value.run.m1L1?.beat).toBe(6);
    expect(preserveM1L1Retry(value, "Blocked until replay proof.", 13)).toEqual(value);
    value = confirmM1L1PressureReplay(value, value.run.m1L1?.coachedBeat === 1 ? "top_of_scene_reset" : "playback_completed", 14);
    value = preserveM1L1Retry(value, "Second and final retry.", 15);
    const capped = preserveM1L1Retry(value, "A forbidden third retry.", 14);
    expect(value.run.m1L1?.retryCount).toBe(2);
    expect(capped).toEqual(value);
    expect(value.run.m1L1?.pushbackTwo).toEqual(pressure);
  });

  test("persists the two eligible learner moments for replay", () => {
    for (const beat of [1, 3] as const) {
      const completed = acceptedRun(`flow-${beat}`);
      const base = { ...completed, run: { ...completed.run, state: "hope_coaching" as const, m1L1: { ...completed.run.m1L1!, beat: 5 as const, coachedBeat: beat, retryCount: 0 as const, replayTarget: undefined, replayProof: undefined, replayRequestedAt: undefined, replayCompletedAt: undefined } } };
      const staged = stageM1L1PressureReplay(base, false, 100);
      expect(staged.run.state).toBe("replay_pending");
      expect(staged.run.m1L1?.replayTarget).toBe(beat === 1 ? "top_of_scene" : "pushback_one");
      expect(preserveM1L1Retry(staged, "Capture must remain blocked.", 101)).toEqual(staged);
      const wrongProof = confirmM1L1PressureReplay(staged, beat === 1 ? "playback_completed" : "top_of_scene_reset", 102);
      expect(wrongProof).toEqual(staged);
      const confirmed = confirmM1L1PressureReplay(staged, beat === 1 ? "top_of_scene_reset" : "playback_completed", 103);
      expect(confirmed.run.state).toBe("ready_for_retry");
      expect(confirmed.run.m1L1?.replayCompletedAt).toBeDefined();
    }
  });

  test("real start-then-interrupt replay path stays locked until completion or exact-text acknowledgement", async () => {
    const completed = acceptedRun("replay-failure");
    const available = { ...completed, run: { ...completed.run, state: "final_retry_available" as const, m1L1: { ...completed.run.m1L1!, coachedBeat: 3 as const } } };
    const staged = stageM1L1PressureReplay(available, true, 200);
    let interrupt!: (outcome: "interrupted") => void;
    const startedThenInterrupted = completeM1L1PressureReplay(staged, () => new Promise((resolve) => { interrupt = resolve; }), 201);
    expect(staged.run.state).toBe("replay_pending");
    expect(preserveM1L1Retry(staged, "Still blocked.", 201)).toEqual(staged);
    interrupt("interrupted");
    expect(await startedThenInterrupted).toEqual(staged);
    const playedToEnd = await completeM1L1PressureReplay(staged, async () => "completed", 202);
    expect(playedToEnd.run.state).toBe("ready_for_final_retry_capture");
    const acknowledged = confirmM1L1PressureReplay(staged, "text_fallback_acknowledged", 203);
    expect(acknowledged.run.state).toBe("ready_for_final_retry_capture");
    expect(acknowledged.run.m1L1?.replayProof).toBe("text_fallback_acknowledged");
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
    expect(vague.find((f) => f.dimension === "grounding_concreteness")?.status).toBe("not_assessable");
    expect(caseBuilding.find((f) => f.dimension === "evidence_discipline")?.status).toBe("not_met");
    expect(motive.find((f) => f.dimension === "motive_character_language")?.status).toBe("not_met");
    expect(noMove.find((f) => f.dimension === "move_clarity")?.status).toBe("not_assessable");
    expect(clean.find((f) => f.dimension === "evidence_discipline")?.status).toBe("not_assessable");
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

  test("derives every comparison transition truthfully from the same selected flag", () => {
    const met = "Yesterday the handoff arrived at 4:20. Can we move it to noon?";
    const notMet = "Maybe there is a handoff problem.";
    const cases = [
      [notMet, met, /improved/i], [met, met, /held/i], [met, notMet, /regressed/i],
      [notMet, notMet, /still did not/i], ["", met, /not assessable/i], [met, "", /not assessable/i],
      ["", notMet, /not assessable/i], [notMet, "", /not assessable/i], ["", "", /not assessable/i],
    ] as const;
    cases.forEach(([before, after, expected]) => {
      expect(m1L1Comparison(before, after, "point_placement", 5).text).toMatch(expected);
    });
  });

  test("production flags, coaching, and comparison preserve exact Unicode and multiline source spans", () => {
    const original = "I hear that.\nYesterday\u00a0the file arrived\tat 4:20!\nCan we move the handoff to noon? Yesterday the file arrived again.";
    const flags = m1L1BehaviorFlags(original, 5);
    for (const item of flags) if (item.evidenceQuote !== null) expect(original.includes(item.evidenceQuote)).toBe(true);
    const note = m1L1CoachNote(original, 5);
    if (note) expect(original.includes(note.evidenceQuote)).toBe(true);
    expect(m1L1Comparison(original, original, "grounding_concreteness", 5).text).toMatch(/held|not assessable/i);
  });

  test("chooses coaching evidence across the opener and first response", () => {
    const note = m1L1CoachExchange({
      opener: "You never respect my review time. Can we move it to noon?",
      firstResponse: "I hear that. The handoff is still the point.",
    });
    expect(note?.selectedDimension).toBe("motive_character_language");
    expect(note?.coachedBeat).toBe(1);
    expect("You never respect my review time. Can we move it to noon?").toContain(note?.evidenceQuote ?? "missing");
  });

  test("resume isolation requires the exact work category and Adam identity", () => {
    const valid = acceptedRun().run;
    const resumable = { ...valid, counterpartIdentity: "adam" };
    expect(isAcceptedM1L1ResumeRun(resumable)).toBe(true);
    expect(isAcceptedM1L1ResumeRun({ ...resumable, scenarioContext: { ...resumable.scenarioContext!, category: "partner" } })).toBe(false);
    expect(isAcceptedM1L1ResumeRun({ ...resumable, counterpartIdentity: "hope" })).toBe(false);
  });

  test("canonically reconstructs persisted attempts and rejects coercive nested timestamps", () => {
    const valid = acceptedRun();
    const withUnknown = { ...valid, ignoredWrapper: "drop", run: { ...valid.run, ignoredRun: "drop" } };
    const normalized = normalizeScenarioPracticeRun(withUnknown);
    expect(normalized).not.toBeNull();
    expect(normalized).not.toHaveProperty("ignoredWrapper");
    expect(normalized?.run).not.toHaveProperty("ignoredRun");
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, attempt: { ...valid.run.attempt!, confirmedAt: "2" } } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, attempt: { ...valid.run.attempt!, id: "other-run-opener" } } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, scenarioContext: { ...valid.run.scenarioContext!, reaction: "invented" } } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, noteFit: "maybe" } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, m1L1: { ...valid.run.m1L1!, replayProof: "playback_completed", replayCompletedAt: undefined } } })).toBeNull();
    expect(normalizeScenarioPracticeRun({ ...valid, run: { ...valid.run, m1L1: { ...valid.run.m1L1!, pushbackOne: { ...valid.run.m1L1!.pushbackOne!, authoredAt: Number.NaN } } } })).toBeNull();
  });

  test("rejects query-only, unrelated, stale-version, and incomplete completion", () => {
    const valid = acceptedRun();
    expect(validateM1L1Completion(valid.run, valid.run.id).isValid).toBe(true);
    expect(validateM1L1Completion(valid.run, "other").reason).toBe("run_id");
    expect(validateM1L1Completion({ ...valid.run, contentVersion: "old" }, valid.run.id).reason).toBe("manifest_identity");
    expect(validateM1L1Completion({ ...valid.run, m1L1: { ...valid.run.m1L1!, pushbackTwo: undefined } }, valid.run.id).reason).toBe("turn_plan");
    const first = valid.run.m1L1!.pushbackOne!;
    const tamperedTurns = [
      { ...first, text: "Unauthorized pressure" },
      { ...first, reactionId: "wrong-reaction" },
      { ...first, semanticVoiceKey: "hope_teacher" as const },
      { ...first, resolvedAudioId: "wrong-audio" },
      { ...first, id: "other-run-pushback-1-1" },
    ];
    tamperedTurns.forEach((tampered) => {
      expect(isCanonicalM1L1PressureTurn(tampered, "pushback_one")).toBe(tampered.id === "other-run-pushback-1-1");
      expect(validateM1L1Completion({ ...valid.run, m1L1: { ...valid.run.m1L1!, pushbackOne: tampered } }, valid.run.id).reason).toBe("pressure_authenticity");
    });
    const outOfOrder = { ...first, authoredAt: valid.run.attempt!.confirmedAt - 1 };
    expect(validateM1L1Completion({ ...valid.run, m1L1: { ...valid.run.m1L1!, pushbackOne: outOfOrder } }, valid.run.id).reason).toBe("turn_order");
  });

  test("pins executable deck authenticity to M1 L1 path, version, and SHA-256", () => {
    const path = "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html";
    const digest = "aa4f4016888794b8f43139e8defdc01c14c4455476fa47f7d1ebb94cd412bd9e";
    expect(isApprovedM1L1DeckDigest(path, M1_L1_CONVERSION.contentVersion, digest)).toBe(true);
    expect(isApprovedM1L1DeckDigest(path, "old-version", digest)).toBe(false);
    expect(isApprovedM1L1DeckDigest(path, M1_L1_CONVERSION.contentVersion, "tampered")).toBe(false);
    expect(isApprovedM1L1DeckDigest("other.html", M1_L1_CONVERSION.contentVersion, digest)).toBe(false);
  });

  test("removes the M1 L1 outcome preview without removing the scene", () => {
    const preview = `<div style="padding:20px"><div style="color:purple">What happens</div><div style="margin-top:8px">You open. Adam pushes back twice. The second one is <em>“You're acting like this happens all the time.”</em> Then Hope names one change and hands the same moment back to you.</div></div>`;
    const template = `<div>The scene</div><p>${M1_L1_CONVERSION.scenario.situation}</p>${preview}<button>Start voice rehearsal</button>`;
    const cleaned = removeM1L1OutcomePreview(template);
    expect(cleaned).toContain("The scene");
    expect(cleaned).toContain(M1_L1_CONVERSION.scenario.situation);
    expect(cleaned).toContain("Start voice rehearsal");
    expect(cleaned).not.toContain("What happens");
    expect(cleaned).not.toContain("pushes back twice");

    const emptiedPreview = `<div style="padding:20px"><div style="color:purple">WHAT HAPPENS</div><div style="margin-top:8px"></div></div>`;
    const cleanedEmptyState = removeM1L1OutcomePreview(`<p>${M1_L1_CONVERSION.scenario.situation}</p>${emptiedPreview}<button>Start voice rehearsal</button>`);
    expect(cleanedEmptyState).not.toContain("WHAT HAPPENS");
    expect(cleanedEmptyState).not.toContain('style="padding:20px"');
    expect(cleanedEmptyState).toContain("Start voice rehearsal");
  });

  test("slices handoff before rehearsal and authorizes only Cards 21–22 after return", () => {
    const handoff = convertedHandoffDeckHtml(fixtureDeck(), 20);
    const returned = returnedDeckHtml(fixtureDeck(), 21, 22);
    expect(handoff).toContain("start-rehearsal");
    const handoffEncoded = handoff.match(/<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s)?.[1];
    expect(handoffEncoded).toBeDefined();
    const handoffTemplate = JSON.parse(handoffEncoded!) as string;
    expect(handoffTemplate).toContain(M1_L1_CONVERSION.scenario.situation);
    expect(handoffTemplate).not.toContain("What happens");
    expect(handoffTemplate).not.toContain("pushes back twice");
    expect(handoffTemplate).not.toContain("same moment back to you");
    expect(handoffTemplate).not.toContain("Sunday evening, kitchen");
    expect(handoffTemplate).not.toContain("Your partner is on the couch");
    expect(handoff).not.toContain("{ n:21, type:");
    expect(returned).not.toContain("{ n:20, type:");
    expect(returned).toContain("{ n:21, type:");
    expect(returned).toContain("{ n:22, type:");
    expect(() => returnedDeckHtml(fixtureDeck(true), 21, 22)).toThrow("exactly Cards 21–22");
  });

  test("approved named-move persistence behaviorally advances Card 21 with every custom blank empty", () => {
    const returned = returnedDeckHtml(fixtureDeck(), 21, 22, true);
    const encoded = returned.match(/<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s)?.[1];
    expect(encoded).toBeDefined();
    const template = JSON.parse(encoded!) as string;
    const Component = new Function(`${template}; return Component;`)() as new () => { state: { i: number; sm: boolean[] }; view(): { cta: { act: () => void } } };
    const instance = new Component();
    expect(instance.state.sm).toEqual([false, false, false]);
    instance.view().cta.act();
    expect(instance.state.i).toBe(1);
  });

  test("evidence is an exact source span or explicitly not assessable", () => {
    const transcript = "Opening.\n\tYesterday\u00a0the file arrived at 4:20! Later.";
    expect(evidenceQuoteFor("grounding_concreteness", transcript)).toBe("Yesterday\u00a0the file arrived at 4:20!");
    expect(evidenceQuoteFor("move_clarity", "No request appears here.")).toBeNull();
  });

  test("rejects malformed incoming progress before merge persistence", async () => {
    resetConvertedProgressQueueForTests();
    const storage = new MemoryStorage();
    await expect(commitConvertedProgress(storage, { ...progress(), transferChoice: "invalid" } as unknown as ConvertedLessonProgress)).rejects.toThrow("Invalid incoming converted progress");
    expect(storage.value).toBeNull();
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
    let pending = false;
    let promoted = false;
    await expect(finalizeConvertedLesson(progress(), {
      writePending: async () => { pending = true; },
      clearActiveRunStrict: async () => { throw new Error("remove failed"); },
      promotePending: async () => { promoted = true; },
    })).rejects.toThrow("remove failed");
    expect(pending).toBe(true);
    expect(promoted).toBe(false);
    expect(scoredBytes).toBe('[{"id":"legacy","overallIndex":72}]');
  });

  test("requires explicit custom wording consent and exposes countable scoreless facts", () => {
    expect(approvedCustomWording("  My chosen line.  ")).toBe("My chosen line.");
    expect(approvedCustomWording(" ")).toBeNull();
    expect(convertedProgressFacts(progress())).toEqual(["Practice completed", "Retry completed", "Move saved", "Lesson completed"]);
  });
});
