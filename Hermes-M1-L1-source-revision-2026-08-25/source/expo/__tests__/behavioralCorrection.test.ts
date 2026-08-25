import { describe, expect, test } from "bun:test";

import {
  hasActiveEntitlement,
  subscriptionSnapshot,
  validatedManagementDestination,
  type PurchaseProvider,
} from "@/lib/commerce";
import {
  commerceActionPresentation,
  commerceStatusMessage,
  microphoneRecoveryPresentation,
  openOffer,
  purchasedContinuity,
  scenarioInteraction,
  transitionOffer,
  transitionPurchase,
  transitionRestore,
} from "@/lib/nativeCommerce";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

const activeProInfo = { entitlements: { active: { pro: { store: "APP_STORE" } } } };
const inactiveInfo = { entitlements: { active: {} } };

const successfulResult = {
  contract_version: 1,
  rehearsal_id: "rehearsal-1",
  pressure_moment: null,
  practice_shift: null,
  signals: [],
  starting_index: {
    index_kind: "partial",
    index_value: 72,
    observed_count: 3,
    total_signal_count: 6,
    index_version: "starting-index-v1",
  },
  first_focus: {
    first_focus_key: "clarity",
    first_focus_label: "State the ask before explaining",
    recommended_module_id: "make_a_clear_ask",
    focus_status: "confirmed",
    focus_version: "first-focus-v1",
  },
} as SharedResultContractV1;

const insufficientResult = {
  ...successfulResult,
  starting_index: {
    index_kind: "partial",
    index_value: null,
    observed_count: 0,
    total_signal_count: 6,
    index_version: "starting-index-v1",
  },
  first_focus: null,
} as SharedResultContractV1;

describe("offer navigation reducer", () => {
  test("executes Stage 1 → Stage 2 → Stage 3", () => {
    const result = { id: "earned-result" };
    const one = openOffer(result);
    const two = transitionOffer(one, "forward");
    const three = transitionOffer(two, "forward");
    expect([one.stage, two.stage, three.stage]).toEqual([1, 2, 3]);
    expect(three.result).toBe(result);
  });

  test("executes Stage 3 Back → Stage 2 and Stage 2 Back → Stage 1", () => {
    const one = openOffer({ id: "earned-result" });
    const three = transitionOffer(transitionOffer(one, "forward"), "forward");
    const two = transitionOffer(three, "back");
    const backToOne = transitionOffer(two, "back");
    expect(two).toMatchObject({ stage: 2, isDismissed: false });
    expect(backToOne).toMatchObject({ stage: 1, isDismissed: false });
  });

  test("executes Stage 1 Back → dismissal and preserves the result", () => {
    const result = { id: "earned-result" };
    expect(transitionOffer(openOffer(result), "back")).toEqual({ stage: 1, isDismissed: true, result });
  });

  test("executes explicit dismissal from every stage without changing the result", () => {
    const result = { id: "earned-result" };
    let state = openOffer(result);
    for (const stage of [1, 2, 3]) {
      expect(transitionOffer(state, "dismiss")).toEqual({ stage, isDismissed: true, result });
      state = transitionOffer(state, "forward");
    }
  });

  test("reopening through the result CTA deliberately begins at Stage 1", () => {
    const result = { id: "earned-result" };
    const dismissed = transitionOffer(transitionOffer(openOffer(result), "forward"), "dismiss");
    expect(dismissed.stage).toBe(2);
    expect(openOffer(dismissed.result)).toEqual({ stage: 1, isDismissed: false, result });
  });
});

describe("subscription-management destination validation", () => {
  const cases: readonly [string, PurchaseProvider, string | null, string | null][] = [
    ["accepts a valid Apple HTTPS destination", "apple", "https://apps.apple.com/account/subscriptions", "https://apps.apple.com/account/subscriptions"],
    ["accepts a valid Google Play HTTPS destination", "google", "https://play.google.com/store/account/subscriptions", "https://play.google.com/store/account/subscriptions"],
    ["rejects a provider mismatch", "apple", "https://play.google.com/store/account/subscriptions", null],
    ["rejects HTTP", "apple", "http://apps.apple.com/account/subscriptions", null],
    ["rejects a custom scheme", "apple", "bysi://apps.apple.com/account/subscriptions", null],
    ["rejects a malformed URL", "apple", "not a url", null],
    ["rejects a credential-bearing URL", "apple", "https://user:password@apps.apple.com/account/subscriptions", null],
    ["rejects an unexpected host", "google", "https://example.com/store/account/subscriptions", null],
    ["rejects a missing URL", "google", null, null],
    ["rejects an unknown provider", "unknown", "https://apps.apple.com/account/subscriptions", null],
    ["rejects Stripe", "stripe", "https://billing.stripe.com/p/session", null],
  ];

  cases.forEach(([name, provider, url, expected]) => {
    test(name, () => expect(validatedManagementDestination(provider, url)).toBe(expected));
  });

  test("subscription snapshots expose only validated authoritative destinations", () => {
    expect(subscriptionSnapshot({ managementURL: "https://evil.example/subscriptions", entitlements: { active: { pro: { store: "APP_STORE" } } } }, "pro")?.managementURL).toBeNull();
    expect(subscriptionSnapshot({ managementURL: "https://apps.apple.com/account/subscriptions", entitlements: { active: { pro: { store: "APP_STORE" } } } }, "pro")?.managementURL).toBe("https://apps.apple.com/account/subscriptions");
  });
});

describe("purchase branch reducer", () => {
  test("initial → pending when purchase begins and CTA alone never grants Pro", () => {
    expect(transitionPurchase("ready", { type: "begin" })).toEqual({ state: "pending", shouldRouteToPurchased: false });
    expect(hasActiveEntitlement(inactiveInfo, "pro")).toBe(false);
  });

  test("authoritative active Pro → purchased", () => {
    const hasActivePro = hasActiveEntitlement(activeProInfo, "pro");
    expect(transitionPurchase("pending", { type: "provider_returned", hasActivePro })).toEqual({ state: "purchased", shouldRouteToPurchased: true });
  });

  test("provider pending → pending", () => {
    expect(transitionPurchase("pending", { type: "provider_pending" })).toEqual({ state: "pending", shouldRouteToPurchased: false });
  });

  test("user cancellation → cancelled", () => {
    expect(transitionPurchase("pending", { type: "user_cancelled" })).toEqual({ state: "cancelled", shouldRouteToPurchased: false });
  });

  test("provider error → failed", () => {
    expect(transitionPurchase("pending", { type: "provider_error" })).toEqual({ state: "failed", shouldRouteToPurchased: false });
  });

  test("provider return without active Pro → entitlement delayed", () => {
    expect(transitionPurchase("pending", { type: "provider_returned", hasActivePro: false })).toEqual({ state: "entitlement_delayed", shouldRouteToPurchased: false });
  });

  test("none of pending, cancelled, failed, or delayed reaches Purchased", () => {
    const transitions = [
      transitionPurchase("pending", { type: "provider_pending" }),
      transitionPurchase("pending", { type: "user_cancelled" }),
      transitionPurchase("pending", { type: "provider_error" }),
      transitionPurchase("pending", { type: "provider_returned", hasActivePro: false }),
    ];
    expect(transitions.every((value) => !value.shouldRouteToPurchased && value.state !== "purchased")).toBe(true);
  });
});

describe("restore branch reducer", () => {
  test("restore begins → restoring", () => {
    expect(transitionRestore("ready", { type: "begin" })).toEqual({ state: "restoring", shouldRouteToPurchased: false });
  });

  test("restored CustomerInfo with active Pro → restore succeeded", () => {
    const hasActivePro = hasActiveEntitlement(activeProInfo, "pro");
    expect(transitionRestore("restoring", { type: "provider_returned", hasActivePro })).toEqual({ state: "restore_succeeded", shouldRouteToPurchased: true });
  });

  test("restored CustomerInfo without active Pro → no entitlement", () => {
    const hasActivePro = hasActiveEntitlement(inactiveInfo, "pro");
    expect(transitionRestore("restoring", { type: "provider_returned", hasActivePro })).toEqual({ state: "restore_empty", shouldRouteToPurchased: false });
  });

  test("restore exception → restore failed", () => {
    expect(transitionRestore("restoring", { type: "provider_error" })).toEqual({ state: "restore_failed", shouldRouteToPurchased: false });
  });

  test("only authoritative active Pro may route to Purchased", () => {
    const active = transitionRestore("restoring", { type: "provider_returned", hasActivePro: hasActiveEntitlement(activeProInfo, "pro") });
    const inactive = transitionRestore("restoring", { type: "provider_returned", hasActivePro: hasActiveEntitlement(inactiveInfo, "pro") });
    expect([active.shouldRouteToPurchased, inactive.shouldRouteToPurchased]).toEqual([true, false]);
  });
});

describe("Purchased continuity view model", () => {
  test("successful Partial Index carries observed count and real first focus without fabricated progress", () => {
    const continuity = purchasedContinuity(successfulResult, 0, 0);
    expect(continuity).toEqual({
      indexValue: 72,
      observedCount: 3,
      firstFocusLabel: "State the ask before explaining",
      moduleId: "make_a_clear_ask",
      hasPersonalizedStart: true,
      recoveryDestination: null,
      completedPracticeCount: 0,
    });
    expect(continuity).not.toHaveProperty("streak");
    expect(continuity).not.toHaveProperty("improvement");
    expect(continuity).not.toHaveProperty("completedModules");
  });

  test("insufficient evidence carries null Index, zero observations, and no default focus or module", () => {
    const continuity = purchasedContinuity(insufficientResult, 0, 0);
    expect(continuity).toEqual({
      indexValue: null,
      observedCount: 0,
      firstFocusLabel: null,
      moduleId: null,
      hasPersonalizedStart: false,
      recoveryDestination: "/debrief/rehearsal-1",
      completedPracticeCount: 0,
    });
    expect(continuity).not.toHaveProperty("streak");
    expect(continuity).not.toHaveProperty("improvement");
    expect(continuity).not.toHaveProperty("completedModules");
  });
});

describe("visible interaction view models", () => {
  test("pending, restoring, delayed, restored Pro, and existing Pro never expose a priced purchase CTA", () => {
    const price = "Continue · $5.00";
    const cases = [
      commerceActionPresentation("pending", false, price),
      commerceActionPresentation("restoring", false, price),
      commerceActionPresentation("entitlement_delayed", false, price),
      commerceActionPresentation("restore_succeeded", true, price),
      commerceActionPresentation("ready", true, price),
    ];
    expect(cases.every((value) => !value.showsPricedPurchase && !value.primaryLabel.includes("$5.00"))).toBe(true);
    expect(cases.map((value) => value.primaryLabel)).toEqual([
      "Waiting for the store…",
      "Checking your store account…",
      "Check access again",
      "Continue to my practice",
      "Continue to my practice",
    ]);
    expect(cases[0]?.isRestoreDisabled).toBe(true);
    expect(cases[1]?.isRestoreDisabled).toBe(true);
  });

  test("cancelled and failed can retry while an empty restore may still show the provider purchase", () => {
    expect(commerceActionPresentation("cancelled", false, "Continue · $5.00").primaryLabel).toBe("Try again");
    expect(commerceActionPresentation("failed", false, "Continue · $5.00").primaryLabel).toBe("Try again");
    expect(commerceActionPresentation("restore_empty", false, "Continue · $5.00").showsPricedPurchase).toBe(true);
  });

  test("purchase and restore branches expose distinct visible status copy", () => {
    expect(["pending", "cancelled", "failed", "entitlement_delayed"].map((state) => commerceStatusMessage(state as "pending" | "cancelled" | "failed" | "entitlement_delayed"))).toEqual([
      "Purchase pending. Access unlocks only after the provider confirms pro.",
      "Purchase cancelled. Nothing was charged or unlocked by BYSI.",
      "The store could not complete this request. Try again when the connection is ready.",
      "The purchase returned, but pro is not active yet. Access remains locked while entitlement catches up.",
    ]);
    expect(["restoring", "restore_succeeded", "restore_empty", "restore_failed"].every((state) => Boolean(commerceStatusMessage(state as "restoring" | "restore_succeeded" | "restore_empty" | "restore_failed")))).toBe(true);
  });

  test("locked and unlocked scenarios derive different interaction destinations", () => {
    expect(scenarioInteraction(true, "hard-talk")).toEqual({ isLocked: true, destination: "/paywall?gate=another-rehearsal" });
    expect(scenarioInteraction(false, "hard-talk")).toEqual({ isLocked: false, destination: "/scenario/hard-talk" });
  });

  test("microphone-denied recovery exposes typed fallback and approval requirement", () => {
    expect(microphoneRecoveryPresentation()).toEqual({
      title: "Microphone recovery",
      actions: ["Open Settings", "Try microphone again", "Type this turn instead"],
      approvalRequired: true,
    });
  });
});
