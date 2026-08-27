import type { ModuleId } from "@/constants/modules";
import type { ActivePracticeSession } from "@/lib/practiceSession";
import { progressHistoryPresentation, type ScoredPracticeRecord } from "@/lib/scoredPracticeHistory";
import type { PilotModuleState, PilotProgressEntry } from "@/types/pilotCurriculum";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

export const TODAY_CARD_HEIGHT = 288 as const;
export const TODAY_CARD_RADIUS = 28 as const;
export const TODAY_CARD_GAP = 16 as const;
export const TODAY_CARD_PADDING = 22 as const;
export const TODAY_PIN_STEP = 12 as const;
export const TODAY_ENTRANCE_DURATION_MS = 520 as const;
export const TODAY_ENTRANCE_STAGGER_MS = 70 as const;
export const TODAY_CHART_DURATION_MS = 620 as const;

export const TODAY_ACTIVITY_KEYS = ["lesson", "practice", "rehearsal", "review"] as const;
export type TodayActivityKey = typeof TODAY_ACTIVITY_KEYS[number];
export type TodayActivityState = "completed" | "current" | "upcoming";
export type TodayIndexKind = "overall" | "partial" | "insufficient";

export interface TodayIndexPresentation {
  kind: TodayIndexKind;
  value: number | null;
  observedCount: number;
  totalSignalCount: 6;
  focus: string | null;
  chartValues: number[];
}

export interface TodayActivityPresentation {
  key: TodayActivityKey;
  state: TodayActivityState;
  isInterrupted: boolean;
  ctaLabel: string | null;
}

export interface TodayRecentDay {
  key: string;
  label: string;
  isToday: boolean;
  hasPractice: boolean;
}

export interface TodayMotionSpec {
  entranceDurationMs: number;
  entranceStaggerMs: number;
  chartDurationMs: number;
  shouldAnimate: boolean;
  cardHeight: typeof TODAY_CARD_HEIGHT;
  pinStep: typeof TODAY_PIN_STEP;
}

const LESSON_STATES: readonly PilotModuleState[] = ["module_preview", "hope_lesson"];
const PRACTICE_STATES: readonly PilotModuleState[] = ["quiz", "quiz_feedback", "preset_scenario"];
const REVIEW_STATES: readonly PilotModuleState[] = ["attempt_comparison", "transfer_cue", "complete"];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

function localDayKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Presents the cumulative evidence-backed Index, including lesson updates. */
export function todayIndexPresentation(
  result: SharedResultContractV1 | undefined,
  history: readonly ScoredPracticeRecord[] = [],
): TodayIndexPresentation {
  const evidence = progressHistoryPresentation(history, result);
  const kind: TodayIndexKind = evidence.indexValue === null || evidence.observedCount === 0
    ? "insufficient"
    : evidence.observedCount === 6
      ? "overall"
      : "partial";
  return {
    kind,
    value: evidence.indexValue,
    observedCount: evidence.observedCount,
    totalSignalCount: 6,
    focus: evidence.currentFocus,
    chartValues: [...evidence.chartValues],
  };
}

/** Builds the current Monday-to-Sunday week from real persisted activity dates. */
export function todayRecentPractice(activityDays: ReadonlySet<string>, now: Date): TodayRecentDay[] {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const daysSinceMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - daysSinceMonday);
  const todayKey = localDayKey(today);

  return WEEKDAY_LABELS.map((label, index): TodayRecentDay => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    const key = localDayKey(date);
    return {
      key,
      label,
      isToday: key === todayKey,
      hasPractice: activityDays.has(key),
    };
  });
}

/** Maps the persisted module run into the approved four-activity Today sequence. */
export function todayCurrentActivity(state: PilotModuleState | undefined): TodayActivityKey {
  if (!state || LESSON_STATES.includes(state)) return "lesson";
  if (PRACTICE_STATES.includes(state)) return "practice";
  if (REVIEW_STATES.includes(state)) return "review";
  return "rehearsal";
}

/** Derives one and only one active CTA from the persisted run, without inventing completion. */
export function todayActivityPresentation(
  state: PilotModuleState | undefined,
  hasPersistedRun: boolean,
): TodayActivityPresentation[] {
  const currentKey = todayCurrentActivity(state);
  const currentIndex = state === "complete" ? TODAY_ACTIVITY_KEYS.length : TODAY_ACTIVITY_KEYS.indexOf(currentKey);
  return TODAY_ACTIVITY_KEYS.map((key, index): TodayActivityPresentation => {
    const isCompleted = index < currentIndex;
    const isCurrent = state !== "complete" && index === currentIndex;
    const isInterrupted = isCurrent && hasPersistedRun && state !== undefined && state !== "module_preview";
    return {
      key,
      state: isCompleted || state === "complete" ? "completed" : isCurrent ? "current" : "upcoming",
      isInterrupted,
      ctaLabel: isCurrent ? `${isInterrupted ? "Continue" : "Start"} ${key}` : null,
    };
  });
}

/** Reduced motion disables transitions while retaining values and the exact deck geometry. */
export function todayMotionSpec(isReducedMotion: boolean): TodayMotionSpec {
  return {
    entranceDurationMs: isReducedMotion ? 0 : TODAY_ENTRANCE_DURATION_MS,
    entranceStaggerMs: isReducedMotion ? 0 : TODAY_ENTRANCE_STAGGER_MS,
    chartDurationMs: isReducedMotion ? 0 : TODAY_CHART_DURATION_MS,
    shouldAnimate: !isReducedMotion,
    cardHeight: TODAY_CARD_HEIGHT,
    pinStep: TODAY_PIN_STEP,
  };
}

/** Natural and pinned top positions used by the reversible sticky deck. */
export function todayLayerGeometry(order: number, scrollOffset: number): { top: number; zIndex: number } {
  const naturalTop = order * (TODAY_CARD_HEIGHT + TODAY_CARD_GAP) - scrollOffset;
  return {
    top: Math.max(order * TODAY_PIN_STEP, naturalTop),
    zIndex: 10 + order * 10,
  };
}

/** The personalized module remains the shared-result first focus; no fallback module is fabricated. */
export function todayRecommendedModuleId(session: ActivePracticeSession | null): ModuleId | null {
  return session?.sharedResult?.first_focus?.recommended_module_id ?? null;
}

/** Counts only real persisted completion records for the recommended module. */
export function todayCompletedModuleCount(progress: readonly PilotProgressEntry[], moduleId: ModuleId): number {
  return progress.filter((entry) => entry.moduleId === moduleId).length;
}
