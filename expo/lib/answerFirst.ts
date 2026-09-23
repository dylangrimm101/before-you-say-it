import { answerFirstContent } from '@/constants/answerFirstContent';
import type { Scenario } from '@/types/convo';

export type Answers = { diff?: string; ctx?: string; rec?: string };
export type AnswerScreen = 'welcome' | 'learn' | 'motive' | 'commit' | 'q1' | 'q2' | 'q3' | 'building' | 'result' | 'trial' | 'remind' | 'offer' | 'account' | 'confirm' | 'setup';
export type Choice = { id: string; label: string; ctx?: string[] };
type Focus = { short: string; headline: string; rec: string; take: string; ptitle: string; scenario: Record<string, string>; counterpart: Record<string, string>; opener: string; before: string; after: string; stop?: boolean };
export const { DIFF, CTX, NOTSURE } = answerFirstContent;
const recognitions: Record<string, Choice[]> = answerFirstContent.REC;
const focuses: Record<string, Focus> = answerFirstContent.FOCUS;
export function recognitionOptions(a: Answers): Choice[] {
  const choices = (recognitions[a.diff ?? ''] ?? []).filter(o => !o.ctx || o.ctx.includes(a.ctx ?? 'any'));
  return choices.length ? [...choices, NOTSURE] : [];
}
export function chooseAnswer(a: Answers, key: keyof Answers, id: string): Answers {
  const choices = key === 'diff' ? DIFF : key === 'ctx' ? CTX : recognitionOptions(a);
  if (!choices.some(o => o.id === id)) return a;
  const next = { ...a, [key]: id };
  if (key !== 'rec' && !recognitionOptions(next).some(o => o.id === next.rec)) delete next.rec;
  return next;
}
export function normalizeAnswers(raw: unknown): Answers {
  if (!raw || typeof raw !== 'object') return {};
  const value = raw as Answers;
  let next: Answers = {};
  for (const key of ['diff', 'ctx', 'rec'] as const) if (typeof value[key] === 'string') next = chooseAnswer(next, key, value[key]!);
  return next;
}
export function suggestedFocus(a: Answers) {
  const valid = normalizeAnswers(a);
  const key = valid.rec && valid.rec !== 'notsure' ? valid.rec : 'other';
  const base = focuses[key] ?? focuses.other;
  const ctx = CTX.find(c => c.id === valid.ctx) ?? CTX[4];
  const pick = (values: Record<string, string>) => values[ctx.id] ?? values.any ?? '';
  return { ...base, key, context: ctx, scene: pick(base.scenario), name: pick(base.counterpart),
    recognition: recognitionOptions(valid).find(o => o.id === valid.rec)?.label ?? DIFF.find(o => o.id === valid.diff)?.label ?? DIFF[6].label };
}
export function nextAnswerScreen(s: AnswerScreen, a: Answers): AnswerScreen {
  const next: Partial<Record<AnswerScreen, AnswerScreen>> = { welcome:'learn', learn:'motive', motive:'commit', commit:'q1', q1:'q2', q3:'building', building:'result', result:'trial', trial:'remind', remind:'offer', offer:'account', account:'confirm', confirm:'setup' };
  if (s === 'q2') return a.diff === 'other' || recognitionOptions(a).length === 0 ? 'building' : 'q3';
  return next[s] ?? s;
}
export function answersComplete(a: Answers): boolean {
  const valid = normalizeAnswers(a);
  return !!valid.diff && !!valid.ctx && (valid.diff === 'other' || !!valid.rec);
}
export function firstPracticeScenario(a: Answers): Scenario {
  const f = suggestedFocus(a);
  return { id: `answer-first-${f.key}-${f.context.id}`, category: f.context.id === 'any' ? 'friends' : f.context.id as Scenario['category'],
    power:'peer', title:f.ptitle, counterpart:f.name, situation:f.scene,
    persona:`Play the counterpart in this situation: ${f.scene} Respond realistically to the learner's words, without inventing threats, aggression or past grievances.`,
    goal:f.take, opensWith:'user', openingLine:f.opener, isCustom:true };
}
