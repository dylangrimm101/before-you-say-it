import { describe, expect, it } from "bun:test";

import {
  SESSION_SCHEMA_VERSION,
  migrateSessions,
  type LegacySession,
} from "@/lib/sessionMigration";
import {
  activityDayKeys,
  averageScores,
  completedRecords,
  dayKey,
  spokenLineCount,
} from "@/lib/progress";

/** Synthetic fixtures only — never real transcripts, audio or user text. */
const FIXTURE_V1: LegacySession[] = [
  {
    id: "s-1",
    scenarioId: "chores",
    title: "Ask for a fair split of the chores",
    counterpart: "Sam — your partner of 4 years",
    category: "partner",
    difficulty: "steady",
    persona: "woman-hope",
    reaction: "defensive",
    outcome: "FIXTURE_OUTCOME_TEXT",
    turns: [
      { id: "t1", role: "them", text: "FIXTURE_THEM_LINE_ONE" },
      { id: "t2", role: "user", text: "FIXTURE_USER_LINE_ONE" },
      { id: "t3", role: "them", text: "FIXTURE_THEM_LINE_TWO", nudge: "FIXTURE_NUDGE" },
      { id: "t4", role: "user", text: "FIXTURE_USER_LINE_TWO" },
    ],
    debrief: {
      headline: "FIXTURE_HEADLINE",
      scores: { clarity: 61, empathy: 44, assertiveness: 70, composure: 55 },
      wins: ["FIXTURE_WIN_ONE", "FIXTURE_WIN_TWO"],
      flags: [
        { quote: "FIXTURE_QUOTE", issue: "FIXTURE_ISSUE", reframe: "FIXTURE_REFRAME" },
      ],
      script: ["FIXTURE_SCRIPT_ONE", "FIXTURE_SCRIPT_TWO"],
      nextRep: "FIXTURE_NEXT_REP",
    },
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_600_000,
  },
  {
    id: "s-2",
    scenarioId: "raise",
    title: "Ask for the raise you already earned",
    counterpart: "Dana — your manager",
    category: "work",
    difficulty: "challenging",
    turns: [
      { id: "t1", role: "them", text: "FIXTURE_THEM_LINE" },
      { id: "t2", role: "user", text: "FIXTURE_USER_LINE" },
      { id: "t3", role: "user", text: "FIXTURE_USER_LINE_AGAIN" },
      { id: "t4", role: "user", text: "FIXTURE_USER_LINE_THIRD" },
    ],
    debrief: {
      headline: "FIXTURE_HEADLINE_TWO",
      scores: { clarity: 80, empathy: 52, assertiveness: 91, composure: 63 },
      wins: [],
      flags: [],
      script: [],
      nextRep: "",
    },
    startedAt: 1_700_100_000_000,
    endedAt: 1_700_100_900_000,
  },
  {
    // Abandoned rep — no debrief, never completed.
    id: "s-3",
    scenarioId: "friend-money",
    title: "Ask for the money back",
    counterpart: "Nico — a close friend",
    category: "friends",
    difficulty: "gentle",
    turns: [{ id: "t1", role: "them", text: "FIXTURE_THEM_LINE" }],
    startedAt: 1_700_200_000_000,
  },
];

const CONTENT_MARKERS = [
  "FIXTURE_THEM_LINE_ONE",
  "FIXTURE_USER_LINE_ONE",
  "FIXTURE_NUDGE",
  "FIXTURE_HEADLINE",
  "FIXTURE_WIN_ONE",
  "FIXTURE_QUOTE",
  "FIXTURE_ISSUE",
  "FIXTURE_REFRAME",
  "FIXTURE_NEXT_REP",
  "FIXTURE_OUTCOME_TEXT",
];

describe("migrateSessions content removal", () => {
  it("removes every transcript, quote and free-text field", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    const serialized = JSON.stringify(records);
    CONTENT_MARKERS.forEach((marker) => {
      expect(serialized).not.toContain(marker);
    });
  });

  it("leaves no turns array, debrief body, flags or outcome on any record", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    records.forEach((r) => {
      const loose = r as unknown as Record<string, unknown>;
      expect(loose.turns).toBeUndefined();
      expect(loose.outcome).toBeUndefined();
      expect(loose.debrief).toBeUndefined();
      expect(loose.flags).toBeUndefined();
      expect(loose.wins).toBeUndefined();
      expect(loose.headline).toBeUndefined();
    });
  });

  /**
   * The script is the one generated field kept on purpose — it is what the user
   * takes into the real conversation, and it is worthless if it disappears.
   */
  it("keeps the real-conversation script, lifted out of a legacy debrief body", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    expect(records[0].script).toEqual(["FIXTURE_SCRIPT_ONE", "FIXTURE_SCRIPT_TWO"]);
  });

  it("omits the script entirely when there was none", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    expect(records[1].script).toBeUndefined();
    expect(records[2].script).toBeUndefined();
  });

  it("keeps a script that is already on a minimized record", () => {
    const { records } = migrateSessions([
      {
        schemaVersion: 2,
        id: "m-1",
        scenarioId: "chores",
        category: "partner",
        difficulty: "steady",
        script: ["FIXTURE_KEPT_SCRIPT"],
        skillIds: [],
        turnCount: 4,
        userTurnCount: 2,
        retryCount: 0,
        completed: true,
        startedAt: 1,
        contentRetained: false,
      },
    ]);
    expect(records[0].script).toEqual(["FIXTURE_KEPT_SCRIPT"]);
  });

  it("does not treat a retained script as content needing migration", () => {
    const { removedContentFrom } = migrateSessions([
      {
        schemaVersion: 2,
        id: "m-2",
        scenarioId: "chores",
        category: "partner",
        difficulty: "steady",
        script: ["FIXTURE_KEPT_SCRIPT"],
        skillIds: [],
        turnCount: 0,
        userTurnCount: 0,
        retryCount: 0,
        completed: true,
        startedAt: 1,
        contentRetained: false,
      },
    ]);
    expect(removedContentFrom).toBe(0);
  });

  it("drops blank lines and caps a runaway script", () => {
    const { records } = migrateSessions([
      {
        id: "m-3",
        scenarioId: "chores",
        turns: [],
        script: ["  keep me  ", "", "   ", ...Array.from({ length: 20 }, (_, i) => `line ${String(i)}`)],
        startedAt: 1,
      },
    ]);
    expect(records[0].script?.length).toBe(8);
    expect(records[0].script?.[0]).toBe("keep me");
  });

  it("preserves identity, timing and score continuity fields", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    expect(records.map((r) => r.id)).toEqual(["s-1", "s-2", "s-3"]);
    expect(records.map((r) => r.scenarioId)).toEqual(["chores", "raise", "friend-money"]);
    expect(records.map((r) => r.startedAt)).toEqual(FIXTURE_V1.map((s) => s.startedAt));
    expect(records.map((r) => r.endedAt)).toEqual(FIXTURE_V1.map((s) => s.endedAt));
    expect(records[0].scores).toEqual({
      clarity: 61,
      empathy: 44,
      assertiveness: 70,
      composure: 55,
    });
    expect(records[0].category).toBe("partner");
    expect(records[0].difficulty).toBe("steady");
    expect(records[0].persona).toBe("woman-hope");
    expect(records[0].reaction).toBe("defensive");
    expect(records[2].scores).toBeUndefined();
  });

  it("preserves completion and turn counts without keeping the turns", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    expect(records.map((r) => r.completed)).toEqual([true, true, false]);
    expect(records.map((r) => r.turnCount)).toEqual([4, 4, 1]);
    expect(records.map((r) => r.userTurnCount)).toEqual([2, 3, 0]);
    expect(records.every((r) => r.schemaVersion === SESSION_SCHEMA_VERSION)).toBe(true);
    expect(records.every((r) => r.contentRetained === false)).toBe(true);
  });

  it("reports how many records had content stripped", () => {
    const { removedContentFrom } = migrateSessions(FIXTURE_V1);
    expect(removedContentFrom).toBe(3);
  });
});

describe("migrateSessions progress equivalence", () => {
  it("keeps completed count identical to the legacy derivation", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    const legacyCompleted = FIXTURE_V1.filter((s) => s.debrief).length;
    expect(completedRecords(records).length).toBe(legacyCompleted);
  });

  it("keeps average scores identical to the legacy derivation", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    const legacy = FIXTURE_V1.filter((s) => s.debrief);
    const sum = { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 };
    legacy.forEach((s) => {
      sum.clarity += s.debrief!.scores.clarity;
      sum.empathy += s.debrief!.scores.empathy;
      sum.assertiveness += s.debrief!.scores.assertiveness;
      sum.composure += s.debrief!.scores.composure;
    });
    const n = legacy.length;
    expect(averageScores(records)).toEqual({
      clarity: Math.round(sum.clarity / n),
      empathy: Math.round(sum.empathy / n),
      assertiveness: Math.round(sum.assertiveness / n),
      composure: Math.round(sum.composure / n),
    });
  });

  it("keeps activity days identical to the legacy derivation", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    const legacyDays = new Set(
      FIXTURE_V1.filter((s) => s.endedAt).map((s) => dayKey(s.endedAt ?? 0)),
    );
    expect([...activityDayKeys(records, [], [])].sort()).toEqual([...legacyDays].sort());
  });

  it("keeps the spoken-line total identical to counting legacy user turns", () => {
    const { records } = migrateSessions(FIXTURE_V1);
    const legacyLines = FIXTURE_V1.filter((s) => s.debrief).reduce(
      (n, s) => n + s.turns.filter((t) => t.role === "user").length,
      0,
    );
    expect(spokenLineCount(completedRecords(records))).toBe(legacyLines);
  });
});

describe("migrateSessions robustness", () => {
  it("is idempotent — migrating twice equals migrating once", () => {
    const first = migrateSessions(FIXTURE_V1);
    const second = migrateSessions(first.records);
    expect(second.records).toEqual(first.records);
    expect(second.removedContentFrom).toBe(0);
  });

  it("accepts a JSON string as stored by AsyncStorage", () => {
    const fromString = migrateSessions(JSON.stringify(FIXTURE_V1));
    const fromArray = migrateSessions(FIXTURE_V1);
    expect(fromString.records).toEqual(fromArray.records);
  });

  it("skips malformed entries instead of throwing", () => {
    const { records } = migrateSessions([
      null,
      "not a session",
      { id: "ok", scenarioId: "chores", startedAt: 1 },
      { scenarioId: "missing-id", startedAt: 2 },
      { id: "bad-turns", scenarioId: "chores", startedAt: 3, turns: "nope" },
    ]);
    expect(records.map((r) => r.id)).toEqual(["ok", "bad-turns"]);
    expect(records[1].turnCount).toBe(0);
  });

  it("fails safe to an empty list for unparseable input", () => {
    expect(migrateSessions("{not json").records).toEqual([]);
    expect(migrateSessions(undefined).records).toEqual([]);
    expect(migrateSessions({ nope: true }).records).toEqual([]);
  });

  it("caps stored history and keeps the newest records", () => {
    const many: LegacySession[] = Array.from({ length: 80 }, (_, i) => ({
      ...FIXTURE_V1[0],
      id: `bulk-${i}`,
    }));
    const { records } = migrateSessions(many);
    expect(records.length).toBe(60);
    expect(records[0].id).toBe("bulk-0");
  });
});
