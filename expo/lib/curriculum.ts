import raw from "@/constants/curriculum.json";
import { DRILLS } from "@/constants/drills";
import { SCENARIOS } from "@/constants/scenarios";
import type { CategoryId } from "@/types/convo";
import {
  SKILL_IDS,
  type CurriculumBlock,
  type CurriculumDay,
  type Program,
  type ResolvedDay,
  type SkillId,
} from "@/types/curriculum";

/**
 * The bundled, known-good curriculum. This ships inside the binary and is the
 * fallback any other candidate is measured against.
 */
const BUNDLED: Program = raw as unknown as Program;

/**
 * The 30-Day Conversation Practice program. Day 1 is the baseline, days 2-29
 * are the shared authored core carried over from the original 28-day
 * challenge, and day 30 replays the baseline so the two can be compared.
 *
 * Content lives in `constants/curriculum.json` so it can be edited, checked
 * and eventually versioned without touching code.
 */
export const PROGRAM: Program = BUNDLED;

/**
 * The only source of truth for how long the program is. Every other duration
 * in the app is derived from this or from counting authored days.
 */
export const TOTAL_DAYS: number = PROGRAM.totalDays;

/** Flatten a program's blocks into a day list, tolerating malformed input. */
function daysOf(program: Program): CurriculumDay[] {
  if (!Array.isArray(program?.blocks)) return [];
  return program.blocks.flatMap((b) => (Array.isArray(b?.days) ? b.days : []));
}

const ALL_DAYS: CurriculumDay[] = daysOf(PROGRAM);

const DAY_BY_NUMBER: Map<number, CurriculumDay> = new Map(
  ALL_DAYS.map((d) => [d.day, d]),
);

const BLOCK_BY_DAY: Map<number, CurriculumBlock> = new Map(
  PROGRAM.blocks.flatMap((block) => block.days.map((d) => [d.day, block] as const)),
);

const SCENARIO_BY_ID = new Map(SCENARIOS.map((s) => [s.id, s]));
const DRILL_IDS = new Set(DRILLS.map((d) => d.id));

/** All days, in program order. */
export function allDays(): CurriculumDay[] {
  return ALL_DAYS;
}

/** The authored day for a program day number, before any track adaptation. */
export function curriculumDay(day: number): CurriculumDay | undefined {
  return DAY_BY_NUMBER.get(day);
}

/** The block a program day belongs to. */
export function blockForDay(day: number): CurriculumBlock | undefined {
  return BLOCK_BY_DAY.get(day);
}

/** The behaviours a day trains. */
export function skillsForDay(day: number): SkillId[] {
  return DAY_BY_NUMBER.get(day)?.skillIds ?? [];
}

/** The two measurement days, in order. */
export function baselineDays(): CurriculumDay[] {
  return ALL_DAYS.filter(
    (d) => d.kind === "baseline" || d.kind === "baseline_replay",
  );
}

/**
 * The number this day's content had in the stored 28-day progress log.
 * Undefined for the baseline days, which were never part of it.
 */
export function legacyDayNumberFor(day: number): number | undefined {
  return DAY_BY_NUMBER.get(day)?.legacyDay;
}

const PROGRAM_DAY_BY_LEGACY: Map<number, number> = new Map(
  ALL_DAYS.flatMap((d) =>
    d.legacyDay === undefined ? [] : [[d.legacyDay, d.day] as const],
  ),
);

/**
 * Inverse of `legacyDayNumberFor`. Progress is still stored against the old
 * 1-28 numbering, so screens that want to *show* 30-day numbering convert
 * through here rather than assuming a fixed offset.
 */
export function programDayForLegacy(legacyDay: number): number | undefined {
  return PROGRAM_DAY_BY_LEGACY.get(legacyDay);
}

/**
 * Apply a track's adaptation to a day. Branching only ever swaps which
 * scenario is rehearsed — it never adds, removes or reorders days.
 */
export function resolveDay(day: number, track?: CategoryId): ResolvedDay | undefined {
  const base = DAY_BY_NUMBER.get(day);
  if (base === undefined) return undefined;
  if (track === undefined) return { ...base };

  const adaptation = base.adaptations?.[track];
  if (adaptation === undefined) return { ...base, track };

  const resolved: ResolvedDay = { ...base, track, note: adaptation.note };
  if (adaptation.refId !== undefined && adaptation.refId !== base.refId) {
    const scenario = SCENARIO_BY_ID.get(adaptation.refId);
    resolved.refId = adaptation.refId;
    if (scenario !== undefined) {
      resolved.title = scenario.title;
      resolved.minutes = scenario.minutes;
    }
  }
  return resolved;
}

/**
 * Structural problems in a candidate program. Returns an empty array when the
 * curriculum is sound.
 *
 * Never throws, whatever it is handed. Bad curriculum data must degrade to a
 * reported problem and a fallback, never to a crash on launch.
 */
export function programProblems(candidate: Program = PROGRAM): string[] {
  const problems: string[] = [];
  const knownSkills = new Set<string>(SKILL_IDS);

  if (candidate === null || typeof candidate !== "object") {
    return ["program is not an object"];
  }
  if (typeof candidate.id !== "string" || candidate.id.length === 0) {
    problems.push("program has no id");
  }
  if (typeof candidate.name !== "string" || candidate.name.length === 0) {
    problems.push("program has no name");
  }
  if (!Array.isArray(candidate.blocks) || candidate.blocks.length === 0) {
    problems.push("program has no blocks");
    return problems;
  }

  const days = daysOf(candidate);
  if (days.length === 0) {
    problems.push("program authors no days");
    return problems;
  }
  if (candidate.totalDays !== days.length) {
    problems.push(
      `totalDays is ${String(candidate.totalDays)} but ${days.length} days are authored`,
    );
  }

  const blockIds = new Set<string>();
  for (const block of candidate.blocks) {
    if (typeof block?.id !== "string" || block.id.length === 0) {
      problems.push("a block has no id");
      continue;
    }
    if (blockIds.has(block.id)) problems.push(`duplicate block id ${block.id}`);
    blockIds.add(block.id);
  }

  let expectedDay = 1;
  const seenDayNumbers = new Set<number>();
  const seenLegacy = new Set<number>();

  for (const day of days) {
    const position = expectedDay;
    expectedDay += 1;

    if (day === null || typeof day !== "object") {
      problems.push(`the day at position ${position} is not an object`);
      continue;
    }
    if (!Number.isInteger(day.day)) {
      problems.push(`the day at position ${position} has no day number`);
      continue;
    }
    if (seenDayNumbers.has(day.day)) {
      problems.push(`day number ${day.day} is used more than once`);
    }
    seenDayNumbers.add(day.day);
    if (day.day !== position) {
      problems.push(`day ${day.day} is out of order, expected ${position}`);
    }
    if (typeof day.title !== "string" || day.title.length === 0) {
      problems.push(`day ${day.day} has no title`);
    }
    if (!Number.isFinite(day.minutes) || day.minutes <= 0) {
      problems.push(`day ${day.day} has no usable duration`);
    }

    if (day.legacyDay !== undefined) {
      if (!Number.isInteger(day.legacyDay)) {
        problems.push(`day ${day.day} has a non-integer legacyDay`);
      } else {
        if (seenLegacy.has(day.legacyDay)) {
          problems.push(`legacyDay ${day.legacyDay} is used more than once`);
        }
        seenLegacy.add(day.legacyDay);
      }
    }

    if (!Array.isArray(day.skillIds) || day.skillIds.length === 0) {
      problems.push(`day ${day.day} trains no skill`);
    } else {
      if (new Set(day.skillIds).size !== day.skillIds.length) {
        problems.push(`day ${day.day} repeats a skill`);
      }
      for (const skill of day.skillIds) {
        if (!knownSkills.has(skill)) {
          problems.push(`day ${day.day} names unknown skill ${String(skill)}`);
        }
      }
    }

    switch (day.kind) {
      case "drill":
        if (!DRILL_IDS.has(day.refId)) {
          problems.push(`day ${day.day} points at missing drill ${String(day.refId)}`);
        }
        break;
      case "rehearsal":
        if (!SCENARIO_BY_ID.has(day.refId)) {
          problems.push(`day ${day.day} points at missing scenario ${String(day.refId)}`);
        }
        break;
      case "baseline":
      case "baseline_replay":
        if (day.refId !== "") {
          problems.push(`baseline day ${day.day} should not reference authored content`);
        }
        break;
      case "custom":
        break;
      default:
        problems.push(`day ${day.day} has unknown kind ${String(day.kind)}`);
    }

    for (const [track, adaptation] of Object.entries(day.adaptations ?? {})) {
      const refId = adaptation?.refId;
      if (refId === undefined) continue;
      const scenario = SCENARIO_BY_ID.get(refId);
      if (scenario === undefined) {
        problems.push(`day ${day.day} adapts to missing scenario ${refId}`);
      } else if (scenario.category !== track) {
        problems.push(
          `day ${day.day} adapts track ${track} to a ${scenario.category} scenario`,
        );
      }
    }
  }

  return problems;
}

/** Outcome of validating a candidate curriculum against the bundled one. */
export interface ProgramLoad {
  program: Program;
  /** True when the candidate was rejected and the bundled program is in use. */
  usedFallback: boolean;
  /** Why the candidate was rejected. Empty when it was accepted. */
  problems: string[];
}

/**
 * Validate a candidate curriculum and fall back to the bundled program if it
 * is malformed, from an unknown schema, or otherwise unusable.
 *
 * The app always ends up with a working program: a bad candidate can never
 * leave the user with a blank or half-built plan. Nothing calls this with a
 * remote payload today — it exists so the loader is already safe when
 * something other than the bundle can supply curriculum.
 */
export function loadProgram(candidate: unknown): ProgramLoad {
  if (candidate === null || typeof candidate !== "object") {
    return { program: BUNDLED, usedFallback: true, problems: ["program is not an object"] };
  }

  let problems: string[];
  try {
    problems = programProblems(candidate as Program);
  } catch {
    return {
      program: BUNDLED,
      usedFallback: true,
      problems: ["program could not be validated"],
    };
  }

  if (problems.length > 0) {
    return { program: BUNDLED, usedFallback: true, problems };
  }
  return { program: candidate as Program, usedFallback: false, problems: [] };
}

/**
 * The days that carry legacy numbering, grouped into their blocks and
 * renumbered back to 1-28. This is what the existing challenge screens and
 * the stored progress log read, so it must stay byte-for-byte compatible.
 */
export function legacyBlocks(): CurriculumBlock[] {
  const blocks: CurriculumBlock[] = [];
  for (const block of PROGRAM.blocks) {
    const days = block.days
      .filter((d) => d.legacyDay !== undefined)
      .map((d) => ({ ...d, day: d.legacyDay as number }));
    if (days.length === 0) continue;
    blocks.push({ ...block, days });
  }
  return blocks;
}
