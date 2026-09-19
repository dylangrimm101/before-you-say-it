import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['fresh','cold'])test(`integrated root accepts explicit ${mode} guest start and resets intent on visit end`,()=>{
 const result=spawnSync(process.execPath,['__tests__/guestVisitMounted.fixture.ts',mode,'root-gate'],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('PASS integrated Entry/Auth/Store/Root');
},30000);
for(const mode of ['fresh','cold'])for(const track of ['real','recurring','skill'])test(`actual ${mode}/${track} guest screens clear visits without clearing authentication or trapping navigation`,()=>{
 const result=spawnSync(process.execPath,['__tests__/guestVisitMounted.fixture.ts',mode,track],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('PASS actual Auth/Store/Onboarding/Rehearse');
},30000);
test('actual completed guest result can start a second journey within the same app process',()=>{
 const result=spawnSync(process.execPath,['__tests__/guestVisitMounted.fixture.ts','fresh','skill','repeat'],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('PASS actual completed visit');
},30000);
