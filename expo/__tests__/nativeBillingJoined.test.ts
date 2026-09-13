import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const sandbox of ['0','1'])test(`environment ${sandbox}: mounted normal billing: verified login, purchase/restore, SQL-gated practice/voice, revocation, cold return and recovery`,()=>{
 const r=spawnSync(process.execPath,['__tests__/nativeBillingJoined.fixture.ts'],{cwd:process.cwd(),encoding:'utf8',timeout:60000,env:{...process.env,BYSI_RC_FIXTURE_SANDBOX:sandbox}});
 expect(r.stdout+r.stderr).toContain('PASS mounted AuthProvider');expect(r.status).toBe(0);
},65000);
