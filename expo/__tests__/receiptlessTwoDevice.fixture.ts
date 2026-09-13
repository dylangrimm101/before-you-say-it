import assert from 'node:assert/strict';
import {fork} from 'node:child_process';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDeletionService,createSupabaseAccountDeletionStore,createSupabaseAuthAdmin} from '../../backend/account-lifecycle/service';
import {createAccountDeletionWorker,createRevenueCatDeletionProvider} from '../../backend/account-lifecycle/worker';
const url='https://spvksnddzyvycfoefrcf.supabase.co',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const user=(owner:string)=>({id:owner,aud:'authenticated',role:'authenticated',email:owner===A?'a@example.invalid':'b@example.invalid',email_confirmed_at:'2026-01-01',is_anonymous:false,created_at:'2026-01-01',app_metadata:{},user_metadata:{}});
const jwt=(owner:string)=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
const revoked=new Set<string>(),removed=new Set<string>(),logouts:string[]=[];
const bearerOwner=(headers:any)=>{try{return JSON.parse(Buffer.from(String(new Headers(headers).get('authorization')).split('.')[1],'base64url').toString()).sub;}catch{return A;}};
const {PGlite}=createRequire('/tmp/bysi-hosted-tests.BlrHHI/package.json')('@electric-sql/pglite');
const dir=await mkdtemp(join(tmpdir(),'bysi-delete-root-'));let db:any=new PGlite(dir);
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE bysi_native_service;CREATE ROLE bysi_account_deletion_api;CREATE ROLE bysi_account_deletion_worker;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
for(const name of ['202608290001_create_lesson_feedback','202609060001_web_bridge','202609060002_private_web_result','202609060003_private_result_service_acl','202609060004_checkout_binding','202609060005_owner_result_discovery','202609060006_staging_paid_access','202609070001_hosted_browser_sessions','202609090001_native_free_sessions'])await db.exec(await readFile(new URL('../../backend/supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec(await readFile('/Users/donaldgrimm/Projects/bysi-web-claude-parity/server/revenuecat/schema.sql','utf8'));
await db.exec(await readFile(new URL('../../backend/supabase/migrations/202609100001_account_deletion.sql',import.meta.url),'utf8'));
await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'a@example.invalid',now()),($2,'b@example.invalid',now())`,[A,B]);

let rpcQueue:Promise<unknown>=Promise.resolve();
const upstream:typeof fetch=(input:any,init:any={})=>{
 const work=async()=>{
  const target=new URL(String(input)),path=target.pathname,body=init.body?JSON.parse(String(init.body)):{};
  assert.equal(target.origin,url);
  if(path==='/auth/v1/token'){
   const owner=body.email==='b@example.invalid'||body.refresh_token==='synthetic-refresh-B'?B:A;
   if(body.password==='wrong-password')return Response.json({code:'invalid_credentials',msg:'Invalid login credentials'},{status:400});
   if(revoked.has(owner)||removed.has(owner))return Response.json({code:'refresh_token_not_found',msg:'Synthetic revoked'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}});
   return Response.json({access_token:jwt(owner),refresh_token:owner===A?'synthetic-refresh':'synthetic-refresh-B',expires_in:3600,token_type:'bearer',user:user(owner)});
  }
  const owner=bearerOwner(init.headers);
  if(path==='/auth/v1/user')return removed.has(owner)?Response.json({code:'user_not_found',msg:'Synthetic absent'},{status:404}):Response.json(user(owner));
  if(path==='/auth/v1/logout'){logouts.push(owner);if(target.searchParams.get('scope')==='global')revoked.add(owner);return new Response(null,{status:204});}
  if(path.startsWith('/auth/v1/admin/users/')){
   const targetOwner=path.split('/').at(-1)!;
   if(init.method==='DELETE'){removed.add(targetOwner);await db.query('DELETE FROM auth.users WHERE id=$1',[targetOwner]);return new Response(null,{status:204});}
   return removed.has(targetOwner)?new Response(null,{status:404}):Response.json(user(targetOwner));
  }
  if(path.startsWith('/rest/v1/rpc/')){
   const role=new Headers(init.headers).get('authorization')==='Bearer worker-fixture'?'bysi_account_deletion_worker':'bysi_account_deletion_api';
   const name=path.split('/').at(-1)!;
   const rpc:Record<string,any>={
    bysi_account_deletion_register_device_status:['SELECT public.bysi_account_deletion_register_device_status($1,$2) v',[body.p_owner,body.p_device_status_digest]],
    bysi_account_deletion_device_status:['SELECT public.bysi_account_deletion_device_status($1) v',[body.p_device_status_secret]],
    bysi_account_deletion_request:['SELECT public.bysi_account_deletion_request($1,$2) v',[body.p_owner,body.p_receipt_digest]],
    bysi_account_deletion_status:['SELECT public.bysi_account_deletion_status($1) v',[body.p_receipt_secret]],
    bysi_account_deletion_work:['SELECT public.bysi_account_deletion_work($1) v',[body.p_limit]],
    bysi_account_deletion_claim_external:['SELECT public.bysi_account_deletion_claim_external($1) v',[body.p_lease]],
    bysi_account_deletion_provider_retry:['SELECT public.bysi_account_deletion_provider_retry($1,$2,$3::jsonb) v',[body.p_request,body.p_lease,JSON.stringify(body.p_evidence)]],
    bysi_account_deletion_complete:['SELECT public.bysi_account_deletion_complete($1,$2::jsonb,$3::jsonb,$4) v',[body.p_request,JSON.stringify(body.p_provider_evidence),JSON.stringify(body.p_auth_evidence),body.p_lease]],
   };
   assert.ok(rpc[name]);await db.exec('SET ROLE '+role);
   try{return Response.json((await db.query(...rpc[name])).rows[0].v);}finally{await db.exec('RESET ROLE');}
  }
  throw Error('Unmodeled synthetic HTTP '+path);
 };
 const next=rpcQueue.then(work,work);rpcQueue=next.catch(()=>{});return next;
};
const handler=createDeletionService({enabled:true,url,publicKey:'synthetic-public',adminKey:'admin-fixture',deletionRpcKey:'api-fixture'},upstream);
const children=new Set<ReturnType<typeof fork>>();
async function device(name:string){
 const child=fork(new URL('./receiptlessDevice.fixture.ts',import.meta.url).pathname,[],{execPath:process.execPath,env:{...process.env,DEVICE_STATE:join(dir,name+'.json')},stdio:['ignore','pipe','pipe','ipc']});children.add(child);
 child.on('message',async(message:any)=>{
  if(!message.httpId)return;
  try{
   const target=new URL(message.url);assert.equal(target.origin,url);
   const init={method:message.method,headers:message.headers,...(message.body?{body:message.body}:{})};
   const response=target.pathname==='/functions/v1/account-delete'?await handler(new Request(message.url,init)):await upstream(message.url,init);
   child.send({httpResponse:message.httpId,status:response.status,headers:Object.fromEntries(response.headers),body:await response.text()});
  }catch(error){child.send({httpResponse:message.httpId,error:String(error)});}
 });
 let sequence=0;let output='';child.stdout?.on('data',chunk=>{output+=chunk;});child.stderr?.on('data',chunk=>{output+=chunk;});
 await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Device ready timeout '+output)),15000);child.once('message',(message:any)=>{clearTimeout(timer);message.ready?resolve():reject(Error(JSON.stringify(message)));});child.once('exit',()=>{clearTimeout(timer);reject(Error('Device startup exited '+output));});});
 const call=(command:string,extra:object={})=>new Promise<any>((resolve,reject)=>{
  const id=++sequence;const timer=setTimeout(()=>{child.off('message',listener);reject(Error(name+' command timeout '+command+' '+output));},40000);
  const listener=(message:any)=>{if(message.id!==id)return;clearTimeout(timer);child.off('message',listener);message.error?reject(Error(name+' '+command+': '+message.error+'\n'+output.slice(-5000))):resolve(message.result);};child.on('message',listener);child.send({id,command,...extra});
 });
 return {call,pid:child.pid,kill:async()=>{child.kill('SIGKILL');await new Promise(resolve=>child.once('exit',resolve));children.delete(child);}};
}
try{
 const first=await device('device-A');let second=await device('device-B');assert.notEqual(first.pid,second.pid);
 await first.call('mount');const invalid=await first.call('login',{invalid:true});assert.equal(invalid.user,null);assert.match(invalid.text,/don’t match an account/);assert.doesNotMatch(invalid.notice,/has been deleted/);await first.call('login');await first.call('seed');
 await second.call('mount');let state=await second.call('login');assert.deepEqual(state.registered,[A]);assert.equal(state.receipt,null);await second.call('seed');
 if(process.env.DELETION_HISTORICAL==='1')await second.call('baseline');
 const captured=state.capturedSession;
 await second.call('offline',{value:true});state=await second.call('check');assert.equal(state.user,A);assert.doesNotMatch(state.notice,/has been deleted/);
 await first.call('delete');
 const worker=createAccountDeletionWorker({store:createSupabaseAccountDeletionStore({url,workerRpcKey:'worker-fixture'},upstream),providers:createRevenueCatDeletionProvider({secretKey:'synthetic',fetch:async()=>{throw Error('Paid provider forbidden');}}),authAdmin:createSupabaseAuthAdmin({url,adminKey:'synthetic'},upstream)});
 assert.deepEqual(await worker.runOnce(),{erased:1,providerRetry:0,completed:1});
 await first.call('receipt');await first.call('check');
 state=await second.call('check');assert.equal(state.user,A);assert.equal(state.receipt,null);assert.ok(state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));
 if(process.env.DELETION_HISTORICAL==='1'){
  await second.call('historical');await second.call('offline',{value:false});await second.call('refresh');
  await second.call('holdStatus',{value:true});await second.call('check');await second.call('awaitHeld');
  state=await second.call('login',{owner:'B',skipCheck:true});assert.equal(state.user,B);
  await second.call('holdStatus',{value:false});state=await second.call('check');
  const pending=(value:any)=>{
   assert.equal(value.user,B);assert.equal(value.sdkOwner,B);
   assert.equal(value.records.find((record:any)=>record.ownerId===A).phase,'pending');
   assert.ok(value.text.includes(value.notice));assert.match(value.notice,/cleanup (?:is pending|could not be confirmed)/);assert.doesNotMatch(value.notice,/has been cleared/);
   assert.ok(value.audioKeys.includes('cache/rehearsal-voice/legacy.wav'));
   assert.ok(!value.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));
   assert.ok(value.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+B))));
   assert.ok(!value.baselineKeys.some((key:string)=>key.endsWith('/owned-A-baseline.m4a')),'independently proven A baseline is erased');
   assert.ok(value.baselineKeys.some((key:string)=>key.endsWith('/sharedbaseline.m4a')),'foreign basename collision is preserved');
   assert.ok(value.baselineKeys.some((key:string)=>key.endsWith('/orphaned-historical.m4a')),'unknown baseline orphan is preserved');
  };
  pending(state);await second.kill();second=await device('device-B');state=await second.call('mount');state=await second.call('check');pending(state);
  state=await second.call('stale',{session:captured});pending(state);assert.ok(!logouts.includes(B));
  const persisted=JSON.parse(await readFile(join(dir,'device-B.json'),'utf8'));
  assert.equal(new Map(persisted.audio).get('cache/rehearsal-voice/legacy.wav'),'synthetic unknown unchanged');
  const persistedBaseline=new Map(persisted.baseline);
  assert.equal(persistedBaseline.get('file:///device/Documents/baseline-audio/sharedbaseline.m4a'),'ambiguous shared retained');
  assert.equal(persistedBaseline.get('file:///device/Documents/baseline-audio/orphaned-historical.m4a'),'unknown retained');
  assert.equal(persistedBaseline.has('file:///device/Documents/baseline-audio/owned-A-baseline.m4a'),false);
  console.log('PASS historical mounted journey: known A audio erased, unknown bytes unchanged, durable pending notice after SIGKILL/restart, B SDK and audio preserved, stale A refused.');
 }else if(process.env.DELETION_CACHED_SDK==='1'){
  state=await second.call('offline',{value:false});assert.equal(state.sdkOwner,A,'receiptless B still holds the actual cached SDK session');
  const beforeLogouts=logouts.length;
  state=await second.call('check');assert.equal(state.sdkOwner,null);assert.equal(state.user,null);assert.equal(state.sdkChunks.length,0);assert.equal(state.receipt,null);
  assert.equal(logouts.length,beforeLogouts+1,'receiptless cleanup must invoke actual SDK local signOut exactly once');
  assert.ok(state.text.includes(state.notice));assert.match(state.notice,/has been deleted.*cleared/);
  assert.ok(!state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));assert.ok(state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+B))));
  assert.ok(!state.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));assert.ok(state.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+B))));
  await second.kill();second=await device('device-B');state=await second.call('mount');assert.equal(state.sdkOwner,null);assert.equal(state.user,null);assert.equal(state.sdkChunks.length,0);
  assert.ok(state.text.includes(state.notice));assert.match(state.notice,/has been deleted.*cleared/);
  state=await second.call('stale',{session:captured});assert.equal(state.sdkOwner,null);assert.equal(state.user,null);
 }else{
 await second.call('offline',{value:false});state=await second.call('refresh');assert.equal(state.sdkOwner,null,'SDK discards revoked refresh before capability discovery');
 await second.call('failSecure',{value:true});await second.call('holdStatus',{value:true});await second.call('check');await second.call('awaitHeld');
 state=await second.call('login',{owner:'B',skipCheck:true});assert.equal(state.user,B);
 await second.call('holdStatus',{value:false});state=await second.call('check');assert.equal(state.user,B,'late A proof cannot quarantine current B');assert.ok(state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));
 state=await second.call('stale',{session:captured});assert.equal(state.user,B,'stale callback cannot publish owner after marker failure');
 await second.call('failSecure',{value:false});await second.call('failCleanup',{value:true});
 state=await second.call('periodic');assert.equal(state.records.find((record:any)=>record.ownerId===A).phase,'pending','continuously active periodic retry persists pending cleanup');
 assert.equal(state.sdkOwner,B);
 await second.kill();second=await device('device-B');state=await second.call('mount');state=await second.call('check');
 assert.equal(state.sdkOwner,B);assert.equal(state.user,B);assert.equal(state.receipt,null);assert.ok(state.sdkChunks.length>0);
 assert.equal(state.records.find((record:any)=>record.ownerId===A).phase,'complete');assert.match(state.notice,/has been deleted.*cleared/);
 assert.ok(state.text.includes(state.notice));
 assert.ok(!state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));assert.ok(state.keys.some((key:string)=>key.includes(encodeURIComponent(url+':'+B))));
 assert.ok(!state.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+A))));assert.ok(state.audioKeys.some((key:string)=>key.includes(encodeURIComponent(url+':'+B))));
 state=await second.call('stale',{session:captured});assert.equal(state.user,B);assert.equal(state.sdkOwner,B);
 await second.kill();second=await device('device-B');state=await second.call('mount');assert.match(state.notice,/has been deleted.*cleared/);
 assert.ok(state.text.includes(state.notice));
 assert.equal(state.user,B);assert.equal(state.sdkOwner,B);
 state=await second.call('foreground');assert.equal(state.user,B);assert.equal(state.sdkOwner,B);assert.ok(!logouts.includes(B));
 await second.kill();second=await device('device-B');state=await second.call('mount');assert.equal(state.user,B);assert.equal(state.sdkOwner,B);
 }
 assert.ok(logouts.length<10,'bounded logout notifications; no SIGNED_OUT loop');
 console.log('PASS isolated processes mounted Root/Auth/Store + installed SDK + chunked native-key-valid storage + actual handler/restricted SQL/worker:',process.env.DELETION_HISTORICAL==='1'?'historical audio ambiguity: durable pending, known-owner erase and B preservation':process.env.DELETION_CACHED_SDK==='1'?'cached stale SDK signOut and visible signed-out tombstone restart':'revoked-null discovery, late A after B login, secure write failure, real periodic retry, partial cleanup process kill with valid B and visible tombstone restart','; stale callbacks/audio rejected and foreign owner preserved. Synthetic Auth/admin/native/provider hosts only.');
}finally{for(const child of children)child.kill('SIGKILL');await db.close();await rm(dir,{recursive:true,force:true});}
