/**
 * Produces a comparison-only key for counterpart lines.
 *
 * NFKC collapses compatibility variants. Default-ignorable characters are
 * removed rather than spaced so an invisible character inserted inside a word
 * cannot disguise a canned line. The returned value is never displayed or
 * persisted.
 */
export function canonicalCounterpartLine(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\p{Default_Ignorable_Code_Point}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
