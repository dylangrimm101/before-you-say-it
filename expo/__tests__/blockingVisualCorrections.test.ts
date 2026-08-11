import { describe, expect, test } from "bun:test";

import { commerceActionPresentation, purchasedContinuity } from "@/lib/nativeCommerce";
import { pilotComparisonPresentation, pilotModule } from "@/lib/pilotCurriculum";
import { progressEvidencePresentation, PROGRESS_SIGNAL_ORDER } from "@/lib/progressEvidence";
import type { PilotDayRun } from "@/types/pilotCurriculum";
import type { SharedResultContractV1, SharedSignalKey } from "@/types/sharedProduct";

const resultWithFocus = {
  contract_version: 1,
  rehearsal_id: "saved-free-result",
  pressure_moment: null,
  practice_shift: null,
  signals: [],
  starting_index: { index_kind: "partial", index_value: 72, observed_count: 3, total_signal_count: 6, index_version: "starting-index-v1" },
  first_focus: { first_focus_key: "clarity", first_focus_label: "State the ask first", recommended_module_id: "make_a_clear_ask", focus_status: "confirmed", focus_version: "first-focus-v1" },
} as SharedResultContractV1;

function signal(key: SharedSignalKey, score: number | null, evidence: string[] = []) {
  return { signal_key: key, observation_status: score === null ? "unobserved" as const : "observed" as const, score, evidence_turn_ids: evidence, signal_version: "signal-v1" as const };
}

describe("blocking commerce output correction", () => {
  test("repeat-purchase price is absent from every pending, restoring, delayed, restored-Pro, and already-subscribed output", () => {
    const priced = "Continue · $5.00";
    const outputs = [
      commerceActionPresentation("pending", false, priced),
      commerceActionPresentation("restoring", false, priced),
      commerceActionPresentation("entitlement_delayed", false, priced),
      commerceActionPresentation("restore_succeeded", true, priced),
      commerceActionPresentation("ready", true, priced),
    ];
    expect(outputs.every((output) => !output.showsPricedPurchase && !output.primaryLabel.includes("$"))).toBe(true);
    expect(outputs.slice(0, 2).every((output) => output.isPrimaryDisabled && output.isRestoreDisabled)).toBe(true);
    expect(outputs[2]?.primaryAction).toBe("check_access");
    expect(outputs.slice(3).every((output) => output.primaryAction === "continue")).toBe(true);
  });
});

describe("Purchased routing correction", () => {
  test("evidence-backed focus routes directly to its real module", () => {
    const continuity = purchasedContinuity(resultWithFocus, 0, 0);
    expect(continuity.hasPersonalizedStart).toBe(true);
    expect(continuity.moduleId).toBe("make_a_clear_ask");
    expect(continuity.recoveryDestination).toBeNull();
  });

  test("insufficient focus routes back to the preserved result rather than disabling the CTA or inventing a module", () => {
    const continuity = purchasedContinuity({ ...resultWithFocus, starting_index: { ...resultWithFocus.starting_index!, index_value: null, observed_count: 0 }, first_focus: null }, 0, 0);
    expect(continuity.hasPersonalizedStart).toBe(false);
    expect(continuity.moduleId).toBeNull();
    expect(continuity.recoveryDestination).toBe("/debrief/saved-free-result");
  });
});

describe("paid rehearsal counterpart and comparison correction", () => {
  const module = pilotModule(2)!;
  const line = module.practice.adam_line!;
  const completeRun: PilotDayRun = {
    id: "run-2",
    day: 2,
    curriculumVersion: "pilot-v3",
    state: "attempt_comparison",
    scenarioMode: "preset",
    lessonIndex: 0,
    attempt: { id: "first", kind: "opener", transcript: "I want to discuss the schedule.", representation: "confirmed_transcript", confirmedAt: 1 },
    responseAttempt: { id: "response", kind: "response", transcript: "Let’s choose one topic now.", representation: "confirmed_transcript", confirmedAt: 2 },
    retryAttempt: { id: "retry", kind: "retry", transcript: "We can handle one topic now and schedule the rest.", representation: "confirmed_transcript", confirmedAt: 3 },
    adamReactionId: "day2_fixed_adam",
    adamAudioId: line.audio_id,
    coachedBehaviorId: "timing_scope_channel",
    comparison: { behaviorId: "timing_scope_channel", text: "The retry names one topic now and schedules the rest.", criterionChanged: true },
    createdAt: 1,
    updatedAt: 3,
  };

  test("the persisted counterpart turn, first response, feedback difference, and retry populate one comparison", () => {
    const view = pilotComparisonPresentation(completeRun, line, "pushback_response");
    expect(view).toEqual({
      counterpartTurnId: line.audio_id,
      counterpartText: line.text,
      firstAttempt: completeRun.responseAttempt?.transcript,
      retry: completeRun.retryAttempt?.transcript,
      evidenceLinkedDifference: completeRun.comparison?.text,
    });
    expect(view?.evidenceLinkedDifference).not.toMatch(/score|percent|%/i);
  });

  test("an incomplete retry cannot produce a completed comparison", () => {
    const { retryAttempt: _retry, ...incomplete } = completeRun;
    expect(pilotComparisonPresentation(incomplete, line, "pushback_response")).toBeNull();
  });

  test("first response, feedback, retry, and comparison visibly reuse counterpart context", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/module/[day].tsx`).text();
    expect(source).toContain('effectiveState === "ready_for_response" ? <><CounterpartContext');
    expect(source).toContain('effectiveState === "hope_coaching" && day !== 1 && activeCoach ? <Reveal><Eyebrow');
    expect(source).toContain('effectiveState === "ready_for_retry" ? <><CounterpartContext');
    expect(source).toContain("<CounterpartMoment role={counterpartLabel} presentation={comparisonPresentation}");
    expect(source).not.toMatch(/Answer him|Respond to him/);
  });
});

describe("Progress fixture coherence correction", () => {
  test("Index, count, order, and all rows derive from one result object", () => {
    const coherentResult = {
      ...resultWithFocus,
      signals: [
        signal("clarity", 60, ["turn-1"]),
        signal("specificity", 72, ["turn-2"]),
        signal("steadiness", null),
        signal("listening", 84, ["turn-3"]),
        signal("boundaries", null),
        signal("repair", null),
      ],
      starting_index: { ...resultWithFocus.starting_index!, index_value: 99, observed_count: 6 },
    };
    const view = progressEvidencePresentation(coherentResult);
    expect(view.indexValue).toBe(72);
    expect(view.observedCount).toBe(3);
    expect(view.rows.map((row) => row.key)).toEqual([...PROGRESS_SIGNAL_ORDER]);
    expect(view.rows.map((row) => row.value)).toEqual([60, 72, 84, null, null, null]);
    expect(view.rows.flatMap((row) => row.evidenceTurnIds)).toEqual(["turn-1", "turn-2", "turn-3"]);
  });

  test("zero observed signals keeps the Index unavailable", () => {
    const empty = progressEvidencePresentation({ ...resultWithFocus, signals: PROGRESS_SIGNAL_ORDER.map((key) => signal(key, null)) });
    expect(empty.indexValue).toBeNull();
    expect(empty.observedCount).toBe(0);
    expect(empty.rows.every((row) => row.value === null)).toBe(true);
  });
});

describe("unsupported claims correction", () => {
  test("visible app surfaces contain no guessed duration, decorative reminder, or seventh Delivery signal", async () => {
    const paths = ["app/(tabs)/index.tsx", "app/(tabs)/library.tsx", "app/module/[day].tsx", "app/settings.tsx", "app/(tabs)/progress.tsx"];
    const sources = await Promise.all(paths.map((path) => Bun.file(`${import.meta.dir}/../${path}`).text()));
    const visible = sources.join("\n");
    expect(visible).not.toMatch(/3[–-]5 min|8 min practice|MIN PRACTICE|Practice reminders|Delivery isn’t|ACTIVITY_MINUTES|duration_minutes\[/i);
  });

  test("removing the incomplete reminder control also cancels and clears any legacy daily schedule", async () => {
    const settings = await Bun.file(`${import.meta.dir}/../app/settings.tsx`).text();
    const store = await Bun.file(`${import.meta.dir}/../providers/store.tsx`).text();
    expect(settings).not.toMatch(/Practice reminders|setReminder|<Switch/);
    expect(store).not.toContain("scheduleDailyReminder");
    expect(store).not.toContain("const setReminder");
    expect(store).toContain("await cancelDailyReminder()");
    expect(store).toContain("await AsyncStorage.removeItem(KEYS.reminder)");
  });
});
