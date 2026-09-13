import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('historical audio ambiguity is truthful across mounted A deletion, B login and child-process restart',()=>{
 const result=spawnSync(process.execPath,['__tests__/receiptlessTwoDevice.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:120000,env:{...process.env,DELETION_HISTORICAL:'1'}});
 expect(result.stdout+result.stderr).toContain('PASS historical mounted journey');expect(result.status).toBe(0);
},125000);
