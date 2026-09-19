import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('actual native voice begins presentation on playing, not request completion',()=>{
 const result=spawnSync(process.execPath,['__tests__/guestPlayback.fixture.ts'],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('PASS actual voice');
});
