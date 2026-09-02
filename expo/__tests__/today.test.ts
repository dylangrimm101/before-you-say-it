import {
  TODAY_ACTIVITY_KEYS,
  TODAY_CARD_GAP,
  TODAY_CARD_HEIGHT,
  TODAY_CARD_PADDING,
  TODAY_CARD_RADIUS,
  TODAY_PIN_STEP,
  todayActivityPresentation,
  todayIndexPresentation,
  todayLayerGeometry,
  todayMotionSpec,
  todayRecentPractice,
  todayRecommendedModuleId,
} from "@/lib/today";
import type { ActivePracticeSession } from "@/lib/practiceSession";
import type { SharedResultContractV1, SharedSignalV1 } from "@/types/sharedProduct";

function result(indexValue: number | null, observedCount: number): SharedResultContractV1 {
  const observedSignals: SharedSignalV1[] = Array.from({ length: 6 }, (_, index): SharedSignalV1 => ({
    signal_key: ["clarity", "specificity", "listening", "steadiness", "boundaries", "repair"][index] as SharedSignalV1["signal_key"],
    observation_status: index < observedCount ? "observed" : "unobserved",
    score: index < observedCount ? indexValue : null,
    evidence_turn_ids: index < observedCount ? ["approved-turn"] : [],
    signal_version: "signal-v1",
  }));
  return {
    contract_version: 1,
    rehearsal_id: "real-rehearsal",
    pressure_moment: null,
    practice_shift: null,
    signals: observedSignals,
    starting_index: {
      index_kind: "partial",
      index_value: indexValue,
      observed_count: observedCount,
      total_signal_count: 6,
      index_version: "starting-index-v1",
    },
    first_focus: {
      first_focus_key: "real-focus",
      first_focus_label: "Return to one answerable request",
      recommended_module_id: "make_a_clear_ask",
      focus_status: "suggested",
      focus_version: "first-focus-v1",
    },
  };
}

describe("locked Today card system", () => {
  test("Index and all four activities share the exact locked geometry", () => {
    expect(TODAY_ACTIVITY_KEYS).toEqual(["lesson", "practice", "rehearsal", "review"]);
    expect({ height: TODAY_CARD_HEIGHT, radius: TODAY_CARD_RADIUS, gap: TODAY_CARD_GAP, padding: TODAY_CARD_PADDING }).toEqual({ height: 288, radius: 28, gap: 16, padding: 22 });
  });

  test("stack order and z-index increase in journey order at 12 px pin steps", () => {
    const layers = Array.from({ length: 5 }, (_, order) => todayLayerGeometry(order, 10_000));
    expect(layers.map((layer) => layer.top)).toEqual([0, 12, 24, 36, 48]);
    expect(layers.map((layer) => layer.zIndex)).toEqual([10, 20, 30, 40, 50]);
  });

  test("forward scroll layers later cards above earlier cards", () => {
    const offset = TODAY_CARD_HEIGHT + TODAY_CARD_GAP;
    expect(todayLayerGeometry(0, offset)).toEqual({ top: 0, zIndex: 10 });
    expect(todayLayerGeometry(1, offset)).toEqual({ top: TODAY_PIN_STEP, zIndex: 20 });
    expect(todayLayerGeometry(2, offset * 2)).toEqual({ top: TODAY_PIN_STEP * 2, zIndex: 30 });
  });

  test("reverse scroll restores natural positions without changing card size", () => {
    const restored = Array.from({ length: 5 }, (_, order) => todayLayerGeometry(order, 0));
    expect(restored.map((layer) => layer.top)).toEqual([0, 304, 608, 912, 1216]);
    expect(TODAY_CARD_HEIGHT).toBe(288);
  });

  test("reduced motion removes timing but preserves geometry and values", () => {
    const regular = todayMotionSpec(false);
    const reduced = todayMotionSpec(true);
    expect(regular).toMatchObject({ entranceDurationMs: 520, entranceStaggerMs: 70, chartDurationMs: 620, shouldAnimate: true });
    expect(reduced).toMatchObject({ entranceDurationMs: 0, entranceStaggerMs: 0, chartDurationMs: 0, shouldAnimate: false, cardHeight: 288, pinStep: 12 });
  });

  test("uses one responsive scroll-driven deck without fixed-height pinning", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(source).toContain("<Animated.ScrollView");
    expect(source).toContain("minHeight: TODAY_CARD_HEIGHT");
    expect(source).toContain("useNativeDriver: true");
    expect(source).not.toContain("pinnedTranslation(order, scrollOffset)");
    expect(source).not.toContain("card: { height: TODAY_CARD_HEIGHT");
    expect(source).not.toContain("stickyHeaderIndices");
  });

  test("makes the current Communication Index the Home focal point and includes completed lesson evidence", async () => {
    const source = await Bun.file(`${import.meta.dir}/../app/(tabs)/index.tsx`).text();
    expect(source).toContain("Your current Index");
    expect(source).toContain("Latest lesson included");
    expect(source).toContain("hasLessonUpdate={scoredPracticeHistory.length > 0}");
    expect(source).toContain("todayIndexPresentation(activePracticeSession?.sharedResult, scoredPracticeHistory)");
    expect(source).toContain("fontSize: 58");
  });
});

describe("truthful Today state", () => {
  test.each([
    [undefined, false, "lesson", "Start lesson"],
    ["hope_lesson", true, "lesson", "Continue lesson"],
    ["quiz", true, "practice", "Continue practice"],
    ["ready_for_attempt", true, "rehearsal", "Continue rehearsal"],
    ["attempt_comparison", true, "review", "Continue review"],
  ] as const)("exposes only the current activity CTA for %s", (state, hasRun, key, label) => {
    const activities = todayActivityPresentation(state, hasRun);
    expect(activities.filter((activity) => activity.ctaLabel !== null)).toEqual([
      expect.objectContaining({ key, state: "current", ctaLabel: label }),
    ]);
  });

  test("completed and upcoming activities never expose competing CTAs", () => {
    const activities = todayActivityPresentation("ready_for_attempt", true);
    expect(activities.map((activity) => [activity.key, activity.state, activity.ctaLabel])).toEqual([
      ["lesson", "completed", null],
      ["practice", "completed", null],
      ["rehearsal", "current", "Continue rehearsal"],
      ["review", "upcoming", null],
    ]);
  });

  test("uses the actual Partial Index and only its one persisted chart point", () => {
    expect(todayIndexPresentation(result(64, 3))).toEqual({
      kind: "partial",
      value: 64,
      observedCount: 3,
      totalSignalCount: 6,
      focus: "Return to one answerable request",
      chartValues: [64],
    });
  });

  test("uses an overall Index only when all six signals are observed", () => {
    expect(todayIndexPresentation(result(71, 6))).toMatchObject({ kind: "overall", value: 71, observedCount: 6, chartValues: [71] });
  });

  test("shows truthful insufficient evidence without a fixture score or chart history", () => {
    expect(todayIndexPresentation(result(null, 0))).toEqual({ kind: "insufficient", value: null, observedCount: 0, totalSignalCount: 6, focus: "Return to one answerable request", chartValues: [] });
  });

  test("shows the current week Monday through Sunday and marks only persisted activity dates", () => {
    const days = todayRecentPractice(new Set(["2026-08-10", "2026-08-15"]), new Date(2026, 7, 11, 12));
    expect(days.map((day) => [day.label, day.key, day.hasPractice, day.isToday])).toEqual([
      ["Mon", "2026-08-10", true, false],
      ["Tue", "2026-08-11", false, true],
      ["Wed", "2026-08-12", false, false],
      ["Thu", "2026-08-13", false, false],
      ["Fri", "2026-08-14", false, false],
      ["Sat", "2026-08-15", true, false],
      ["Sun", "2026-08-16", false, false],
    ]);
  });

  test("keeps Sunday last while highlighting it as today", () => {
    const days = todayRecentPractice(new Set<string>(), new Date(2026, 7, 16, 12));
    expect(days.map((day) => day.label)).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
    expect(days.findIndex((day) => day.isToday)).toBe(6);
  });

  test("recommended module comes only from the persisted first focus", () => {
    const session = { sharedResult: result(64, 3) } as ActivePracticeSession;
    expect(todayRecommendedModuleId(session)).toBe("make_a_clear_ask");
    expect(todayRecommendedModuleId(null)).toBeNull();
    expect(todayRecommendedModuleId({} as ActivePracticeSession)).toBeNull();
  });
});
