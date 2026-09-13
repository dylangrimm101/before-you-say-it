import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
for (const fixture of ['registeredSignup', 'monthlyPurchase']) {
  test(`native customer controls: ${fixture} (synthetic services)`, () => {
    const result = spawnSync(process.execPath, [`__tests__/${fixture}.fixture.ts`], { cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 60000 });
    expect(result.stdout + result.stderr).toContain('PASS');
    expect(result.status).toBe(0);
  }, 65000);
}
