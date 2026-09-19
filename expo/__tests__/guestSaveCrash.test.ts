import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=(args:string[])=>spawnSync(process.execPath,['__tests__/guestSaveCrash.fixture.ts',...args],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:30000});
for(const stage of ['auth-before-retry','retry-written','claim-before-ack'])test('actual guest Auth handoff survives process death at '+stage,()=>{
 const dir=mkdtempSync(join(tmpdir(),'bysi-guest-save-')),file=join(dir,'synthetic.json');
 try{
  const stopped=run([stage,file]);expect({status:stopped.status,error:stopped.status!==73?stopped.stderr:''}).toEqual({status:73,error:''});
  const restored=run([stage,file,'resume']);expect({status:restored.status,error:restored.status?restored.stderr:''}).toEqual({status:0,error:''});
  expect(restored.stdout).toContain('PASS crash recovery');
 }finally{rmSync(dir,{recursive:true,force:true});}
},30000);
for(const failure of ['missing-session','storage-failure'])test('guest account-save disclosure: '+failure,()=>{
 const result=run([failure]);expect({status:result.status,error:result.status?result.stderr:''}).toEqual({status:0,error:''});
 expect(result.stdout).toContain('PASS explicit save failure');
});
