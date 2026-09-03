import type { ModuleId } from "@/constants/modules";
import type { CategoryId, Scenario } from "@/types/convo";

const AUTHORED_FOCUS_SCENARIOS: Record<ModuleId, readonly string[]> = {
  get_to_the_point: ["chores", "whole-task-ownership", "manager-skepticism", "burnout", "private-news-boundary", "friend-drift"],
  make_a_clear_ask: ["chores", "whole-task-ownership", "sibling-caregiving", "raise", "request-time-off", "scope-creep", "friend-money"],
  start_the_conversation: ["intimacy", "phone-attention", "wedding-money", "parent-comingclean", "quit", "reconnect-after-silence", "friend-drift"],
  listen_and_respond: ["intimacy", "parenting-disagreement", "mother-boundary", "parenting-criticism", "feedback", "unhappy-client", "friend-drift"],
  stay_clear_under_pushback: ["chores", "last-minute-plan-change", "mother-boundary", "manager-skepticism", "price-pushback", "raise", "decline-friend-invitation", "friend-money"],
  pause_say_no_boundary: ["mother-boundary", "decline-family-invitation", "family-money-request", "parent-comingclean", "burnout", "quit", "decline-friend-invitation"],
  repair_what_went_wrong: ["repair-after-snapping", "intimacy", "feedback", "reconnect-after-silence", "friend-drift"],
  use_it_in_real_life: ["whole-task-ownership", "work-priority-conflict", "sibling-caregiving", "request-time-off", "meeting-interruption", "raise", "reconnect-after-silence", "friend-money"],
};

export type ScenarioRecommendationMatch = "focus-and-category" | "focus-only" | "category-only" | "none";

export interface ScenarioRecommendation {
  scenario: Scenario | null;
  match: ScenarioRecommendationMatch;
  reason: string;
  isLocked: boolean;
}

/** Selects an authored focus match first, then falls back truthfully to context. */
export function recommendScenario(
  scenarios: readonly Scenario[],
  focusModuleId: ModuleId | null | undefined,
  focusLabel: string | null | undefined,
  category: CategoryId,
  isLocked: boolean,
): ScenarioRecommendation {
  const authored = scenarios.filter((scenario) => !scenario.isCustom);
  const focusIds = focusModuleId ? AUTHORED_FOCUS_SCENARIOS[focusModuleId] : [];
  const focusMatches = focusIds.flatMap((id) => {
    const scenario = authored.find((item) => item.id === id);
    return scenario ? [scenario] : [];
  });
  const focusAndCategory = focusMatches.find((scenario) => scenario.category === category);
  if (focusAndCategory) {
    return {
      scenario: focusAndCategory,
      match: "focus-and-category",
      reason: focusLabel ? `Matches your current focus, “${focusLabel},” in this relationship context.` : "Matches your current focus in this relationship context.",
      isLocked,
    };
  }
  const focusOnly = focusMatches[0];
  if (focusOnly) {
    return {
      scenario: focusOnly,
      match: "focus-only",
      reason: focusLabel ? `Matches your current focus, “${focusLabel}.” It is outside the selected relationship filter.` : "Matches your current focus outside the selected relationship filter.",
      isLocked,
    };
  }
  const categoryOnly = authored.find((scenario) => scenario.category === category);
  if (categoryOnly) {
    return {
      scenario: categoryOnly,
      match: "category-only",
      reason: "A useful place to practice in this part of your life.",
      isLocked,
    };
  }
  return {
    scenario: null,
    match: "none",
    reason: "No authored scenario matches the current focus or selected relationship context.",
    isLocked,
  };
}
