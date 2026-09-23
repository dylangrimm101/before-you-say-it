import {test, expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {accountAccessState} from '../lib/accountAccess';
test('subscription-only root blocks content, redirects confirmed absence, and preserves recovery',()=>{
 const r=spawnSync(process.execPath,['__tests__/appRootNavigation.fixture.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_ACCESS_GATE:'1'},encoding:'utf8',timeout:30000});
 expect(r.status,r.stdout+r.stderr).toBe(0);
 expect(r.stdout).toContain('PASS subscription-only root gate');
});
test('access is server authority, not login or auto-renew status',()=>{
 expect(accountAccessState(true,{data:true})).toBe('allowed'); // includes active trial / cancelled-but-unexpired server grant
 expect(accountAccessState(true,{data:false})).toBe('paywall');
 expect(accountAccessState(true,{data:true,isError:true})).toBe('unavailable'); // no unbounded cached server authorization
 expect(accountAccessState(true,{data:undefined})).toBe('checking');
 expect(accountAccessState(false,{data:true})).toBe('login');
});
