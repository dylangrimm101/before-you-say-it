// Actual AuthProvider + consent handoff + SecureStore retry adapter. Only Auth,
// server HTTP and device storage hosts are synthetic. Run each crash in a process.
import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync,writeFileSync} from 'node:fs';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN='https://beforeyousayit.app';
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=false;
const guest='11111111-1111-4111-8111-111111111111',accountId='22222222-2222-4222-8222-222222222222',serverSession='33333333-3333-4333-8333-333333333333';
const slot='cc.activePracticeSession.v1',disk=new Map<string,string>(),secure=new Map<string,string>();
const mode=process.argv[2],file=process.argv[3],resume=process.argv[4]==='resume';
let session:any={user:{id:guest,is_anonymous:true},access_token:'synthetic-guest-token'},serverClaimed=false,claims=0;
const checkpoint=(stage:string)=>{if(!resume&&mode===stage){writeFileSync(file,JSON.stringify({disk:[...disk],secure:[...secure],session,serverClaimed}),{mode:0o600});process.exit(73);}};
if(resume){const saved=JSON.parse(readFileSync(file,'utf8'));for(const [k,v] of saved.disk)disk.set(k,v);for(const [k,v] of saved.secure)secure.set(k,v);session=saved.session;serverClaimed=saved.serverClaimed;}
const raw={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()]};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
mock.module('expo-crypto',()=>({getRandomBytes:randomBytes,randomUUID,CryptoDigestAlgorithm:{SHA256:'SHA-256'},digestStringAsync:async(_:string,s:string)=>createHash('sha256').update(s).digest('hex')}));
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,isAvailableAsync:async()=>true,
 getItemAsync:async(k:string,o:any)=>secure.get(o.keychainService+':'+k)??null,
 setItemAsync:async(k:string,v:string,o:any)=>{assert.equal(o.keychainAccessible,4);if(o.keychainService==='beforeyousayit.normal.result-claim-retry.v1'&&mode==='storage-failure')throw Error('synthetic full keychain');secure.set(o.keychainService+':'+k,v);if(o.keychainService==='beforeyousayit.normal.result-claim-retry.v1')checkpoint('retry-written');},
 deleteItemAsync:async(k:string,o:any)=>{secure.delete(o.keychainService+':'+k);}}));
const events=new Set<any>();
const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),onAuthStateChange:(fn:any)=>{events.add(fn);return {data:{subscription:{unsubscribe(){events.delete(fn);}}}};},signInWithPassword:async()=>{session={user:{id:accountId,is_anonymous:false,email:'a@invalid',email_confirmed_at:'2026-01-01'},access_token:'synthetic-account-token'};for(const fn of events)fn('SIGNED_IN',session);checkpoint('auth-before-retry');return {data:{session},error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://spvksnddzyvycfoefrcf.supabase.co',staging:false},isAuthConfigured:true}));
mock.module('@/lib/nativeBillingRuntime',()=>({nativeBilling:null}));
mock.module('@/lib/normalFreeRuntime',()=>({currentNormalFreeSessionId:async()=>mode==='missing-session'?null:serverSession,requestNormalFree:async()=>Response.json({status:'ended'})}));
mock.module('@/lib/normalResultsRuntime',()=>({normalResults:{resume(){},suspend(){},claimGuest:async(id:string,token:string)=>{assert.equal(id,serverSession);assert.equal(token,'synthetic-guest-token');claims++;serverClaimed=true;checkpoint('claim-before-ack');return id;}}}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, identifyPurchasesUser:async()=>null}));
mock.module('react-native',()=>({Platform:{OS:'ios'},AppState:{addEventListener:()=>({remove(){}})}}));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {AuthProvider,useAuth}=await import('../providers/auth');
const client=new QueryClient();let account:any;
const Probe=()=>{account=useAuth();return null;};let root:any;
await act(async()=>{root=create(React.createElement(QueryClientProvider,{client},React.createElement(AuthProvider,null,React.createElement(Probe))));});
for(let i=0;i<30&&account.isAuthLoading;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
assert.equal(account.isAuthLoading,false);
if(resume){
 assert.equal(account.user.id,accountId);assert.equal(account.restoredGuestContinuationId,'synthetic-run');
 assert.ok(await account.practiceOwner.storage.getItem(slot),'consented local copy is preserved');
 assert.ok(account.continuationIssue.includes('server has not been confirmed'),'local receipt must not claim a server save');
 assert.equal(claims,0,'cold restore must not invent or silently replay a server claim');
 const hasRetry=[...secure.keys()].some(k=>k.startsWith('beforeyousayit.normal.result-claim-retry.v1:'));
 assert.equal(hasRetry,mode!=='auth-before-retry','existing durable claim retry survives where it was actually written');
 if(hasRetry){let confirmed=false;await act(async()=>{confirmed=await account.retryCurrentGuestResultClaim();});assert.equal(confirmed,true);assert.equal(claims,1);assert.equal(account.continuationIssue,'');}
 console.log('PASS crash recovery: local copy truthful; existing protected retry reused only on explicit action');
}else{
 const source=account.practiceOwner.storage;
 await source.setItem(slot,JSON.stringify({id:'synthetic-run'}));await account.beginCurrentGuestPractice(source,'synthetic-run');
 const result=JSON.stringify({id:'synthetic-run',attemptOne:{transcript:'Synthetic approved words'},sharedResult:{overall:null},freeJourneyCheckpoint:'starting_index'});
 await account.stageCurrentGuestAssessment(source,'synthetic-run',result);await source.setItem(slot,result);
 await act(async()=>{await account.sealCurrentGuestPractice(source,'synthetic-run');});
 assert.equal(disk.size,0,'ordinary guest content is not durable');
 // Deliberately do not stage the React-ref claim: exercise the existing journal fallback.
 let outcome:any;await act(async()=>{outcome=await account.login('a@invalid','synthetic-password',true);});
 assert.equal(outcome.success,true);assert.equal(outcome.continuationProblem,true);
 assert.ok(account.continuationIssue.length>0,'missing claim ID or retry-write failure must have visible explanation');
 assert.equal(claims,mode==='missing-session'?0:1);
 console.log('PASS explicit save failure is not presented as confirmed server ownership');
}
await act(async()=>root.unmount());client.clear();
