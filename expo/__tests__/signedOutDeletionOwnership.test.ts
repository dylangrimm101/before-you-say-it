import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('signed-out receipt cleanup cannot log out a later account',()=>{
 const r=spawnSync(process.execPath,['__tests__/signedOutDeletionOwnership.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000,env:process.env});
 expect(r.stdout+r.stderr).toContain('PASS signed-out deletion callback preserves later B');expect(r.status).toBe(0);
},35000);
