import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const run=(extra:Record<string,string>)=>spawnSync(process.execPath,['__tests__/appFirstNavigation.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000,env:{...process.env,BYSI_DURABLE_GUEST:'1',BYSI_CURRENT_GUEST_CONTINUATION:'1',...extra}});
for(const mode of ['nullable','late-switch','wrong-owner','expired','cancel','conflict','read-retry','secure-full-result'])test('native secure adapter + actual components restart: '+mode,()=>{
 const r=run({BYSI_GUEST_DENIAL:mode});expect(r.stdout+r.stderr).toContain('PASS current-run');expect(r.status).toBe(0);
});
for(const stage of ['result-after','consent','auth','auth-refresh','issued-before','issued-after'])test('separate process restart after '+stage,()=>{
 const dir=mkdtempSync(join(tmpdir(),'bysi-guest-restart-'));const file=join(dir,'fixture.json');
 try{
  const stopped=run({BYSI_GUEST_DENIAL:'nullable',BYSI_GUEST_RESTART_FILE:file,BYSI_GUEST_STOP_STAGE:stage==='auth-refresh'?'auth':stage});
  expect(stopped.status).toBe(73);
  const resumed=run({BYSI_GUEST_DENIAL:'nullable',BYSI_GUEST_RESTART_FILE:file,BYSI_GUEST_RESUME:'1',BYSI_GUEST_COLD_REFRESH:stage==='auth-refresh'?'1':'0',BYSI_GUEST_STOP_STAGE:'',BYSI_GUEST_EXPECT_UNCERTAIN:stage==='issued-before'?'1':'0'});
  expect(resumed.stdout+resumed.stderr).toContain('PASS durable separate-process');expect(resumed.status).toBe(0);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
