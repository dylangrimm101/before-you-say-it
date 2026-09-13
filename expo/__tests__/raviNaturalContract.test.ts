import {expect, test} from 'bun:test';
import {approvedRehearsalPressurePassesQuality as passes} from '@/lib/approvedRehearsalPressure';
import {approvedRehearsalConfig} from '@/lib/approvedRehearsals';
const context = approvedRehearsalConfig('m1-l2')!.scenario.situation;
const contract = 'ravi-m1-l2-natural-facts-v1';
export const positives = [
  "Yesterday's file was late because the client didn't send its revisions until 3, not because of our approval process.",
  "The client's revisions didn't arrive until three yesterday. I still don't see how that proves our approval process is the problem.",
  "Tuesday's file waited because no one owned sign-off. That's still one example, not a pattern.",
  "Nobody was responsible for Tuesday's sign-off. Does that prove the approval process needs an owner?",
  "You're pointing to Tuesday, but I'm not convinced that proves a pattern with final approval.",
  "I don't think one delayed file means our approval process is broken.",
  "How does Tuesday's file show that naming an owner would fix the approval process?",
];
export const negatives = [
  "The client didn't send revisions until three in the afternoon.",
  "The client didn't send revisions until 3 p.m.",
  "The client didn't send revisions until 03.",
  "The client didn't send revisions until 3:30.",
  "The client didn't send revisions until four.",
  "Three files waited because nobody owned sign-off.",
  "Tuesday's file was late because the client didn't send revisions until 3.",
  "Yesterday's file waited because nobody owned sign-off.",
  "The client didn't send revisions until three. Tuesday was their fault too.",
  "Tuesday's file waited because Ravi forgot to approve it.",
  "Tuesday's file waited because nobody owned sign-off and the client changed the specs.",
  "The client didn't send revisions until three. Morgan owns final approval.",
  "The client didn't send revisions until three. We need a new owner for approval.",
  "One late file doesn't prove we need a different owner for approval.",
  "Does Tuesday prove we should replace the approval owner?",
  "The client didn't send revisions until three. That's on them because our approval system crashed.",
  "That's on them, not our approval process.",
  "Tuesday's file didn't wait because nobody owned sign-off.",
  "Tuesday's file waited because somebody owned sign-off.",
  "The client sent revisions at three.",
  "The client didn't send revisions until three. I will own final approval.",
  "Tuesday's file waited because nobody owned sign-off. Give me all the other examples.",
  "Tuesday's file waited because nobody owned sign-off. Use one strong anchor instead.",
];
test('natural relational paraphrases preserve the weak-to-strong anchor task', () => {
  for (const reply of positives) expect(passes(reply, context, contract), reply).toBe(true);
});
test('independent actor, chronology, quantity, cause, ownership and lesson negatives fail closed', () => {
  for (const reply of negatives) expect(passes(reply, context, contract), reply).toBe(false);
  for (const reply of negatives) expect(passes(reply, context + ' ' + reply, contract), 'transcript cannot authorize: ' + reply).toBe(false);
});
test('new content version distinguishes the natural contract from closed-vocabulary history', () => {
  expect(approvedRehearsalConfig('m1-l2')!.contentVersion).toBe('m1-l2-thursday-semantic-v7-2026-09-07');
});
test('Ravi alone accepts grounded possessives and client pronouns without a closed vocabulary', () => {
  const reply = "The client didn't send revisions until three. That's on them, not our approval process.";
  expect(passes(reply, context, contract)).toBe(true);
  expect(passes(reply, context)).toBe(false);
  expect(passes(reply, context, 'other-lesson')).toBe(false);
});
