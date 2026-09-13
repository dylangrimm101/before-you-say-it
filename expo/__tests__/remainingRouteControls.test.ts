import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,existsSync} from 'node:fs';
import {join} from 'node:path';
const root=new URL('..',import.meta.url);
for(const mode of ['normal','safety-mismatch','privacy-disclosure','privacy-write-failure','privacy-delete-failure','privacy-history-failure','privacy-reset-failure','drill-save-failure','drill-double-save']){
 test(`remaining actual route controls / ${mode}`,()=>{
  const run=spawnSync(process.execPath,['__tests__/remainingRouteControls.fixture.ts'],{cwd:root,env:{...process.env,BYSI_ROUTE_CASE:mode},encoding:'utf8',timeout:30000});
  expect(run.stdout+run.stderr).toContain('PASS actual remaining route controls');
  expect(run.status).toBe(0);
 });
}
test('joined app-first / web-first matrix covers exact route inventory and explicit external gaps',()=>{
 const matrix=JSON.parse(readFileSync(new URL('../docs/NATIVE-JOINED-JOURNEY-MATRIX.json',root),'utf8'));
 const checklist=JSON.parse(readFileSync(new URL('../docs/NATIVE-APP-ROUTE-CHECKLIST.json',root),'utf8'));
 const files=(dir:string):string[]=>readdirSync(new URL(dir+'/',root),{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(join(dir,e.name)):e.name.endsWith('.tsx')?[join(dir,e.name)]:[]);
 expect(matrix.routes.map((r:any)=>r.source).sort()).toEqual(files('app').sort());
 expect(new Set(matrix.routes.map((r:any)=>r.source)).size).toBe(matrix.routes.length);
 expect(matrix.routes.map((r:any)=>r.source).sort()).toEqual(checklist.routes.map((r:any)=>r.source).sort());
 const routes=new Set(matrix.routes.map((r:any)=>r.source));
 expect(matrix.journeys.map((j:any)=>j.id).sort()).toEqual(['app-first','shared-owned-app','web-first']);
 for(const journey of matrix.journeys){
  expect(journey.steps.length).toBeGreaterThan(3);
  for(const step of journey.steps){
   expect(step.acceptance.length).toBeGreaterThan(20);
   expect(step.boundary.length).toBeGreaterThan(20);
   for(const source of step.sources)expect(routes.has(source)).toBe(true);
   for(const evidence of step.evidence)expect(existsSync(new URL(evidence,root))).toBe(true);
  }
 }
 expect(matrix.wholeAppAccepted).toBe(false);
 expect(matrix.releaseDenials.sort()).toEqual(['app/approved-lessons.tsx','app/internal-review-evidence.tsx','app/qa-access.tsx']);
 expect(matrix.requiredExternalGates).toContain('native-web-buyer-no-duplicate-apple-offer');
 expect(matrix.requiredExternalGates).toContain('physical-native-navigation-media-secure-storage');
});
