import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {plugin} from 'bun';
// Counterfactual RED uses exact untouched baseline component bytes, no source rollback.
if(process.env.BYSI_BASE_GATE==='1')plugin({name:'baseline-gate-proof',setup(build){build.onLoad({filter:/NativeBillingGate\.tsx$/},()=>({contents:readFileSync('/Users/donaldgrimm/bysi-native-release-tools/account-deletion-build/testflight-integration-20260911/web-access-approved-run/snapshot/Users/donaldgrimm/bysi-testflight-foundation/expo/components/NativeBillingGate.tsx','utf8'),loader:'tsx'}));}});
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=true;
// Explicit retained worker-B source; never the shared live working tree.
const web='/Users/donaldgrimm/bysi-native-release-tools/account-deletion-build/worker-b-build-services-20260911/snapshot/Users/donaldgrimm/Projects/bysi-web-claude-parity';
const require=createRequire('/Users/donaldgrimm/bysi-testflight-foundation/artifacts/native-free-release-20260909/test-deps/package.json');const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();await db.exec(readFileSync(web+'/server/revenuecat/schema.sql','utf8'));
const owner='11111111-1111-4111-8111-111111111111',now=1800000000000;
const sandbox=process.env.BYSI_RC_FIXTURE_SANDBOX==='1';
const secret='synthetic-webhook-authorization-not-live';let session:any=null;const listeners=new Set<any>();const calls:any[]=[];
const user={id:owner,email:'owner@fixture.invalid',is_anonymous:false,email_confirmed_at:'2026-01-01'};
const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session?.user??null},error:null}),onAuthStateChange:(fn:any)=>{listeners.add(fn);return {data:{subscription:{unsubscribe(){listeners.delete(fn);}}}};},signInWithPassword:async()=>{session={user,access_token:'fixture-jwt'};for(const fn of listeners)fn('SIGNED_IN',session);return {data:{session},error:null};},signOut:async()=>{session=null;for(const fn of listeners)fn('SIGNED_OUT',null);return {error:null};}};
const snapshot=()=>({request_date_ms:now,subscriber:{entitlements:{pro:{product_identifier:'byis_pro_monthly_5',expires_date:new Date(now+3600000).toISOString()}},subscriptions:{byis_pro_monthly_5:{store:'app_store',is_sandbox:sandbox,ownership_type:'PURCHASED',refunded_at:null,store_transaction_id:'fixture-tx',expires_date:new Date(now+3600000).toISOString()}}}});
const {createRuntime}=await import(web+'/server/revenuecat/runtime.mjs');
const {createDatabase}=await import(web+'/server/revenuecat/database.mjs');
let lease=Promise.resolve();
const transactionalDatabase=createDatabase({async connect(){const previous=lease;let release!:()=>void;lease=new Promise<void>(r=>release=r);await previous;return {query:(sql:string,params:any[])=>db.query(sql,params),release};}});
const runtime=createRuntime({database:transactionalDatabase,now:()=>now,env:{BYSI_NATIVE_RC_ENVIRONMENT:sandbox?'SANDBOX':'PRODUCTION',BYSI_NATIVE_SANDBOX_OWNER_IDS:sandbox?owner:undefined,BYSI_NATIVE_PAID:'revenuecat-v1',BYSI_NATIVE_ORIGIN:'https://beforeyousayit.app',BYSI_NATIVE_AUTH_ORIGIN:'https://spvksnddzyvycfoefrcf.supabase.co',BYSI_NATIVE_DATABASE_URL:'postgres://fixture:fixture@localhost/fixture?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:secret},fetch:async(url:string,options:any)=>{calls.push(['server',url,options.headers]);return Response.json(url.includes('/auth/')?session?.user??{}:snapshot());}});
mock.module(web+'/server/revenuecat/runtime.mjs',()=>({createRuntime,getRuntime:()=>runtime}));
// The independently deployed webhook now mounts the receiver-only composition,
// not the paid runtime. Exercise its real SQL/projector with the same synthetic
// database and explicit sandbox allowlist; never connect to the fixture URL.
const {createReceiverRuntime}=await import(web+'/server/revenuecat/receiver.mjs');
const receiver=createReceiverRuntime({database:transactionalDatabase,now:()=>now,env:{
 BYSI_REVENUECAT_RECEIVER:'receiver-v1',
 BYSI_NATIVE_DATABASE_URL:'postgres://bysi_native_runtime:fixture-only@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',
 BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:secret,
 BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',
 BYSI_NATIVE_SANDBOX_OWNER_IDS:sandbox?owner:undefined,
},fetch:async()=>Response.json(snapshot())});
assert.ok(receiver);
mock.module(web+'/server/revenuecat/receiver.mjs',()=>({createReceiverRuntime,receiverRoute:(request:Request)=>receiver.webhook(request)}));
const {NextRequest}=await import(web+'/node_modules/next/server.js');
const routes:any={};for(const name of ['identify','access','webhook','generate','tts','transcribe'])routes[name]=(await import(web+'/app/api/native/'+name+'/route.js')).POST;
let slow=false,release:any;
globalThis.fetch=async(url:any,options:any)=>{calls.push(['native',String(url),options.headers]);if(String(url)==='https://api.anthropic.com/v1/messages')return Response.json({id:'fixture-provider',model:'fixture-model',content:[{type:'text',text:JSON.stringify({mode:'turn',turn:'pushback',role:'adam',text:'Everyone has priorities. Why should your work be different?',safety:null})}]});if(String(url).startsWith('https://api.elevenlabs.io/'))return new Response(new Uint8Array([1,2,3]),{headers:{'content-type':'audio/mpeg'}});if(String(url)==='https://api.openai.com/v1/audio/transcriptions')return Response.json({text:'Synthetic approved transcript'});if(slow)await new Promise(r=>release=r);return routes[String(url).split('/').pop()!](new NextRequest(url,options));};
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN='https://beforeyousayit.app';process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY='appl_fixture';
mock.module('@/lib/supabase',()=>({supabase:{auth},isAuthConfigured:true,authEnvironment:{url:'https://spvksnddzyvycfoefrcf.supabase.co',staging:false}}));
const host=(p:any)=>React.createElement('host',p,p.children);
mock.module('react-native',()=>({Platform:{OS:'ios',select:(v:any)=>v.ios},AppState:{addEventListener:()=>({remove(){}})},View:host,Text:host}));
mock.module('expo-constants',()=>({ExecutionEnvironment:{StoreClient:'go'},default:{executionEnvironment:'standalone'}}));
const disk=new Map();mock.module('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:any)=>disk.get(k)??null,setItem:async(k:any,v:any)=>{disk.set(k,v);},getAllKeys:async()=>[...disk.keys()],multiRemove:async()=>{}}}));
mock.module('@/lib/guestContinuationRuntime',()=>({createGuestContinuationRuntime:()=>({durable:false,dispose(){},pending:()=>false,available:()=>false,invalidate:async()=>{},restore:async()=>{}})}));
let rcId='anonymous',sdkPro=false,sequence=0;
const info=()=>({entitlements:{active:sdkPro?{pro:{}}:{}}});
async function event(type='INITIAL_PURCHASE'){
 const r=await routes.webhook(new NextRequest('https://beforeyousayit.app/api/native/webhook',{method:'POST',headers:{authorization:secret},body:JSON.stringify({api_version:'1.0',event:{id:'fixture-'+(++sequence),type,app_id:'appab45402f36',event_timestamp_ms:now+sequence,app_user_id:rcId,original_app_user_id:rcId,aliases:[rcId],environment:sandbox?'SANDBOX':'PRODUCTION',store:'APP_STORE',product_id:'byis_pro_monthly_5',entitlement_ids:['pro'],transaction_id:'fixture-tx',is_family_share:false}})}));assert.equal(r.status,200);
}
let sdkLogoutRelease:(()=>void)|null=null;let holdLogout=false;let sdkLogoutStarted:(()=>void)|null=null;
mock.module('react-native-purchases',()=>({default:{configure(){},getAppUserID:async()=>rcId,isAnonymous:async()=>rcId==='anonymous',getCustomerInfo:async()=>info(),logIn:async(id:string)=>{calls.push(['sdk-login',id]);rcId=id;return {customerInfo:info()};},logOut:async()=>{if(holdLogout){sdkLogoutStarted?.();await new Promise<void>(r=>sdkLogoutRelease=r);}rcId='anonymous';sdkPro=false;return info();},getOfferings:async()=>({}),purchasePackage:async()=>{sdkPro=true;await event();return {customerInfo:info()};},restorePurchases:async()=>{sdkPro=true;await event();return info();}}}));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');const {AuthProvider,useAuth}=await import('../providers/auth');const purchases=await import('../lib/purchases');
let account:any,buy:any,restore:any,isPro=false;
mock.module('@/components/ui',()=>({PrimaryButton:(p:any)=>React.createElement('button',p,p.label)}));
const {NativeBillingGate}=await import('../components/NativeBillingGate');
assert.equal(typeof NativeBillingGate,'function','normal paywall must stop known web buyers before Apple offers');
const Probe=()=>{account=useAuth();buy=purchases.usePurchasePackage();restore=purchases.useRestorePurchases();isPro=purchases.useIsPro();return React.createElement(NativeBillingGate,{onContinue(){},onLogin(){}},React.createElement('apple-offer'));};
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});let root:any;
const tree=()=>React.createElement(QueryClientProvider,{client},React.createElement(AuthProvider,null,React.createElement(Probe)));
await act(async()=>{root=create(tree());});await act(async()=>{assert.equal((await account.login('owner@fixture.invalid','fixture-password')).success,true);});
assert.notEqual(rcId,owner,'SDK must receive the server-issued binding, never Auth ID');
assert.equal((await db.query('select app_user_id from bysi_revenuecat.binding where owner_id=$1',[owner])).rows[0].app_user_id,rcId);
assert.equal(isPro,false);
await act(async()=>{await new Promise(r=>setTimeout(r,25));});
assert.equal(root.root.findAllByType('apple-offer').length,0);
await act(async()=>{root.root.findAllByType('button').find((b:any)=>b.props.label==='I have not subscribed — view Apple offer').props.onPress();});
assert.equal(root.root.findAllByType('apple-offer').length,1);
await act(async()=>{assert.equal((await buy.mutateAsync({product:{identifier:'byis_pro_monthly_5'}})).status,'purchased');});
await act(async()=>{await new Promise(r=>setTimeout(r,25));});assert.equal(isPro,true);
const transport=(await import('../lib/nativeBillingRuntime')).nativeBilling!;
process.env.ANTHROPIC_API_KEY='fixture-no-network';process.env.ELEVENLABS_API_KEY='fixture-no-network';process.env.OPENAI_API_KEY='fixture-no-network';
const {nextCounterpartTurn}=await import('../lib/ai');
const generated=await nextCounterpartTurn({id:'fixture',title:'Priorities',category:'work',counterpart:'Adam',situation:'My manager keeps adding work.',persona:'adam',openingLine:'',opensWith:'user',goal:'Name one priority'} as any,'steady',[{id:'u1',role:'user',text:'Which priority can move before more work is added?',at:now}] as any,undefined,'One clear request','adam','real_conversation',true);
assert.equal(generated.reply,'Everyone has priorities. Why should your work be different?');
assert.equal((await transport.request('tts',{text:generated.reply,role:'adam'})).status,200);
const form=new FormData();form.append('turn','opener');form.append('audio',new Blob(['synthetic audio'],{type:'audio/mp4'}),'fixture.m4a');
assert.equal((await (await transport.request('transcribe',form)).json()).text,'Synthetic approved transcript');
assert.equal((await transport.request('generate',{type:'bad'})).status,400,'paid request reaches actual handler validation after SQL authority');
await event('EXPIRATION');assert.equal(await transport.access(),false);assert.equal((await transport.request('generate',{type:'bad'})).status,403);
await act(async()=>{assert.equal(await restore.mutateAsync(),true);});
await act(async()=>{root.unmount();});await act(async()=>{root=create(tree());});await act(async()=>{await new Promise(r=>setTimeout(r,30));});assert.equal(account.user.id,owner);assert.equal(await transport.access(),true);
holdLogout=true;const logoutBegan=new Promise<void>(r=>sdkLogoutStarted=r);
let logoutPending:any;
await act(async()=>{logoutPending=account.logout();await logoutBegan;});
assert.ok(session,'Auth session still exists while SDK logout is stalled');
const early=await transport.request('access',{},100).then(()=>false,()=>true);
assert.equal(early,true,'logout must suspend new paid requests before the Auth event');
sdkLogoutRelease!();await act(async()=>{await logoutPending;});holdLogout=false;
await act(async()=>{await account.login('owner@fixture.invalid','fixture-password');});
slow=true;const pending=transport.access();const denied=assert.rejects(pending);await new Promise(r=>setTimeout(r,20));await act(async()=>{await account.logout();});release();await denied;slow=false;
assert.equal(isPro,false);assert.ok(calls.some(c=>c[0]==='native'&&c[2].Authorization==='Bearer fixture-jwt'));
rcId=owner;sdkPro=true;
await act(async()=>{assert.equal((await account.login('owner@fixture.invalid','fixture-password')).success,true);});
assert.equal(rcId,owner,'legacy purchased identity stays untouched until explicit restore');
await act(async()=>{await assert.rejects(buy.mutateAsync({product:{identifier:'byis_pro_monthly_5'}}),/existing Apple purchase needs recovery/);});
await act(async()=>{assert.equal(await restore.mutateAsync(),true);});assert.notEqual(rcId,owner);
await event('EXPIRATION');await act(async()=>{await client.invalidateQueries({queryKey:['native','access']});});
await act(async()=>{await new Promise(r=>setTimeout(r,25));});
await act(async()=>{root.root.findAllByType('button').find((b:any)=>b.props.label==='I already subscribed on the web').props.onPress();});
await act(async()=>{await new Promise(r=>setTimeout(r,25));});
assert.ok(JSON.stringify(root.toJSON()).includes('cannot currently verify web billing'));assert.equal(root.root.findAllByType('apple-offer').length,0);
// The warning is the only client presentation hint. Real hooks must consume
// independently reconciled SQL entitlement, not a fabricated query access=true.
assert.equal(client.getQueryData(['native','known-web-buyer',owner]),true);
await act(async()=>{assert.equal(await restore.mutateAsync(),true);});
await act(async()=>{await client.invalidateQueries({queryKey:['native','access']});await new Promise(r=>setTimeout(r,25));});
assert.equal(await transport.access(),true,'actual access route independently reads reconciled SQL authority');
assert.ok(root.root.findAllByType('button').some((b:any)=>b.props.label==='Continue to practice'),'SQL-verified independent entitlement must override mounted web warning');
assert.equal(root.root.findAllByType('apple-offer').length,0,'independently paid owner is not asked to pay again');
await event('EXPIRATION');
await act(async()=>{await client.invalidateQueries({queryKey:['native','access']});await new Promise(r=>setTimeout(r,25));});
assert.equal(await transport.access(),false);
assert.ok(!root.root.findAllByType('button').some((b:any)=>b.props.label==='Continue to practice'),'durable revocation removes mounted continuation');
assert.ok(JSON.stringify(root.toJSON()).includes('cannot currently verify web billing'));
assert.equal(root.root.findAllByType('apple-offer').length,0);
console.log('PASS SQL-authorized mounted gate overrides warning, then durable revocation denies; actual native hooks/Next/PGlite with synthetic Auth/RC/provider and native bridge.');
await act(async()=>root.unmount());await act(async()=>{root=create(tree());});await act(async()=>{await new Promise(r=>setTimeout(r,30));});assert.equal(root.root.findAllByType('apple-offer').length,0,'cold return never automatically displays another Apple offer');
await act(async()=>root.unmount());client.clear();transport.dispose();await db.close();console.log('PASS mounted AuthProvider + real SDK hooks -> NextRequest routes -> real SQL; synthetic Auth/RC only; purchase, restore, revocation, cold remount, slow logout');
