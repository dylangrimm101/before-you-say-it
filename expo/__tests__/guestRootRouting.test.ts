import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('actual root layout routes fresh guest leases without changing account gates',()=>{
 const r=spawnSync(process.execPath,['__tests__/guestRootRouting.fixture.ts'],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:30000});
 expect({status:r.status,error:r.status?r.stderr:''}).toEqual({status:0,error:''});
 expect(r.stdout).toContain('PASS mounted root routing');
});
