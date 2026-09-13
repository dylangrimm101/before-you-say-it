import type { PilotDayRun } from "@/types/pilotCurriculum";

type ReviewState = "confirm_attempt_transcript" | "confirm_response_transcript" | "confirm_retry_transcript";
/** Reopen only the run already matched by route and requested run identity. */
export function scenarioPracticeRecovery(run: PilotDayRun | null | undefined): { draft: string; error: string; reviewState: ReviewState } {
  const failed = run?.state === "network_error" || run?.state === "model_error";
  const reviewState: ReviewState = run?.state === "confirm_retry_transcript" ? "confirm_retry_transcript"
    : run?.state === "confirm_response_transcript" || (failed && run.responseAttempt) ? "confirm_response_transcript"
    : "confirm_attempt_transcript";
  const draft = failed || run?.state === reviewState
    ? (reviewState === "confirm_retry_transcript" ? run?.retryAttempt : reviewState === "confirm_response_transcript" ? run?.responseAttempt : run?.attempt)?.transcript ?? ""
    : "";
  return { draft, reviewState, error: failed ? "The response or feedback did not come through. Your approved wording is saved. Return to review it and try again." : "" };
}
