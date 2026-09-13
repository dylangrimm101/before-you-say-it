import {expect,test} from 'bun:test';
import * as deletion from '../../backend/account-lifecycle/handler';
import * as service from '../../backend/account-lifecycle/service';
import {createDeletionService} from '../../backend/account-lifecycle/service';
import * as nativeDeletion from '../lib/accountDeletion';
import {requestAccountDeletion} from '../lib/accountDeletion';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
test('deletion derives only from pinned normal Auth with explicit source enablement',()=>{
 const resolve=(nativeDeletion as any).reviewedDeletionEndpoint;
 expect(typeof resolve).toBe('function');
 const normal='https://spvksnddzyvycfoefrcf.supabase.co';
 expect(resolve(normal,false)).toBe(null);expect(resolve(normal,true)).toBe(normal+'/functions/v1/account-delete');
 for(const url of [normal+'/',normal+'?x=1','https://other.supabase.co',null])expect(resolve(url,true)).toBe(null);
});
test('platform modern key dictionaries bind without legacy fallback',()=>{
 const env:Record<string,string>={SUPABASE_URL:'https://spvksnddzyvycfoefrcf.supabase.co',SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_fixture'}),SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_fixture'}),SUPABASE_SERVICE_ROLE_KEY:'revoked-legacy'};
 expect(typeof (service as any).deletionConfigFromEnv).toBe('function');
 const config=(service as any).deletionConfigFromEnv((name:string)=>env[name]);
 expect(config).toEqual({enabled:false,url:env.SUPABASE_URL,publicKey:'sb_publishable_fixture',adminKey:'sb_secret_fixture',deletionRpcKey:''});
 env.SUPABASE_SECRET_KEYS='invalid';expect((service as any).deletionConfigFromEnv((name:string)=>env[name]).adminKey).toBe('');
 env.BYSI_ACCOUNT_DELETION_ACCEPTS='reviewed-local-only';env.SUPABASE_SECRET_KEYS=JSON.stringify({default:'sb_secret_fixture'});
 expect((service as any).deletionConfigFromEnv((name:string)=>env[name]).enabled).toBe(false);
});
test('worker env composition keeps hosted factory off and local review factory explicit',()=>{
 let network=0;
 const fetcher=async()=>{network++;throw Error('no construction network');};
 const env:Record<string,string>={
  SUPABASE_URL:'https://spvksnddzyvycfoefrcf.supabase.co',
  SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_fixture'}),
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_fixture'}),
  BYSI_ACCOUNT_DELETION_WORKER:'reviewed-local-only',
  BYSI_ACCOUNT_DELETION_WORKER_RPC_KEY:'worker-fixture',
  BYSI_REVENUECAT_SECRET_KEY:'rc-fixture',
 };
 expect((service as any).createDeletionWorkerFromEnv((name:string)=>({...env,BYSI_ACCOUNT_DELETION_WORKER:'off'} as any)[name],fetcher)).toBe(null);
 expect((service as any).createDeletionWorkerFromEnv((name:string)=>({...env,SUPABASE_URL:'https://pqqxaklcburdxjfeolmd.supabase.co'} as any)[name],fetcher)).toBe(null);
 expect((service as any).createDeletionWorkerFromEnv((name:string)=>env[name],fetcher)).toBe(null);
 expect((service as any).createReviewedLocalDeletionWorkerFromEnv((name:string)=>env[name],fetcher)?.runOnce).toBeFunction();
 expect(network).toBe(0);
});
test('mounted lifecycle controls',()=>{const r=spawnSync(process.execPath,['__tests__/accountLifecycleComponent.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});expect(r.stdout+r.stderr).toContain('PASS joined mounted account deletion');expect(r.status).toBe(0);});
for(const mode of ['disabled','anonymous','wrong-owner','expired-reauth','revoke-error','delete-error','readback-error','body-owner'])test('deletion denial '+mode,async()=>{
 let deleted=0;let calls=0;
 const handler=deletion.createDeletionHandler({enabled:mode!=='disabled',verify:async()=>{calls++;return mode==='expired-reauth' && calls===2?null:{id:'A',email:'a@example.invalid',confirmed:mode!=='anonymous'}},reauthenticate:async()=>({token:'fresh',owner:mode==='wrong-owner'?'B':'A'}),revoke:async()=>{if(mode==='revoke-error')throw Error()},softDelete:async()=>{deleted++;if(mode==='delete-error')throw Error()},isDeleted:async()=>mode!=='readback-error'});
 const r=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',confirmation:'DELETE',...(mode==='body-owner'?{userId:'B'}:{})})}));
 expect(r.status).not.toBe(200);if(!['delete-error','readback-error'].includes(mode))expect(deleted).toBe(0);
});
test('provider-deleted identity is denied before password grant or mutation',async()=>{
 const calls:string[]=[];
 const handler=createDeletionService({enabled:true,url:'https://spvksnddzyvycfoefrcf.supabase.co',publicKey:'fixture',adminKey:'fixture',deletionRpcKey:'rpc-fixture'},async(url)=>{calls.push(String(url));return Response.json({id:'A',email:'a@example.invalid',email_confirmed_at:'2026-01-01',deleted_at:'2026-09-09',is_anonymous:false});});
 const response=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64)})}));
 expect(response.status).toBe(401);expect(calls).toEqual(['https://spvksnddzyvycfoefrcf.supabase.co/auth/v1/user']);
});
test('native bearer serialization reaches real handler and pinned Auth REST adapters',async()=>{
 const wire:any[]=[];const sdkAuth:any={getSession:async()=>({data:{session:{user:{id:'A'},access_token:'old'}},error:null}),getUser:async()=>({data:{user:{id:'A'}},error:null})};
 const handler=createDeletionService({enabled:true,url:'https://spvksnddzyvycfoefrcf.supabase.co',publicKey:'public-fixture',adminKey:'server-fixture',deletionRpcKey:'rpc-fixture'},async(url,init)=>{
  wire.push({url:String(url),method:init?.method,headers:init?.headers,body:init?.body?JSON.parse(String(init.body)):null});
  const p=new URL(String(url)).pathname;
  if(p.endsWith('/token'))return Response.json({access_token:'fresh',user:{id:'A'}});
  if(p.endsWith('/logout'))return new Response(null,{status:204});
  if(p.endsWith('/rest/v1/rpc/bysi_account_deletion_request'))return Response.json({code:'ok',requestId:'request-1',ownerId:'A',status:'accepted'});
  return Response.json({id:'A',email:'a@example.invalid',email_confirmed_at:'2026-09-09',is_anonymous:false});
 });
 const receiptStore={receipt:null as any,load:async()=>receiptStore.receipt,save:async(r:any)=>{receiptStore.receipt=r;}};
 await receiptStore.save({ownerId:'A',secret:'a'.repeat(64),digest:'b'.repeat(64)});
 const response=await requestAccountDeletion(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A','password',{kind:'apple',store:'app_store',product_id:'byis_pro_monthly_5'},receiptStore,async(url,init)=>handler(new Request(url,init)));
 expect(response.success).toBe(true);
 expect(response.message).toContain('Deletion requested');
 expect(wire.find(x=>String(x.url).endsWith('/rest/v1/rpc/bysi_account_deletion_request')).body).toEqual({p_owner:'A',p_receipt_digest:'b'.repeat(64)});
 expect(wire.find(x=>String(x.url).endsWith('/rest/v1/rpc/bysi_account_deletion_request')).headers.Authorization).toBe('Bearer rpc-fixture');
 expect(wire.map(x=>x.method)).toEqual(['GET','POST','GET','POST','POST']);
});
test('stalled deletion request body is bounded and cancelled before Auth work',async()=>{
 let cancelled=false;let verified=0;
 const handler=deletion.createDeletionHandler({enabled:true,verify:async()=>{verified++;return null}} as any,10);
 const r=await handler(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer token','Content-Type':'application/json'},body:new ReadableStream({cancel(){cancelled=true;}}),duplex:'half'} as any));
 expect(r.status).toBe(408);expect(cancelled).toBe(true);expect(verified).toBe(0);
});
test('deletion verifies bearer owner and fresh password owner before soft deletion and readback',async()=>{
 expect(typeof deletion.createDeletionHandler).toBe('function');
 const calls:string[]=[];
 const deps:any={enabled:true,verify:async(token:string)=>({id:token==='old'?'A':'A',email:'a@example.invalid',confirmed:true}),reauthenticate:async()=>({token:'fresh',owner:'A'}),revoke:async()=>{calls.push('revoke')},accept:async()=>({code:'ok',requestId:'request-1',ownerId:'A',status:'accepted'})};
 const handler=deletion.createDeletionHandler(deps);
 const r=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64)})}));
 expect(r.status).toBe(202);expect((await r.json()).status).toBe('accepted');expect(calls).toEqual(['revoke']);
});

test('server accepts durable account deletion without typed DELETE or client billing and only after same-owner reauthentication',async()=>{
 const accepted:any[]=[];const calls:string[]=[];
 const handler=deletion.createDeletionHandler({enabled:true,
  verify:async(token:string)=>({id:token==='fresh'?'A':'A',email:'a@example.invalid',confirmed:true}),
  reauthenticate:async()=>({token:'fresh',owner:'A'}),
  accept:async(input:any)=>{accepted.push(input);return {code:'ok',requestId:'request-1',ownerId:'A',status:'accepted'};},
  revoke:async()=>{calls.push('revoke');},
 } as any);
 const r=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64)})}));
 expect(r.status).toBe(202);
 expect(await r.json()).toMatchObject({status:'accepted',requestId:'request-1'});
 expect(accepted[0]).toEqual({ownerId:'A',receiptDigest:'a'.repeat(64)});
 expect(calls).toEqual(['revoke']);
});

test('server rejects hostile client-supplied billing and RevenueCat IDs before acceptance',async()=>{
 let accepted=0;
 const handler=deletion.createDeletionHandler({enabled:true,verify:async()=>({id:'A',email:'a@example.invalid',confirmed:true}),reauthenticate:async()=>({token:'fresh',owner:'A'}),accept:async()=>{accepted++;return {code:'ok',requestId:'request-1',ownerId:'A',status:'accepted'};}} as any);
 const r=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64),billing:{kind:'apple',store:'app_store',product_id:'byis_pro_monthly_5',revenuecat_app_user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}})}));
 expect(r.status).toBe(400);expect(accepted).toBe(0);
});

test('restartable deletion worker retries provider work and never completes on unknown provider outcome',async()=>{
 const {createAccountDeletionWorker}=await import('../../backend/account-lifecycle/worker');
 let completed=0;let retried=0;let authDeletes=0;let claims=0;
 const worker=createAccountDeletionWorker({store:{eraseAccepted:async()=>({erased:0}),claimExternal:async()=>claims++===0?{requestId:'request-1',ownerId:'A',billing:{kind:'apple',store:'unknown',product_id:'byis_pro_monthly_5'}}:null,markProviderRetry:async()=>{retried++;},complete:async()=>{completed++;return {code:'ok'};}},providers:{deleteCustomer:async()=>({status:'retry',reason:'unknown_store'})},authAdmin:{hardDelete:async()=>{authDeletes++;},verifyAbsent:async()=>false}});
 const first=await worker.runOnce();
 const second=await worker.runOnce();
 expect(first).toMatchObject({providerRetry:1,completed:0});
 expect(second).toMatchObject({providerRetry:0,completed:0});
 expect({completed,retried,authDeletes}).toEqual({completed:0,retried:1,authDeletes:0});
});

test('receipt status survives lost Auth credentials and rejects owner-shaped bodies',async()=>{
 let statusReads=0;
 const handler=deletion.createDeletionHandler({enabled:true,verify:async()=>{throw Error('must not need Auth for receipt status');},reauthenticate:async()=>null,accept:async()=>({code:'unavailable'}),status:async(receiptSecret:string)=>{statusReads++;return {code:'ok',requestId:'request-1',status:receiptSecret==='a'.repeat(64)?'complete':'missing'};}} as any);
 const ok=await handler(new Request('https://example.test/account-delete/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptSecret:'a'.repeat(64)})}));
 expect(ok.status).toBe(200);expect(await ok.json()).toEqual({code:'ok',requestId:'request-1',status:'complete',completedAt:null});expect(statusReads).toBe(1);
 const hostile=await handler(new Request('https://example.test/account-delete/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptSecret:'a'.repeat(64),ownerId:'B'})}));
 expect(hostile.status).toBe(400);expect(statusReads).toBe(1);
});

test('RevenueCat provider adapter deletes only supported Apple customers and treats 404 as already gone',async()=>{
 const {createRevenueCatDeletionProvider}=await import('../../backend/account-lifecycle/worker');
 const calls:any[]=[];
 const provider=createRevenueCatDeletionProvider({secretKey:'secret',fetch:async(url,init)=>{calls.push({url:String(url),auth:new Headers(init?.headers).get('authorization')});return new Response('{}',{status:calls.length===1?200:404});}});
 expect(await provider.deleteCustomer({requestId:'r1',ownerId:'A',billing:{kind:'apple',store:'app_store',product_id:'byis_pro_monthly_5',revenuecat_app_user_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'}})).toMatchObject({status:'complete',reason:'delete_acknowledged'});
 expect(await provider.deleteCustomer({requestId:'r2',ownerId:'B',billing:{kind:'apple',store:'app_store',product_id:'byis_pro_monthly_5',revenuecat_app_user_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}})).toMatchObject({status:'complete',reason:'already_absent'});
 expect(calls.map(x=>x.url)).toEqual(['https://api.revenuecat.com/v1/subscribers/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','https://api.revenuecat.com/v1/subscribers/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb']);
 expect(calls.every(x=>x.auth==='Bearer secret')).toBe(true);
 expect(await provider.deleteCustomer({requestId:'r3',ownerId:'C',billing:{kind:'apple',store:'revenuecat_billing',product_id:'byis_pro_monthly_5',revenuecat_app_user_id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'}})).toMatchObject({status:'retry',reason:'revenuecat_billing_would_cancel'});
 expect(await provider.deleteCustomer({requestId:'r4',ownerId:'D',billing:{kind:'unknown',store:'unknown'}})).toMatchObject({status:'retry',reason:'unknown_store'});
 expect(await provider.deleteCustomer({requestId:'r5',ownerId:'E',billing:{kind:'free'}})).toMatchObject({status:'retry',reason:'server_inventory_unverified'});
 expect(await provider.deleteCustomer({requestId:'r6',ownerId:'F',billing:{kind:'free',verified_no_revenuecat:true}})).toMatchObject({status:'complete',reason:'server_verified_no_revenuecat'});
});

test('native client persists deletion receipt before uncertain network outcome',async()=>{
 const sdkAuth:any={getSession:async()=>({data:{session:{user:{id:'A'},access_token:'old'}},error:null}),getUser:async()=>({data:{user:{id:'A'}},error:null})};
 const store={receipt:null as any,load:async()=>store.receipt,save:async(r:any)=>{store.receipt=r;}};
 let dispatched=false;
 const response=await requestAccountDeletion(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A','password',{kind:'free'},store,async()=>{dispatched=true;expect(store.receipt?.ownerId).toBe('A');expect(store.receipt?.digest).toMatch(/^[a-f0-9]{64}$/);throw Error('synthetic lost response');});
 expect(dispatched).toBe(true);expect(response.success).toBe(false);expect(store.receipt?.ownerId).toBe('A');
});

test('Auth outages and malformed admin absence fail closed instead of becoming credential or completion success',async()=>{
 const unavailable=createDeletionService({enabled:true,url:'https://spvksnddzyvycfoefrcf.supabase.co',publicKey:'fixture',adminKey:'fixture',deletionRpcKey:'rpc-fixture'},async()=>new Response('{}',{status:500}));
 const r=await unavailable(new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64)})}));
 expect(r.status).toBe(503);
 const {createSupabaseAuthAdmin}=await import('../../backend/account-lifecycle/service');
 const malformed=createSupabaseAuthAdmin({url:'https://spvksnddzyvycfoefrcf.supabase.co',adminKey:'sb_secret_fixture'},async()=>Response.json({}));
 expect(await malformed.verifyAbsent('A')).toBe(false);
 const missing=createSupabaseAuthAdmin({url:'https://spvksnddzyvycfoefrcf.supabase.co',adminKey:'sb_secret_fixture'},async()=>new Response('not found',{status:404}));
 expect(await missing.verifyAbsent('A')).toBe(true);
});

test('worker does not report completion when the completion RPC rejects the lease',async()=>{
 const {createAccountDeletionWorker}=await import('../../backend/account-lifecycle/worker');
 let retries=0;
 const worker=createAccountDeletionWorker({store:{eraseAccepted:async()=>({erased:0}),claimExternal:async()=>({requestId:'request-1',ownerId:'A',billing:{kind:'free',verified_no_revenuecat:true},leaseId:'lease'}),markProviderRetry:async()=>{retries++;},complete:async()=>({code:'lease_mismatch'})},providers:{deleteCustomer:async()=>({status:'complete',source:'revenuecat'})},authAdmin:{hardDelete:async()=>{},verifyAbsent:async()=>true}});
 expect(await worker.runOnce()).toMatchObject({completed:0,providerRetry:1});
 expect(retries).toBe(1);
});

test('status uses the raw receipt secret, not the stored digest, and supports signed-out latest receipt lookup',async()=>{
 const secret='a'.repeat(64);const stored={ownerId:'A',secret,digest:digest(secret)};
 const store={load:async(owner:string)=>owner==='A'?stored:null,loadLatest:async()=>stored,save:async()=>{}};
 const bodies:any[]=[];
 const result=await nativeDeletion.checkAccountDeletionStatus('https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete',null,store,async(_url,init)=>{bodies.push(JSON.parse(String(init?.body)));return Response.json({code:'ok',requestId:'request-1',status:'complete',completedAt:null});});
 expect(result.success).toBe(true);
 expect(bodies).toEqual([{receiptSecret:secret}]);
});

test('secure receipt read failure stops submission before dispatch',async()=>{
 const sdkAuth:any={getSession:async()=>({data:{session:{user:{id:'A'},access_token:'old'}},error:null}),getUser:async()=>({data:{user:{id:'A'}},error:null})};
 let dispatched=false;
 const store={load:async()=>{throw Error('secure store unavailable');},save:async()=>{}};
 const response=await requestAccountDeletion(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A','password',{kind:'free'},store,async()=>{dispatched=true;return Response.json({});});
 expect(response.success).toBe(false);
 expect(dispatched).toBe(false);
});

test('native duplicate deletion submissions are serialized before the first awaited read',async()=>{
 let release:any;let sessions=0;let dispatched=0;
 const sdkAuth:any={getSession:async()=>{sessions++;if(sessions===1)await new Promise(r=>release=r);return {data:{session:{user:{id:'A'},access_token:'old'}},error:null};},getUser:async()=>({data:{user:{id:'A'}},error:null})};
 const store={receipt:{ownerId:'A',secret:'a'.repeat(64),digest:'b'.repeat(64)} as any,load:async()=>store.receipt,save:async(r:any)=>{store.receipt=r;}};
 const first=requestAccountDeletion(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A','password',{kind:'free'},store,async()=>{dispatched++;return Response.json({requestId:'request-1',status:'accepted'});});
 const second=await requestAccountDeletion(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A','password',{kind:'free'},store,async()=>{dispatched++;return Response.json({requestId:'request-2',status:'accepted'});});
 expect(second.success).toBe(false);
 release();
 expect((await first).success).toBe(true);
 expect(dispatched).toBe(1);
});

test('receiptless device status capability is registered only for verified owner and checked without body owner',async()=>{
 const registered:any[]=[];let statusReads=0;
 const handler=deletion.createDeletionHandler({enabled:true,
  verify:async(token:string)=>token==='old'?{id:'A',email:'a@example.invalid',confirmed:true}:null,
  reauthenticate:async()=>null,
  accept:async()=>({code:'unavailable'}),
  registerDeviceStatus:async(input:any)=>{registered.push(input);return {code:'ok'};},
  deviceStatus:async(secret:string)=>{statusReads++;return secret==='c'.repeat(64)?{code:'ok',status:'deleted',ownerId:'A'}:{code:'not_found'};},
 } as any);
 const register=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({deviceStatusDigest:'d'.repeat(64)})}));
 expect(register.status).toBe(200);expect(await register.json()).toEqual({code:'ok'});
 expect(registered).toEqual([{ownerId:'A',deviceStatusDigest:'d'.repeat(64)}]);
 const checked=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceStatusSecret:'c'.repeat(64)})}));
 expect(checked.status).toBe(200);expect(await checked.json()).toEqual({code:'ok',status:'deleted',ownerId:'A'});
 const hostile=await handler(new Request('https://example.test/account-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceStatusSecret:'c'.repeat(64),ownerId:'B'})}));
 expect(hostile.status).toBe(400);expect(statusReads).toBe(1);
});

test('native receiptless status never treats generic auth or network failure as deletion proof',async()=>{
 expect(typeof (nativeDeletion as any).ensureReceiptlessDeletionCapability).toBe('function');
 expect(typeof (nativeDeletion as any).checkReceiptlessDeletionNotice).toBe('function');
 const capStore={cap:null as any,load:async()=>capStore.cap,save:async(cap:any)=>{capStore.cap=cap;}};
 const sdkAuth:any={getSession:async()=>({data:{session:{user:{id:'A',is_anonymous:false},access_token:'old'}},error:null}),getUser:async()=>({data:{user:{id:'A',is_anonymous:false,email:'a@example.invalid'}},error:null})};
 await expect((nativeDeletion as any).ensureReceiptlessDeletionCapability(sdkAuth,'https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A',capStore,async()=>new Response('{}',{status:401}))).resolves.toMatchObject({registered:false});
 expect(capStore.cap?.ownerId).toBe('A');
 await expect((nativeDeletion as any).checkReceiptlessDeletionNotice('https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A',capStore,async()=>new Response('{}',{status:403}))).resolves.toMatchObject({deleted:false,uncertain:true});
 await expect((nativeDeletion as any).checkReceiptlessDeletionNotice('https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A',capStore,async()=>{throw Error('offline');})).resolves.toMatchObject({deleted:false,uncertain:true});
 await expect((nativeDeletion as any).checkReceiptlessDeletionNotice('https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete','A',capStore,async()=>Response.json({code:'ok',status:'deleted',ownerId:'A'}))).resolves.toMatchObject({deleted:true,ownerId:'A'});
});
