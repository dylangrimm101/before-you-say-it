import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { CHALLENGE_TOTAL_DAYS } from "@/constants/challenge";
import { errorShape, safeLog } from "@/lib/redact";

const REMINDER_ID = "daily-drill-reminder";
const CHALLENGE_NUDGE_ID = "challenge-6pm-nudge";
const NUDGE_HOUR = 18;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Ask for notification permission. Returns true when granted. */
export async function requestReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/**
 * Schedule (or reschedule) the daily drill reminder at the given local time.
 * Cancels any previous reminder first so only one is ever active.
 */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<void> {
  if (Platform.OS === "web") return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "Time for today's rep",
      body: "Two minutes of drills keeps the streak alive. Say it here first.",
      sound: true,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
      channelId: Platform.OS === "android" ? "reminders" : undefined,
    },
  });
}

/** Remove the scheduled daily reminder, if any. */
export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch (e) {
    safeLog("[reminders] cancel failed", errorShape(e));
  }
}

/** Remove the scheduled 6 PM challenge nudge, if any. */
export async function cancelChallengeNudge(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.cancelScheduledNotificationAsync(CHALLENGE_NUDGE_ID);
  } catch (e) {
    safeLog("[reminders] nudge cancel failed", errorShape(e));
  }
}

const NUDGE_LINES: { title: string; body: string }[] = [
  {
    title: "Day {day} is still open",
    body: "Two minutes before dinner. Say it here before you say it there.",
  },
  {
    title: "Your streak is on the line",
    body: "Day {day} takes one rep. The conversation won't rehearse itself.",
  },
  {
    title: "Still time for Day {day}",
    body: "One rep tonight and the flame stays lit.",
  },
];

/**
 * Keep the 6 PM challenge nudge in sync with reality:
 * - today's rep not done and it's before 6 PM → nudge today at 6 PM
 * - otherwise → nudge tomorrow at 6 PM (for the next open day)
 * - challenge finished → no nudge at all
 * Never prompts for permission; only schedules when already granted.
 */
export async function syncChallengeNudge(
  todayDone: boolean,
  nextDay: number,
): Promise<void> {
  if (Platform.OS === "web") return;

  await cancelChallengeNudge();
  if (nextDay > CHALLENGE_TOTAL_DAYS) return;

  const settings = await Notifications.getPermissionsAsync();
  if (!settings.granted) return;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Daily reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const now = new Date();
  const fireDate = new Date(now);
  fireDate.setHours(NUDGE_HOUR, 0, 0, 0);
  if (todayDone || now.getTime() >= fireDate.getTime()) {
    fireDate.setDate(fireDate.getDate() + 1);
  }

  const line = NUDGE_LINES[nextDay % NUDGE_LINES.length];
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: CHALLENGE_NUDGE_ID,
      content: {
        title: line.title.replace("{day}", String(nextDay)),
        body: line.body.replace("{day}", String(nextDay)),
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: fireDate,
        channelId: Platform.OS === "android" ? "reminders" : undefined,
      },
    });
  } catch (e) {
    safeLog("[reminders] nudge schedule failed", errorShape(e));
  }
}
