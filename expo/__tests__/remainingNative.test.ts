import { describe, expect, test } from "bun:test";

import { storeProductSnapshot, subscriptionSnapshot } from "@/lib/commerce";
import { calculatePartialStartingIndex, type SharedSignalV1 } from "@/types/sharedProduct";

const source = async (relative: string): Promise<string> => Bun.file(`${import.meta.dir}/../${relative}`).text();

describe("remaining native acquisition and paid experience", () => {
  test("fresh installations route to Entry and the primary action begins the frozen onboarding", async () => {
    const layout = await source("app/_layout.tsx");
    const entry = await source("app/entry.tsx");
    expect(layout).toContain('router.replace("/entry")');
    expect(layout).toContain("!hasLocalJourney");
    expect(entry).toContain("Start my free rehearsal");
    expect(entry).toContain("await beginNativeJourney()");
    expect(entry).toContain('router.replace("/onboarding")');
  });

  test("locally resumable people bypass Entry while account continuation remains truthful", async () => {
    const layout = await source("app/_layout.tsx");
    const continuation = await source("app/continue-from-web.tsx");
    expect(layout).toContain("profile || activePracticeSession || nativeJourneyStarted");
    expect(layout).toContain("activePracticeSession?.sharedResult");
    expect(continuation).toContain("not connected yet");
    expect(continuation).toContain("No identity was created");
    expect(continuation).not.toContain("signIn(");
  });

  test("an existing entitlement continues through the current access source of truth", async () => {
    const store = await source("providers/store.tsx");
    const today = await source("app/(tabs)/index.tsx");
    expect(store).toContain('purchasedPro || (__DEV__ && devPro) ? "pro" : "free"');
    expect(today).toContain('access.entitlement !== "pro"');
    expect(today).toContain('pathname: "/module/[day]"');
  });

  test("the earned offer is three stages and rejects an incomplete free result", async () => {
    const paywall = await source("app/paywall.tsx");
    const offerLogic = await source("lib/nativeCommerce.ts");
    const results = await source("components/FreeJourneyResults.tsx");
    expect(offerLogic).toContain("export type OfferStage = 1 | 2 | 3");
    expect(paywall).toContain("earnedOfferBlocked");
    expect(paywall).toContain("Pressure Moment, Practice Shift, Starting Index, and practice path");
    expect(results).toContain('freeJourneyCheckpoint: "complete"');
    expect(results.indexOf('freeJourneyCheckpoint: "complete"')).toBeLessThan(results.indexOf('pathname: "/paywall"'));
  });

  test("live product values remain live and unavailable fields stay explicit", () => {
    expect(storeProductSnapshot({ priceString: "€8.49", subscriptionPeriod: "P1M", introPrice: { price: 0, priceString: "€0.00", period: "P7D" } })).toEqual({ priceString: "€8.49", periodLabel: "1 month", trialDurationLabel: "7 days", trialPriceString: "€0.00" });
    expect(storeProductSnapshot({ priceString: "¥980" })).toEqual({ priceString: "¥980", periodLabel: null, trialDurationLabel: null, trialPriceString: null });
    expect(storeProductSnapshot({ subscriptionPeriod: "P1M" })).toBeNull();
  });

  test("purchase and success screens cannot fabricate entitlement", async () => {
    const purchases = await source("lib/purchases.ts");
    const paywall = await source("app/paywall.tsx");
    const purchased = await source("app/purchase-success.tsx");
    expect(purchases).toContain('hasPro(customerInfo) ? "purchased"');
    expect(purchases).toContain('"entitlement_delayed"');
    expect(paywall).toContain('result.status === "entitlement_delayed"');
    expect(purchased).toContain("if (!isPro)");
    expect(purchased).toContain("Nothing has been unlocked optimistically");
  });

  test("Purchased carries the actual free result and adds no history", async () => {
    const purchased = await source("app/purchase-success.tsx");
    const continuity = await source("lib/nativeCommerce.ts");
    expect(continuity).toContain("result?.starting_index?.index_value");
    expect(continuity).toContain("result?.starting_index?.observed_count");
    expect(continuity).toContain("result?.first_focus?.first_focus_label");
    expect(purchased).toContain("Paid-practice history begins now. No practice record was fabricated by purchase.");
    expect(purchased).not.toContain("saved rehearsal record");
    expect(purchased).not.toContain("7 practices");
    expect(purchased).not.toContain("streak");
  });

  test("first practice and Today derive from first focus and real checkpoints", async () => {
    const today = await source("app/(tabs)/index.tsx");
    const todayLogic = await source("lib/today.ts");
    const purchased = await source("app/purchase-success.tsx");
    expect(todayLogic).toContain("session?.sharedResult?.first_focus?.recommended_module_id ?? null");
    expect(today).toContain("run.moduleId === moduleId");
    expect(today).toContain("todayActivityPresentation(activeRun?.state");
    expect(purchased).toContain("Start my first practice");
  });

  test("paid practice keeps voice, review, approval, retry, comparison, and microphone recovery", async () => {
    const module = await source("app/module/[day].tsx");
    const commerceLogic = await source("lib/nativeCommerce.ts");
    ["ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "hope_coaching", "ready_for_retry", "confirm_retry_transcript", "attempt_comparison"].forEach((state) => expect(module).toContain(state));
    expect(commerceLogic).toContain("Type this turn instead");
    expect(module).toContain("Nothing submits until you approve the transcript");
    expect(module).not.toContain("onend");
  });

  test("Scenarios uses the shared scenario/category model and real entitlement", async () => {
    const scenarios = await source("app/(tabs)/library.tsx");
    expect(scenarios).toContain("CATEGORIES, SCENARIOS");
    expect(scenarios).toContain('access.entitlement !== "pro"');
    expect(scenarios).toContain("scenario.category === active");
    expect(scenarios).toContain("accessibilityLabel={`Show ${item.label} scenarios`}");
  });

  test("Progress excludes every unobserved signal from the Index", async () => {
    const signals: SharedSignalV1[] = [
      { signal_key: "clarity", observation_status: "observed", score: 72, evidence_turn_ids: ["u1"], signal_version: "signal-v1" },
      { signal_key: "repair", observation_status: "unobserved", score: null, evidence_turn_ids: [], signal_version: "signal-v1" },
    ];
    expect(calculatePartialStartingIndex(signals).index_value).toBe(72);
    const progress = await source("app/(tabs)/progress.tsx");
    expect(progress).toContain("Unobserved signals are not treated as zero");
    expect(progress).not.toContain("averageScores");
    expect(progress).not.toContain("overallOf");
  });

  test("Settings opens management only for an authoritative provider URL", async () => {
    expect(subscriptionSnapshot({ managementURL: "https://apps.apple.com/account/subscriptions", entitlements: { active: { pro: { store: "APP_STORE", expirationDate: "2026-09-01", willRenew: true } } } }, "pro")?.provider).toBe("apple");
    expect(subscriptionSnapshot({ managementURL: null, entitlements: { active: { pro: { store: "PLAY_STORE" } } } }, "pro")?.managementURL).toBeNull();
    const settings = await source("app/settings.tsx");
    expect(settings).toContain('subscription.provider === "unknown"');
    expect(settings).toContain('subscription.provider === "stripe"');
    expect(settings).toContain("if (!subscription.managementURL)");
    expect(settings).toContain("useRestorePurchases");
  });

  test("no sensitive acquisition content enters routes or analytics", async () => {
    const entry = await source("app/entry.tsx");
    const paywall = await source("app/paywall.tsx");
    expect(entry).not.toContain("analytics");
    expect(paywall).not.toContain("approved_text");
    expect(paywall).not.toContain("evidenceQuote");
    expect(paywall).not.toContain("scenarioTitle");
  });

  test("test fixture progress remains unavailable to production source", async () => {
    const production = await Promise.all(["app/(tabs)/index.tsx", "app/(tabs)/library.tsx", "app/(tabs)/progress.tsx", "app/paywall.tsx", "app/purchase-success.tsx", "app/settings.tsx", "providers/store.tsx"].map(source));
    expect(production.join("\n")).not.toContain("freeJourneyVisual");
    expect(production.join("\n")).not.toContain("visual-fixture");
  });
});
