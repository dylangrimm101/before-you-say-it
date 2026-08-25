import { describe, expect, test } from "bun:test";

import {
  createPilotDayRun,
  createPresetPracticeSession,
  normalizePracticeSession,
  preservePilotAttempt,
  protectImmutablePracticeRecords,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import type { PilotDayRun } from "@/types/pilotCurriculum";

const PRACTICE_ID = "stc_mild_pushback";
const OTHER_PRACTICE_ID = "lar_genuine_question";

function completedRun(session: ActivePracticeSession): PilotDayRun {
  let run = createPilotDayRun(
    session,
    108,
    200,
    "start_the_conversation",
    PRACTICE_ID,
    "0.1-review",
  );
  run = preservePilotAttempt(run, "opener", "Can we talk about the handoff?", 210);
  run = preservePilotAttempt(run, "response", "I hear the concern. Can we decide the handoff?", 220);
  run = preservePilotAttempt(run, "retry", "Can we decide who owns the handoff?", 230);
  return {
    ...run,
    state: "complete",
    scenarioMode: "carried_context",
    scenarioContext: {
      scenarioId: "context-1",
      category: "work",
      title: "Project handoff",
      situation: "A teammate questions the handoff.",
      objective: "Agree on one owner.",
      difficulty: "steady",
      reaction: "pushback",
      counterpartId: "priya-context-1",
      counterpartName: "Priya",
      counterpartLabel: "Priya · teammate",
      counterpartRole: "teammate",
    },
    counterpartTurn: { id: "turn-priya-1", text: "Why should this be mine?", source: "authored" },
    counterpartIdentity: "Priya",
    counterpartReactionId: "mild-pushback-1",
    resolvedAudioId: "audio-priya-1",
    adamReactionId: "mild-pushback-1",
    adamAudioId: "audio-priya-1",
    coachedBehaviorId: "pushback_response",
    coachedSegment: "pushback_response",
    retryResetId: "day-8-reset-1",
    comparison: {
      behaviorId: "pushback_response",
      text: "First attempt: changed topics. Retry: acknowledged the concern and returned to the handoff.",
      criterionChanged: true,
    },
    completedAt: 250,
    updatedAt: 250,
  };
}

function persistedSession(): ActivePracticeSession {
  const session = createPresetPracticeSession("anon-stale-proof", 100);
  const otherRun: PilotDayRun = {
    ...createPilotDayRun(
      session,
      104,
      205,
      "listen_and_respond",
      OTHER_PRACTICE_ID,
      "0.1-review",
    ),
    state: "lesson",
    updatedAt: 205,
  };
  return {
    ...session,
    pilotRuns: {
      [PRACTICE_ID]: completedRun(session),
      [OTHER_PRACTICE_ID]: otherRun,
    },
    updatedAt: 250,
  };
}

function staleSession(existing: ActivePracticeSession): ActivePracticeSession {
  const confirmed = existing.pilotRuns[PRACTICE_ID]!;
  return {
    ...existing,
    pilotRuns: {
      [PRACTICE_ID]: {
        ...confirmed,
        state: "hope_coaching",
        scenarioContext: {
          ...confirmed.scenarioContext!,
          counterpartId: "sam-replacement",
          counterpartName: "Sam",
          counterpartLabel: "Sam · replacement",
        },
        attempt: undefined,
        responseAttempt: { ...confirmed.responseAttempt!, transcript: "replacement response" },
        retryAttempt: undefined,
        counterpartTurn: { id: "replacement-turn", text: "Different pushback", source: "provider" },
        counterpartIdentity: "Sam",
        counterpartReactionId: "replacement-reaction",
        resolvedAudioId: "replacement-audio",
        adamReactionId: "replacement-reaction",
        adamAudioId: "replacement-audio",
        coachedBehaviorId: "return_to_point",
        coachedSegment: "opener",
        retryResetId: "replacement-reset",
        comparison: {
          behaviorId: "return_to_point",
          text: "Replacement comparison",
          criterionChanged: false,
        },
        completedAt: undefined,
        updatedAt: 215,
      },
    },
    updatedAt: 215,
  };
}

function roundTrip(session: ActivePracticeSession): ActivePracticeSession {
  const restored = normalizePracticeSession(JSON.parse(JSON.stringify(session)) as unknown);
  if (!restored) throw new Error("Expected the protected session to survive normalization.");
  return restored;
}

describe("adversarial stale and interleaved persistence", () => {
  test("preserves immutable attempts, counterpart context, exact turn, audio, coaching, reset, and comparison", () => {
    const existing = persistedSession();
    const protectedSession = protectImmutablePracticeRecords(existing, staleSession(existing));
    const run = protectedSession.pilotRuns[PRACTICE_ID]!;
    const confirmed = existing.pilotRuns[PRACTICE_ID]!;

    expect(run.attempt).toEqual(confirmed.attempt);
    expect(run.responseAttempt).toEqual(confirmed.responseAttempt);
    expect(run.retryAttempt).toEqual(confirmed.retryAttempt);
    expect(run.scenarioContext).toEqual(confirmed.scenarioContext);
    expect(run.counterpartTurn).toEqual(confirmed.counterpartTurn);
    expect(run.counterpartIdentity).toBe("Priya");
    expect(run.counterpartReactionId).toBe("mild-pushback-1");
    expect(run.resolvedAudioId).toBe("audio-priya-1");
    expect(run.adamReactionId).toBe("mild-pushback-1");
    expect(run.adamAudioId).toBe("audio-priya-1");
    expect(run.coachedBehaviorId).toBe("pushback_response");
    expect(run.coachedSegment).toBe("pushback_response");
    expect(run.retryResetId).toBe("day-8-reset-1");
    expect(run.comparison).toEqual(confirmed.comparison);
    expect(run.completedAt).toBe(250);
  });

  test("does not regress completed or post-counterpart state under stale writes", () => {
    const existing = persistedSession();
    for (const staleState of ["transfer_cue", "attempt_comparison", "hope_coaching", "listening_response"] as const) {
      const stale = staleSession(existing);
      stale.pilotRuns[PRACTICE_ID] = { ...stale.pilotRuns[PRACTICE_ID]!, state: staleState };
      const protectedSession = protectImmutablePracticeRecords(existing, stale);
      expect(protectedSession.pilotRuns[PRACTICE_ID]?.state).toBe("complete");
      expect(protectedSession.pilotRuns[PRACTICE_ID]?.counterpartTurn).toEqual(
        existing.pilotRuns[PRACTICE_ID]?.counterpartTurn,
      );
    }
  });

  test("keeps a Day 3 rejected-note tombstone through stale write, serialization, and restart", () => {
    const session = createPresetPracticeSession("anon-day-3", 100);
    const base = createPilotDayRun(
      session,
      103,
      200,
      "stay_clear_under_pushback",
      "scp_notice_pressure_move",
      "0.1-review",
    );
    const rejected: PilotDayRun = {
      ...base,
      state: "day3_neutral_retry",
      noteFit: "rejected",
      coachNote: undefined,
      updatedAt: 240,
    };
    const persisted: ActivePracticeSession = {
      ...session,
      pilotRuns: { scp_notice_pressure_move: rejected },
      updatedAt: 240,
    };
    const stale: ActivePracticeSession = {
      ...persisted,
      pilotRuns: {
        scp_notice_pressure_move: {
          ...rejected,
          state: "day3_note_check",
          noteFit: "accepted",
          coachNote: "Rejected coaching that must stay deleted",
          updatedAt: 220,
        },
      },
      updatedAt: 220,
    };

    const restored = roundTrip(protectImmutablePracticeRecords(persisted, stale));
    expect(restored.pilotRuns.scp_notice_pressure_move?.state).toBe("day3_neutral_retry");
    expect(restored.pilotRuns.scp_notice_pressure_move?.noteFit).toBe("rejected");
    expect(restored.pilotRuns.scp_notice_pressure_move?.coachNote).toBeUndefined();
  });

  test("keeps an accepted Day 3 observation through an older rejected snapshot and restart", () => {
    const session = createPresetPracticeSession("anon-day-3-accepted", 100);
    const base = createPilotDayRun(
      session,
      103,
      200,
      "stay_clear_under_pushback",
      "scp_notice_pressure_move",
      "0.1-review",
    );
    const accepted: PilotDayRun = {
      ...base,
      state: "ready_for_retry",
      noteFit: "accepted",
      coachNote: "You named the pressure move without guessing intent.",
      retryInstruction: "Name the pressure, then return to your boundary.",
      updatedAt: 250,
    };
    const persisted: ActivePracticeSession = {
      ...session,
      pilotRuns: { scp_notice_pressure_move: accepted },
      updatedAt: 250,
    };
    const stale: ActivePracticeSession = {
      ...persisted,
      pilotRuns: {
        scp_notice_pressure_move: {
          ...accepted,
          state: "day3_neutral_retry",
          noteFit: "rejected",
          coachNote: undefined,
          retryInstruction: "Replacement instruction from an older snapshot.",
          updatedAt: 220,
        },
      },
      updatedAt: 220,
    };

    const restored = roundTrip(protectImmutablePracticeRecords(persisted, stale));
    expect(restored.pilotRuns.scp_notice_pressure_move?.noteFit).toBe("accepted");
    expect(restored.pilotRuns.scp_notice_pressure_move?.coachNote).toBe(
      "You named the pressure move without guessing intent.",
    );
    expect(restored.pilotRuns.scp_notice_pressure_move?.retryInstruction).toBe(
      "Name the pressure, then return to your boundary.",
    );
    expect(restored.pilotRuns.scp_notice_pressure_move?.state).toBe("ready_for_retry");
  });

  test("keeps a newer non-complete post-counterpart checkpoint through a stale capture snapshot", () => {
    const session = createPresetPracticeSession("anon-interrupted-checkpoint", 100);
    const laterRun: PilotDayRun = {
      ...completedRun(session),
      state: "attempt_comparison",
      completedAt: undefined,
      updatedAt: 245,
    };
    const persisted: ActivePracticeSession = {
      ...session,
      pilotRuns: { [PRACTICE_ID]: laterRun },
      updatedAt: 245,
    };
    const staleRun: PilotDayRun = {
      ...laterRun,
      state: "listening_attempt",
      scenarioContext: {
        ...laterRun.scenarioContext!,
        counterpartId: "replacement-counterpart",
        counterpartName: "Replacement",
        counterpartLabel: "Replacement · reopened selection",
      },
      counterpartTurn: { id: "replacement-turn", text: "A different turn", source: "provider" },
      counterpartIdentity: "Replacement",
      counterpartReactionId: "replacement-reaction",
      resolvedAudioId: "replacement-audio",
      adamReactionId: "replacement-reaction",
      adamAudioId: "replacement-audio",
      coachedBehaviorId: "replacement-behavior",
      coachedSegment: "opener",
      retryResetId: "replacement-reset",
      updatedAt: 210,
    };
    const stale: ActivePracticeSession = {
      ...persisted,
      pilotRuns: { [PRACTICE_ID]: staleRun },
      updatedAt: 210,
    };

    const restored = roundTrip(protectImmutablePracticeRecords(persisted, stale));
    const run = restored.pilotRuns[PRACTICE_ID]!;
    expect(run.state).toBe("attempt_comparison");
    expect(run.scenarioContext).toEqual(laterRun.scenarioContext);
    expect(run.counterpartTurn).toEqual(laterRun.counterpartTurn);
    expect(run.counterpartIdentity).toBe(laterRun.counterpartIdentity);
    expect(run.counterpartReactionId).toBe(laterRun.counterpartReactionId);
    expect(run.resolvedAudioId).toBe(laterRun.resolvedAudioId);
    expect(run.adamReactionId).toBe(laterRun.adamReactionId);
    expect(run.adamAudioId).toBe(laterRun.adamAudioId);
    expect(run.coachedBehaviorId).toBe(laterRun.coachedBehaviorId);
    expect(run.coachedSegment).toBe(laterRun.coachedSegment);
    expect(run.retryResetId).toBe(laterRun.retryResetId);
  });

  test("is idempotent, preserves unrelated practices, and creates no scored Progress records", () => {
    const existing = persistedSession();
    const once = protectImmutablePracticeRecords(existing, staleSession(existing));
    const twice = protectImmutablePracticeRecords(once, staleSession(existing));

    expect(twice).toEqual(once);
    expect(once.pilotRuns[OTHER_PRACTICE_ID]).toEqual(existing.pilotRuns[OTHER_PRACTICE_ID]);
    expect(Object.keys(once.pilotRuns).sort()).toEqual([OTHER_PRACTICE_ID, PRACTICE_ID].sort());
    expect("scoredPracticeHistory" in once).toBe(false);
  });
});
