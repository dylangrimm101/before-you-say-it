import type { ChallengeLogEntry, DrillResult } from "@/types/convo";
import type { SessionRecord, SessionScores } from "@/types/privacy";

/**
 * Pure progress derivations. Everything the app shows about streaks, averages
 * and history is computed from minimized records only — never from content.
 */

/** YYYY-MM-DD bucket for a timestamp. */
export function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

export function completedRecords(records: SessionRecord[]): SessionRecord[] {
  return records.filter((r) => r.completed);
}

/** Rounded average of the four legacy score axes, or null with no data. */
export function averageScores(records: SessionRecord[]): SessionScores | null {
  const scored = records.filter((r) => r.scores);
  if (scored.length === 0) return null;
  const sum: SessionScores = { clarity: 0, empathy: 0, assertiveness: 0, composure: 0 };
  scored.forEach((r) => {
    const s = r.scores;
    if (!s) return;
    sum.clarity += s.clarity;
    sum.empathy += s.empathy;
    sum.assertiveness += s.assertiveness;
    sum.composure += s.composure;
  });
  const n = scored.length;
  return {
    clarity: Math.round(sum.clarity / n),
    empathy: Math.round(sum.empathy / n),
    assertiveness: Math.round(sum.assertiveness / n),
    composure: Math.round(sum.composure / n),
  };
}

/** Every day with training activity: rehearsals, drills or challenge days. */
export function activityDayKeys(
  records: SessionRecord[],
  drillLog: DrillResult[],
  challengeLog: ChallengeLogEntry[],
): Set<string> {
  const days = new Set<string>();
  records.forEach((r) => {
    if (r.endedAt) days.add(dayKey(r.endedAt));
  });
  drillLog.forEach((d) => days.add(d.date));
  challengeLog.forEach((e) => days.add(e.date));
  return days;
}

/** Total lines the user spoke or typed, counted without keeping the lines. */
export function spokenLineCount(records: SessionRecord[]): number {
  return records.reduce((n, r) => n + r.userTurnCount, 0);
}

/** Consecutive-day streak across a set of day keys, ending today or yesterday. */
export function streakFromDays(days: Set<string>, now: number = Date.now()): number {
  if (days.size === 0) return 0;
  const oneDay = 86400000;
  const today = dayKey(now);
  const yesterday = dayKey(now - oneDay);
  let cursor = days.has(today) ? now : days.has(yesterday) ? now - oneDay : 0;
  if (cursor === 0) return 0;

  let streak = 0;
  while (days.has(dayKey(cursor))) {
    streak += 1;
    cursor -= oneDay;
  }
  return streak;
}

/**
 * First incomplete day in a sequence of `totalDays`, or `totalDays + 1` when
 * every day is done. Pure so the upgrade path can be tested without a store.
 */
export function firstOpenDay(doneDays: Set<number>, totalDays: number): number {
  let day = 1;
  while (day <= totalDays && doneDays.has(day)) day += 1;
  return day;
}

/** Overall score for a record, or 0 when it was never scored. */
export function overallOf(scores: SessionScores | undefined): number {
  if (!scores) return 0;
  return Math.round(
    (scores.clarity + scores.empathy + scores.assertiveness + scores.composure) / 4,
  );
}
