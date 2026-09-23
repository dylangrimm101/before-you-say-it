import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).__DEV__=false;
plugin({name:'app-root-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const Host=(p:any)=>React.createElement('host',p,p.children);
let store:any={hydrated:true,profile:null,activePracticeSession:null,nativeJourneyStarted:false,migrationNotice:false,dismissMigrationNotice(){}};
let account:any={isAuthLoading:false,user:null};
let segments:any[]=[];let redirects:any[]=[];let routeParams:any={};
const router={replace:(r:any)=>redirects.push(r)};
const Stack=Object.assign((p:any)=>p.screenLayout ? p.screenLayout({children:React.createElement('paid-content')}) : React.createElement('paid-content'),{Screen:()=>null});
mock.module('expo-router',()=>({Stack,useRouter:()=>router,useSegments:()=>segments,useGlobalSearchParams:()=>({id:segments[1],...routeParams})}));
mock.module('@/providers/store',()=>({StoreProvider:Host,useStore:()=>store}));
mock.module('@/providers/auth',()=>({AuthProvider:Host,useAuth:()=>account}));
let access:any={data:false,isPending:false,isError:false,isFetching:false,refetch:async()=>{}};
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0,useNativeServerAccess:()=>access}));
mock.module('@/lib/nativeBillingRuntime',()=>({normalBillingEnabled:process.env.BYSI_ACCESS_GATE==='1'}));
mock.module('@/components/AccountAccessStatus',()=>({AccountAccessStatus:(p:any)=>React.createElement('access-status',p)}));
mock.module('react-native',()=>({View:Host,Text:Host,Pressable:Host,Platform:{OS:'web',select:(v:any)=>v.web??v.default}}));
mock.module('react-native-gesture-handler',()=>({GestureHandlerRootView:Host}));
mock.module('expo-font',()=>({useFonts:()=>[true,null]}));
mock.module('expo-status-bar',()=>({StatusBar:()=>null}));
mock.module('expo-splash-screen',()=>({preventAutoHideAsync:async()=>{},hideAsync:async()=>{}}));
mock.module('@/components/LaunchExperience',()=>({LaunchExperience:()=>null}));
mock.module('@/components/MigrationNotice',()=>({MigrationNotice:()=>null}));
const {default:Root}=await import(process.env.BYSI_ACCESS_BASELINE ?? '../app/_layout');
let root:any;
async function visit(path:string){segments=path.split('/').filter(Boolean);redirects=[];await act(async()=>{if(root)root.update(React.createElement(Root));else root=create(React.createElement(Root));});return redirects;}
if(process.env.BYSI_ACCESS_GATE==='1'){
  account={...account,user:{id:'registered-A'}};
  const protectedRoutes=['(tabs)','(tabs)/library','(tabs)/progress','approved-lesson/m1-l1','approved-rehearsal/m1-l1','quick-rep/m1-l1','first-practice','module/1','rehearse/scene','path','custom'];
  for(const path of protectedRoutes){
    assert.deepEqual(await visit(path),[{pathname:'/paywall',params:{source:'access-gate'}}],`unpaid account must not enter ${path}`);
    assert.equal(root.root.findAllByType('paid-content').length,0,'protected children must not mount before access');
  }
  for(const path of ['settings','privacy','safety','delete-account','paywall','continue-from-web'])assert.deepEqual(await visit(path),[]);
  account={...account,restoredGuestContinuationId:'old-result'};store={...store,activePracticeSession:{id:'old-result',sharedResult:{}}};
  assert.deepEqual(await visit('paywall'),[],'legacy result must not bounce paywall back into a gated route');
  account={...account,restoredGuestContinuationId:null};store={...store,activePracticeSession:null};
  for(const state of [{data:undefined,isPending:true},{data:undefined,isError:true},{data:false,isError:true},{data:false,isFetching:true}]){
    access={data:undefined,isError:false,isPending:false,isFetching:false,refetch:async()=>{},...state};
    assert.deepEqual(await visit('(tabs)'),[],'unknown/error must not send a subscriber to checkout');
    assert.equal(root.root.findAllByType('paid-content').length,0);
  }
  let retries=0;access={...access,isFetching:false,isError:true,refetch:async()=>{retries++;}};
  await visit('(tabs)');await act(async()=>root.root.findByType('access-status').props.retry());assert.equal(retries,1);
  for(const fetching of [false,true]){
    access={data:true,isPending:false,isError:false,isFetching:fetching};
    for(const path of protectedRoutes){assert.deepEqual(await visit(path),[]);assert.equal(root.root.findAllByType('paid-content').length,1);}
  }
  assert.deepEqual(await visit('entry'),['/(tabs)']);
  routeParams={source:'account-login'};assert.deepEqual(await visit('answer-onboarding'),['/(tabs)']);
  routeParams={source:'account-return'};assert.deepEqual(await visit('answer-onboarding'),[],'purchase-first claim handoff stays intact');
  // Fresh owner has no inherited query data; AuthProvider clears queries on owner change.
  account={...account,user:{id:'registered-B'}};access={data:undefined,isPending:true};
  assert.deepEqual(await visit('(tabs)'),[]);assert.equal(root.root.findAllByType('paid-content').length,0);
  account={...account,user:null};assert.deepEqual(await visit('(tabs)'),['/entry']);
  await act(async()=>root.unmount());console.log('PASS subscription-only root gate');process.exit(0);
}
assert.deepEqual(await visit('(tabs)'),['/entry'],'fresh installation cannot silently enter paid home');
assert.deepEqual(await visit('entry'),[]);
assert.deepEqual(await visit('continue-from-web'),[]);
for (const started of [false, true]) {
  store = {...store, nativeJourneyStarted: started};
  for (const path of ['privacy', 'safety', 'delete-account']) assert.deepEqual(await visit(path), [], `public ${path} before account/profile; started=${started}`);
}
store = {...store, nativeJourneyStarted: false};
assert.deepEqual(await visit('staging-web-result'),[],'staging route owns its fail-closed gate');
// An interrupted free rehearsal must not capture the account login escape route.
store={...store,profile:{persona:'woman-hope'},nativeJourneyStarted:true,activePracticeSession:{id:'synthetic-run',scenarioId:'synthetic-scene',expectedReaction:'defensive'}};
assert.deepEqual(await visit('continue-from-web'),[],'interrupted onboarding must allow account login');
assert.deepEqual(await visit('(tabs)'),[{pathname:'/rehearse/[id]',params:{id:'synthetic-scene',difficulty:'steady',reaction:'defensive',entry:'onboarding',persona:'woman-hope',practiceSessionId:'synthetic-run'}}]);
store={...store,activePracticeSession:{...store.activePracticeSession,sharedResult:{},freeJourneyCheckpoint:'pressure_moment'}};
assert.deepEqual(await visit('continue-from-web'),[],'unfinished result must allow account login');
assert.deepEqual(await visit('account-practice'),[],'explicit continuity decision must not be swallowed by existing owner work');
assert.deepEqual(await visit('(tabs)'),['/debrief/synthetic-run']);
assert.deepEqual(await visit('privacy'),[]);
assert.deepEqual(await visit('safety'),[]);
store={...store,profile:null,activePracticeSession:null,nativeJourneyStarted:false};
account={...account,user:{id:'registered-A'}};
for(const path of ['(tabs)','(tabs)/library','(tabs)/progress','settings','delete-account','path','privacy'])assert.deepEqual(await visit(path),[],`returning account: ${path}`);
// Release routing must not depend on an optional saved-content endpoint.
store={...store,profile:{persona:'woman-hope'},activePracticeSession:{id:'saved',sharedResult:{},freeJourneyCheckpoint:'result'}};
for(const path of ['saved-result','approved-lesson/m1-l1','approved-rehearsal/m1-l1','quick-rep/m1-l1','path','settings','(tabs)','paywall'])assert.deepEqual(await visit(path),[],`registered result must not intercept ${path} when normalResults is absent`);
store={...store,profile:null,activePracticeSession:null};
let acknowledged='';
account={...account,restoredGuestContinuationId:'device-run',acknowledgeGuestContinuation:async(id:string)=>{acknowledged=id;}};
store={...store,activePracticeSession:{id:'device-run',sharedResult:{},freeJourneyCheckpoint:'complete'}};
assert.deepEqual(await visit('(tabs)'),['/debrief/device-run'],'cold device handoff routes exact result without importing a guest profile');
assert.equal(acknowledged,'','routing alone does not acknowledge presentation');
routeParams={returnTo:'subscription'};
assert.deepEqual(await visit('continue-from-web'),[],'verified login must retain explicit subscription intent during handoff');
assert.equal(acknowledged,'','sign-in form alone does not finish handoff');
routeParams={source:'account-offer'};
assert.deepEqual(await visit('paywall'),[],'verified account can review terms without being sent back to debrief');
assert.equal(acknowledged,'device-run','explicit return after reviewing guest debrief finishes matching owner handoff');
acknowledged='';
routeParams={};
assert.deepEqual(await visit('paywall'),['/debrief/device-run'],'ordinary cold handoff behavior stays unchanged');
assert.deepEqual(await visit('debrief/device-run'),[]);assert.equal(acknowledged,'device-run');
account={...account,restoredGuestContinuationId:undefined};store={...store,activePracticeSession:null};
account={...account,user:null,isAuthLoading:true};
assert.deepEqual(await visit('(tabs)'),[],'do not route before Auth hydration');
await act(async()=>root.unmount());
console.log('PASS actual root navigation: fresh install, interrupted rehearsal/result login escape, returning account, hydration. Router and state hosts are synthetic.');
