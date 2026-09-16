import {mock} from 'bun:test';
import {plugin} from 'bun';
plugin({name:'connected-deletion-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
import assert from 'node:assert/strict';
import React from 'react';
import {createClient} from '@supabase/supabase-js';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {readFileSync} from 'node:fs';
import {deletionDatabaseHost} from './fixtures/deletionDatabaseHost';
import {createHash,randomUUID} from 'node:crypto';
const host=await deletionDatabaseHost();const db=host.db;
const owner='11111111-1111-4111-8111-111111111111';
const authOrigin='https://spvksnddzyvycfoefrcf.supabase.co';
const endpoint='https://beforeyousayit.app/functions/v1/account-delete';
const appUser='33333333-3333-4333-8333-333333333333',project='projSyntheticLocal';
let inventoryReady=false,customerDeleted=false,readbackReady=false;
process.env.BYSI_ACCOUNT_DELETION_REVENUECAT_PROJECT_ID=project;
const customerPath=`https://api.revenuecat.com/v2/projects/${project}/customers/${appUser}`;
const disk=new Map<string,string>();let sdk:ReturnType<typeof createClient>;
const legacySecret='0'.repeat(64),legacyKey=`bysi.accountDeletion.receipt.v1.${owner}`;
const legacyBytes=JSON.stringify({ownerId:owner,secret:legacySecret,digest:createHash('sha256').update(legacySecret).digest('hex'),requestId:'legacy-queue',status:'accepted'});
disk.set(legacyKey,legacyBytes);disk.set('bysi.accountDeletion.receipt.index.v1',JSON.stringify({latestOwnerId:owner}));
Object.assign(globalThis,{__DEV__:true});
const NativeHost=(props:any)=>React.createElement('host',props,props.children);
mock.module('react-native',()=>({View:NativeHost,Text:NativeHost,TextInput:(props:any)=>React.createElement('input',props),Platform:{OS:'ios',select:(values:any)=>values.ios??values.default},AppState:{addEventListener:()=>({remove(){}})}}));
mock.module('expo-constants',()=>({default:{executionEnvironment:'standalone'},ExecutionEnvironment:{StoreClient:'storeClient'}}));
mock.module('expo-file-system/legacy',()=>({cacheDirectory:'cache/',getInfoAsync:async()=>({exists:false}),readDirectoryAsync:async()=>[]}));
mock.module('@/components/ui',()=>({PrimaryButton:(props:any)=>React.createElement('button',props,props.label)}));
mock.module('@react-native-async-storage/async-storage',()=>({default:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{},getAllKeys:async()=>[],multiRemove:async()=>{}}}));
mock.module('expo-secure-store',()=>({isAvailableAsync:async()=>true,WHEN_UNLOCKED_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>disk.get(k)??null,setItemAsync:async(k:string,v:string)=>{assert.match(k,/^[\w.-]+$/);disk.set(k,v);},deleteItemAsync:async(k:string)=>{disk.delete(k);}}));
mock.module('expo-crypto',()=>({randomUUID,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,s:string)=>createHash('sha256').update(s).digest('hex')}));
mock.module('../lib/supabase',()=>({authEnvironment:{url:authOrigin,staging:false,key:'synthetic'},isAuthConfigured:true,get supabase(){return sdk;}}));
mock.module('pg',()=>({Pool:class {role:string;constructor(options:any){this.role=new URL(options.connectionString).username;}on(){}async end(){}async connect(){return host.connect(this.role);}}}));
Object.assign(process.env,{EXPO_PUBLIC_NATIVE_ACCOUNT_DELETION:'normal-results-local-v1',BYSI_ACCOUNT_DELETION_API:'normal-results-local-v1',BYSI_ACCOUNT_DELETION_WORKER:'normal-results-local-v1',BYSI_ACCOUNT_DELETION_API_DATABASE_URL:'postgresql://bysi_account_deletion_api:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_ACCOUNT_DELETION_WORKER_DATABASE_URL:'postgresql://bysi_account_deletion_worker:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_ACCOUNT_DELETION_AUTH_ORIGIN:authOrigin,BYSI_ACCOUNT_DELETION_PUBLISHABLE_KEY:'synthetic',BYSI_ACCOUNT_DELETION_AUTH_ADMIN_KEY:'synthetic',BYSI_REVENUECAT_SECRET_KEY:'synthetic'});
const calls:{url:string;method:string;authorization:string|null}[]=[];
let passwordRejected=false,bearerRejected=false,outage=false,freshForeign=false,malformedUser=false,malformedGrant=false,dropAcceptance=false;
let POST:any;
globalThis.fetch=(async(url:any,init:any)=>{
 const exact=String(url);const method=init?.method??'GET';const authorization=new Headers(init?.headers).get('authorization');calls.push({url:exact,method,authorization});
 if(exact===endpoint){const response=await POST(new Request(exact,init));if(dropAcceptance&&response.status===202){dropAcceptance=false;throw Error('Synthetic response lost after durable acceptance');}return response;}
 if(exact.startsWith(customerPath)){
  if(!inventoryReady)return new Response(null,{status:503});
  if(exact===customerPath&&method==='DELETE'){customerDeleted=true;return Response.json({object:'customer_deleted'});}
  if(exact===customerPath)return customerDeleted&&readbackReady?new Response(null,{status:404}):Response.json({object:'customer',id:appUser,project_id:project,first_seen_at:1,last_seen_at:2,active_entitlements:{object:'list',items:[],next_page:null}});
  const path=new URL(exact).pathname;
  if(exact===customerPath+'/aliases?limit=100')return Response.json({object:'list',url:path,items:[{object:'customer.alias',id:appUser,created_at:1}],next_page:null});
  if(exact===customerPath+'/subscriptions?limit=100')return Response.json({object:'list',url:path,items:[{object:'subscription',id:'subSynthetic',customer_id:appUser,store:'app_store',environment:'production',ownership:'purchased'}],next_page:null});
  if(exact===customerPath+'/purchases?limit=100')return Response.json({object:'list',url:path,items:[],next_page:null});
 }
 if(exact===authOrigin+'/auth/v1/admin/users/'+owner){
  if(method==='DELETE'){await db.exec('reset role');await db.query('delete from auth.users where id=$1',[owner]);return Response.json({id:owner});}
  if(method==='GET'){await db.exec('reset role');return new Response(null,{status:(await db.query('select 1 from auth.users where id=$1',[owner])).rows.length?200:404});}
 }
 if(exact===authOrigin+'/auth/v1/user')return malformedUser?Response.json({}):outage?new Response(null,{status:503}):bearerRejected?new Response(null,{status:401}):Response.json({id:freshForeign&&authorization==='Bearer fresh'?'22222222-2222-4222-8222-222222222222':owner,email:'owner@example.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01'});
 if(exact===authOrigin+'/auth/v1/token?grant_type=password')return malformedGrant?Response.json({}):passwordRejected?Response.json({code:'invalid_credentials'},{status:400}):Response.json({user:{id:owner,is_anonymous:false,email_confirmed_at:'2026-01-01'},access_token:'fresh'});
 if(exact===authOrigin+'/auth/v1/logout?scope=local')return new Response(null,{status:204});
 if(exact===authOrigin+'/auth/v1/logout?scope=global')return new Response(null,{status:204});
 throw Error('Unexpected external destination');
}) as any;
sdk=createClient(authOrigin,'synthetic-public',{global:{fetch:globalThis.fetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const jwt=[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:owner,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),Buffer.from('synthetic-signature').toString('base64url')].join('.');
assert.equal((await sdk.auth.setSession({access_token:jwt,refresh_token:'synthetic-refresh'})).error,null);
try{
 await db.exec('CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE bysi_native_service;CREATE ROLE bysi_account_deletion_api;CREATE ROLE bysi_account_deletion_worker;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);');
 await db.exec('alter default privileges grant all on tables to anon,authenticated,service_role;alter default privileges grant all on functions to anon,authenticated,service_role');
 for(const schema of ['native-free','account-deletion','normal-results','revenuecat'])await db.exec(readFileSync(new URL('../../server/server/'+schema+'/schema.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../server/server/account-deletion/inventory-schema.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[owner]);
 await db.query('insert into bysi_revenuecat.binding(owner_id,app_user_id) values($1,$2)',[owner,appUser]);
 await db.query('insert into bysi_revenuecat.projection values($1,$2,$3)', ['PRODUCTION',appUser,JSON.stringify({allowed:true,blocked:false,eventId:'synthetic'})]);
 POST=(await import('../../server/app/functions/v1/account-delete/route.js')).POST;
 const {verifyComponentTestDeps}=await import('../scripts/component-test-deps');
 const {create,act}=await import(verifyComponentTestDeps());
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const lifecycle=await import('../lib/accountLifecycleRuntime');
 assert.equal(await lifecycle.accountDeletionReceiptStore.loadLatest(),null,'old Edge receipt is not assigned to candidate queue');
 const {AuthProvider,useAuth}=await import('../providers/auth');
 let authTree:any,account:any;const queryClient=new QueryClient({defaultOptions:{queries:{retry:false}}});
 function AccountProbe(){account=useAuth();return null;}
 await act(async()=>{authTree=create(React.createElement(QueryClientProvider,{client:queryClient},React.createElement(AuthProvider,null,React.createElement(AccountProbe))));});
 for(let i=0;i<40&&!account?.user;i++)await act(async()=>{await new Promise(r=>setTimeout(r,25));});
 assert.equal(account?.user?.id,owner,'actual AuthProvider restores installed SDK owner');
 for(let i=0;i<40;i++){
  await act(async()=>{await new Promise(r=>setTimeout(r,25));});
  if((await lifecycle.receiptlessDeletionCapabilityStore.load(owner))?.registered)break;
 }
 assert.equal((await lifecycle.receiptlessDeletionCapabilityStore.load(owner))?.registered,true,'actual Auth coordinator enrolled through mounted API');
 await act(async()=>authTree.unmount());queryClient.clear();

 assert.equal(lifecycle.accountDeletionAvailable,true,'explicit candidate reaches actual native runtime');
 assert.equal((await lifecycle.enrollReceiptlessDeletionNotice(owner)).registered,true);
 assert.equal((await lifecycle.checkReceiptlessAccountDeletionNotice(owner)).status,'active');
 passwordRejected=true;assert.equal((await lifecycle.deleteAccountIdentity(owner,'bad',{kind:'unknown'})).status,'rejected');passwordRejected=false;
 bearerRejected=true;assert.equal((await POST(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer invalid','content-type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'f'.repeat(64)})}))).status,401);bearerRejected=false;
 outage=true;assert.equal((await POST(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer old','content-type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'f'.repeat(64)})}))).status,503);outage=false;
 for(const kind of ['user','grant']){
  malformedUser=kind==='user';malformedGrant=kind==='grant';
  assert.equal((await POST(new Request(endpoint,{method:'POST',headers:{authorization:'Bearer old','content-type':'application/json'},body:JSON.stringify({password:'password',receiptDigest:'f'.repeat(64)})}))).status,503,'malformed Auth '+kind+' is unavailable, not credential rejection');
 }
 malformedUser=false;malformedGrant=false;
 freshForeign=true;assert.equal((await lifecycle.deleteAccountIdentity(owner,'password',{kind:'unknown'})).status,'rejected');freshForeign=false;
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from bysi_account_deletion.request')).rows[0].n,0);
 const {AccountDeletionControls}=await import('../components/AccountLifecycleControls');
 let mounted:any;const localCleaned:string[]=[];
 await act(async()=>{mounted=create(React.createElement(AccountDeletionControls,{ownerId:owner,billing:{kind:'unknown'},clearLocal:async(id:string)=>{localCleaned.push(id);}}));});
 await act(async()=>mounted.root.findByType('input').props.onChangeText('password'));
 dropAcceptance=true;
 await act(async()=>mounted.root.findAllByType('button').find((n:any)=>n.props.label==='Delete account anyway').props.onPress());
 assert.match(JSON.stringify(mounted.toJSON()),/Deletion is still in progress/);
 assert.equal((await lifecycle.accountDeletionReceiptStore.load(owner))?.status,'accepted');
 assert.deepEqual(localCleaned,[]);
 await act(async()=>mounted.unmount());
 assert.equal((await lifecycle.checkReceiptlessAccountDeletionNotice(owner)).status,'deleting');
 assert.equal((await sdk.auth.getSession()).data.session?.user.id,owner,'remote global revoke does not mutate installed native SDK');
 await sdk.auth.signOut({scope:'local'});
 const {runAccountDeletionWorkerOnce}=await import('../../server/server/account-deletion/runtime.mjs');
 assert.deepEqual(await runAccountDeletionWorkerOnce({limit:1}),{enabled:true,erased:1,providerRetry:1,completed:0});
 assert.equal((await lifecycle.checkAccountDeletionStatus()).status,'provider_retry');
 assert.ok(calls.some(c=>c.url===authOrigin+'/auth/v1/logout?scope=global'));
 assert.ok(calls.some(c=>c.url===authOrigin+'/auth/v1/user'&&c.authorization==='Bearer fresh'));
 assert.equal(calls.filter(c=>c.method==='DELETE').length,0);
 await db.exec('reset role');
 const original=(await db.query('select id from bysi_account_deletion.request')).rows[0].id;
 if(process.env.REVIEW_PG_SOCKET){
  await db.exec('update bysi_account_deletion.request set next_attempt_at=clock_timestamp()');
  await db.exec('begin;select id from bysi_revenuecat.lock where id=true for update');
  const waiting=runAccountDeletionWorkerOnce({limit:1});let blocked=false;
  try{
   for(let i=0;i<80&&!blocked;i++){
    await new Promise(r=>setTimeout(r,10));
    await db.exec('select pg_stat_clear_snapshot()');
    blocked=(await db.query("select count(*)::int n from pg_stat_activity where pid<>pg_backend_pid() and wait_event_type='Lock' and query like '%bysi_account_deletion_inventory_snapshot%' ")).rows[0].n>0;
   }
   assert.equal(blocked,true,'actual separate worker connection blocks on binding authority lock');
  }finally{await db.exec('commit');}
  assert.equal((await waiting).completed,0);
  const {createDatabase}=await import('../../server/server/revenuecat/database.mjs');
  const {createDatabaseAccountDeletionStore}=await import('../../server/server/account-deletion/store.mjs');
  const sqlStore=createDatabaseAccountDeletionStore({database:createDatabase({connect:()=>host.connect('bysi_account_deletion_worker')}),randomUUID});
  await db.exec('update bysi_account_deletion.request set next_attempt_at=clock_timestamp()');
  const leaseA=await sqlStore.claimExternal();assert.ok(leaseA);
  await db.exec("update bysi_account_deletion.request set lease_expires_at=clock_timestamp()-interval '1 second'");
  const leaseB=await sqlStore.claimExternal();assert.ok(leaseB);assert.notEqual(leaseA.leaseId,leaseB.leaseId);
  assert.equal((await sqlStore.inventorySnapshot(leaseA)).code,'lease_mismatch');
  assert.equal((await sqlStore.inventorySnapshot(leaseB)).code,'ok');
  await sqlStore.markProviderRetry(leaseB,{reason:'inventory_pending'});
  for(const role of ['anon','authenticated','service_role','bysi_native_service','bysi_account_deletion_api','bysi_account_deletion_worker']){
   const row=(await db.query("select has_function_privilege($1,'public.bysi_account_deletion_inventory_refresh(uuid,uuid,text,jsonb)','execute') refresh,has_function_privilege($1,'public.bysi_account_deletion_register_device_status(uuid,text)','execute') device,has_table_privilege($1,'bysi_account_deletion.device_status_capability','select') raw",[role])).rows[0];
   assert.equal(row.refresh,role==='bysi_account_deletion_worker');assert.equal(row.device,role==='bysi_account_deletion_api');assert.equal(row.raw,false);
  }
  console.log('PASS separate-connection PostgreSQL lock observed in pg_stat_activity, lease A superseded by B, effective worker/API ACLs under broad default grants');
 }

 for(let i=0;i<6;i++){
  await db.exec("reset role;update bysi_account_deletion.request set next_attempt_at=clock_timestamp()-interval '1 second'");
  await runAccountDeletionWorkerOnce({limit:1});
  await db.exec('reset role');const row=(await db.query('select * from bysi_account_deletion.request')).rows[0];
  assert.equal(row.id,original);assert.equal(row.status,'provider_retry');assert.equal(row.external_attempts,0);
 }
 inventoryReady=true;
 await db.exec("reset role;update bysi_account_deletion.request set next_attempt_at=clock_timestamp()-interval '1 second'");
 assert.equal((await runAccountDeletionWorkerOnce({limit:1})).completed,0,'queued provider deletion is not absence');
 assert.ok(customerDeleted);
 assert.equal(calls.filter(c=>c.url===authOrigin+'/auth/v1/admin/users/'+owner).length,0);
 readbackReady=true;
 await db.exec("reset role;update bysi_account_deletion.request set next_attempt_at=clock_timestamp()-interval '1 second'");
 assert.equal((await runAccountDeletionWorkerOnce({limit:1})).completed,1,'existing trusted inventory survives asynchronous provider deletion and resolves same job');
 assert.equal((await lifecycle.checkAccountDeletionStatus()).status,'complete');
 assert.equal((await lifecycle.checkReceiptlessAccountDeletionNotice(owner)).status,'deleted');
 await db.exec('reset role');assert.equal((await db.query('select id from bysi_account_deletion.request')).rows[0].id,original);
 assert.ok(customerDeleted);
 assert.equal(disk.get(legacyKey),legacyBytes,'legacy secret retained untouched in its original backend');
 assert.notEqual((await lifecycle.accountDeletionReceiptStore.loadLatest())?.secret,legacySecret);
 console.log('PASS actual native runtime -> exact mounted POST -> actual API -> restricted SQL queue -> exported worker -> receiptless and receipt; unknown remains pending. Synthetic platform/Auth/DB transport only.');
}finally{await db.close();}
