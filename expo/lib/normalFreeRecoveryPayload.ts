import type { Scenario, Turn } from "@/types/convo";
// Same builder, exact bytes. Recovery must not paraphrase a proof-bound contract.
// ai's transport imports are lazy; this export does not dispatch generation.
export {bysiContract as normalFreeRecoveryContract} from './ai';

export function normalFreeRecoveryTranscript(turns: Turn[], scenario: Scenario) {
  const userTurns = turns.filter((turn) => turn.role === "user").map((turn) => turn.text);
  const counterpartTurns = turns
    .filter((turn) => turn.role === "them")
    .map((turn) => turn.text);
  const authoredOpening = scenario.opensWith === "counterpart" ? scenario.openingLine : "";
  return {
    user_turn_1: userTurns[0] ?? "",
    counterpart_pushback: counterpartTurns[0] ?? authoredOpening,
    user_turn_2: userTurns[1] ?? "",
    counterpart_close: counterpartTurns[1] ?? "",
  };
}
