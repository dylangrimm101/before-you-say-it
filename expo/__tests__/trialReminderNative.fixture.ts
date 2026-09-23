import { mock } from 'bun:test';
import assert from 'node:assert/strict';
mock.module('react-native', () => ({ Platform: { OS: 'ios' } }));
const values = new Map<string, string>();
mock.module('@react-native-async-storage/async-storage', () => ({ default: { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } } }));
let granted = false, fail = false, scheduled: any[] = [];
mock.module('expo-notifications', () => ({
  getPermissionsAsync: async () => ({ granted, canAskAgain: true }),
  requestPermissionsAsync: async () => ({ granted }),
  getAllScheduledNotificationsAsync: async () => scheduled,
  cancelScheduledNotificationAsync: async (id: string) => { scheduled = scheduled.filter(n => n.identifier !== id); },
  scheduleNotificationAsync: async (n: any) => { if (fail) throw Error('synthetic native scheduling error'); scheduled.push(n); return n.identifier; },
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));
const { enableTrialReminder, syncTrialReminder, trialReminderPreference } = await import('../lib/trialReminder');
const expiry = Date.now() + 7 * 86400000;
const info = { entitlements: { active: { pro: { isActive: true, productIdentifier: 'byis_pro_monthly_5', periodType: 'TRIAL', store: 'APP_STORE', willRenew: true, expirationDate: new Date(expiry).toISOString() } } } };
assert.equal(await trialReminderPreference(), 'off');
assert.equal(await enableTrialReminder(), 'denied');
assert.equal(await syncTrialReminder(info), 'off');
assert.equal(scheduled.length, 0);
granted = true;
assert.equal(await enableTrialReminder(), 'enabled');
assert.equal(await syncTrialReminder(info), 'scheduled');
assert.equal(scheduled[0].trigger.date.getTime(), expiry - 48 * 3600000);
assert.equal(scheduled[0].trigger.type, 'date');
assert.equal(await syncTrialReminder(info), 'scheduled');
assert.equal(scheduled.length, 1);
scheduled.push({ identifier: 'daily-drill-reminder' });
await syncTrialReminder(null);
assert.deepEqual(scheduled, [{ identifier: 'daily-drill-reminder' }]);
fail = true;
assert.equal(await syncTrialReminder(info), 'unavailable');
assert.equal(scheduled.length, 1);
console.log('PASS native notification adapter with mocked OS; no real notification delivered.');
