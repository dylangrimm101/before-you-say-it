import { describe, expect, test } from "bun:test";

import { CURRICULUM_MODULES, type ModuleId } from "@/constants/modules";
import {
  dimensionEvidencePresentation,
  interruptedPresentation,
  paidActivityForState,
  pathPresentation,
} from "@/lib/paidProduct";
import { createPilotDayRun, createPresetPracticeSession, transitionPilotRun, upsertPilotDayRun } from "@/lib/practiceSession";
import { progressEvidencePresentation, PROGRESS_SIGNAL_ORDER } from "@/lib/progressEvidence";
import { todayActivityPresentation } from "@/lib/today";
import type { PilotModuleState } from "@/types/pilotCurriculum";
import type { SharedResultContractV1, SharedSignalKey } from "@/types/sharedProduct";

function signal(key: SharedSignalKey, score: number | null, evidenceTurnIds: string[] = []): SharedResultContractV1["signals"][number] {
  return { signal_key: key, observation_status: score === null ? "unobserved" : "observed", score, evidence_turn_ids: evidenceTurnIds, signal_version: "signal-v1" };
}

const result: SharedResultContractV1 = {
  contract_version: 1,
  rehearsal_id: "paid-product-result",
  pressure_moment: null,
  practice_shift: null,
  signals: [signal("clarity", 70, ["turn-clarity"]), signal("specificity", 50, ["turn-specificity"]), ...PROGRESS_SIGNAL_ORDER.slice(2).map((key) => signal(key, null))],
  starting_index: { index_kind: "partial", index_value: 99, observed_count: 6, total_signal_count: 6, index_version: "starting-v1" },
  first_focus: { first_focus_key: "clear-ask", first_focus_label: "Return to one answerable request", recommended_module_id: "make_a_clear_ask", focus_status: "suggested", focus_version: "focus-v1" },
};

describe("post-login paid-product presentation", () => {
  test("maps every persisted run state to exactly one approved activity screen", () => {
    const expected: Record<PilotModuleState, string> = {
      module_preview: "lesson", hope_lesson: "lesson", quiz: "practice", quiz_feedback: "practice",
      preset_scenario: "rehearsal", ready_for_attempt: "rehearsal", listening_attempt: "rehearsal", confirm_attempt_transcript: "rehearsal",
      adam_response: "rehearsal", ready_for_response: "rehearsal", listening_response: "rehearsal", confirm_response_transcript: "rehearsal",
      hope_coaching: "rehearsal", day3_note_check: "rehearsal", day3_neutral_retry: "rehearsal", ready_for_retry: "rehearsal",
      listening_retry: "rehearsal", confirm_retry_transcript: "rehearsal", play_adam_after_opener_retry: "rehearsal",
      attempt_comparison: "review", transfer_cue: "review", complete: "review", microphone_error: "rehearsal", no_speech: "rehearsal", transcription_error: "rehearsal", playback_error: "rehearsal", network_error: "rehearsal", model_error: "rehearsal",
    };
    for (const [state, activity] of Object.entries(expected) as [PilotModuleState, string][]) expect(paidActivityForState(state)).toBe(activity);
  });

  test("interrupted state reports completed, stopped, remaining, and current-only continuation", () => {
    const session = createPresetPracticeSession("anon-paid", 1000);
    const base = createPilotDayRun(session, 7, 1100, "make_a_clear_ask");
    const run = transitionPilotRun(base, "confirm_response_transcript", 1200);
    const interrupted = interruptedPresentation(run);
    expect(interrupted.activity).toBe("rehearsal");
    expect(interrupted.completed).toEqual(["Lesson", "Practice"]);
    expect(interrupted.stoppedAt).toBe("At transcript review");
    expect(interrupted.remains).toEqual(["Review"]);
    expect(interrupted.continueLabel).toBe("Continue rehearsal");
    const today = todayActivityPresentation(run.state, true);
    expect(today.filter((item) => item.ctaLabel !== null)).toHaveLength(1);
    expect(today.find((item) => item.state === "current")?.ctaLabel).toBe("Continue rehearsal");
  });

  test("path uses all eight canonical modules without fabricating completion", () => {
    let session = createPresetPracticeSession("anon-path", 1000);
    session = { ...session, sharedResult: result };
    const base = createPilotDayRun(session, 7, 1100, "make_a_clear_ask");
    session = upsertPilotDayRun(session, transitionPilotRun(base, "quiz", 1200), 1200);
    const completed = new Set<ModuleId>(["get_to_the_point"]);
    const path = pathPresentation(session, completed, true);
    expect(path.map((item) => item.module.id)).toEqual(CURRICULUM_MODULES.map((module) => module.id));
    expect(path.filter((item) => item.status === "completed").map((item) => item.module.id)).toEqual(["get_to_the_point"]);
    expect(path.find((item) => item.module.id === "make_a_clear_ask")?.status).toBe("interrupted");
    expect(path.filter((item) => item.status === "locked")).toHaveLength(0);
  });

  test("free access locks only genuinely entitlement-gated modules while preserving the recommendation", () => {
    const session = { ...createPresetPracticeSession("anon-free-path", 1000), sharedResult: result };
    const path = pathPresentation(session, new Set<ModuleId>(), false);
    expect(path.find((item) => item.module.id === "make_a_clear_ask")?.status).toBe("recommended");
    expect(path.filter((item) => item.status === "locked")).toHaveLength(7);
  });

  test("Progress and Dimension detail share the same evidence records", () => {
    const progress = progressEvidencePresentation(result);
    expect(progress.indexValue).toBe(60);
    expect(progress.observedCount).toBe(2);
    expect(progress.rows.map((row) => row.label)).toEqual(["Clarity", "Specificity", "Listening", "Steadiness", "Boundaries", "Repair"]);
    const clarity = dimensionEvidencePresentation("clarity", result, new Map([["turn-clarity", "I need us to decide who owns Tuesday."]]));
    expect(clarity.value).toBe(progress.rows[0]?.value);
    expect(clarity.evidenceTexts).toEqual(["I need us to decide who owns Tuesday."]);
    expect(clarity.practiceCount).toBe(1);
    const repair = dimensionEvidencePresentation("repair", result);
    expect(repair.value).toBeNull();
    expect(repair.evidenceTexts).toEqual([]);
    expect(repair.practiceCount).toBe(0);
  });

  test("every requested destination route exists without importing artifact fixtures", async () => {
    const paths = ["app/path.tsx", "app/interrupted/[moduleId].tsx", "app/progress/dimension/[signal].tsx", "app/progress/how-it-works.tsx", "app/(tabs)/library.tsx", "app/(tabs)/progress.tsx", "app/settings.tsx", "app/module/[day].tsx"];
    const sources = await Promise.all(paths.map((path) => Bun.file(`${import.meta.dir}/../${path}`).text()));
    for (const source of sources) {
      expect(source.length).toBeGreaterThan(100);
      expect(source).not.toMatch(/BYSI Full Flow|\.dc\.html|prototype fixture|duration_minutes/);
    }
    expect(sources.join("\n")).not.toMatch(/Practice reminders|Delivery isn|\b[0-9]+[–-][0-9]+ min|· [0-9]+ min/i);
    const moduleSource = sources.at(-1) ?? "";
    for (const recovery of ["microphone_error", "no_speech", "transcription_error", "playback_error", "network_error", "model_error"]) expect(moduleSource).toContain(`effectiveState === \"${recovery}\"`);
  });
});
