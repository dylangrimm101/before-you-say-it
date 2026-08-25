import { describe, expect, test } from "bun:test";

import {
  CHALLENGE_BLOCKS,
  CHALLENGE_TOTAL_DAYS,
  challengeDayByNumber,
} from "@/constants/challenge";
import {
  PROGRAM,
  TOTAL_DAYS,
  baselineDays,
  curriculumDay,
  legacyDayNumberFor,
  programProblems,
  resolveDay,
  skillsForDay,
} from "@/lib/curriculum";
import { DRILLS } from "@/constants/drills";
import { SCENARIOS } from "@/constants/scenarios";
import type { CategoryId } from "@/types/convo";
import { SKILL_IDS, TRACK_IDS, type SkillId } from "@/types/curriculum";

const TRACKS: CategoryId[] = ["partner", "family", "work", "friends"];

describe("program shape", () => {
  test("declares thirty days as the single duration source", () => {
    expect(PROGRAM.totalDays).toBe(30);
    expect(TOTAL_DAYS).toBe(30);
  });

  test("is internally consistent", () => {
    expect(programProblems()).toEqual([]);
  });

  test("covers every day from 1 to 30 exactly once", () => {
    const days = PROGRAM.blocks.flatMap((b) => b.days).map((d) => d.day);
    expect(days).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  test("blocks are contiguous and non-overlapping", () => {
    let expected = 1;
    for (const block of PROGRAM.blocks) {
      for (const day of block.days) {
        expect(day.day).toBe(expected);
        expected += 1;
      }
    }
  });

  test("every block has a stable id and a distinct pair of tones", () => {
    const ids = PROGRAM.blocks.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const block of PROGRAM.blocks) {
      expect(block.id.length).toBeGreaterThan(0);
      expect(block.accent).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(block.accentInk).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(block.accent).not.toBe(block.accentInk);
    }
  });
});

describe("day one and day thirty are the same measurement", () => {
  test("day 1 is the baseline and day 30 is its replay", () => {
    expect(curriculumDay(1)?.kind).toBe("baseline");
    expect(curriculumDay(30)?.kind).toBe("baseline_replay");
  });

  test("both baseline days exist and are the only two", () => {
    const found = baselineDays().map((d) => d.day);
    expect(found).toEqual([1, 30]);
  });

  test("they measure exactly the same skills so the comparison is fair", () => {
    expect(skillsForDay(30)).toEqual(skillsForDay(1));
    expect(skillsForDay(1).length).toBeGreaterThan(0);
  });

  test("neither baseline day points at an authored drill or scenario", () => {
    expect(curriculumDay(1)?.refId).toBe("");
    expect(curriculumDay(30)?.refId).toBe("");
  });

  test("structural days are marked so later phases can find them", () => {
    expect(curriculumDay(1)?.structural).toBe(true);
    expect(curriculumDay(29)?.structural).toBe(true);
    expect(curriculumDay(30)?.structural).toBe(true);
  });
});

describe("the shared core keeps the authored twenty-eight days intact", () => {
  test("days 2 through 29 carry the legacy numbering, in order", () => {
    const mapped: number[] = [];
    for (let day = 2; day <= 29; day += 1) {
      const legacy = legacyDayNumberFor(day);
      expect(legacy).toBe(day - 1);
      mapped.push(legacy as number);
    }
    expect(mapped).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  test("the baseline days are deliberately outside the legacy numbering", () => {
    expect(legacyDayNumberFor(1)).toBeUndefined();
    expect(legacyDayNumberFor(30)).toBeUndefined();
  });

  test("branching never changes the day count", () => {
    for (const track of TRACKS) {
      const resolved = Array.from({ length: 30 }, (_, i) => resolveDay(i + 1, track));
      expect(resolved.length).toBe(30);
      expect(resolved.every((d) => d !== undefined)).toBe(true);
    }
  });
});

describe("every reference resolves to real authored content", () => {
  const drillIds = new Set(DRILLS.map((d) => d.id));
  const scenarioIds = new Set(SCENARIOS.map((s) => s.id));

  test("drill days point at drills that exist", () => {
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      if (day.kind !== "drill") continue;
      expect(drillIds.has(day.refId)).toBe(true);
    }
  });

  test("rehearsal days point at scenarios that exist", () => {
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      if (day.kind !== "rehearsal") continue;
      expect(scenarioIds.has(day.refId)).toBe(true);
    }
  });

  test("every track adaptation points at a scenario in that track", () => {
    const byId = new Map(SCENARIOS.map((s) => [s.id, s]));
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      const adaptations = day.adaptations ?? {};
      for (const key of Object.keys(adaptations)) {
        const refId = adaptations[key as CategoryId]?.refId;
        if (refId === undefined) continue;
        const scenario = byId.get(refId);
        expect(scenario).toBeDefined();
        expect(scenario?.category).toBe(key);
      }
    }
  });

  test("resolving a day for a track swaps in that track's scenario", () => {
    const byId = new Map(SCENARIOS.map((s) => [s.id, s]));
    for (let day = 1; day <= 30; day += 1) {
      for (const track of TRACKS) {
        const resolved = resolveDay(day, track);
        if (resolved?.kind !== "rehearsal") continue;
        expect(byId.get(resolved.refId)?.category).toBe(track);
      }
    }
  });

  test("resolving without a track returns the authored default untouched", () => {
    for (let day = 1; day <= 30; day += 1) {
      const base = curriculumDay(day);
      const resolved = resolveDay(day);
      expect(resolved?.refId).toBe(base?.refId as string);
      expect(resolved?.title).toBe(base?.title as string);
    }
  });

  test("a resolved day always carries a usable title and minutes", () => {
    for (let day = 1; day <= 30; day += 1) {
      for (const track of TRACKS) {
        const resolved = resolveDay(day, track);
        expect(resolved?.title.trim().length).toBeGreaterThan(0);
        expect(resolved?.minutes).toBeGreaterThan(0);
      }
    }
  });
});

describe("skills", () => {
  test("every day names at least one skill it is training", () => {
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      expect(day.skillIds.length).toBeGreaterThan(0);
    }
  });

  test("no day claims a skill outside the vocabulary", () => {
    const known = new Set<string>(SKILL_IDS);
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      for (const skill of day.skillIds) {
        expect(known.has(skill)).toBe(true);
      }
    }
  });

  test("a day never lists the same skill twice", () => {
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      expect(new Set(day.skillIds).size).toBe(day.skillIds.length);
    }
  });

  test("the shared core exercises every skill in the vocabulary at least once", () => {
    const seen = new Set<SkillId>();
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      for (const skill of day.skillIds) seen.add(skill);
    }
    for (const skill of SKILL_IDS) {
      expect(seen.has(skill)).toBe(true);
    }
  });

  test("child is reserved in the track vocabulary but drives no content yet", () => {
    expect(TRACK_IDS).toContain("child");
    for (const day of PROGRAM.blocks.flatMap((b) => b.days)) {
      expect(Object.keys(day.adaptations ?? {})).not.toContain("child");
    }
  });
});

describe("the legacy challenge surface is unchanged", () => {
  test("still reports twenty-eight days", () => {
    expect(CHALLENGE_TOTAL_DAYS).toBe(28);
  });

  test("still exposes four blocks", () => {
    expect(CHALLENGE_BLOCKS.length).toBe(4);
  });

  test("still numbers its days 1 to 28 in order", () => {
    const days = CHALLENGE_BLOCKS.flatMap((b) => b.days).map((d) => d.day);
    expect(days).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  test("every legacy day keeps the shape the existing screens read", () => {
    for (const day of CHALLENGE_BLOCKS.flatMap((b) => b.days)) {
      expect(typeof day.day).toBe("number");
      expect(typeof day.refId).toBe("string");
      expect(typeof day.title).toBe("string");
      expect(typeof day.meta).toBe("string");
      expect(typeof day.minutes).toBe("number");
      expect(["drill", "rehearsal", "custom"]).toContain(day.kind);
    }
  });

  test("lookup by legacy day number still works across the whole range", () => {
    for (let day = 1; day <= 28; day += 1) {
      expect(challengeDayByNumber(day)?.day).toBe(day);
    }
    expect(challengeDayByNumber(0)).toBeUndefined();
    expect(challengeDayByNumber(29)).toBeUndefined();
  });

  test("the finale is still the user's own conversation", () => {
    const finale = challengeDayByNumber(28);
    expect(finale?.kind).toBe("custom");
    expect(finale?.refId).toBe("");
  });

  test("legacy blocks never leak the baseline days into stored progress", () => {
    const refIds = CHALLENGE_BLOCKS.flatMap((b) => b.days).map((d) => d.kind);
    expect(refIds).not.toContain("baseline");
    expect(refIds).not.toContain("baseline_replay");
  });
});

describe("scenarios declare who holds the power", () => {
  test("every work scenario states the power relation", () => {
    for (const scenario of SCENARIOS.filter((s) => s.category === "work")) {
      expect(scenario.power).toBeDefined();
    }
  });

  test("asking upward is marked as facing more power", () => {
    const byId = new Map(SCENARIOS.map((s) => [s.id, s]));
    expect(byId.get("raise")?.power).toBe("counterpart_has_more_power");
    expect(byId.get("burnout")?.power).toBe("counterpart_has_more_power");
    expect(byId.get("feedback")?.power).toBe("peer");
  });

  test("power values are self-documenting, not bare directions", () => {
    for (const scenario of SCENARIOS) {
      if (scenario.power === undefined) continue;
      expect([
        "user_has_more_power",
        "peer",
        "counterpart_has_more_power",
        "mixed_or_unknown",
      ]).toContain(scenario.power);
    }
  });
});

describe("the curriculum is data, not code", () => {
  test("no rehearsal content or storage keys hide in the program data", () => {
    const raw = JSON.stringify(PROGRAM);
    expect(raw).not.toContain("cc.");
    expect(raw).not.toContain("AsyncStorage");
  });

  test("program metadata names the program, not the app", () => {
    expect(PROGRAM.name).toBe("30-Day Conversation Practice");
    expect(PROGRAM.id.length).toBeGreaterThan(0);
  });
});
