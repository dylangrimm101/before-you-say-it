import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {stagingAccountEnvironment} from '../scripts/run-staging-account';
import {FREE_STAGING_ENDPOINT} from '../lib/freeAcquisition';
import {verifyStagingBundleEnvironment} from '../scripts/verify-staging-account-export';

test('export verifier accepts only the explicit pinned acquisition environment',()=>{
 const env=stagingAccountEnvironment({NODE_ENV:'test',EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT:FREE_STAGING_ENDPOINT});
 const prelude='process.env=Object.defineProperties(process.env, {'+Object.entries(env).filter(([k])=>k.startsWith('EXPO_PUBLIC_')).map(([k,v])=>`${JSON.stringify(k)}: { enumerable: true, value: ${JSON.stringify(v)} }`).join(', ')+'});';
 expect(()=>verifyStagingBundleEnvironment(prelude,'sb_publishable_synthetic',undefined,FREE_STAGING_ENDPOINT)).not.toThrow();
 expect(()=>verifyStagingBundleEnvironment(prelude,'sb_publishable_synthetic')).toThrow();
});

test('explicit free endpoint survives staging launcher while wrong origin fails closed',()=>{
 const source:NodeJS.ProcessEnv={NODE_ENV:'test',EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_synthetic',EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT:FREE_STAGING_ENDPOINT};
 expect(stagingAccountEnvironment(source).EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT).toBe(FREE_STAGING_ENDPOINT);
 expect(()=>stagingAccountEnvironment({...source,EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT:'https://beforeyousayit.app/api/generate'})).toThrow();
});
test('native acquisition builder → runtime → existing hosted handler/provenance is runnable offline',()=>{
 const child=spawnSync('bun',['__tests__/freeAcquisitionJourney.fixture.ts'],{cwd:process.cwd(),encoding:'utf8',timeout:30000});
 expect({status:child.status,output:child.status===0?'verified':child.stdout+child.stderr}).toEqual({status:0,output:'verified'});
});
import {harness,pushback,completeTransport} from './freeAcquisitionHarness.fixture';

test('missing or unverified owner fails before session issuance; never creates Auth',async()=>{
 const h=harness();h.change(null);const c=h.create();
 await expect(c.request(pushback)).rejects.toThrow();expect(h.requests).toHaveLength(0);c.dispose();
 const j=harness();j.auth.getUser=async()=>({data:{user:{id:'other'}},error:null});const d=j.create();
 await expect(d.request(pushback)).rejects.toThrow();expect(j.requests).toHaveLength(0);d.dispose();
});
test('tampered exchange, out-of-order result, and failed provider do not manufacture success',async()=>{
 const h=harness(),c=h.create();
 expect((await c.request({...pushback,type:'free_rehearsal_result'})).status).toBe(409);
 await c.request(pushback);
 expect((await c.request({...pushback,turn:'close',transcript:{...pushback.transcript,counterpart_pushback:'forged',user_turn_2:'Approved reply'}})).status).toBe(503);
 expect(h.outputs).toHaveLength(1);c.dispose();
 const j=harness(),d=j.create();j.control.providerFailure=true;
 expect((await d.request(pushback)).status).toBe(503);
 expect((await d.request(pushback)).status).toBe(503);
 expect((await d.request(pushback)).status).toBe(429);
 expect(j.outputs).toHaveLength(0);d.dispose();
});
test('global quota and storage failure deny generation; no fresh capability after uncertainty',async()=>{
 const h=harness(),c=h.create();h.control.globalQuota=false;
 expect((await c.request(pushback)).status).toBe(503);expect(h.outputs).toHaveLength(0);c.dispose();
 const j=harness();j.options.storage.setItem=async()=>{throw Error('Synthetic locked keychain')};const d=j.create();
 await expect(d.request(pushback)).rejects.toThrow();expect(j.outputs).toHaveLength(0);d.dispose();
});
test('logout and stalled native response body reject late results without cookie deletion',async()=>{
 const h=harness(),c=h.create();await c.request(pushback);
 const saved=[...h.secure.values()];h.change(null);
 await expect(c.request(pushback)).rejects.toThrow();expect([...h.secure.values()]).toEqual(saved);c.dispose();
 const j=harness();j.options.fetch=async()=>new Response(new ReadableStream({start(){}}));const d=j.create();
 await expect(d.request(pushback,5)).rejects.toThrow();d.dispose();
});
test('in-flight owner switch, simultaneous requests, invalid fields and oversized native body fail closed',async()=>{
 const h=harness();let resolve!:(r:Response)=>void;
 h.options.fetch=async()=>new Promise<Response>(r=>{resolve=r});const c=h.create();
 const pending=c.request(pushback);await new Promise(r=>setTimeout(r,2));
 await expect(c.request(pushback)).rejects.toThrow();h.change('22222222-2222-4222-8222-222222222222');
 await expect(pending).rejects.toThrow();resolve(Response.json({}));c.dispose();
 const j=harness(),d=j.create();await expect(d.request({...pushback,lesson_constraints:{}})).rejects.toThrow();expect(j.outputs).toHaveLength(0);d.dispose();
 const k=harness();k.options.fetch=async()=>({redirected:false,status:200,headers:new Headers(),arrayBuffer:async()=>new Uint8Array(131073).buffer}) as Response;const e=k.create();
 await expect(e.request(pushback)).rejects.toThrow('too large');e.dispose();
});

test('free acquisition runs exact hosted session/CSRF/provenance path and retains quotas across restart',async()=>{
 const h=harness();let client=h.create();
 const result=await completeTransport(h,client);
 expect(result.status).toBe(200);expect(await result.json()).toEqual(h.outputs[2]);
 expect(h.requests.map(r=>new URL(r.url).pathname)).toEqual(['/api/web-signup/session','/api/web-signup/generate','/api/web-signup/generate','/api/web-signup/generate']);
 expect(h.requests.every(r=>!r.headers.has('authorization'))).toBe(true);
 expect(h.secure.size).toBe(1);
 client.dispose();client=h.create();
 expect((await completeTransport(h,client)).status).toBe(200);
 expect((await client.request(pushback)).status).toBe(429);
 expect(h.outputs).toHaveLength(6);
 client.dispose();
});

test('staging acquisition has an explicit disabled-by-default pinned composition', async()=>{
 const module=await import('../lib/freeAcquisition').catch(()=>null);
 expect(module).not.toBeNull();
 if(!module)return;
 const config={developmentBuild:true,staging:true,authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co',endpoint:module.FREE_STAGING_ENDPOINT,auth:{} as any,storage:{} as any};
 expect(module.createFreeAcquisitionTransport({...config,endpoint:undefined})).toBeNull();
 for(const override of [{developmentBuild:false},{staging:false},{authUrl:'https://other.supabase.co'},{endpoint:'https://beforeyousayit.app/api/generate'},{endpoint:'https://bysi-signup-staging.vercel.app/api/practice/generate'}])expect(module.createFreeAcquisitionTransport({...config,...override})).toBeNull();
});
