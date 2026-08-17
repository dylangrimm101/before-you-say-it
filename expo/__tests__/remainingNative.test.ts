import { describe, expect, test } from "bun:test";

import { storeProductSnapshot, subscriptionSnapshot } from "@/lib/commerce";
import { calculatePartialStartingIndex, type SharedSignalV1 } from "@/types/sharedProduct";

const source = async (relative: string): Promise<string> => Bun.file(`${import.meta.dir}/../${relative}`).text();

describe("remaining native acquisition and paid experience", () => {
  test("fresh installations see the world-class communication gateway before onboarding", async () => {
    const layout = await source("app/_layout.tsx");
    const entry = await source("app/entry.tsx");
    const onboarding = await source("app/onboarding.tsx");
    expect(layout).toContain('router.replace("/entry")');
    expect(layout).toContain("!hasLocalJourney");
    expect(entry).toContain("Build the qualities of world-class communicators.");
    expect(entry).toContain('label="Sign up now"');
    expect(entry).toContain('label="Log in"');
    expect(entry).toContain("await beginNativeJourney()");
    expect(entry).toContain('router.replace("/onboarding")');
    expect(onboarding).toContain("useState<number>(0)");
  });

  test("rehearsal replies use the user-owned BYSI Claude endpoint with honest recovery copy", async () => {
    const ai = await source("lib/ai.ts");
    const rehearsal = await source("app/rehearse/[id].tsx");
    expect(ai).toContain('"https://beforeyousayit.app/api/generate"');
    expect(ai).toContain('type: "rehearsal_turn"');
    expect(ai).toContain('type: "free_rehearsal_result"');
    expect(ai).not.toContain("EXPO_PUBLIC_TOOLKIT_URL");
    expect(ai).not.toContain("EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY");
    expect(ai).not.toContain("/v2/vercel/v1/chat/completions");
    expect(ai).not.toContain("OPENAI_API_KEY");
    expect(ai).not.toContain("ANTHROPIC_API_KEY");
    expect(rehearsal).toContain('label: "Response unavailable"');
    expect(rehearsal).not.toContain('label: "Connection lost"');
    expect(rehearsal).toContain("retry without saying it again");
  });

  test("the free result follows the working web baseline, rewrite, shift, and trial sequence", async () => {
    const loading = await source("app/debrief/[id].tsx");
    const results = await source("components/FreeJourneyResults.tsx");
    expect(loading).toContain("Personalizing your");
    expect(loading).toContain("practice plan…");
    expect(results).toContain("Your communication baseline");
    expect(results).toContain("You stayed in the room. Now make the ask hold.");
    expect(results).toContain("Where it stalls:");
    expect(results).toContain("Here’s what practice is helping you say");
    expect(results).toContain("STARTING INDEX");
    expect(results).toContain("observed_count} of 6 signals observed");
    expect(results).not.toContain("How BYSI read this");
    expect(results.indexOf('label="Show what changes with practice"')).toBeLessThan(results.indexOf("STARTING INDEX"));
    expect(results).toContain("styles.signalChips");
    expect(results).toContain("Your thoughts and feelings are valid and deserve to be heard.");
    expect(results).toContain("Practicing your communication skills builds the confidence to find the right words when pressure shows up.");
    expect(results).toContain('label="WITHOUT PRACTICE"');
    expect(results).toContain('label="WITH BYSI PRACTICE"');
    expect(results).toContain("The conversation starts with the same vague ask");
    expect(results).toContain("Return to one clear next step");
    expect(results).not.toContain("currentSteps={result.practice_shift.current_pattern_steps}");
    expect(results).not.toContain(">Practice Shift</Text>");
    expect(results).toContain('label="Start 7-Day free trial"');
    expect(results.indexOf('label="Show what changes with practice"')).toBeLessThan(results.indexOf("Here’s what practice is helping you say"));
    expect(results.indexOf("Here’s what practice is helping you say")).toBeLessThan(results.indexOf("Your thoughts and feelings are valid"));
    expect(results.indexOf("Your thoughts and feelings are valid")).toBeLessThan(results.indexOf('label="Start 7-Day free trial"'));
    expect(results).toContain('storedCheckpoint === "generating"');
    expect(results).toContain('? "communication-baseline"');
    expect(results).toContain('? "practice-shift"');
    expect(loading).toContain('screen: "personalizing"');
    expect(results).toContain('step: "practice-shift-to-trial"');
    const paywall = await source("app/paywall.tsx");
    expect(paywall).toContain("const screen = `pay${stage}`");
    expect(paywall).toContain("7 days free");
    expect(paywall).toContain("$11.99/month or $89.99/year");
    expect(paywall).toContain("We’ll email you 3 days before your free trial ends.");
    expect(paywall).toContain("In-app purchase configuration required");
    expect(paywall).not.toContain("Price Unavailable");
    expect(paywall).not.toContain("No confirmed trial");
    expect(paywall).not.toContain("Plans unavailable");
    expect(paywall).not.toContain("Unlock all modules for testing");
  });

  test("existing web customers authenticate and reconnect their paid identity", async () => {
    const layout = await source("app/_layout.tsx");
    const continuation = await source("app/continue-from-web.tsx");
    const auth = await source("providers/auth.tsx");
    const purchases = await source("lib/purchases.ts");
    expect(layout).toContain("user || profile || activePracticeSession || nativeJourneyStarted");
    expect(layout).toContain("activePracticeSession?.sharedResult");
    expect(layout).toContain("<AuthProvider>");
    expect(continuation).toContain("Use the same account you used on the web");
    expect(continuation).toContain("await login(email, password)");
    expect(auth).toContain("supabase.auth.signInWithPassword");
    expect(auth).toContain("identifyPurchasesUser");
    expect(purchases).toContain("sdk.logIn(normalizedUserId)");
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

  test("live product values remain provider-derived and incomplete store setup blocks checkout", async () => {
    const paywall = await source("app/paywall.tsx");
    expect(paywall).toContain('monthlyTerms?.trialDurationLabel === "7 days"');
    expect(paywall).toContain('annualTerms?.trialDurationLabel === "7 days"');
    expect(paywall).toContain('label={actions.primaryLabel}');
    expect(paywall).toContain('!isApprovedStoreOffer');
    expect(paywall).toContain('status: isApprovedStoreOffer ? "ready" : "iap-blocker"');
    expect(paywall).not.toContain("devProEnabled");
    expect(paywall).not.toContain("toggleDevPro");
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
