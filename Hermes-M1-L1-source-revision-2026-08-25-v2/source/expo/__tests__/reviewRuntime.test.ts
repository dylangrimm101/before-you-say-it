import { describe, expect, test } from "bun:test";

import { CURRICULUM_MODULES } from "@/constants/modules";
import {
  REVIEW_CURRICULUM,
  REVIEW_PRACTICES,
  isInternalReviewModuleComplete,
  reviewPracticeRuntime,
  runnableReviewPractices,
} from "@/lib/modularCurriculum";
import {
  comparePilotAttempts,
  validatePilotCoachResponse,
  validatePilotComparison,
  wordCount,
} from "@/lib/pilotCurriculum";
import {
  createPilotDayRun,
  createPresetPracticeSession,
  normalizePracticeSession,
  preservePilotAttempt,
  transitionPilotRun,
  upsertPilotDayRun,
} from "@/lib/practiceSession";
import type { PilotCoachResponse, PilotComparison } from "@/types/pilotCurriculum";

describe("43-practice canonical runtime adapter", () => {
  test("builds all and only 43 runnable records for the existing paid engine", () => {
    const runnable = runnableReviewPractices();
    expect(runnable).toHaveLength(43);
    for (const practice of runnable) {
      const definition = reviewPracticeRuntime(practice.practiceId, "internal_review");
      expect(definition?.identity.practiceId).toBe(practice.practiceId);
      expect(definition?.module.practice_id).toBe(practice.practiceId);
      expect(definition?.module.duration_minutes).toBeUndefined();
      expect(definition?.module.copy.lessons.length).toBeGreaterThan(0);
      expect(definition?.module.copy.quiz).toBeDefined();
      expect(definition?.module.copy.scenario).toBeDefined();
    }
    for (const practice of REVIEW_PRACTICES.filter((item) => item.runtimeStatus !== "runnable")) {
      expect(reviewPracticeRuntime(practice.practiceId, "internal_review")).toBeNull();
    }
  });

  test("keeps practice and module completion distinct", () => {
    for (const module of CURRICULUM_MODULES) {
      const required = runnableReviewPractices(module.id);
      const all = new Set(required.map((practice) => practice.practiceId));
      const incomplete = new Set([...all].slice(0, -1));
      expect(isInternalReviewModuleComplete(module.id, incomplete)).toBe(false);
      expect(isInternalReviewModuleComplete(module.id, all)).toBe(true);
    }
  });

  test("contains no universal Adam identity in review curriculum presentation copy", () => {
    expect(JSON.stringify(REVIEW_CURRICULUM.modules)).not.toMatch(/\bAdam\b/);
  });

  test("persists stable practice identity independently of compatibility day", () => {
    const definition = reviewPracticeRuntime("lar_genuine_question", "internal_review")!;
    const session = createPresetPracticeSession("anon", 1);
    const run = createPilotDayRun(session, definition.module.day, 2, definition.identity.moduleId, definition.identity.practiceId, definition.identity.contentVersion);
    expect(run.practiceId).toBe("lar_genuine_question");
    expect(run.moduleId).toBe("listen_and_respond");
    expect(run.id).toContain("lar_genuine_question");
  });
});

describe("counterpart, restart, and completion invariants", () => {
  test("protects text, identity, turn, reaction, and audio through retry writes", () => {
    const session = createPresetPracticeSession("anon", 1);
    const run = {
      ...createPilotDayRun(session, 104, 2, "listen_and_respond", "lar_genuine_question", "0.1-review"),
      counterpartTurn: { id: "turn-1", text: "What do you mean by that?", source: "authored" as const },
      counterpartIdentity: "Priya",
      counterpartReactionId: "mild-question",
      resolvedAudioId: "audio-1",
      adamReactionId: "mild-question",
      adamAudioId: "audio-1",
      coachedSegment: "opener" as const,
      retryResetId: "pre-opener-reset-1",
    };
    const stored = upsertPilotDayRun(session, run, 3);
    const incoming = {
      ...run,
      counterpartTurn: { id: "turn-2", text: "replacement", source: "provider" as const },
      counterpartIdentity: "Sam",
      counterpartReactionId: "replacement",
      resolvedAudioId: "audio-2",
      adamReactionId: "replacement",
      adamAudioId: "audio-2",
      coachedSegment: "pushback_response" as const,
      retryResetId: "replacement-reset",
    };
    const protectedSession = upsertPilotDayRun(stored, incoming, 4);
    const restored = protectedSession.pilotRuns.lar_genuine_question;
    expect(restored?.counterpartTurn).toEqual(run.counterpartTurn);
    expect(restored?.counterpartIdentity).toBe("Priya");
    expect(restored?.counterpartReactionId).toBe("mild-question");
    expect(restored?.resolvedAudioId).toBe("audio-1");
    expect(restored?.coachedSegment).toBe("opener");
    expect(restored?.retryResetId).toBe("pre-opener-reset-1");
  });

  test("preserves either Priya or Sam through serialization and restart", () => {
    for (const identity of ["Priya", "Sam"]) {
      const session = createPresetPracticeSession("anon", 1);
      const run = { ...createPilotDayRun(session, 105, 2, "listen_and_respond", `practice-${identity}`), counterpartIdentity: identity };
      const restored = normalizePracticeSession(JSON.parse(JSON.stringify(upsertPilotDayRun(session, run))) as unknown);
      expect(restored?.pilotRuns[`practice-${identity}`]?.counterpartIdentity).toBe(identity);
    }
  });

  test("persists accepted Day 3 fit and prevents rejected coaching from returning", () => {
    const session = createPresetPracticeSession("anon", 1);
    const base = createPilotDayRun(session, 3, 2, "stay_clear_under_pushback", "scp_notice_pressure_move");
    const accepted = upsertPilotDayRun(session, { ...base, noteFit: "accepted", coachNote: "Specific note" });
    const acceptedRestart = normalizePracticeSession(JSON.parse(JSON.stringify(accepted)) as unknown);
    expect(acceptedRestart?.pilotRuns.scp_notice_pressure_move?.noteFit).toBe("accepted");
    const rejected = upsertPilotDayRun(accepted, { ...base, state: "day3_neutral_retry", noteFit: "rejected", coachNote: undefined });
    const rejectedRestart = normalizePracticeSession(JSON.parse(JSON.stringify(rejected)) as unknown);
    expect(rejectedRestart?.pilotRuns.scp_notice_pressure_move?.noteFit).toBe("rejected");
    expect(rejectedRestart?.pilotRuns.scp_notice_pressure_move?.coachNote).toBeUndefined();
  });

  test("cannot complete before retry, comparison, and transfer", () => {
    const session = createPresetPracticeSession("anon", 1);
    const run = createPilotDayRun(session, 102, 2, "get_to_the_point", "gtp_keep_point_present");
    expect(transitionPilotRun(run, "complete")).toBe(run);
    const retried = preservePilotAttempt(run, "retry", "I hear that. I still want to decide bedtime.");
    expect(transitionPilotRun(retried, "complete")).toBe(retried);
    const compared = { ...retried, state: "attempt_comparison" as const, comparison: comparePilotAttempts("return_to_point", "I hear that", "I hear that. I still want to decide bedtime.") };
    expect(transitionPilotRun(compared, "complete")).toBe(compared);
    const transfer = transitionPilotRun(compared, "transfer_cue");
    expect(transitionPilotRun(transfer, "complete").state).toBe("complete");
  });
});

describe("special contracts and exact output boundaries", () => {
  test("keeps Day 4 modeled pause without pause or latency scoring", () => {
    const definition = reviewPracticeRuntime("psb_create_choice", "internal_review")!;
    expect(definition.module.copy.quiz?.option_b.leading_pause_ms).toBe(650);
    const content = definition.identity.content!;
    expect(content.audio_contract?.rehearsal_pause_duration_scored).toBe(false);
    expect(content.audio_contract?.manual_recording_latency_is_not_conversational_evidence).toBe(true);
  });

  test("keeps Day 7 actor, action, condition, autonomy, counteroffer, and refusal contracts", () => {
    const content = reviewPracticeRuntime("mca_answerable_action", "internal_review")!.identity.content!;
    const contract = `${content.lesson_cards.join(" ")} ${content.coaching_contract.may_evaluate.join(" ")} ${content.coaching_contract.may_not_infer.join(" ")} ${content.preset_scenario.user_response_objective}`;
    expect(contract).toMatch(/action/i);
    expect(contract).toMatch(/person|who/i);
    expect(contract).toMatch(/timing|when|nights/i);
    expect(contract).toMatch(/accept, decline, or change|permits an answer/i);
    expect(contract).toMatch(/loyalty|love/i);
    expect(contract).toMatch(/adjust|what would work/i);
    expect(contract).toMatch(/refusal/i);
  });

  test("keeps both Day 8 branch contracts and exact pushback replay", () => {
    const definition = reviewPracticeRuntime("stc_mild_pushback", "internal_review")!;
    const content = definition.identity.content!;
    expect(content.retry.branches?.opener).toMatch(/same selected pushback/i);
    expect(content.retry.branches?.pushback_response).toMatch(/same selected pushback/i);
    expect(definition.module.practice.approved_pushback_bank).toHaveLength(4);
    expect(new Set(definition.module.practice.approved_pushback_bank?.map((line) => line.audio_id)).size).toBe(4);
  });

  test("accepts exact 32/16 and 28/20 coaching boundaries totaling 48", () => {
    const module = reviewPracticeRuntime("mca_answerable_action", "internal_review")!.module;
    const make = (noteWords: number, retryWords: number): PilotCoachResponse => ({
      route: "coach",
      day: module.day,
      evidenceQuote: "clear",
      behaviorId: module.primary_behavior_id,
      note: ["clear", ...Array.from({ length: noteWords - 1 }, () => "word")].join(" "),
      retryInstruction: Array.from({ length: retryWords }, () => "move").join(" "),
      retryPrompt: "Try that same moment again.",
    });
    expect(validatePilotCoachResponse(make(32, 16), module, "clear request")).toEqual([]);
    expect(validatePilotCoachResponse(make(28, 20), module, "clear request")).toEqual([]);
    expect(validatePilotCoachResponse(make(32, 17), module, "clear request")).toContain("note and retry exceed 48 words");
  });

  test("rejects adversarial inference language", () => {
    const module = reviewPracticeRuntime("lar_reflect_and_check", "internal_review")!.module;
    for (const phrase of ["emotion", "sincerity", "nervous-system", "confidence", "motive", "attachment", "relationship"]) {
      const value: PilotCoachResponse = { route: "coach", day: module.day, evidenceQuote: "clear", behaviorId: module.primary_behavior_id, note: `clear shows ${phrase}`, retryInstruction: "Ask one question", retryPrompt: "Try that same moment again." };
      expect(validatePilotCoachResponse(value, module, "clear")).toContain("prohibited coaching claim or style");
    }
  });

  test("requires concrete one-behavior comparison and enforces 36 words", () => {
    const comparison = comparePilotAttempts("one_point", "I need help with bedtime and dishes.", "I need help with bedtime.");
    expect(comparison.text).toMatch(/^First attempt: .+ Retry: .+/);
    expect(comparison.text).not.toMatch(/wording changed/i);
    expect(wordCount(comparison.text)).toBeLessThanOrEqual(36);
    expect(validatePilotComparison(comparison, "one_point")).toEqual([]);
    const exact36: PilotComparison = { behaviorId: "one_point", criterionChanged: true, text: `First attempt: ${Array.from({ length: 17 }, () => "first").join(" ")}. Retry: ${Array.from({ length: 16 }, () => "retry").join(" ")}.` };
    expect(wordCount(exact36.text)).toBe(36);
    expect(validatePilotComparison(exact36, "one_point")).toEqual([]);
    expect(validatePilotComparison({ ...exact36, text: `${exact36.text} extra` }, "one_point")).toContain("comparison exceeds 36 words");
  });
});
