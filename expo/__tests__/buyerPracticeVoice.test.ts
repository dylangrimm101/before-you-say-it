import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

test('actual Quick Rep and drill consumers select protected voice', () => {
  const child = spawnSync(process.execPath, ['__tests__/buyerPracticeVoice.fixture.ts'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000 });
  expect(child.stdout + child.stderr).toContain('Mounted Quick Rep and drill');
  expect(child.status).toBe(0);
});
test('legacy paid module selects protected voice while onboarding retains acquisition', () => {
  const read = (p: string) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
  const module = read('app/module/[day].tsx');
  expect(module.match(/useDictation\(\{ paidPractice: true \}\)/g)?.length).toBe(3);
  expect(module).toContain('speakPaidPilotAudio as speakPilotAudio');
  const rehearsal = read('app/rehearse/[id].tsx');
  expect(rehearsal).toContain('params.entry !== "onboarding" && scenario');
  expect(rehearsal).toContain('<ScenarioPaidPractice');
  expect(rehearsal).toContain('const dictation = useDictation();');
});
