import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { subscriptionReturn } from '../lib/subscriptionNavigation';

test('only allowlisted subscription intent can redirect after login', () => {
  expect(subscriptionReturn({ returnTo: 'https://example.invalid' })).toBeNull();
  expect(subscriptionReturn({})).toBeNull();
  expect(subscriptionReturn({ returnTo: 'subscription', moduleId: '../bad', gate: 'untrusted' })).toEqual({ pathname: '/paywall', params: { source: 'account-offer' } });
});
test('mounted guest price review through verified account return', () => {
  const result = spawnSync(process.execPath, ['__tests__/subscriptionPreview.fixture.tsx'], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 30000 });
  expect(result.status, result.stdout + result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS guest subscription preview');
});
