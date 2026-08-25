import type { SpeakOutcome } from "@/lib/speech";
import type { PersonaVoice } from "@/types/convo";
import type { PilotAudioLine, PilotDayRun } from "@/types/pilotCurriculum";

export type PilotAudioPlayer = (
  line: PilotAudioLine,
  options: { muted?: boolean; contextualPersona?: PersonaVoice },
) => Promise<SpeakOutcome>;

/** Plays a modular line with the persona fixed on the run that authored the checkpoint. */
export function playRunBoundPilotAudio(
  run: Pick<PilotDayRun, "contextualPersona">,
  line: PilotAudioLine,
  options: { muted?: boolean } = {},
  player: PilotAudioPlayer,
): Promise<SpeakOutcome> {
  if (line.voice_key === "contextual_counterpart" && !run.contextualPersona) return Promise.resolve("failed");
  return player(line, { ...options, contextualPersona: run.contextualPersona });
}
