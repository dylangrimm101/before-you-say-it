import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {LAUNCH_DECK_IDS} from '../lib/launchCurriculum';

const root=new URL('..',import.meta.url);
for(const fixture of ['appRootNavigation','appFirstNavigation']){
 test(`actual full-app local boundary: ${fixture}`,()=>{
  const result=spawnSync(process.execPath,[`__tests__/${fixture}.fixture.ts`],{cwd:root,encoding:'utf8',timeout:30000});
  expect(result.stdout+result.stderr).toContain('PASS actual');
  expect(result.status).toBe(0);
 });
}
test('actual positive app-first result → offer → verified account → deliberate restart',()=>{
 const result=spawnSync(process.execPath,['__tests__/appFirstNavigation.fixture.ts'],{cwd:root,env:{...process.env,BYSI_APP_FIRST_POSITIVE:'1'},encoding:'utf8',timeout:30000});
 expect(result.stdout+result.stderr).toContain('PASS actual positive');expect(result.status).toBe(0);
});
for(const denial of ['expired','switch'])test(`actual login readback denies ${denial}`,()=>{
 const result=spawnSync(process.execPath,['__tests__/buyerLoginComponent.fixture.ts'],{cwd:root,env:{...process.env,BYSI_LOGIN_DENIAL:denial},encoding:'utf8',timeout:30000});
 expect(result.stdout+result.stderr).toContain('PASS actual');expect(result.status).toBe(0);
});
test('route checklist covers every exact Expo TSX entry, including layouts and native intent',()=>{
 const matrix=JSON.parse(readFileSync(new URL('../docs/NATIVE-APP-ROUTE-CHECKLIST.json',root),'utf8'));
 const files=(dir:string):string[]=>readdirSync(new URL(dir+'/',root),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(join(dir,entry.name)):entry.name.endsWith('.tsx')?[join(dir,entry.name)]:[]);
 const sources=matrix.routes.map((row:any)=>row.source);
 expect(new Set(sources).size).toBe(sources.length);
 expect([...sources].sort()).toEqual(files('app').sort());
 for(const row of matrix.routes){
  expect(row.boundary.length).toBeGreaterThan(30);
  expect(['component-local','domain-tests','source-only']).toContain(row.status);
  if(row.status!=='source-only')expect(existsSync(new URL(row.evidence,root))).toBe(true);
 }
 expect(matrix.lessons.map((l:any)=>l.id).sort()).toEqual([...LAUNCH_DECK_IDS].sort());
 expect(matrix.lessons.filter((l:any)=>l.kind==='lesson')).toHaveLength(10);
 expect(matrix.lessons.filter((l:any)=>l.kind==='module-close')).toHaveLength(2);
 expect(Object.keys(matrix.onboardingSteps).sort()).toEqual(['desired_skill','real_conversation','recurring_problem']);
 expect(matrix.onboardingSteps.real_conversation).toHaveLength(5);
 expect(matrix.onboardingSteps.desired_skill).toHaveLength(4);
 expect(matrix.onboardingSteps.recurring_problem).toHaveLength(4);
});
