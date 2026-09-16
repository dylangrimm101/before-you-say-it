const FALLBACK = "Could not transcribe that. Try again.";
const UNAVAILABLE = "Voice transcription is temporarily unavailable. Type this turn instead.";

function isUnavailable(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { name?: string }).name === "TranscriptionUnavailableError");
}

/** On-device talking failures must be readable on TestFlight. Do not hide them behind Could not transcribe. */
export function visibleDictationFailure(error: unknown): string {
  if (isUnavailable(error)) return UNAVAILABLE;
  if (error instanceof Error && error.message === "No recording was captured") return "No recording was captured.";
  const raw = error instanceof Error ? error.message.trim() : "";
  if (!raw) return FALLBACK;
  if (/https?:\/\//i.test(raw) || /eyJ[A-Za-z0-9_-]{20,}/.test(raw)) return FALLBACK;
  return raw.slice(0, 160);
}
