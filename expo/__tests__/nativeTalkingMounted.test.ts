import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const caller of ['m1','scenario','module'])test(`mounted actual ${caller} caller survives recorder callback replacement and cancels on leave`,()=>{
 const result=spawnSync(process.execPath,['__tests__/nativeTalkingCallers.fixture.ts',caller],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});
 expect(result.stdout).toContain('"leaveCancelledLatest":true');
});
for(const name of ['Upload','Playback'])test(`actual paid ${name} preserves native file/byte boundary`,()=>{
 const result=spawnSync(process.execPath,[`__tests__/nativeTalking${name}.fixture.ts`],{cwd:import.meta.dir+'/..',encoding:'utf8'});
 expect({code:result.status,stderr:result.status?result.stderr:''}).toEqual({code:0,stderr:''});expect(result.stdout).toContain('PASS actual');
});
