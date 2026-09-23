import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY='appl_synthetic_fixture';
const pendingData=new Map<string,string>();
mock.module('@react-native-async-storage/async-storage',()=>({default:{getItem:async(k:string)=>pendingData.get(k)??null,setItem:async(k:string,v:string)=>{pendingData.set(k,v);},removeItem:async(k:string)=>{pendingData.delete(k);}}}));
mock.module('expo-constants',()=>({default:{executionEnvironment:'standalone'},ExecutionEnvironment:{StoreClient:'expo-go'}}));
mock.module('react-native',()=>({Platform:{OS:'ios',select:(v:any)=>v.ios}}));
let policy=true,allowed=false,claimAllowed=false,claimCalls=0,buyCalls=0,restoreCalls=0,loginCalls=0,mode='success';
let sdkId='$RCAnonymousID:synthetic',boundId='server-issued-a';
let info:any={entitlements:{active:{}}};
const paid=()=>({entitlements:{active:{pro:{productIdentifier:'byis_pro_monthly_5'}}}});
mock.module('@/lib/purchaseFirstPolicy',()=>({purchaseFirstEnabled:true,checkPurchaseFirstPolicy:async()=>policy}));
mock.module('@/lib/trialReminder',()=>({syncTrialReminder:async()=>{}}));
mock.module('@/lib/nativeBillingRuntime',()=>({normalBillingEnabled:true,nativeBilling:{suspend(){},identify:async()=>boundId,access:async()=>allowed,request:async(op:string)=>{assert.equal(op,'claim');claimCalls++;return Response.json({allowed:allowed||claimAllowed});}}}));
mock.module('react-native-purchases',()=>({default:{configure(){},getCustomerInfo:async()=>info,isAnonymous:async()=>sdkId.startsWith('$RCAnonymousID:'),getAppUserID:async()=>sdkId,logOut:async()=>{throw Error('Must not discard anonymous purchase');},logIn:async(id:string)=>{loginCalls++;sdkId=id;return {customerInfo:info,created:true};},purchasePackage:async()=>{buyCalls++;if(mode==='cancel')throw {userCancelled:true};if(mode==='pending')throw {code:'PAYMENT_PENDING'};info=paid();return {customerInfo:info};},restorePurchases:async()=>{restoreCalls++;info=paid();return info;}}}));
const billing=await import('../lib/purchases');
await billing.identifyPurchasesUser(null);
const client=new QueryClient({defaultOptions:{queries:{retry:false},mutations:{retry:false}}});
let pre:any,claim:any,restore:any;function Harness(){pre=billing.usePreAccountPurchase();claim=billing.useClaimPreAccountPurchase();restore=billing.useRestorePurchases();return null;}
let root:any;await act(async()=>{root=create(<QueryClientProvider client={client}><Harness/></QueryClientProvider>);});
const pkg:any={product:{identifier:'byis_pro_monthly_5'}};
// A definitive rejection must not leave an uncertainty lock on the install.
const sdkModule=(await import('react-native-purchases')).default;
const originalBuy=sdkModule.purchasePackage;
sdkModule.purchasePackage=async()=>{throw {code:'3'};};
await act(async()=>{await assert.rejects(pre.mutateAsync({kind:'buy',pkg}));});
assert.equal(pendingData.size,0,'definitively rejected purchase must release retry hint');
sdkModule.purchasePackage=originalBuy;
const originalRestore=sdkModule.restorePurchases;
sdkModule.restorePurchases=async()=>info;
sdkModule.purchasePackage=async()=>{throw {code:'2'};};
await act(async()=>{await assert.rejects(pre.mutateAsync({kind:'buy',pkg}));});
assert.equal(pendingData.size,1,'ambiguous store failure preserves uncertainty');
await act(async()=>{await assert.rejects(pre.mutateAsync({kind:'buy',pkg}));});
sdkModule.purchasePackage=async()=>({customerInfo:paid()});
await act(async()=>assert.equal((await pre.mutateAsync({kind:'recover',pkg})).status,'account_required','explicit recovery can escape an ambiguous failure after restore'));
assert.equal(pendingData.size,0);
sdkModule.purchasePackage=originalBuy;
policy=false;await act(async()=>{await assert.rejects(pre.mutateAsync({kind:'buy',pkg}));});assert.equal(buyCalls,0,'backend readiness required before charging');policy=true;
for(const m of ['cancel','pending']){mode=m;await act(async()=>assert.equal((await pre.mutateAsync({kind:'buy',pkg})).status,m==='cancel'?'cancelled':'pending'));assert.equal(claimCalls,0);}
const pendingCount=buyCalls;await billing.identifyPurchasesUser(null);
await act(async()=>assert.equal((await pre.mutateAsync({kind:'recover',pkg})).status,'pending'));
assert.equal(buyCalls,pendingCount,'known deferred purchase is never redispatched by recovery');
sdkModule.restorePurchases=originalRestore;
await act(async()=>{await assert.rejects(pre.mutateAsync({kind:'buy',pkg}));});assert.equal(buyCalls,pendingCount,'pending purchase survives SDK restart sync without recharging');
// The delayed Apple confirmation becomes visible in a later SDK snapshot.
info=paid();mode='success';await act(async()=>assert.equal((await pre.mutateAsync({kind:'buy',pkg})).status,'account_required'));
assert.equal(client.getQueryData(['native','access']),undefined,'Apple confirmation is not lesson access');
const count=buyCalls;await act(async()=>pre.mutateAsync({kind:'buy',pkg}));assert.equal(buyCalls,count,'completed anonymous purchase cannot charge twice');
await billing.identifyPurchasesUser(null);assert.ok(sdkId.startsWith('$RCAnonymousID:'),'anonymous identity survives restart sync');
assert.equal(await billing.identifyPurchasesUser('owner-a'),null,'ordinary login preserves purchased anonymous identity until explicit linking');
await act(async()=>assert.equal(await restore.mutateAsync(),false));assert.equal(claimCalls,1,'signed-in restore must recover an interrupted pre-account claim');assert.equal(loginCalls,1);assert.equal(client.getQueryData(['native','access']),false);
// Reproduce the installed-device state: SDK is linked, receipt exists, but
// access is false until the server atomically verifies and claims that receipt.
let access:any;function AccessHarness(){access=billing.useNativeServerAccess();return null;}
let accessRoot:any;claimAllowed=true;const claimsBefore=claimCalls;
await act(async()=>{accessRoot=create(<QueryClientProvider client={client}><AccessHarness/></QueryClientProvider>);});
await act(async()=>{await access.refetch();await new Promise(resolve=>setTimeout(resolve,20));});
assert.equal(access.data,true,'routine access must finish the interrupted server claim');
assert.ok(claimCalls>claimsBefore,'server claim—not SDK active status—grants access');
assert.equal(restoreCalls,1,'routine verification must not invoke Apple restore');
assert.equal(buyCalls,count,'routine verification must never buy');
claimAllowed=false;
let denied:any;await act(async()=>{denied=await access.refetch();await new Promise(resolve=>setTimeout(resolve,20));});
assert.equal(denied.isError,true,'active Apple purchase with denied claim must show recovery, not an offer');
await act(async()=>accessRoot.unmount());
allowed=true;await act(async()=>assert.equal(await claim.mutateAsync('owner-a'),'linked'));assert.equal(client.getQueryData(['native','access']),true);assert.equal(buyCalls,count);
boundId='server-issued-b';const previous=loginCalls;await act(async()=>{await assert.rejects(claim.mutateAsync('owner-b'));});assert.equal(loginCalls,previous,'identified active purchase cannot silently move to another owner');
assert.equal(restoreCalls,1);await act(async()=>root.unmount());client.clear();
console.log('PASS purchase-first billing: readiness, cancel/pending, Apple before signup, no duplicate charge, preserved anonymous identity, explicit linking, delayed server access, wrong-owner rejection. SDK and server responses simulated.');
