export const MONTHLY_PRODUCT = 'byis_pro_monthly_5';
export const TWO_DAYS_MS = 48 * 60 * 60 * 1000;

/** Eligibility alone is insufficient: the actual store offer must be free for seven days. */
export function isSevenDayTrial(product: unknown, eligibility: number | undefined): boolean {
  const p = product as { identifier?: string; introPrice?: { price?: number; period?: string; cycles?: number } } | null;
  return eligibility === 2 && p?.identifier === MONTHLY_PRODUCT && p.introPrice?.price === 0
    && (p.introPrice.period === 'P1W' || p.introPrice.period === 'P7D') && p.introPrice.cycles === 1;
}

export function trialReminderDate(info: unknown, now: number): number | null {
  const e = (info as { entitlements?: { active?: { pro?: {
    isActive?: boolean; productIdentifier?: string; store?: string; periodType?: string;
    willRenew?: boolean; expirationDate?: string | null;
  } } } } | null)?.entitlements?.active?.pro;
  if (!e?.isActive || e.productIdentifier !== MONTHLY_PRODUCT || e.store !== 'APP_STORE'
    || e.periodType !== 'TRIAL' || e.willRenew !== true || !e.expirationDate) return null;
  const fireAt = Date.parse(e.expirationDate) - TWO_DAYS_MS;
  return Number.isFinite(fireAt) && fireAt > now ? fireAt : null;
}

export type TrialReminderStatus = 'off' | 'enabled' | 'scheduled' | 'denied' | 'unavailable' | 'not-applicable';
export const TRIAL_REMINDER_ID = 'bysi-trial-ending';

export interface TrialReminderDriver {
  enabled(): Promise<boolean>;
  permitted(): Promise<boolean>;
  scheduledAt(): Promise<number | null>;
  cancel(): Promise<void>;
  schedule(at: number): Promise<void>;
}

/** One fixed notification; retries and multiple mounted consumers cannot create duplicates. */
export function createTrialReminderSync(driver: TrialReminderDriver, now = Date.now) {
  let tail: Promise<unknown> = Promise.resolve();
  return (info: unknown): Promise<TrialReminderStatus> => {
    const run = async (): Promise<TrialReminderStatus> => {
      try {
        const at = trialReminderDate(info, now());
        if (!at || !await driver.enabled()) {
          await driver.cancel();
          return at ? 'off' : 'not-applicable';
        }
        if (!await driver.permitted()) { await driver.cancel(); return 'denied'; }
        if (await driver.scheduledAt() !== at) {
          await driver.cancel();
          await driver.schedule(at);
        }
        return await driver.scheduledAt() === at ? 'scheduled' : 'unavailable';
      } catch { return 'unavailable'; }
    };
    const result = tail.then(run, run);
    tail = result;
    return result;
  };
}
