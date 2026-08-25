import { sanitizeMeta } from "@/lib/redact";

/**
 * Local, no-op analytics. There is no remote sink and no transport. It exists
 * only so product events have one narrow, auditable doorway if a provider is
 * ever added deliberately.
 *
 * Rules baked in here: generic event names from a fixed list, redacted
 * properties, and disabled by default.
 */

/** The only event names that may ever be recorded. */
export type AnalyticsEvent =
  | "onboarding_completed"
  | "rehearsal_started"
  | "rehearsal_completed"
  | "drill_completed"
  | "challenge_day_completed"
  | "safety_gate_shown"
  | "safety_gate_hard_stop"
  | "privacy_screen_opened"
  | "history_deleted"
  | "paywall_shown";

const ENABLED = false;

/** Record a product event. Does nothing unless a sink is deliberately added. */
export function track(event: AnalyticsEvent, props?: Record<string, unknown>): void {
  if (!ENABLED) return;
  // Redacted on the way in, so a future sink can never receive content.
  void sanitizeMeta(props ?? {});
}

export function isAnalyticsEnabled(): boolean {
  return ENABLED;
}
