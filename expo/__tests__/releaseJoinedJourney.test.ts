import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['positive','insufficient','recovery'])test(`Release joined root/signup/login/onboarding/result ${mode} (synthetic boundaries)`,()=>{
 const r=spawnSync(process.execPath,['__tests__/releaseJoinedJourney.fixture.ts',mode],{cwd:new URL('..',import.meta.url),env:process.env,encoding:'utf8',timeout:120000});
 if(r.status!==0)throw Error(r.stdout+'\n'+r.stderr);
 expect(r.status).toBe(0);expect(r.stdout).toContain('PASS JOINED');
},130000);
