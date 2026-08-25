import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { nextPilotCounterpart } from "@/lib/ai";
import {
  PILOT_MODULES,
  PILOT_NEUTRAL_COACH_FALLBACK,
  PILOT_PROGRAM,
  PILOT_TOTAL_DAYS,
  audioLines,
  comparePilotAttempts,
  currentPilotDay,
  day8RetryBranch,
  isPilotModuleUnlocked,
  neutralPilotCoachResponse,
  pilotModule,
  pilotProblems,
  selectDay8Pushback,
  validatePilotCoachResponse,
  validatePilotComparison,
  wordCount,
} from "@/lib/pilotCurriculum";
import type { PilotCoachResponse } from "@/types/pilotCurriculum";

const root = join(import.meta.dir, "..");

const APPROVED_HEADINGS = [
  "Go back to one moment",
  "Give the conversation one job",
  "Spot what pressure makes you do",
  "Give yourself room to answer",
  "Separate what happened from the story",
  "Keep one point in the room",
  "Make one answerable request",
  "Put the week into one opener",
];

const APPROVED_TRANSFERS = [
  "Watch for a smaller moment this week where the same move would fit. You don’t have to use it today.",
  "Next time something big is coming, ask yourself what you want the conversation to settle.",
  "Listen for the first thing you do after pushback. You may start talking faster or reach back for older examples.",
  "When you catch yourself piling on words, stop there and pick one thing to say.",
  "Prepare one current example for the real conversation. Don’t build a historical case file.",
  "Say your one point out loud before the real conversation.",
  "Try the request in a smaller conversation, or save it for the conversation you have in mind.",
  "Save one sentence from today’s practice for the real conversation.",
];

describe("approved V3 Days 1–8 pack", () => {
  test("loads one versioned config-driven engine pack", () => {
    expect(PILOT_TOTAL_DAYS).toBe(8);
    expect(PILOT_MODULES.map((module) => module.day)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(PILOT_PROGRAM.schema_version).toBe("3.0");
    expect(PILOT_PROGRAM.curriculum_version).toBe("BYSI-days-1-8-v3-2026-08-04");
    expect(PILOT_PROGRAM.audio_cache_version).toBe("bysi-v3-20260804");
    expect(pilotProblems()).toEqual([]);
  });

  test("ships the approved headings, transfer cues, and alternative labels exactly", () => {
    expect(PILOT_MODULES.map((module) => module.copy.heading)).toEqual(APPROVED_HEADINGS);
    expect(PILOT_MODULES.map((module) => module.copy.transfer)).toEqual(APPROVED_TRANSFERS);
    expect(pilotModule(1)?.copy.secondary_button).toBe("Use a different conversation");
    expect(PILOT_MODULES.slice(1).every((module) => module.copy.secondary_button === "Use my conversation")).toBe(true);
  });

  test("preserves Day 1 and its approved recovery-independent copy", () => {
    const day1 = pilotModule(1)!;
    expect(day1.preserve_uncoached_attempt).toBe(true);
    expect(day1.copy.body).toBe("You already made an attempt during setup. Now take one moment out of it and try that part again.");
    expect(day1.copy.primary_button).toBe("Show me what to try");
    expect(day1.copy.finish_button).toBe("Finish Day 1");
  });

  test("uses only the approved Day 8 pushback bank with stable audio IDs", () => {
    const bank = pilotModule(8)?.practice.approved_pushback_bank ?? [];
    expect(bank.map((line) => line.text)).toEqual([
      "I don’t think it’s that serious.",
      "I’ve had a long day. Can this wait?",
      "You do that too.",
      "I thought we already handled this.",
    ]);
    expect(bank.map((line) => line.audio_id)).toEqual([
      "bysi-v3-adam-d8-serious", "bysi-v3-adam-d8-wait", "bysi-v3-adam-d8-you-too", "bysi-v3-adam-d8-handled",
    ]);
  });

  test("maps every fixed spoken line to a unique V3 audio ID and semantic role", () => {
    const lines = PILOT_MODULES.flatMap(audioLines);
    expect(new Set(lines.map((line) => line.audio_id)).size).toBe(lines.length);
    expect(lines.every((line) => line.audio_id.startsWith("bysi-v3-"))).toBe(true);
    expect(lines.every((line) => line.voice_key === "hope_teacher" || line.voice_key === "adam_counterpart")).toBe(true);
    expect(pilotModule(4)?.copy.quiz?.option_b.leading_pause_ms).toBeGreaterThanOrEqual(500);
  });

  test("keeps exact day-specific fixed lines", () => {
    expect(pilotModule(2)?.practice.adam_line?.text).toBe("I can talk, but I have to leave in ten minutes.");
    expect(pilotModule(5)?.practice.adam_line?.text).toBe("What actually happened this week?");
    expect(pilotModule(6)?.retry.direction).toBe("Answer the work concern briefly, then return to the bedtime request.");
    expect(pilotModule(7)?.retry.direction).toBe("Ask who will do what and when. Leave room for a no or a different plan.");
    expect(pilotModule(8)?.retry.opener_direction).toBe("Run the opener again. Say what you want settled, what happened, and what you’re asking for.");
    expect(pilotModule(8)?.retry.response_direction).toBe("Answer that pushback again. Address a relevant concern, or set aside a deflection, then return to the request.");
  });

  test("unlocks sequentially without rewriting legacy progress", () => {
    expect(isPilotModuleUnlocked(1, new Set())).toBe(true);
    expect(isPilotModuleUnlocked(2, new Set())).toBe(false);
    expect(isPilotModuleUnlocked(2, new Set([1]))).toBe(true);
    expect(currentPilotDay(new Set([1, 2, 3]))).toBe(4);
  });
});

describe("static Adam and deterministic retry mechanics", () => {
  test("returns fixed Day 2 and Day 5 lines without generating replacements", async () => {
    const day2 = await nextPilotCounterpart(pilotModule(2)!, "private words", "run-2");
    const day5 = await nextPilotCounterpart(pilotModule(5)!, "private words", "run-5");
    expect(day2.spokenText).toBe("I can talk, but I have to leave in ten minutes.");
    expect(day2.audioId).toBe("bysi-v3-adam-d2-ten-minutes");
    expect(day5.spokenText).toBe("What actually happened this week?");
  });

  test("selects and reselects the same approved Day 8 reaction from the run ID", () => {
    const module = pilotModule(8)!;
    const first = selectDay8Pushback("stable-run", module);
    expect(selectDay8Pushback("stable-run", module)).toEqual(first);
    expect(module.practice.approved_pushback_bank).toContainEqual(first);
  });

  test("selects Day 8 chronology from only the coached behavior", () => {
    expect(day8RetryBranch("integrated_opener")).toBe("opener");
    expect(day8RetryBranch("pushback_response")).toBe("pushback_response");
  });
});

describe("Hope output validation", () => {
  const module = pilotModule(7)!;
  const valid: PilotCoachResponse = {
    route: "coach", day: 7, evidenceQuote: "care more", behaviorId: "answerable_request",
    note: "In care more, the request is a quality rather than an action.",
    retryInstruction: "Ask for one specific action and when.", retryPrompt: "Try that same moment again.",
  };

  test("requires an exact contiguous quote rendered inside the note", () => {
    expect(validatePilotCoachResponse(valid, module, "I need you to care more")).toEqual([]);
    expect(validatePilotCoachResponse(valid, module, "I need one action")).toContain("quote is not exact and contiguous");
    expect(validatePilotCoachResponse({ ...valid, note: "The request is still a quality." }, module, "I need you to care more")).toContain("note does not contain quote");
  });

  test("rejects over-limit, multiple-priority, scoring, praise, motive, diagnosis, relationship, future, and agreement claims", () => {
    expect(validatePilotCoachResponse({ ...valid, note: `care more ${"word ".repeat(33)}` }, module, "care more")).toContain("note exceeds 32 words");
    expect(validatePilotCoachResponse({ ...valid, retryInstruction: "word ".repeat(21) }, module, "care more")).toContain("retry exceeds 20 words");
    for (const phrase of ["Great job", "42 percent", "their motive", "a trauma response", "your personality", "the relationship", "will agree"]) {
      expect(validatePilotCoachResponse({ ...valid, note: `care more ${phrase}` }, module, "care more")).toContain("prohibited coaching claim or style");
    }
    expect(validatePilotCoachResponse({ ...valid, behaviorId: "pressure_pattern" }, module, "care more")).toContain("behavior not allowed");
  });

  test("fails closed to the approved neutral fallback", () => {
    const fallback = neutralPilotCoachResponse(module);
    expect(fallback.note).toBe(PILOT_NEUTRAL_COACH_FALLBACK);
    expect(fallback.note).toBe("I couldn't turn that into a clear, specific note. Please try the moment once more.");
  });

  test("keeps comparison to one behavior and 36 words", () => {
    const comparison = comparePilotAttempts("answerable_request", "Help more", "Can you own Tuesday bedtime?");
    expect(wordCount(comparison.text)).toBeLessThanOrEqual(36);
    expect(validatePilotComparison(comparison, "answerable_request")).toEqual([]);
    expect(validatePilotComparison(comparison, "one_point")).toContain("comparison behavior changed");
    expect(comparison.text).not.toMatch(/%|percent|score|great job/i);
  });
});

describe("shared engine, privacy, and navigation source contracts", () => {
  const layout = readFileSync(join(root, "app/_layout.tsx"), "utf8");
  const moduleScreen = readFileSync(join(root, "app/module/[day].tsx"), "utf8");
  const voice = readFileSync(join(root, "lib/voice.ts"), "utf8");

  test("uses one route and persisted run for all eight days", () => {
    expect(moduleScreen).toContain("createPilotDayRun");
    expect(moduleScreen).toContain("upsertPilotDayRun");
    expect(moduleScreen).not.toContain("scenario_setup");
    expect(moduleScreen).not.toContain("setup_fields");
  });

  test("confirms every transcript before Adam or Hope processing", () => {
    expect(moduleScreen).toContain("Does this match what you said?");
    expect(moduleScreen).toContain("Edit transcript");
    expect(moduleScreen).toContain("Use this transcript");
    const confirmAttempt = moduleScreen.slice(moduleScreen.indexOf("const confirmAttempt"), moduleScreen.indexOf("const confirmResponse"));
    const confirmResponse = moduleScreen.slice(moduleScreen.indexOf("const confirmResponse"), moduleScreen.indexOf("const beginRetry"));
    expect(confirmAttempt.indexOf("preservePilotAttempt")).toBeLessThan(confirmAttempt.indexOf("playAdam(preserved"));
    expect(confirmResponse.indexOf("preservePilotAttempt")).toBeLessThan(confirmResponse.indexOf("evaluatePilotAttempt(module"));
  });

  test("keeps Hope and Adam in separate semantic audio roles and a versioned cache", () => {
    expect(voice).toContain('hope_teacher: "woman-hope"');
    expect(voice).toContain('adam_counterpart: "man-adam"');
    expect(voice).toContain('line.voice_key === "contextual_counterpart"');
    expect(voice).toContain("PILOT_PROGRAM.audio_cache_version");
    expect(voice).toContain("staticAudioId: line.audio_id");
  });

  test("keeps transcript confirmation uninterrupted without automatic restart", () => {
    expect(moduleScreen).not.toContain("newlySpokenContentNeedsSafetyCheck");
    expect(moduleScreen).not.toContain("safety-check");
    expect(moduleScreen).toContain("preservePilotAttempt");
    expect(moduleScreen).not.toContain("autoStart");
  });

  test("uses native forward routes and reverse navigation", () => {
    expect(layout).toMatch(/name="module\/\[day\]"[\s\S]*?animation: "slide_from_right"/);
    expect(moduleScreen).toContain('router.navigate("/(tabs)")');
  });
});
