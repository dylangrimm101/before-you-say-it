import type { SpeakOutcome } from "@/lib/speech";
import type { PersonaVoice } from "@/types/convo";
import type { ScenarioCounterpartTurn } from "@/types/pilotCurriculum";

export type ScenarioAudioPlayer = (
  line: { audio_id: string; voice_key: "contextual_counterpart"; text: string },
  options: { contextualPersona: PersonaVoice },
) => Promise<SpeakOutcome>;

/** Invokes the real shared playback boundary with the run-bound contextual persona. */
export function playSharedScenarioPressure(
  turn: ScenarioCounterpartTurn,
  contextualPersona: PersonaVoice,
  player: ScenarioAudioPlayer,
): Promise<SpeakOutcome> {
  if (turn.semanticVoiceKey !== "contextual_counterpart" || !turn.resolvedAudioId) return Promise.resolve("failed");
  return player(
    { audio_id: turn.resolvedAudioId, voice_key: "contextual_counterpart", text: turn.text },
    { contextualPersona },
  );
}
