import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import React from 'react';

process.env.EXPO_OS='web';
const {verifyComponentTestDeps}=await import('../scripts/component-test-deps');
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).__DEV__=true;

const require=createRequire('/tmp/bysi-hosted-tests.BlrHHI/package.json');
const {PGlite}=require('@electric-sql/pglite');
const Host=(p:any)=>React.createElement('host',p,p.children);
mock.module('react-native',()=>({Platform:{OS:'web'},Text:Host,View:Host,TextInput:(p:any)=>React.createElement('input',p),StyleSheet:{create:(v:any)=>v},AppState:{addEventListener:()=>({remove(){}})}}));
mock.module('@/components/ui',()=>({PrimaryButton:(p:any)=>React.createElement('button',p,p.label)}));
const disk=new Map<string,string>();
mock.module('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(keys:string[])=>{for(const key of keys)disk.delete(key);}}}));
mock.module('expo-secure-store',()=>({isAvailableAsync:async()=>true,AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,getItemAsync:async(k:string)=>disk.get('secure:'+k)??null,setItemAsync:async(k:string,v:string)=>{disk.set('secure:'+k,v);},deleteItemAsync:async(k:string)=>{disk.delete('secure:'+k);}}));
mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA-256'},randomUUID:()=>'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',digestStringAsync:async(_alg:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
mock.module('expo-constants',()=>({default:{expoConfig:{version:'synthetic',extra:{eas:{projectId:'1b655360-557d-4dba-ad69-fbf26120e852'}}}}}));
mock.module('expo-application',()=>({applicationId:'app.rork.8fc4qwsqaurkxk0pimyvx'}));

const ownerA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const authUrl='https://spvksnddzyvycfoefrcf.supabase.co';
mock.module('@/lib/supabase',()=>({authEnvironment:{url:authUrl,staging:false,key:'public-fixture',keychainService:'beforeyousayit.supabase'},supabase:null}));
mock.module('@/lib/baselineAudio',()=>({baselineFileName:(id:string)=>`${id.replace(/[^a-zA-Z0-9_-]/g,'')||'session'}.m4a`,listBaselineAudioFileNamesStrict:async()=>[],deleteBaselineAudioStrict:async()=>{}}));

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const migrations=['202608290001_create_lesson_feedback','202609060001_web_bridge','202609060002_private_web_result','202609060003_private_result_service_acl','202609060004_checkout_binding','202609060005_owner_result_discovery','202609060006_staging_paid_access','202609070001_hosted_browser_sessions','202609090001_native_free_sessions'];
const privateResult=()=>({schema_version:1,kind:'bysi_private_web_result',provenance:{source:'server_generation',generation_id:'gen_fixture',rehearsal_id:'rehearsal_fixture',provider_request_id:'provider_fixture',model:'synthetic_model',producer_version:'fixture_v1',generated_at:'2026-09-06T12:00:00.000Z'},result:{mode:'result',outputVersion:'bysi-free-rehearsal-result-v1-2026-08-12',pressure_moment:{headline:'Headline',conclusion:'Conclusion',how_bysi_read_this:{observed:'Observed',why_it_matters:'Reason',confidence:'Limited'}},practice_shift:{headline:'Shift',current_pattern:['One','Two','Three'],practice_target:['Four','Five','Six'],goal_line:'Goal',honesty_note:'Note'},starting_index:{overall:null,label:'Starting Index',coverage_note:'Coverage',score_note:'Score note',focus_dimension:'Repair',observed_dimensions:[{name:'Clarity',score:43.25,evidence:'Evidence'}],unobserved_dimensions:['Specificity','Listening','Steadiness','Boundaries','Repair']},recommended_path:{first_module:'Get to the Point',reason:'Reason',next_modules:['Repair What Went Wrong']}}});
const dir=await mkdtemp(join(tmpdir(),'bysi-account-joined-'));
let db:any=new PGlite(dir);
let sqlQueue=Promise.resolve();
let authSession:any={user:{id:ownerA,email:'a@example.invalid',is_anonymous:false},access_token:'old-a'};
let revoked=false;
let authDeleted=false;
const authFetches:string[]=[];
const revenueCatDeletes:string[]=[];

async function withSql<T>(fn:()=>Promise<T>):Promise<T>{
 const previous=sqlQueue;let release!:()=>void;sqlQueue=new Promise<void>(r=>release=r);await previous;
 try{return await fn();}finally{release();}
}
async function applySql(){
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE bysi_native_service;CREATE ROLE bysi_account_deletion_api;CREATE ROLE bysi_account_deletion_worker;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
 for(const version of migrations)await db.exec(await readFile(new URL('../../backend/supabase/migrations/'+version+'.sql',import.meta.url),'utf8'));
 await db.exec(await readFile('/Users/donaldgrimm/Projects/bysi-web-claude-parity/server/revenuecat/schema.sql','utf8'));
 await db.exec(await readFile(new URL('../../backend/supabase/migrations/202609100001_account_deletion.sql',import.meta.url),'utf8'));
 await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at,is_anonymous) VALUES($1,'a@example.invalid',now(),false),($2,'b@example.invalid',now(),false)`,[ownerA,ownerB]);
 await db.query(`INSERT INTO public.bysi_private_results(id,generation_id,record,expires_at) VALUES($1,'gen_fixture',$2::jsonb,'2099-01-01')`,[ownerA,JSON.stringify(privateResult())]);
 await db.query(`INSERT INTO public.bysi_web_sessions(id,owner_id,email,claim_secret_hash,livemode,result_summary,private_result_id) VALUES($1,$1,'a@example.invalid',$2,false,NULL,$1),($3,$3,'b@example.invalid',$2,false,'{"schema_version":1,"result_code":"steady","next_practice_id":"intro"}',NULL)`,[ownerA,'1'.repeat(64),ownerB]);
 await db.query(`INSERT INTO bysi_revenuecat.binding(owner_id,app_user_id) VALUES($1,$1),($2,$2)`,[ownerA,ownerB]);
 await db.query(`INSERT INTO bysi_revenuecat.projection(environment,app_user_id,value) VALUES('PRODUCTION',$1,$2::jsonb),('PRODUCTION',$3,$4::jsonb)`,[ownerA,JSON.stringify({eventId:'evt-a',eventAt:1800000000000,blocked:false,allowed:true,transaction:'tx-a',expiry:1800003600000,checkedAt:1800000000000}),ownerB,JSON.stringify({eventId:'evt-b',eventAt:1800000000000,blocked:false,allowed:true,transaction:'tx-b',expiry:1800003600000,checkedAt:1800000000000})]);
 await db.query(`INSERT INTO bysi_revenuecat.event(environment,id,digest) VALUES('PRODUCTION','evt-a',$1),('PRODUCTION','evt-b',$2)`,['a'.repeat(64),'b'.repeat(64)]);
 await db.query(`INSERT INTO bysi_revenuecat.rate_limit(key,bucket,used) VALUES($1,1,7),($2,1,9),('global',1,11)`,[ownerA,ownerB]);
}
await applySql();

async function rpc(name:string,body:any,key:string){
 return withSql(async()=>{
  await db.exec('RESET ROLE');
  await db.exec(`SET ROLE ${key==='worker-fixture'?'bysi_account_deletion_worker':'bysi_account_deletion_api'}`);
  try{
   const map:any={
    bysi_account_deletion_request:['SELECT public.bysi_account_deletion_request($1,$2) AS value',[body.p_owner,body.p_receipt_digest]],
    bysi_account_deletion_status:['SELECT public.bysi_account_deletion_status($1) AS value',[body.p_receipt_secret]],
    bysi_account_deletion_work:['SELECT public.bysi_account_deletion_work($1) AS value',[body.p_limit]],
    bysi_account_deletion_claim_external:['SELECT public.bysi_account_deletion_claim_external($1) AS value',[body.p_lease]],
    bysi_account_deletion_provider_retry:['SELECT public.bysi_account_deletion_provider_retry($1,$2,$3::jsonb) AS value',[body.p_request,body.p_lease,JSON.stringify(body.p_evidence)]],
    bysi_account_deletion_complete:['SELECT public.bysi_account_deletion_complete($1,$2::jsonb,$3::jsonb,$4) AS value',[body.p_request,JSON.stringify(body.p_provider_evidence),JSON.stringify(body.p_auth_evidence),body.p_lease]],
   };
   const spec=map[name];if(!spec)return Response.json({code:'missing_rpc'},{status:404});
   return Response.json((await db.query(spec[0],spec[1])).rows[0].value);
  }finally{await db.exec('RESET ROLE');}
 });
}
const auth:any={
 getSession:async()=>({data:{session:authSession},error:null}),
 getUser:async(token:string)=>({data:{user:token==='old-a'&&authSession?.user.id===ownerA?authSession.user:null},error:null}),
};
const syntheticFetch:typeof fetch=async(url:any,init:any={})=>{
 const target=String(url);const path=new URL(target).pathname;const body=init.body?JSON.parse(String(init.body)):null;authFetches.push(path);
 if(path==='/auth/v1/user')return Response.json(revoked?{}:{id:ownerA,email:'a@example.invalid',email_confirmed_at:'2026-01-01',is_anonymous:false});
 if(path==='/auth/v1/token')return Response.json({access_token:'fresh-a',user:{id:ownerA}});
 if(path==='/auth/v1/logout'){revoked=true;return new Response(null,{status:204});}
 if(path==='/auth/v1/admin/users/'+ownerA && init.method==='DELETE'){authDeleted=true;await withSql(()=>db.query('DELETE FROM auth.users WHERE id=$1',[ownerA]).then(()=>undefined));return new Response(null,{status:204});}
 if(path==='/auth/v1/admin/users/'+ownerA && init.method==='GET')return authDeleted?new Response('not found',{status:404}):Response.json({});
 if(path.startsWith('/rest/v1/rpc/')){
  const key=String(new Headers(init.headers).get('authorization')??'').replace(/^Bearer /,'');
  if(!['delete-rpc-fixture','worker-fixture'].includes(key))return Response.json({code:'stale_jwt_rejected'},{status:401});
  return rpc(path.split('/').pop()!,body,key);
 }
 if(target.startsWith('https://api.revenuecat.com/v1/subscribers/')){revenueCatDeletes.push(decodeURIComponent(target.split('/').pop()!));return Response.json({deleted:true});}
 return Response.json({code:'not_found'},{status:404});
};
const {createDeletionService,createSupabaseAccountDeletionStore,createSupabaseAuthAdmin}=await import('../../backend/account-lifecycle/service');
const {createAccountDeletionWorker,createRevenueCatDeletionProvider}=await import('../../backend/account-lifecycle/worker');
const {requestAccountDeletion,checkAccountDeletionStatus}=await import('../lib/accountDeletion');
const runtime=await import('../lib/accountLifecycleRuntime');
const {createOwnerPracticeStorage}=await import('../lib/ownerPracticeStorage');
const AsyncStorage=(await import('@react-native-async-storage/async-storage')).default;
const {AccountDeletionControls,AccountDeletionStatusControls}=await import('../components/AccountLifecycleControls');
const server=createDeletionService({enabled:true,url:authUrl,publicKey:'public-fixture',adminKey:'admin-fixture',deletionRpcKey:'delete-rpc-fixture'},syntheticFetch);
const receiptStore={load:async(owner:string)=>JSON.parse(disk.get(`secure:bysi.accountDeletion.receipt.v1.${owner}`)??'null'),loadLatest:async()=>{const index=JSON.parse(disk.get('secure:bysi.accountDeletion.receipt.index.v1')??'null');return index?.latestOwnerId?receiptStore.load(index.latestOwnerId):null;},save:async(receipt:any)=>{disk.set(`secure:bysi.accountDeletion.receipt.v1.${receipt.ownerId}`,JSON.stringify(receipt));disk.set('secure:bysi.accountDeletion.receipt.index.v1',JSON.stringify({latestOwnerId:receipt.ownerId}));}};
let loseAcceptedResponse=true;
const deleteIdentity=(owner:string,password:string,billing:any)=>requestAccountDeletion(auth,authUrl+'/functions/v1/account-delete',owner,password,billing,receiptStore,async(url,init)=>{
 const response=await server(new Request(url,init));
 if(loseAcceptedResponse && response.status===202){loseAcceptedResponse=false;throw new Error('lost accepted response');}
 return response;
});

const receiptSecret='c'.repeat(64);
const receipt={ownerId:ownerA,secret:receiptSecret,digest:digest(receiptSecret)};
await disk.set(`secure:bysi.accountDeletion.receipt.v1.${ownerA}`,JSON.stringify(receipt));
await disk.set('secure:bysi.accountDeletion.receipt.index.v1',JSON.stringify({latestOwnerId:ownerA}));
const ownerPrefix=(owner:string)=>`bysi.owner.v1:${encodeURIComponent(`${authUrl}:${owner}`)}:`;
disk.set(ownerPrefix(ownerA)+'cc.sessions.v2',JSON.stringify([{id:'local-a',endedAt:1}]));
disk.set(ownerPrefix(ownerA)+'cc.activeScenarioRun.v1',JSON.stringify({run:{id:'run-a'}}));
disk.set(ownerPrefix(ownerB)+'cc.sessions.v2',JSON.stringify([{id:'local-b',endedAt:1}]));
const {guestContinuationSecureStorage}=await import('../lib/guestContinuationRuntime');
const guestSecure=await guestContinuationSecureStorage(JSON.stringify([authUrl,'beforeyousayit.supabase']));
await guestSecure.setItem('current',JSON.stringify({version:1,source:`${authUrl}:${ownerA}`,target:`${authUrl}:${ownerA}`}));
const staleOwnerLease=createOwnerPracticeStorage(AsyncStorage,`${authUrl}:${ownerA}`);
await staleOwnerLease.setItem('cc.profile.v1',JSON.stringify({focus:'owned-a'}));

let root:any;
const localStatus=(owner:string|null)=>checkAccountDeletionStatus(authUrl+'/functions/v1/account-delete',owner,receiptStore,async(url,init)=>server(new Request(url,init)));
await act(async()=>{root=create(React.createElement(AccountDeletionControls,{available:true,ownerId:ownerA,ownerEmail:'a@example.invalid',billing:{kind:'apple'},deleteIdentity,checkStatus:(owner:string)=>localStatus(owner),clearLocal:runtime.cleanupDeletedAccountOwner}));});
await act(async()=>{root.root.findAllByType('input')[0].props.onChangeText('current-password');});
const button=()=>root.root.findAllByType('button')[0];
await act(async()=>{const first=button().props.onPress();void button().props.onPress();await first;});
assert.match(JSON.stringify(root.toJSON()),/Deletion is still in progress/);
assert.equal(authSession?.user?.id,ownerA,'server revoke must not fake SDK logout; local status completion owns device logout');
assert.equal((await rpc('bysi_account_deletion_status',{p_receipt_secret:receiptSecret},'delete-rpc-fixture').then(r=>r.json())).status,'accepted');
await db.close();db=new PGlite(dir);
assert.equal((await rpc('bysi_account_deletion_status',{p_receipt_secret:receiptSecret},'delete-rpc-fixture').then(r=>r.json())).status,'accepted','receipt status survives process restart');
assert.equal((await syntheticFetch(authUrl+'/rest/v1/rpc/bysi_account_deletion_request',{method:'POST',headers:{Authorization:'Bearer stale-api-jwt','Content-Type':'application/json'},body:JSON.stringify({p_owner:ownerA,p_receipt_digest:'d'.repeat(64)})})).status,401);
assert.equal((await server(new Request(authUrl+'/functions/v1/account-delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptSecret:'d'.repeat(64)})}))).status,404);

const worker=createAccountDeletionWorker({store:createSupabaseAccountDeletionStore({url:authUrl,workerRpcKey:'worker-fixture'},syntheticFetch),providers:createRevenueCatDeletionProvider({secretKey:'rc-secret',fetch:syntheticFetch}),authAdmin:createSupabaseAuthAdmin({url:authUrl,adminKey:'admin-fixture'},syntheticFetch)});
assert.deepEqual(await worker.runOnce(10),{erased:1,providerRetry:0,completed:1});
assert.deepEqual(revenueCatDeletes,[ownerA]);
assert.equal((await rpc('bysi_account_deletion_status',{p_receipt_secret:receiptSecret},'delete-rpc-fixture').then(r=>r.json())).status,'complete');
assert.equal((await withSql(()=>db.query('SELECT count(*)::int n FROM bysi_revenuecat.binding WHERE owner_id=$1',[ownerA]))).rows[0].n,0);
assert.equal((await withSql(()=>db.query('SELECT count(*)::int n FROM bysi_revenuecat.binding WHERE owner_id=$1',[ownerB]))).rows[0].n,1);
assert.equal((await withSql(()=>db.query('SELECT used FROM bysi_revenuecat.rate_limit WHERE key=$1',[ownerB]))).rows[0].used,9);
assert.equal((await withSql(()=>db.query('SELECT public.bysi_project_stripe($1::jsonb) AS v',[JSON.stringify({subscriptionId:'sub_late',livemode:false,sessionId:ownerA,customerId:'cus_late',status:'active',expiresAt:'2099-01-01',cancelAtPeriodEnd:false,eventCreated:1,eventId:'evt_late'})]))).rows[0].v,'erased');

await act(async()=>root.unmount());
let cleanupAttempts=0;
await act(async()=>{root=create(React.createElement(AccountDeletionStatusControls,{available:true,checkStatus:()=>localStatus(null),clearLocal:async(owner:string)=>{cleanupAttempts++;if(cleanupAttempts===1)throw new Error('synthetic cleanup failure');await runtime.cleanupDeletedAccountOwner(owner);}}));});
await act(async()=>{await root.root.findAllByType('button')[0].props.onPress();});
assert.match(JSON.stringify(root.toJSON()),/still be on this device/);
assert.ok([...disk.keys()].some(k=>k.startsWith(ownerPrefix(ownerA))));
await act(async()=>{await root.root.findAllByType('button')[0].props.onPress();});
assert.match(JSON.stringify(root.toJSON()),/Your account has been deleted/);
assert.ok(![...disk.keys()].some(k=>k.startsWith(ownerPrefix(ownerA))));
assert.ok([...disk.keys()].some(k=>k.startsWith(ownerPrefix(ownerB))),'cleanup must not erase a signed-in or guest successor namespace');
assert.equal(await guestSecure.getItem('current'),null,'owned chunked handoff removed after completion');
await assert.rejects(staleOwnerLease.setItem('cc.profile.v1',JSON.stringify({focus:'late-write'})),/Account changed/);
await guestSecure.setItem('current',JSON.stringify({version:1,source:`${authUrl}:${ownerB}`,target:`${authUrl}:${ownerB}`}));
await runtime.cleanupDeletedAccountOwner(ownerA);
assert.ok(await guestSecure.getItem('current'),'cleanup must preserve another owner handoff');
await act(async()=>root.unmount());
await db.close();await rm(dir,{recursive:true,force:true});
assert.ok(authFetches.includes('/auth/v1/token'));
console.log('PASS joined mounted account deletion: UI -> native transport (synthetic Auth object) -> real handler/service -> HTTP RPC SQL adapter -> file-backed SQL restart -> worker/Auth/RevenueCat -> receipt status -> owner-scoped cleanup retry; synthetic local HTTP only');
