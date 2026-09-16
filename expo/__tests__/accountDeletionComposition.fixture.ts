import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {requestAccountDeletion,checkAccountDeletionStatus} from '../lib/accountDeletion';

const {PGlite}=createRequire(new URL('../../test-deps/package.json',import.meta.url))('@electric-sql/pglite');
const owner='11111111-1111-4111-8111-111111111111';
const endpoint='https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete';
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');

const db=new PGlite();
try{
 await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role;CREATE ROLE bysi_native_service;CREATE ROLE bysi_account_deletion_api;CREATE ROLE bysi_account_deletion_worker;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);`);
 await db.exec(readFileSync(new URL('../../server/server/native-free/schema.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../server/server/account-deletion/schema.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../server/server/normal-results/schema.sql',import.meta.url),'utf8'));
 await db.query('insert into auth.users(id,email_confirmed_at,is_anonymous) values($1,now(),false)',[owner]);

 const databaseFor=(role:string)=>({async transaction(fn:any){
  await db.exec('reset role');await db.exec('begin');await db.exec('set local role '+role);
  try{const value=await fn({query:(sql:string,params?:unknown[])=>db.query(sql,params)});await db.exec('commit');return value;}
  catch(error){await db.exec('rollback').catch(()=>{});throw error;}
 }});
 const {createDatabaseAccountDeletionStore}=await import('../../server/server/account-deletion/store.mjs');
 const {createAccountDeletionHandler,trustedNoRevenueCatInventory}=await import('../../server/server/account-deletion/http.mjs');
 const {createAccountDeletionWorker,createRevenueCatDeletionProvider}=await import('../../server/server/account-deletion/worker.mjs');
 const apiStore=createDatabaseAccountDeletionStore({database:databaseFor('bysi_account_deletion_api')});
 const workerStore=createDatabaseAccountDeletionStore({database:databaseFor('bysi_account_deletion_worker'),randomUUID:(()=>{let i=0;return ()=>`00000000-0000-4000-8000-${String(++i).padStart(12,'0')}`;})()});
 const calls:string[]=[];
 const handler=createAccountDeletionHandler({
  enabled:true,
  store:apiStore,
  verifyBearer:async(token:string)=>{calls.push('verify:'+token);return token==='Bearer old'?{id:owner,email:'owner@example.invalid',confirmed:true}:null;},
  reauthenticate:async(input:any)=>{calls.push('reauth:'+input.ownerId+':'+input.password);return input.ownerId===owner&&input.password==='password'?{ownerId:owner,token:'fresh'}:null;},
  revoke:async(input:any)=>{calls.push('revoke:'+input.token);},
  resolveProviderInventory:async({ownerId}:any)=>trustedNoRevenueCatInventory(ownerId)
 });
 const receiptSecret='c'.repeat(64);
 const receiptStore={receipt:{ownerId:owner,secret:receiptSecret,digest:digest(receiptSecret),status:undefined as string|undefined},load:async()=>receiptStore.receipt,loadLatest:async()=>receiptStore.receipt,save:async(receipt:any)=>{receiptStore.receipt=receipt;}};
 const auth:any={getSession:async()=>({data:{session:{user:{id:owner,is_anonymous:false},access_token:'old'}},error:null}),getUser:async()=>({data:{user:{id:owner,is_anonymous:false,email:'owner@example.invalid'}},error:null})};
 const localFetch=async(url:string|URL|Request,init?:RequestInit)=>handler(new Request(String(url),init));

 const requested=await requestAccountDeletion(auth,endpoint,owner,'password',{kind:'apple',store:'app_store',revenuecat_app_user_id:'ffffffff-ffff-4fff-8fff-ffffffffffff'},receiptStore,localFetch as any);
 assert.equal(requested.success,true);
 assert.equal(requested.status,'accepted');
 assert.deepEqual(calls,['verify:Bearer old','reauth:'+owner+':password','revoke:fresh']);
 assert.equal((await checkAccountDeletionStatus(endpoint,owner,receiptStore,localFetch as any)).status,'accepted');

 let providerFetches=0,authDeletes=0;
 const worker=createAccountDeletionWorker({
  store:workerStore,
  providers:createRevenueCatDeletionProvider({secretKey:'synthetic',fetch:async()=>{providerFetches++;throw Error('No external provider calls in local trusted-absence proof');}}),
  authAdmin:{hardDelete:async(id:string)=>{authDeletes++;await db.exec('reset role');await db.query('delete from auth.users where id=$1',[id]);},verifyAbsent:async(id:string)=>{await db.exec('reset role');return (await db.query('select 1 from auth.users where id=$1',[id])).rows.length===0;}}
 });
 assert.deepEqual(await worker.runOnce(1),{erased:1,providerRetry:0,completed:1});
 assert.equal(providerFetches,0);
 assert.equal(authDeletes,1);
 const completed=await checkAccountDeletionStatus(endpoint,null,receiptStore,localFetch as any);
 assert.equal(completed.success,true);
 assert.equal(completed.status,'complete');
 console.log('PASS actual native requestAccountDeletion -> local account-delete handler -> SQL request/status -> worker entry -> receipt complete. Synthetic Auth/provider inventory; no external operations.');
}finally{
 await db.close();
}
