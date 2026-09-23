import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
test('result cards pin after evidence is readable and preserve reduced-motion access', () => {
  const run = spawnSync(process.execPath, ['__tests__/resultCardStack.fixture.tsx'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000 });
  expect(run.status, run.stdout + run.stderr).toBe(0);
  expect(run.stdout).toContain('PASS measured stack');
});
