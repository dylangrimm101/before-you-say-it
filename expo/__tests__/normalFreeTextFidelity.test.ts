import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

for (const variant of ['quoted', 'whitespace']) test(`native free text fidelity: ${variant} (client invariant, not deployed output evidence)`, () => {
  const result = spawnSync(process.execPath, ['--no-env-file', `${import.meta.dir}/normalFreeTextFidelity.fixture.ts`, variant], {
    env: process.env, encoding: 'utf8', timeout: 30_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 35_000);
