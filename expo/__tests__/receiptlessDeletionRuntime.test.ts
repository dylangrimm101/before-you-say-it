import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('isolated native SecureStore journal primitive proof',()=>{
 const result=spawnSync(process.execPath,['test','./__tests__/receiptlessDeletionRuntime.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:15000});
 expect(result.stdout+result.stderr).toContain('0 fail');expect(result.status).toBe(0);
});
