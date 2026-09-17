import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

test('native free generation, recovery and actual voice retain authorized text and role', () => {
  const result = spawnSync(process.execPath, ['--no-env-file', `${import.meta.dir}/normalFreeTextFidelity.fixture.ts`], {
    env: process.env, encoding: 'utf8', timeout: 30_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 35_000);
