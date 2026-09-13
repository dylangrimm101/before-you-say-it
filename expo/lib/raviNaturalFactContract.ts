/** Versioned, lesson-local fact contract. This is a conservative relational
 * recognizer, NOT a complete semantic verifier. Unrecognized assertions fail
 * closed; no provider self-certification, vocabulary oracle, or canned replies.
 */
export const RAVI_NATURAL_FACT_VERSION = 'ravi-m1-l2-natural-facts-v1';
export const RAVI_NATURAL_FACT_CONTRACT = {
  version: RAVI_NATURAL_FACT_VERSION,
  lesson_id: 'm1-l2', counterpart_id: 'ravi',
  time: 'Thursday end of day. Yesterday is Wednesday; Tuesday is separate. Revisions until 3/three has no AM/PM qualifier.',
  facts: ['Tuesday file waited because nobody owned sign-off.', 'Another file stalled the week before.', 'Specs messy since March.', 'Two coworkers mentioned similar concerns.'],
  attributed_position: 'Ravi blames the client for yesterday: revisions did not arrive until 3. This is his resistance claim, not an objective explanation for Tuesday.',
  ownership: 'Missing or unassigned final approval ownership, not replacement of an incumbent. No new/different/replacement owner.',
  pedagogy: 'Challenge the weak yesterday example; after the learner replaces it with Tuesday, question whether that representative example establishes the approval pattern. Do not demand a list or coach the move. Keep the issue unresolved.',
  output_policy: 'Natural grammar and paraphrases are allowed, not closed word membership. State only recognized scene relations or skeptical questions about whether the evidence supports the approval decision. Do not add actors, causes, times, quantities, or promises. Unknown factual assertions fail closed.',
} as const;

export function raviNaturalFactViolations(reply: string, context: string): string[] {
  if (!context.includes('Thursday, end of day.') || !context.includes('Tuesday’s file waited because nobody owned the sign-off.') || !context.includes('revisions until 3')) return ['canonical_scene_mismatch'];
  const text = reply.normalize('NFKC').replace(/\p{Default_Ignorable_Code_Point}/gu, '').replace(/[’‘]/g, "'").toLowerCase().trim();
  const clauses = text.split(/[.!?;—]+/).map(s => s.trim()).filter(Boolean);
  let clientAntecedent = false;
  const violations: string[] = [];
  // Whole-clause coverage is deliberate: no wildcard suffix can smuggle in a
  // new explanation or actor. These are relation grammars, not surface-word
  // membership. They admit inflections/composition but do not cover all English.
  const process = "(?:(?:our|the) )?(?:approval (?:process|step)|final approval|sign-off)";
  const evidence = "(?:that|this|yesterday(?:'s (?:late |delayed )?file)?|tuesday(?:'s file)?|(?:one|a single) (?:late |delayed )?(?:file|example))";
  const conclusion = `(?:a pattern(?: (?:with|in) ${process})?|${process} (?:is (?:the problem|broken)|needs (?:a clear |an |one )?owner)|we need (?:a clear |an |one )?owner for ${process})`;
  const full = (pattern: string, clause: string) => new RegExp(`^(?:${pattern})$`).test(clause);
  for (const raw of clauses) {
    const clause = raw.replace(/^(?:but |still, )/, '');
    const sent = "(?:the |our )?client (?:didn't|did not) send (?:its |their |the )?revisions until (?:3|three)";
    const arrived = "(?:the |our )?client's revisions (?:didn't|did not) (?:arrive|come in) until (?:3|three)";
    if (full(`(?:(?:yesterday's (?:late )?file was late because |yesterday,? )?(?:${sent}|${arrived})(?: yesterday)?)(?:,? not because of ${process})?`, clause)) { clientAntecedent = true; continue; }
    if (clientAntecedent && full(`(?:that's|that is) on them, not ${process}`, clause)) continue;
    if (full("tuesday's file (?:waited|was delayed|stalled) because (?:nobody|no one) (?:owned|was responsible for) (?:the )?sign-off", clause)
      || full("(?:nobody|no one) (?:owned|was responsible for) tuesday's sign-off", clause)) continue;
    if (full("(?:that's|that is|it's|it is) (?:still |only |just )?(?:one|a single) example(?:,? not a pattern)?", clause)) continue;
    if (full(`i (?:still )?(?:don't|do not) (?:think|see how|see why) ${evidence} (?:proves?|shows?|means?) (?:that )?${conclusion}`, clause)) continue;
    if (full(`(?:you're pointing to tuesday,? but )?i(?:'m| am) (?:still )?not convinced (?:that )?${evidence} (?:proves?|shows?|means?) (?:that )?${conclusion}`, clause)) continue;
    if (full(`(?:does|how does|why does) ${evidence} (?:prove|show|mean) (?:that )?${conclusion}`, clause)) continue;
    if (full(`how does ${evidence} (?:prove|show|mean) that (?:naming|assigning) (?:an|a clear) owner would (?:fix|resolve) ${process}`, clause)) continue;
    if (full(`${evidence} (?:still )?(?:doesn't|does not) (?:prove|show|mean) (?:that )?${conclusion}`, clause)) continue;
    violations.push('unrecognized_relation');
  }
  if (!clauses.length) violations.push('missing_relation');
  return [...new Set(violations)];
}
