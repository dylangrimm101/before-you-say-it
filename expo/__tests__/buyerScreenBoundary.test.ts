import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

test('buyer consumer screens retain exact result and expose the current paid-route boundary', () => {
  const result = spawnSync(process.execPath, ['__tests__/buyerScreenBoundary.fixture.ts'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000 });
  expect(result.stdout + result.stderr).toContain('Verified local buyer screen boundary');
  expect(result.status).toBe(0);
});
