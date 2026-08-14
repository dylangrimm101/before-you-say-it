import type { ModuleId, OnboardingEntryRoute } from "@/constants/modules";
import type { CategoryId, PersonaVoice, ReactionPattern, Scenario } from "@/types/convo";

export type ApprovedOnboardingScenarioId =
  | "approved-work-combative"
  | "approved-partner-chores"
  | "approved-family-comments"
  | "approved-friend-repayment";

export type OnboardingContextLabel = "Work" | "Partner or co-parent" | "Family member" | "Friend";

export interface ApprovedOnboardingScenario {
  id: ApprovedOnboardingScenarioId;
  contextLabel: OnboardingContextLabel;
  title: string;
  preview: string;
  situation: string;
  category: CategoryId;
  counterpartRelationship: "Work colleague" | "Partner or co-parent" | "Sister" | "Friend";
  desiredOutcome: string;
  authoredPushback: string;
  authoredClose: string;
}

export const APPROVED_ONBOARDING_SCENARIOS: readonly ApprovedOnboardingScenario[] = [
  {
    id: "approved-work-combative",
    contextLabel: "Work",
    title: "Address combative meeting behavior",
    preview: "A colleague keeps becoming combative with you in meetings in front of other people.",
    situation: "You need to talk to a work colleague who continues to be combative with you during meetings in front of others.",
    category: "work",
    counterpartRelationship: "Work colleague",
    desiredOutcome: "Set a clear expectation for how you will disagree during meetings.",
    authoredPushback: "I’m not being combative. I’m challenging ideas, and if that feels uncomfortable, I don’t know what you want me to do.",
    authoredClose: "I still think you’re reading too much into it. What exactly are you asking me to change before I agree to anything?",
  },
  {
    id: "approved-partner-chores",
    contextLabel: "Partner or co-parent",
    title: "Ask for more help at home",
    preview: "You need your partner to help more with chores around the house.",
    situation: "You need to talk to your partner about needing them to help more with chores around the house.",
    category: "partner",
    counterpartRelationship: "Partner or co-parent",
    desiredOutcome: "Agree on specific household responsibilities your partner will fully own.",
    authoredPushback: "I do help. It feels like you only notice the things I don’t get to, not everything I already handle.",
    authoredClose: "I’m not agreeing that this is all on me. What specific responsibility do you want to change?",
  },
  {
    id: "approved-family-comments",
    contextLabel: "Family member",
    title: "Set a limit on public comments",
    preview: "Your sister makes fun of your choices in front of other people.",
    situation: "You need to talk to your sister about her comments on your choices in front of others making fun of you.",
    category: "family",
    counterpartRelationship: "Sister",
    desiredOutcome: "Ask her to stop making those comments in front of other people.",
    authoredPushback: "I was joking. Everyone else knew that, and you’re making this into something much bigger than it was.",
    authoredClose: "I don’t agree that I was making fun of you. Tell me exactly what you want me not to say next time.",
  },
  {
    id: "approved-friend-repayment",
    contextLabel: "Friend",
    title: "Ask for repayment",
    preview: "A friend is late paying you back again for something you covered weeks ago.",
    situation: "You need to talk to a friend who is late paying you back again for something you paid for weeks ago.",
    category: "friends",
    counterpartRelationship: "Friend",
    desiredOutcome: "Receive a specific repayment date or a realistic payment plan.",
    authoredPushback: "I told you money is tight right now. I haven’t forgotten, but bringing it up again isn’t going to make the money appear.",
    authoredClose: "I can’t promise a date I may miss. What are you actually asking me to commit to right now?",
  },
] as const;

const BY_ID = new Map<ApprovedOnboardingScenarioId, ApprovedOnboardingScenario>(
  APPROVED_ONBOARDING_SCENARIOS.map((scenario) => [scenario.id, scenario]),
);

export function approvedOnboardingScenario(id: string | null): ApprovedOnboardingScenario | null {
  return id ? BY_ID.get(id as ApprovedOnboardingScenarioId) ?? null : null;
}

/** Resolves the authored rehearsal automatically from the selected context. */
export function approvedScenarioForContext(context: CategoryId | null): ApprovedOnboardingScenario | null {
  return APPROVED_ONBOARDING_SCENARIOS.find((scenario) => scenario.category === context) ?? null;
}

/** Work uses Adam; every other acquisition context uses Hope. */
export function personaForContext(context: CategoryId | null): PersonaVoice {
  return context === "work" ? "man-adam" : "woman-hope";
}

export function behavioralGoal(entryRoute: OnboardingEntryRoute, moduleId?: ModuleId, desiredOutcome?: string): string {
  if (entryRoute === "real_conversation") return desiredOutcome?.trim() || "Say what you need clearly and ask for a concrete next step.";
  const goals: Record<ModuleId, string> = {
    get_to_the_point: "Organize your thoughts and get to the point.",
    make_a_clear_ask: "Say what you need and make one clear request.",
    start_the_conversation: "Start the conversation directly without delivering the whole case.",
    listen_and_respond: "Hear their concern before returning to your point.",
    stay_clear_under_pushback: "Stay with the point after pushback.",
    pause_say_no_boundary: "Set a limit without escalating.",
    repair_what_went_wrong: "Repair what went wrong without losing the issue.",
    use_it_in_real_life: "Say what you need clearly and ask for a concrete next step.",
  };
  return moduleId ? goals[moduleId] : desiredOutcome?.trim() || "Say what you need clearly and ask for a concrete next step.";
}

export function expectedReactionLabel(reaction: ReactionPattern): string {
  const labels: Record<ReactionPattern, string> = {
    defensive: "They may get defensive.",
    "hears-criticism": "They may hear criticism.",
    minimizes: "They may minimize the problem.",
    quiet: "They may avoid the issue or shut down.",
    louder: "They may get louder.",
    "turns-back": "They may turn it back on you.",
    "agrees-without-changing": "They may agree in the moment, but nothing changes.",
    "not-sure": "You are not sure how they will respond.",
  };
  return labels[reaction];
}

export function scenarioFromApproved(source: ApprovedOnboardingScenario, persona: PersonaVoice): Scenario {
  const counterpart = persona === "man-adam" ? "Adam" : "Hope";
  return {
    id: source.id,
    category: source.category,
    title: source.title,
    counterpart,
    situation: source.situation,
    persona: `Play the learner’s ${source.counterpartRelationship.toLowerCase()} in this exact in-person situation. Begin with realistic resistance and do not turn the close into an easy agreement.`,
    goal: source.desiredOutcome,
    opensWith: "user",
    openingLine: "",
    minutes: 5,
    isCustom: true,
    ...(persona === "woman-hope" ? { counterpartGender: "woman" as const } : { counterpartGender: "man" as const }),
  };
}
