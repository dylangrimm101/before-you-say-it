import type { ModuleId } from "@/constants/modules";
import type { SharedResultContractV1 } from "@/types/sharedProduct";

export type OfferStage = 1 | 2 | 3;
export type OfferEvent = "forward" | "back" | "dismiss";

export interface OfferState<Result> {
  stage: OfferStage;
  isDismissed: boolean;
  result: Result;
}

/** Opens a fresh offer presentation without persisting presentation stage as progress. */
export function openOffer<Result>(result: Result): OfferState<Result> {
  return { stage: 1, isDismissed: false, result };
}

/** Applies one offer navigation action while preserving the earned result reference. */
export function transitionOffer<Result>(state: OfferState<Result>, event: OfferEvent): OfferState<Result> {
  if (event === "dismiss") return { ...state, isDismissed: true };
  if (event === "forward") {
    return { ...state, stage: Math.min(3, state.stage + 1) as OfferStage };
  }
  if (state.stage === 1) return { ...state, isDismissed: true };
  return { ...state, stage: (state.stage - 1) as OfferStage };
}

export type PurchaseState = "ready" | "pending" | "purchased" | "cancelled" | "failed" | "entitlement_delayed";
export type PurchaseEvent =
  | { type: "begin" }
  | { type: "provider_returned"; hasActivePro: boolean }
  | { type: "provider_pending" }
  | { type: "user_cancelled" }
  | { type: "provider_error" };

export interface PurchaseTransition {
  state: PurchaseState;
  shouldRouteToPurchased: boolean;
}

/** Reduces provider purchase events; only an authoritative active Pro event may route. */
export function transitionPurchase(current: PurchaseState, event: PurchaseEvent): PurchaseTransition {
  if (event.type === "begin") return { state: "pending", shouldRouteToPurchased: false };
  if (event.type === "provider_returned") {
    return event.hasActivePro
      ? { state: "purchased", shouldRouteToPurchased: true }
      : { state: "entitlement_delayed", shouldRouteToPurchased: false };
  }
  if (event.type === "provider_pending") return { state: "pending", shouldRouteToPurchased: false };
  if (event.type === "user_cancelled") return { state: "cancelled", shouldRouteToPurchased: false };
  if (event.type === "provider_error") return { state: "failed", shouldRouteToPurchased: false };
  return { state: current, shouldRouteToPurchased: false };
}

export type RestoreState = "ready" | "restoring" | "restore_succeeded" | "restore_empty" | "restore_failed";
export type RestoreEvent =
  | { type: "begin" }
  | { type: "provider_returned"; hasActivePro: boolean }
  | { type: "provider_error" };

export interface RestoreTransition {
  state: RestoreState;
  shouldRouteToPurchased: boolean;
}

/** Reduces restore events; an empty or failed restore can never route to Purchased. */
export function transitionRestore(current: RestoreState, event: RestoreEvent): RestoreTransition {
  if (event.type === "begin") return { state: "restoring", shouldRouteToPurchased: false };
  if (event.type === "provider_returned") {
    return event.hasActivePro
      ? { state: "restore_succeeded", shouldRouteToPurchased: true }
      : { state: "restore_empty", shouldRouteToPurchased: false };
  }
  if (event.type === "provider_error") return { state: "restore_failed", shouldRouteToPurchased: false };
  return { state: current, shouldRouteToPurchased: false };
}

export type CommercePresentationState = PurchaseState | RestoreState;

export interface CommerceActionPresentation {
  primaryLabel: string;
  primaryAction: "purchase" | "check_access" | "continue" | "none";
  isPrimaryDisabled: boolean;
  isRestoreDisabled: boolean;
  showsPricedPurchase: boolean;
}

/** Derives every visible commerce action so non-purchasable states cannot retain a priced CTA. */
export function commerceActionPresentation(
  state: CommercePresentationState,
  hasActivePro: boolean,
  purchaseLabel: string,
): CommerceActionPresentation {
  if (hasActivePro || state === "purchased" || state === "restore_succeeded") {
    return { primaryLabel: "Continue to my practice", primaryAction: "continue", isPrimaryDisabled: false, isRestoreDisabled: true, showsPricedPurchase: false };
  }
  if (state === "pending") {
    return { primaryLabel: "Waiting for the store…", primaryAction: "none", isPrimaryDisabled: true, isRestoreDisabled: true, showsPricedPurchase: false };
  }
  if (state === "restoring") {
    return { primaryLabel: "Checking your store account…", primaryAction: "none", isPrimaryDisabled: true, isRestoreDisabled: true, showsPricedPurchase: false };
  }
  if (state === "entitlement_delayed") {
    return { primaryLabel: "Check access again", primaryAction: "check_access", isPrimaryDisabled: false, isRestoreDisabled: false, showsPricedPurchase: false };
  }
  if (state === "cancelled" || state === "failed") {
    return { primaryLabel: "Try again", primaryAction: "purchase", isPrimaryDisabled: false, isRestoreDisabled: false, showsPricedPurchase: false };
  }
  return { primaryLabel: purchaseLabel, primaryAction: "purchase", isPrimaryDisabled: false, isRestoreDisabled: false, showsPricedPurchase: true };
}

/** Visible status copy derived from executable commerce state. */
export function commerceStatusMessage(state: CommercePresentationState): string | null {
  const messages: Record<CommercePresentationState, string | null> = {
    ready: null,
    pending: "Purchase pending. Access unlocks only after the provider confirms pro.",
    purchased: "Purchase confirmed. Pro is active.",
    cancelled: "Purchase cancelled. Nothing was charged or unlocked by BYSI.",
    failed: "The store could not complete this request. Try again when the connection is ready.",
    entitlement_delayed: "The purchase returned, but pro is not active yet. Access remains locked while entitlement catches up.",
    restoring: "Checking this store account for an active entitlement…",
    restore_succeeded: "Restore succeeded. Pro is active.",
    restore_empty: "Restore completed, but no active pro entitlement was found.",
    restore_failed: "Restore failed. Check your connection and try again.",
  };
  return messages[state];
}

export interface PurchasedContinuity {
  indexValue: number | null;
  observedCount: number;
  firstFocusLabel: string | null;
  moduleId: ModuleId | null;
  hasPersonalizedStart: boolean;
  recoveryDestination: string | null;
  completedPracticeCount: number;
}

/** Builds Purchased copy exclusively from earned result and real persisted counts. */
export function purchasedContinuity(
  result: SharedResultContractV1 | undefined,
  _savedHistoryCount: number,
  completedPracticeCount: number,
): PurchasedContinuity {
  const moduleId = result?.first_focus?.recommended_module_id ?? null;
  const hasPersonalizedStart = moduleId !== null;
  return {
    indexValue: result?.starting_index?.index_value ?? null,
    observedCount: result?.starting_index?.observed_count ?? 0,
    firstFocusLabel: result?.first_focus?.first_focus_label ?? null,
    moduleId,
    hasPersonalizedStart,
    recoveryDestination: hasPersonalizedStart || !result?.rehearsal_id ? null : `/debrief/${result.rehearsal_id}`,
    completedPracticeCount,
  };
}

export interface MicrophoneRecoveryPresentation {
  title: "Microphone recovery";
  actions: readonly ["Open Settings", "Try microphone again", "Type this turn instead"];
  approvalRequired: true;
}

/** Visible recovery actions for a denied or unavailable microphone. */
export function microphoneRecoveryPresentation(): MicrophoneRecoveryPresentation {
  return {
    title: "Microphone recovery",
    actions: ["Open Settings", "Try microphone again", "Type this turn instead"],
    approvalRequired: true,
  };
}

export interface ScenarioInteraction {
  isLocked: boolean;
  destination: string;
}

/** Derives the visible lock state and destination from current entitlement access. */
export function scenarioInteraction(isLocked: boolean, scenarioId: string): ScenarioInteraction {
  return {
    isLocked,
    destination: isLocked ? "/paywall?gate=another-rehearsal" : `/scenario/${scenarioId}`,
  };
}
