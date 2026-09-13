import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
for (const fixture of ['buyerOwnerComponent', 'buyerJourneyComponent', 'buyerLoginComponent']) {
  test(`actual native buyer components: ${fixture}`, () => {
    const result=spawnSync(process.execPath,[`__tests__/${fixture}.fixture.ts`],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
    expect(result.stdout+result.stderr).toContain('PASS actual');
    expect(result.status).toBe(0);
  });
}
