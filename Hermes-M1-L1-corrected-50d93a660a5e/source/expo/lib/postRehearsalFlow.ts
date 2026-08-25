import type { PostRehearsalState } from "@/lib/practiceSession";

export const POST_REHEARSAL_SEQUENCE: readonly PostRehearsalState[] = [
  "rehearsal_complete",
  "transcript_review",
  "generating",
  "pressure",
  "rewrite",
  "shift",
  "pay1",
  "pay2",
  "pay3",
];

/** Enforces adjacent forward/back navigation and the one explicit evidence branch. */
export function transitionPostRehearsal(
  current: PostRehearsalState | undefined,
  next: PostRehearsalState,
): PostRehearsalState {
  if (current === next) return next;
  if (next === "insufficient_evidence" && current === "generating") return next;
  if (current === "insufficient_evidence" && next === "rehearsal_complete") return next;
  if (current === undefined) return next;
  const currentIndex = POST_REHEARSAL_SEQUENCE.indexOf(current);
  const nextIndex = POST_REHEARSAL_SEQUENCE.indexOf(next);
  if (currentIndex >= 0 && nextIndex >= 0 && Math.abs(nextIndex - currentIndex) === 1) return next;
  throw new Error(`Invalid post-rehearsal transition: ${current} -> ${next}`);
}
