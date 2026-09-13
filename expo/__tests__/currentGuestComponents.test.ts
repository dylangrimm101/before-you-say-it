import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
for (const mode of ['', 'late-switch', 'wrong-owner', 'expired', 'login-retry', 'read-retry', 'conflict', 'nullable', 'cancel']) {
  test(`actual current-guest seamless continuation components: ${mode || 'success'}`, () => {
    const result = spawnSync(process.execPath, ['__tests__/appFirstNavigation.fixture.ts'], {
      cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000,
      env: { ...process.env, BYSI_CURRENT_GUEST_CONTINUATION: '1', BYSI_GUEST_DENIAL: mode },
    });
    expect(result.stdout + result.stderr).toContain('PASS current-run');
    expect(result.status).toBe(0);
  });
}
