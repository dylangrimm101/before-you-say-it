import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
test('native reminder adapter checks consent, schedules exact date, and preserves unrelated reminders', () => {
  const result = spawnSync(process.execPath, ['__tests__/trialReminderNative.fixture.ts'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000 });
  expect(result.status, result.stdout + result.stderr).toBe(0);
});
