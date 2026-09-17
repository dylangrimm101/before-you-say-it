import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';

for (const [channel, variant] of [
  ['email', 'persona'], ['text', 'persona'], ['phone call', 'persona'],
  ['email', 'opening'], ['email', 'no-remount'], ['email', 'situation'],
  ['email', 'unsupported'], ['email', 'other-session'],
]) {
  test(`recovered screen preserves grounding: ${channel}, ${variant}`, () => {
    const result = spawnSync(process.execPath, ['--no-env-file', `${import.meta.dir}/recoveryGrounding.fixture.ts`, channel!, variant!], {
      env: process.env, encoding: 'utf8', timeout: 30_000,
    });
    expect({ status: result.status, output: result.stdout + result.stderr }).toEqual({
      status: 0, output: expect.stringContaining(`PASS recovery grounding ${channel} ${variant}`),
    });
  }, 35_000);
}
