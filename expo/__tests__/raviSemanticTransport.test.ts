import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('actual v2 native paid transport and server preserve exact pushback/close and deny revoked access',()=>{
 const r=spawnSync(process.execPath,['__tests__/raviSemanticTransport.fixture.ts'],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
 expect(r.status,r.stdout+r.stderr).toBe(0);expect(r.stdout).toContain('"revocationDenied":true');
});
