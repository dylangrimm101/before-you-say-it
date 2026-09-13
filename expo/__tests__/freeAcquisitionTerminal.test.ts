import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {harness,pushback} from './freeAcquisitionHarness.fixture';
test('same produced insufficient payload survives serialized native consumer → owner store → mounted terminal UI',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bysi-terminal-'));const env={...process.env,BYSI_TERMINAL_RESULT_FILE:join(dir,'result.json')};
 try{for(const args of [['__tests__/freeAcquisitionTerminal.fixture.ts','insufficient'],['__tests__/appFirstNavigation.fixture.ts']]){
  const r=spawnSync('bun',args,{env,encoding:'utf8',timeout:30000});expect({status:r.status,output:r.status===0?'verified':r.stdout+r.stderr}).toEqual({status:0,output:'verified'});
 }}finally{rmSync(dir,{recursive:true,force:true});}
});
for(const mode of ['safety-turn','insufficient','safety-result'])test('actual native/hosted producer terminal '+mode,()=>{
 const r=spawnSync('bun',['__tests__/freeAcquisitionTerminal.fixture.ts',mode],{encoding:'utf8',timeout:30000});
 expect({status:r.status,output:r.status===0?'verified':r.stdout+r.stderr}).toEqual({status:0,output:'verified'});
});
for(const mode of ['turn','result'])test('mounted free rehearsal safety '+mode+' uses terminal UI',()=>{
 const r=spawnSync('bun',['__tests__/appFirstNavigation.fixture.ts'],{env:{...process.env,BYSI_FREE_TERMINAL_UI:mode},encoding:'utf8',timeout:30000});
 expect({status:r.status,output:r.status===0?'verified':r.stdout+r.stderr}).toEqual({status:0,output:'verified'});
});
test('owner A → B → A uses distinct protected capability keys and resumes A quota identity',async()=>{
 const h=harness(),c=h.create();await c.request(pushback);const a=h.requests[1]!.headers.get('cookie');
 h.change('22222222-2222-4222-8222-222222222222');await c.request(pushback);const b=h.requests[3]!.headers.get('cookie');
 expect(a).not.toBe(b);expect(h.secure.size).toBe(2);
 h.change('11111111-1111-4111-8111-111111111111');await c.request(pushback);expect(h.requests[5]!.headers.get('cookie')).toBe(a);
 expect((await c.request(pushback)).status).toBe(429);c.dispose();
});
test('native acquisition never uses ambient cookies or follows redirects',async()=>{
 const h=harness(),observed:any[]=[];const send=h.options.fetch;
 h.options.fetch=async(url:any,init:any)=>{observed.push({url,init});return send(url,init);};const c=h.create();await c.request(pushback);c.dispose();
 expect(observed).toHaveLength(2);
 for(const {url,init} of observed){expect(new URL(url).origin).toBe(h.options.endpoint.replace('/api/web-signup/generate',''));expect(init.credentials).toBe('omit');expect(init.redirect).toBe('error');expect(init.cache).toBe('no-store');expect(new Headers(init.headers).has('authorization')).toBe(false);}
 expect(new Headers(observed[1].init.headers).get('origin')).toBe('https://bysi-signup-staging.vercel.app');
 const j=harness();j.options.fetch=async()=>({redirected:true,arrayBuffer:async()=>{throw Error('must not read redirected bytes')}}) as Response;
 const d=j.create();await expect(d.request(pushback)).rejects.toThrow('redirect denied');expect([...j.secure.values()]).toEqual(['issuance-pending-v1']);d.dispose();
});
