import type { ModuleId, OnboardingEntryRoute } from "@/constants/modules";
import type { CategoryId, PersonaVoice, ReactionPattern, Scenario } from "@/types/convo";

export type ApprovedOnboardingScenarioId =
  | "approved-work-capacity"
  | "approved-partner-chores"
  | "approved-friend-rent";

export interface ApprovedOnboardingScenario {
  id: ApprovedOnboardingScenarioId;
  contextLabel: "Work" | "Partner" | "Friend";
  title: string;
  preview: string;
  situation: string;
  category: CategoryId;
  counterpartRelationship: "Manager" | "Partner" | "Friend";
  counterpartDisplayLabel: "Your manager" | "Your partner" | "Your friend";
  desiredOutcome: string;
}

export const APPROVED_ONBOARDING_SCENARIOS: readonly ApprovedOnboardingScenario[] = [
  {
    id: "approved-work-capacity",
    contextLabel: "Work",
    title: "Too much on your plate",
    preview: "Your manager adds another task when you are already at capacity.",
    situation: "Your manager has added another task, but you are already at capacity. You need to ask what should be deprioritized instead of silently absorbing more work.",
    category: "work",
    counterpartRelationship: "Manager",
    counterpartDisplayLabel: "Your manager",
    desiredOutcome: "Agree on what should move or be deprioritized.",
  },
  {
    id: "approved-partner-chores",
    contextLabel: "Partner",
    title: "Chores keep falling back to you",
    preview: "You are still noticing and finishing chores that were supposed to be shared.",
    situation: "You and your partner agreed to split the household chores, but you are still noticing what needs doing and finishing most of it. You want clearer ownership.",
    category: "partner",
    counterpartRelationship: "Partner",
    counterpartDisplayLabel: "Your partner",
    desiredOutcome: "Agree on specific household responsibilities your partner will fully own.",
  },
  {
    id: "approved-friend-rent",
    contextLabel: "Friend",
    title: "They still owe you money",
    preview: "You covered their share of the rent, but they still have not paid you back.",
    situation: "You covered your friend’s share of the rent, but they still have not paid you back. You need them to commit to a specific repayment date.",
    category: "friends",
    counterpartRelationship: "Friend",
    counterpartDisplayLabel: "Your friend",
    desiredOutcome: "Receive a clear repayment date and plan.",
  },
] as const;

const BY_ID = new Map<ApprovedOnboardingScenarioId, ApprovedOnboardingScenario>(
  APPROVED_ONBOARDING_SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export function approvedOnboardingScenario(id: string | null): ApprovedOnboardingScenario | null {
  return id ? BY_ID.get(id as ApprovedOnboardingScenarioId) ?? null : null;
}

export function behavioralGoal(entryRoute: OnboardingEntryRoute, moduleId?: ModuleId, desiredOutcome?: string): string {
  if (entryRoute === "recurring_problem") return "Say what you need as naturally and clearly as you can.";
  if (entryRoute === "real_conversation") {
    return desiredOutcome?.trim()
      ? `State what you need and work toward this outcome: ${desiredOutcome.trim()}`
      : "State what you need clearly and ask for a concrete next step.";
  }
  const goals: Record<ModuleId, string> = {
    get_to_the_point: "Open clearly in one or two sentences without listing every previous incident.",
    make_a_clear_ask: "Make one specific request the other person can answer.",
    start_the_conversation: "Open the conversation directly and name what you want to discuss.",
    listen_and_respond: "Respond to what they actually say before returning to your point.",
    stay_clear_under_pushback: "Keep your main point clear when the other person pushes back.",
    pause_say_no_boundary: "State one clear boundary without overexplaining it.",
    repair_what_went_wrong: "Name what went wrong, take your part, and make one repair request.",
    use_it_in_real_life: "Say what you need clearly and ask for a concrete next step.",
  };
  return moduleId ? goals[moduleId] : "Say what you need clearly and ask for a concrete next step.";
}

export function expectedReactionLabel(reaction: ReactionPattern): string {
  const labels: Record<ReactionPattern, string> = {
    defensive: "They may get defensive.",
    "hears-criticism": "They may hear criticism.",
    minimizes: "They may minimize the problem.",
    quiet: "They may avoid the issue or shut down.",
    louder: "They may get louder.",
    "turns-back": "They may turn it back on you.",
    "agrees-without-changing": "They may agree without changing anything.",
    "not-sure": "You are not sure how they will respond.",
  };
  return labels[reaction];
}

export function scenarioFromApproved(source: ApprovedOnboardingScenario, persona: PersonaVoice): Scenario {
  return {
    id: source.id,
    category: source.category,
    title: source.title,
    counterpart: source.counterpartDisplayLabel,
    situation: source.situation,
    persona: `Play ${source.counterpartDisplayLabel.toLowerCase()} in this concrete situation. Stay consistent with the selected expected reaction.`,
    goal: source.desiredOutcome,
    opensWith: "user",
    openingLine: "",
    minutes: 5,
    isCustom: true,
    ...(persona === "woman-hope" ? { counterpartGender: "woman" as const } : { counterpartGender: "man" as const }),
  };
}
