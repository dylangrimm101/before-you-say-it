export type PurchaseProvider = "apple" | "google" | "stripe" | "unknown";

export interface StoreProductSnapshot {
  priceString: string;
  periodLabel: string | null;
  trialDurationLabel: string | null;
  trialPriceString: string | null;
}

export interface SubscriptionSnapshot {
  provider: PurchaseProvider;
  managementURL: string | null;
  expirationDate: string | null;
  willRenew: boolean | null;
}

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value !== null && typeof value === "object" ? value as UnknownRecord : null;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function periodFromISO(value: string | null): string | null {
  if (!value) return null;
  const match = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/i.exec(value);
  if (!match) return null;
  const units: readonly [string | undefined, string][] = [[match[1], "year"], [match[2], "month"], [match[3], "week"], [match[4], "day"]];
  const found = units.find(([count]) => count !== undefined);
  if (!found?.[0]) return null;
  const count = Number(found[0]);
  return `${count} ${found[1]}${count === 1 ? "" : "s"}`;
}

/** Reads only provider-supplied product values and returns null for unavailable terms. */
export function storeProductSnapshot(product: unknown): StoreProductSnapshot | null {
  const item = record(product);
  const priceString = nonEmpty(item?.priceString);
  if (!priceString) return null;
  const intro = record(item?.introPrice);
  const defaultOption = record(item?.defaultOption);
  const firstPhase = Array.isArray(defaultOption?.pricingPhases) ? record(defaultOption?.pricingPhases[0]) : null;
  const trialPeriod = nonEmpty(intro?.period) ?? nonEmpty(firstPhase?.billingPeriod);
  const trialPrice = nonEmpty(intro?.priceString) ?? nonEmpty(record(firstPhase?.price)?.formatted);
  return {
    priceString,
    periodLabel: periodFromISO(nonEmpty(item?.subscriptionPeriod)),
    trialDurationLabel: trialPrice === "$0.00" || trialPrice === "0" || Number(intro?.price) === 0 ? periodFromISO(trialPeriod) : null,
    trialPriceString: trialPrice,
  };
}

/** Maps RevenueCat lifecycle data without guessing a provider or management destination. */
export function subscriptionSnapshot(customerInfo: unknown, entitlementId: string): SubscriptionSnapshot | null {
  const info = record(customerInfo);
  const entitlements = record(info?.entitlements);
  const active = record(entitlements?.active);
  const entitlement = record(active?.[entitlementId]);
  if (!entitlement) return null;
  const rawStore = nonEmpty(entitlement.store)?.toLowerCase() ?? "";
  const provider: PurchaseProvider = rawStore.includes("app_store") || rawStore.includes("mac_app_store")
    ? "apple"
    : rawStore.includes("play_store")
      ? "google"
      : rawStore.includes("stripe")
        ? "stripe"
        : "unknown";
  return {
    provider,
    managementURL: nonEmpty(info?.managementURL),
    expirationDate: nonEmpty(entitlement.expirationDate),
    willRenew: typeof entitlement.willRenew === "boolean" ? entitlement.willRenew : null,
  };
}

export function providerLabel(provider: PurchaseProvider): string {
  if (provider === "apple") return "Apple App Store";
  if (provider === "google") return "Google Play";
  if (provider === "stripe") return "Stripe";
  return "Purchase provider unavailable";
}
