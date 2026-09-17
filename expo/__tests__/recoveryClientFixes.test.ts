import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

for (const scenario of ['custom', 'review-cleared', 'duplicate-approval', 'approval-setup-retry', 'approval-back', 'approval-invalid-count', 'final-read-only', 'final-empty-drafts', 'final-invalid-stored', 'legacy-empty-draft', 'counterpart-failure', 'final-record-again', 'exact-playback', 'recovered-playback']) {
  test(`actual recovery screens: ${scenario}`, () => {
    const result = spawnSync(process.execPath, ['--no-env-file', `${import.meta.dir}/recoveryClientFixes.fixture.ts`, scenario], {
      env: process.env, encoding: 'utf8', timeout: 30_000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({ status: 0, output: expect.stringContaining(`PASS ${scenario}`) });
  }, 35_000);
}
