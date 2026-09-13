import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('retained Adam native builder to paid server to durable consumer offline replay',()=>{
 const r=spawnSync(process.execPath,['__tests__/m1l1UnsupportedFacts.fixture.ts'],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
 expect(r.status,r.stdout+r.stderr).toBe(0);
});
