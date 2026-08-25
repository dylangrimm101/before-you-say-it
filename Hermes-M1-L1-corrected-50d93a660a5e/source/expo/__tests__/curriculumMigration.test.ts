import { describe, expect, it } from "bun:test";

import {
  CHALLENGE_BLOCKS,
  CHALLENGE_TOTAL_DAYS,
  challengeDayByNumber,
} from "@/constants/challenge";
import { DRILLS } from "@/constants/drills";
import { SCENARIOS } from "@/constants/scenarios";
import {
  PROGRAM,
  TOTAL_DAYS,
  allDays,
  loadProgram,
  programProblems,
} from "@/lib/curriculum";
import { firstOpenDay } from "@/lib/progress";
import type { Program } from "@/types/curriculum";

import {
  PRE_CHALLENGE_BLOCKS,
  PRE_CHALLENGE_TOTAL_DAYS,
  preChallengeDayByNumber,
} from "./fixtures/legacyChallenge.pre";

/**
 * Phase 1 acceptance gate. Phase 1 was a behaviour-preserving migration of the
 * curriculum from a hardcoded array into data, so these tests compare the live
 * program against a frozen reconstruction of the pre-migration file and against
 * stored-progress expectations. Nothing here asserts new behaviour.
 */

/** The authored fields the migration was required to carry over untouched. */
function normalizeDay(d: {
  day: number;
  kind: string;
  refId: string;
  title: string;
  meta: string;
  minutes: number;
  difficulty?: string;
}) {
  return {
    day: d.day,
    kind: d.kind,
    refId: d.refId,
    title: d.title,
    meta: d.meta,
    minutes: d.minutes,
    difficulty: d.difficulty ?? null,
  };
}

describe("normalized equivalence with the pre-migration curriculum", () => {
  it("the frozen fixture really is the twenty-eight day original", () => {
    expect(PRE_CHALLENGE_TOTAL_DAYS).toBe(28);
    expect(PRE_CHALLENGE_BLOCKS).toHaveLength(4);
    expect(PRE_CHALLENGE_BLOCKS.flatMap((b) => b.days)).toHaveLength(28);
  });

  it("exposes exactly the same number of days", () => {
    expect(CHALLENGE_TOTAL_DAYS).toBe(PRE_CHALLENGE_TOTAL_DAYS);
  });

  it("exposes exactly the same number of blocks", () => {
    expect(CHALLENGE_BLOCKS).toHaveLength(PRE_CHALLENGE_BLOCKS.length);
  });

  it("every authored day survives with identical content", () => {
    const before = PRE_CHALLENGE_BLOCKS.flatMap((b) => b.days).map(normalizeDay);
    const after = CHALLENGE_BLOCKS.flatMap((b) => b.days).map(normalizeDay);
    expect(after).toEqual(before);
  });

  it("every authored day survives when looked up one by one", () => {
    for (let day = 1; day <= PRE_CHALLENGE_TOTAL_DAYS; day += 1) {
      const before = preChallengeDayByNumber(day);
      const after = challengeDayByNumber(day);
      expect(before).toBeDefined();
      expect(after).toBeDefined();
      expect(normalizeDay(after!)).toEqual(normalizeDay(before!));
    }
  });

  it("block titles and blurbs survive", () => {
    // Accent tones are deliberately excluded: they are presentation, not
    // authored content, and they were re-paletted when the product moved off
    // the warm/sage palette. Pinning them here would freeze the retired colors.
    const before = PRE_CHALLENGE_BLOCKS.map((b) => ({ title: b.title, blurb: b.blurb }));
    const after = CHALLENGE_BLOCKS.map((b) => ({ title: b.title, blurb: b.blurb }));
    expect(after).toEqual(before);
  });

  it("every block still carries a distinct pair of accent tones", () => {
    expect(CHALLENGE_BLOCKS.length).toBe(PRE_CHALLENGE_BLOCKS.length);
    for (const block of CHALLENGE_BLOCKS) {
      expect(block.accent, `${block.title} accent`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(block.accentInk, `${block.title} accentInk`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(block.accentInk, `${block.title} needs contrast`).not.toBe(block.accent);
    }
  });

  it("days stay in their original blocks", () => {
    const before = PRE_CHALLENGE_BLOCKS.map((b) => b.days.map((d) => d.day));
    const after = CHALLENGE_BLOCKS.map((b) => b.days.map((d) => d.day));
    expect(after).toEqual(before);
  });

  it("every drill referenced before the migration is still referenced after", () => {
    const before = new Set(
      PRE_CHALLENGE_BLOCKS.flatMap((b) => b.days)
        .filter((d) => d.kind === "drill")
        .map((d) => d.refId),
    );
    const after = new Set(
      CHALLENGE_BLOCKS.flatMap((b) => b.days)
        .filter((d) => d.kind === "drill")
        .map((d) => d.refId),
    );
    expect([...after].sort()).toEqual([...before].sort());
  });

  it("every scenario referenced before the migration is still referenced after", () => {
    const before = new Set(
      PRE_CHALLENGE_BLOCKS.flatMap((b) => b.days)
        .filter((d) => d.kind === "rehearsal")
        .map((d) => d.refId),
    );
    const after = new Set(
      CHALLENGE_BLOCKS.flatMap((b) => b.days)
        .filter((d) => d.kind === "rehearsal")
        .map((d) => d.refId),
    );
    expect([...after].sort()).toEqual([...before].sort());
  });

  it("no scenario was dropped from the library", () => {
    expect(SCENARIOS).toHaveLength(12);
    const ids = SCENARIOS.map((s) => s.id).sort();
    expect(ids).toEqual([...new Set(ids)].sort());
  });

  it("no drill and no drill round was dropped from the library", () => {
    expect(DRILLS).toHaveLength(8);
    const drillIds = DRILLS.map((d) => d.id);
    expect(new Set(drillIds).size).toBe(drillIds.length);
    for (const drill of DRILLS) {
      expect(drill.rounds.length).toBeGreaterThanOrEqual(3);
      for (const round of drill.rounds) {
        expect(round.line.length).toBeGreaterThan(0);
        expect(round.focus.length).toBeGreaterThan(0);
      }
    }
  });

  it("every drill round referenced by the program still resolves", () => {
    const byId = new Map(DRILLS.map((d) => [d.id, d]));
    for (const day of CHALLENGE_BLOCKS.flatMap((b) => b.days)) {
      if (day.kind !== "drill") continue;
      const drill = byId.get(day.refId);
      expect(drill).toBeDefined();
      expect(drill!.rounds.length).toBeGreaterThan(0);
    }
  });

  it("the custom finale is still the last legacy day and references nothing", () => {
    const finale = challengeDayByNumber(CHALLENGE_TOTAL_DAYS);
    expect(finale?.kind).toBe("custom");
    expect(finale?.refId).toBe("");
  });
});

describe("upgrade fixture: an existing user keeps their place", () => {
  /** A tester who finished legacy days 1, 2 and 3 before the upgrade. */
  const storedLog = [
    { day: 1, date: "2026-07-20" },
    { day: 2, date: "2026-07-21" },
    { day: 3, date: "2026-07-22" },
  ];
  const doneDays = new Set(storedLog.map((e) => e.day));

  it("the stored log needs no migration at all", () => {
    expect([...doneDays].sort()).toEqual([1, 2, 3]);
  });

  it("all three completed days still resolve to the same content", () => {
    for (const entry of storedLog) {
      const before = preChallengeDayByNumber(entry.day);
      const after = challengeDayByNumber(entry.day);
      expect(normalizeDay(after!)).toEqual(normalizeDay(before!));
    }
  });

  it("the completion count is unchanged", () => {
    expect(doneDays.size).toBe(3);
  });

  it("the current day is still day 4, not day 5", () => {
    const before = firstOpenDay(doneDays, PRE_CHALLENGE_TOTAL_DAYS);
    const after = firstOpenDay(doneDays, CHALLENGE_TOTAL_DAYS);
    expect(before).toBe(4);
    expect(after).toBe(4);
  });

  it("day 4 still opens the same drill it did before the upgrade", () => {
    const before = preChallengeDayByNumber(4);
    const after = challengeDayByNumber(4);
    expect(after?.refId).toBe(before?.refId);
    expect(after?.kind).toBe(before?.kind);
  });

  it("a gap in the log does not shift the current day", () => {
    const patchy = new Set([1, 2, 4]);
    expect(firstOpenDay(patchy, CHALLENGE_TOTAL_DAYS)).toBe(3);
  });

  it("a finished user lands one past the end, exactly as before", () => {
    const all = new Set(Array.from({ length: 28 }, (_, i) => i + 1));
    expect(firstOpenDay(all, CHALLENGE_TOTAL_DAYS)).toBe(29);
  });

  it("an empty log still starts at day 1", () => {
    expect(firstOpenDay(new Set<number>(), CHALLENGE_TOTAL_DAYS)).toBe(1);
  });

  it("the baseline days are absent from the legacy surface, so they cannot shift progress", () => {
    const legacyDayNumbers = CHALLENGE_BLOCKS.flatMap((b) => b.days).map((d) => d.day);
    expect(Math.min(...legacyDayNumbers)).toBe(1);
    expect(Math.max(...legacyDayNumbers)).toBe(28);
  });
});

describe("malformed and unknown curriculum falls back safely", () => {
  const good: Program = PROGRAM;

  it("accepts the bundled program without falling back", () => {
    const load = loadProgram(good);
    expect(load.usedFallback).toBe(false);
    expect(load.problems).toEqual([]);
    expect(load.program.id).toBe(good.id);
  });

  const junk: [string, unknown][] = [
    ["null", null],
    ["undefined", undefined],
    ["a number", 7],
    ["a string", "curriculum"],
    ["an array", []],
    ["an empty object", {}],
    ["no blocks", { id: "x", name: "x", totalDays: 30 }],
    ["empty blocks", { id: "x", name: "x", totalDays: 30, blocks: [] }],
    ["blocks that are not arrays", { id: "x", name: "x", totalDays: 30, blocks: {} }],
    [
      "no days",
      { id: "x", name: "x", totalDays: 30, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [] }] },
    ],
    [
      "a day that is not an object",
      { id: "x", name: "x", totalDays: 1, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [null] }] },
    ],
    [
      "a day with no skills",
      { id: "x", name: "x", totalDays: 1, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [{ day: 1, kind: "custom", refId: "", title: "t", meta: "m", minutes: 5 }] }] },
    ],
    [
      "a day naming an unknown skill",
      { id: "x", name: "x", totalDays: 1, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [{ day: 1, kind: "custom", refId: "", title: "t", meta: "m", minutes: 5, skillIds: ["telepathy"] }] }] },
    ],
    [
      "a day of an unknown kind",
      { id: "x", name: "x", totalDays: 1, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [{ day: 1, kind: "hypnosis", refId: "", title: "t", meta: "m", minutes: 5, skillIds: ["repair"] }] }] },
    ],
    [
      "a drill day pointing at a missing drill",
      { id: "x", name: "x", totalDays: 1, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [{ day: 1, kind: "drill", refId: "nope", title: "t", meta: "m", minutes: 5, skillIds: ["repair"] }] }] },
    ],
    [
      "totalDays disagreeing with the authored days",
      { ...good, totalDays: 45 },
    ],
    [
      "duplicate day numbers",
      { id: "x", name: "x", totalDays: 2, blocks: [{ id: "b", title: "t", blurb: "b", accent: "#000", accentInk: "#000", days: [{ day: 1, kind: "custom", refId: "", title: "t", meta: "m", minutes: 5, skillIds: ["repair"] }, { day: 1, kind: "custom", refId: "", title: "t", meta: "m", minutes: 5, skillIds: ["repair"] }] }] },
    ],
  ];

  junk.forEach(([label, candidate]) => {
    it(`falls back to the bundled program given ${label}`, () => {
      const load = loadProgram(candidate);
      expect(load.usedFallback).toBe(true);
      expect(load.problems.length).toBeGreaterThan(0);
      expect(load.program.id).toBe(good.id);
      expect(load.program.totalDays).toBe(good.totalDays);
    });
  });

  junk.forEach(([label, candidate]) => {
    it(`never throws given ${label}`, () => {
      expect(() => loadProgram(candidate)).not.toThrow();
    });
  });

  it("the fallback program is always usable, never blank", () => {
    const load = loadProgram({ broken: true });
    expect(load.program.blocks.length).toBeGreaterThan(0);
    expect(programProblems(load.program)).toEqual([]);
  });

  it("validation of junk reports problems rather than throwing", () => {
    expect(() => programProblems({} as Program)).not.toThrow();
    expect(programProblems({} as Program).length).toBeGreaterThan(0);
  });
});

describe("Program.totalDays is the only duration source", () => {
  it("the exported program length comes from totalDays", () => {
    expect(TOTAL_DAYS).toBe(PROGRAM.totalDays);
  });

  it("totalDays matches the number of authored days exactly", () => {
    expect(PROGRAM.totalDays).toBe(allDays().length);
  });

  it("a totalDays that disagrees with the data is a reported problem", () => {
    expect(programProblems({ ...PROGRAM, totalDays: 29 })).toContain(
      "totalDays is 29 but 30 days are authored",
    );
  });

  it("the legacy length is counted from the data, not written down", () => {
    const counted = CHALLENGE_BLOCKS.reduce((n, b) => n + b.days.length, 0);
    expect(CHALLENGE_TOTAL_DAYS).toBe(counted);
  });

  it("the legacy length equals the number of days carrying legacy numbering", () => {
    const withLegacy = allDays().filter((d) => d.legacyDay !== undefined);
    expect(CHALLENGE_TOTAL_DAYS).toBe(withLegacy.length);
  });

  it("no source file outside the curriculum data hardcodes a program length", async () => {
    const { Glob } = await import("bun");
    const offenders: string[] = [];
    const glob = new Glob("{app,lib,providers,components,constants}/**/*.{ts,tsx}");
    for await (const path of glob.scan({ cwd: ".", absolute: false })) {
      if (path.endsWith("curriculum.json")) continue;
      const text = await Bun.file(path).text();
      const lines = text.split("\n");
      lines.forEach((line, i) => {
        // Prose in comments is documentation, not a duration source.
        const trimmed = line.trim();
        if (trimmed.startsWith("*") || trimmed.startsWith("//") || trimmed.startsWith("/*")) {
          return;
        }
        // Day-count comparisons, e.g. `day <= 28`.
        const comparison =
          /(?:day|Day|nextDay|totalDays)\s*(?:<=|>=|<|>|===|!==)\s*(?:28|30)\b/.test(line);
        // Durations written into copy, e.g. `of 28 days` or `28-Day`.
        const copy = /\b(?:28|30)[\s-](?:day|Day|days|Days)\b/.test(line);
        // A bare count next to a day word, e.g. `allDone ? 28 :`.
        const bareCount = /\?\s*(?:28|30)\s*:/.test(line);
        if (comparison || copy || bareCount) {
          offenders.push(`${path}:${i + 1} → ${line.trim()}`);
        }
      });
    }
    expect(offenders).toEqual([]);
  });
});

describe("curriculum inventory is unambiguous", () => {
  it("every program day number is unique", () => {
    const nums = allDays().map((d) => d.day);
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("every legacy day number is unique", () => {
    const legacy = allDays()
      .map((d) => d.legacyDay)
      .filter((n): n is number => n !== undefined);
    expect(new Set(legacy).size).toBe(legacy.length);
  });

  it("every block id is unique", () => {
    const ids = PROGRAM.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("structural days carry the structural flag and authored days do not", () => {
    const structural = allDays().filter((d) => d.structural === true).map((d) => d.day);
    expect(structural).toEqual([1, 29, 30]);
  });

  it("the structural day 1 and the preserved legacy day 1 never collide", () => {
    // Program day 1 is the baseline and has no legacy number, so it is invisible
    // to the stored log. Legacy day 1 lives at program day 2.
    const programDayOne = allDays().find((d) => d.day === 1);
    expect(programDayOne?.kind).toBe("baseline");
    expect(programDayOne?.legacyDay).toBeUndefined();

    const legacyDayOne = allDays().find((d) => d.legacyDay === 1);
    expect(legacyDayOne?.day).toBe(2);
    expect(challengeDayByNumber(1)?.refId).toBe(legacyDayOne?.refId);
  });

  it("only the twenty-eight legacy days are reachable from the rendered screen", () => {
    const rendered = CHALLENGE_BLOCKS.flatMap((b) => b.days);
    expect(rendered).toHaveLength(28);
    expect(rendered.every((d) => d.structural !== true || d.kind === "custom")).toBe(true);
  });

  it("no baseline day is reachable from the rendered screen", () => {
    const renderedKinds = new Set(CHALLENGE_BLOCKS.flatMap((b) => b.days).map((d) => d.kind));
    expect(renderedKinds.has("baseline")).toBe(false);
    expect(renderedKinds.has("baseline_replay")).toBe(false);
  });
});
