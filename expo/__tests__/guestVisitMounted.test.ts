import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['fresh','cold'])for(const track of ['real','recurring','skill'])test(`actual ${mode}/${track} guest screens clear visits without clearing authentication or trapping navigation`,()=>{
 const result=spawnSync(process.execPath,['__tests__/guestVisitMounted.fixture.ts',mode,track],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('PASS actual Auth/Store/Onboarding/Rehearse');
},30000);
