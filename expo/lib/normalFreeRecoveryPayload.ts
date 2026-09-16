import { DIFFICULTY } from "@/constants/scenarios";
import { renderCounterpartMessage } from "@/lib/rehearsal";
import type { Difficulty, ReactionPattern, Scenario, Turn } from "@/types/convo";

type BysiEntryRoute = "real_conversation" | "recurring_problem" | "desired_skill";

const REACTION_BEHAVIOUR: Record<ReactionPattern, string> = {
  defensive:
    "They may become protective or justify their perspective, while still staying inside the scenario facts.",
  "hears-criticism":
    "They may hear even neutral statements as criticism, while still staying inside the scenario facts.",
  minimizes:
    "They may downplay the issue or suggest it is not a big deal, without changing the underlying facts.",
  quiet:
    "They may be brief, avoidant, or slow to engage, but they still respond as the named counterpart.",
  louder:
    "They may get louder or more absolute when pushed, while still staying inside the scenario facts.",
  "turns-back":
    "They may redirect responsibility toward the learner, while preserving the original situation.",
  "agrees-without-changing":
    "They may agree superficially while resisting a concrete change.",
  "not-sure":
    "Choose a plausible resistance pattern that fits the exact scenario and counterpart.",
};

export function normalFreeRecoveryContract(
  scenario: Scenario,
  reaction?: ReactionPattern,
  outcome?: string,
  entryRoute: BysiEntryRoute = "real_conversation",
  difficulty?: Difficulty,
) {
  const difficultyBehavior = difficulty ? DIFFICULTY[difficulty].behaviour : null;
  const reactionBehavior = reaction ? REACTION_BEHAVIOUR[reaction] : null;
  const opensWith = scenario.opensWith ?? "user";
  return {
    entry_route: entryRoute,
    context: scenario.category,
    scenario: `${scenario.title}. Counterpart: ${scenario.counterpart}. Situation: ${scenario.situation} Opening: ${opensWith === "counterpart" ? scenario.openingLine : "The learner opens in their own words."}`.trim(),
    counterpart: scenario.counterpart,
    counterpart_persona: scenario.persona,
    difficulty: difficulty ?? null,
    difficulty_behavior: difficultyBehavior,
    reaction_pattern: reaction ?? null,
    opens_with: opensWith,
    opening_line: scenario.openingLine,
    success_target: outcome?.trim() || scenario.goal,
    pressure_condition: [
      `Stay in character as ${scenario.counterpart}.`,
      "Scenario facts and persona are authoritative; never replace them with a generic reaction style.",
      scenario.persona,
      difficultyBehavior ? `Use difficulty only to scale resistance without changing the scenario: ${difficultyBehavior}` : "",
      reactionBehavior ? `Use the reaction tendency only when it does not contradict the scenario: ${reactionBehavior}` : "",
    ].filter(Boolean).join(" "),
  };
}

export function normalFreeRecoveryTranscript(turns: Turn[], scenario: Scenario) {
  const userTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const counterpartTurns = turns
    .filter((turn) => turn.role === "them")
    .map((turn) => renderCounterpartMessage(turn.text, scenario.counterpart).body);
  const authoredOpening = scenario.opensWith === "counterpart" ? scenario.openingLine : "";
  return {
    user_turn_1: userTurns[0] ?? "",
    counterpart_pushback: counterpartTurns[0] ?? authoredOpening,
    user_turn_2: userTurns[1] ?? "",
    counterpart_close: counterpartTurns[1] ?? "",
  };
}
