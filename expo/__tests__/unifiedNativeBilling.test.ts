import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('mounted native gate: independent entitlement, unbound web warnings, ordinary offer and owner isolation',()=>{
 const result=spawnSync(process.execPath,['__tests__/unifiedNativeBilling.fixture.tsx'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
 expect(result.stdout+result.stderr).toContain('PASS actual mounted NativeBillingGate');
 expect(result.status).toBe(0);
});
for(const sandbox of ['0','1'])test(`SQL-backed mounted gate warning precedence and revocation, synthetic environment ${sandbox}`,()=>{
 const result=spawnSync(process.execPath,['__tests__/unifiedNativeBillingJoined.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:60000,env:{...process.env,BYSI_BASE_GATE:'0',BYSI_RC_FIXTURE_SANDBOX:sandbox}});
 expect(result.stdout+result.stderr).toContain('PASS SQL-authorized mounted gate overrides warning, then durable revocation denies');
 expect(result.status).toBe(0);
},65000);
