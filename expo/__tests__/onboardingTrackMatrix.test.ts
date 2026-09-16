import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { componentTestPrefix } from '../scripts/component-test-deps';

const tracks = ['real_conversation', 'recurring_problem', 'desired_skill'] as const;
const contexts = ['Work', 'Partner or co-parent', 'Family member', 'Friend'] as const;

function walkthrough(track: string, options: Record<string, string> = {}): void {
  const result = spawnSync(process.execPath, ['--no-env-file', '__tests__/appFirstNavigation.fixture.ts'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 25000,
    // Allowlist only test settings: no credentials, staging selectors, or live service origins.
    env: {
      PATH: process.env.PATH, HOME: process.env.HOME, CI: '1', EXPO_NO_DOTENV: '1',
      BYSI_COMPONENT_TEST_DEPS: componentTestPrefix(), BYSI_ONBOARDING_TRACK: track, ...options,
    },
  });
  if (result.error || result.status !== 0) {
    throw new Error(`Offline onboarding fixture failed (${track}): ${result.error?.message ?? result.status}\n${result.stdout}\n${result.stderr}`);
  }
  expect(result.stdout).toContain('PASS onboarding matrix');
  expect(result.status).toBe(0);
}

for (const track of tracks) {
  for (const context of contexts) {
    for (const result of ['positive', 'insufficient']) {
      test(`mounted onboarding ${track} / ${context} / ${result}: questions → typed rehearsal → approved transcript → result → remount`, () => {
        walkthrough(track, { BYSI_ONBOARDING_CONTEXT: context, BYSI_APP_FIRST_POSITIVE: result === 'positive' ? '1' : '0' });
      }, 30000);
    }
  }
  test(`mounted onboarding ${track}: session failure blocks persistence and rehearsal`, () => {
    walkthrough(track, { BYSI_ONBOARDING_AUTH_FAILURE: '1' });
  }, 30000);
  test(`mounted onboarding ${track}: enabled recovery check accepts simulated new-session response`, () => {
    walkthrough(track, { BYSI_ONBOARDING_RECOVERY: '1', BYSI_ONBOARDING_HANDOFF_ONLY: '1' });
  }, 30000);
}

for (const track of ['recurring_problem', 'desired_skill']) {
  test(`mounted onboarding ${track}: alternate diagnosis and pressure preserve selection`, () => {
    walkthrough(track, { BYSI_ONBOARDING_CHOICE: '3', BYSI_ONBOARDING_SECONDARY: '2', BYSI_ONBOARDING_CONTEXT: 'Family member', BYSI_APP_FIRST_POSITIVE: '1' });
  }, 30000);
}
