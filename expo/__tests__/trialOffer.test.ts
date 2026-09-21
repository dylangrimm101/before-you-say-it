import { describe, expect, test } from 'bun:test';
import { createTrialReminderSync, isSevenDayTrial, MONTHLY_PRODUCT, trialReminderDate, TWO_DAYS_MS } from '../lib/trialOffer';

const now = Date.parse('2026-09-21T12:00:00Z');
const expires = now + 7 * 86400000;
const info = (patch = {}) => ({ entitlements: { active: { pro: { isActive: true, productIdentifier: MONTHLY_PRODUCT, store: 'APP_STORE', periodType: 'TRIAL', willRenew: true, expirationDate: new Date(expires).toISOString(), ...patch } } } });
describe('verified trial offer and reminder', () => {
  test('requires eligible, matching, seven-day free store offer', () => {
    const product = { identifier: MONTHLY_PRODUCT, introPrice: { price: 0, period: 'P1W', cycles: 1 } };
    expect(isSevenDayTrial(product, 2)).toBe(true);
    for (const status of [0, 1, 3, undefined]) expect(isSevenDayTrial(product, status)).toBe(false);
    expect(isSevenDayTrial({ ...product, introPrice: { price: 1, period: 'P1W', cycles: 1 } }, 2)).toBe(false);
    expect(isSevenDayTrial({ ...product, identifier: 'other' }, 2)).toBe(false);
    expect(isSevenDayTrial(null, 2)).toBe(false);
  });
  test('uses actual expiration, excludes renewals, cancelled and accelerated sandbox trials', () => {
    expect(trialReminderDate(info(), now)).toBe(expires - TWO_DAYS_MS);
    for (const patch of [{ isActive: false }, { willRenew: false }, { store: 'PLAY_STORE' }, { periodType: 'NORMAL' }, { expirationDate: 'invalid' }, { expirationDate: new Date(now + 600000).toISOString() }]) expect(trialReminderDate(info(patch), now)).toBe(null);
  });
  test('serializes duplicate scheduling, cancels denied and ended trials, reports native failures', async () => {
    let at: number | null = null, schedules = 0, permission = true;
    const sync = createTrialReminderSync({ enabled: async () => true, permitted: async () => permission, scheduledAt: async () => at, cancel: async () => { at = null; }, schedule: async date => { schedules++; at = date; } }, () => now);
    expect(await Promise.all([sync(info()), sync(info())])).toEqual(['scheduled', 'scheduled']);
    expect(schedules).toBe(1);
    permission = false;
    expect(await sync(info())).toBe('denied'); expect(at).toBe(null);
    expect(await sync(null)).toBe('not-applicable');
    const fail = createTrialReminderSync({ enabled: async () => true, permitted: async () => true, scheduledAt: async () => null, cancel: async () => {}, schedule: async () => { throw Error('native failed'); } }, () => now);
    expect(await fail(info())).toBe('unavailable');
  });
});
