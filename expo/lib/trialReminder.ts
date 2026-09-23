import { Platform } from 'react-native';
import { createTrialReminderSync, TRIAL_REMINDER_ID, type TrialReminderStatus } from './trialOffer';

const CONSENT_KEY = 'cc.trialReminder.v1';
const storage = async () => (await import('@react-native-async-storage/async-storage')).default;
const notifications = () => import('expo-notifications');

export async function trialReminderPreference(): Promise<TrialReminderStatus> {
  try {
    if (Platform.OS !== 'ios') return 'unavailable';
    if (await (await storage()).getItem(CONSENT_KEY) !== 'enabled') return 'off';
    return (await (await notifications()).getPermissionsAsync()).granted ? 'enabled' : 'denied';
  } catch { return 'unavailable'; }
}

export async function enableTrialReminder(): Promise<TrialReminderStatus> {
  try {
    if (Platform.OS !== 'ios') return 'unavailable';
    const n = await notifications();
    const current = await n.getPermissionsAsync();
    const granted = current.granted || (current.canAskAgain && (await n.requestPermissionsAsync()).granted);
    if (!granted) return 'denied';
    await (await storage()).setItem(CONSENT_KEY, 'enabled');
    return 'enabled';
  } catch { return 'unavailable'; }
}

export const syncTrialReminder = createTrialReminderSync({
  enabled: async () => Platform.OS === 'ios' && await (await storage()).getItem(CONSENT_KEY) === 'enabled',
  permitted: async () => (await (await notifications()).getPermissionsAsync()).granted,
  scheduledAt: async () => {
    const item = (await (await notifications()).getAllScheduledNotificationsAsync()).find(n => n.identifier === TRIAL_REMINDER_ID);
    const at = item?.content.data?.trialReminderAt;
    return typeof at === 'number' ? at : null;
  },
  cancel: async () => {
    if (Platform.OS === 'ios') await (await notifications()).cancelScheduledNotificationAsync(TRIAL_REMINDER_ID);
  },
  schedule: async at => {
    const n = await notifications();
    await n.scheduleNotificationAsync({
      identifier: TRIAL_REMINDER_ID,
      content: {
        title: 'Your BYSI trial ends in 2 days',
        body: 'Review your subscription in Apple Settings. If you already cancelled, no action is needed.',
        sound: true,
        data: { trialReminderAt: at },
      },
      trigger: { type: n.SchedulableTriggerInputTypes.DATE, date: new Date(at) },
    });
  },
});
