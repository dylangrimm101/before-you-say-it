import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['opener','reply','expired','lost','missing','spend','generation'])test(`upgraded legacy mounted continuation ${mode}`,()=>{
 const r=spawnSync('bun',['__tests__/frontDoorAcceptance.fixture.ts','continuation-'+mode],{cwd:new URL('..',import.meta.url).pathname,encoding:'utf8',timeout:90000,maxBuffer:16*1024*1024,env:{...process.env,EXPO_NO_DOTENV:'1',BYSI_TEST_LEGACY_UPGRADE:'1',BYSI_COMPONENT_TEST_DEPS:new URL('../../component-deps',import.meta.url).pathname}});
 expect(r.status,r.stdout+r.stderr).toBe(0);
 expect(r.stdout).toContain('PASS FRONT DOOR continuation-'+mode);
},100000);
