import { legacyBlocks } from "@/lib/curriculum";
import type { CurriculumBlock, CurriculumDay, CurriculumDayKind } from "@/types/curriculum";

/**
 * Compatibility surface for the original 28-day challenge.
 *
 * The curriculum now lives in `constants/curriculum.json` and is loaded by
 * `lib/curriculum.ts`. Everything here is a thin adapter over that data: the
 * same 28 days, with the same day numbers the stored progress log is keyed
 * on. New work should read the program directly from `lib/curriculum`.
 */

export type ChallengeTaskKind = CurriculumDayKind;
export type ChallengeDay = CurriculumDay;
export type ChallengeBlock = CurriculumBlock;

/** The four authored blocks, days renumbered 1-28. */
export const CHALLENGE_BLOCKS: ChallengeBlock[] = legacyBlocks();

/**
 * Length of the legacy challenge, derived from the data rather than fixed.
 * The program's own length is `TOTAL_DAYS` in `lib/curriculum`.
 */
export const CHALLENGE_TOTAL_DAYS: number = CHALLENGE_BLOCKS.reduce(
  (total, block) => total + block.days.length,
  0,
);

export function challengeDayByNumber(day: number): ChallengeDay | undefined {
  for (const block of CHALLENGE_BLOCKS) {
    const found = block.days.find((d) => d.day === day);
    if (found) return found;
  }
  return undefined;
}
