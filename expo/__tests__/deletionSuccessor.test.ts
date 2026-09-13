import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const [file,marker] of [['ownerVoiceRuntime','PASS actual voice writer'],['secureDeletionRuntime','secure runtime owner erasure:'],['deletionRecoveryUx','PASS deletion recovery UX'],['deletionRootJourney','PASS mounted Root/Auth/Store deletion']])test(file,()=>{
 const result=spawnSync(process.execPath,[`__tests__/${file}.fixture.ts`],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:60000});
 expect(result.stdout+result.stderr).toContain(marker);expect(result.status).toBe(0);
},70000);
