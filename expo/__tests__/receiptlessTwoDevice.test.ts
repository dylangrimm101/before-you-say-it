import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['cached-sdk','expired-race'])test(`independent mounted two-device receiptless deletion through actual restricted SQL worker: ${mode}`,()=>{
 const result=spawnSync(process.execPath,['__tests__/receiptlessTwoDevice.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:120000,env:{...process.env,DELETION_CACHED_SDK:mode==='cached-sdk'?'1':'0'}});
 expect(result.stdout+result.stderr).toContain('PASS isolated processes mounted Root/Auth/Store');expect(result.status).toBe(0);
},125000);
