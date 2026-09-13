import {FreeAcquisitionSafetyError} from '../lib/freeAcquisitionOutcome';
import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {createHash,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {createGuestContinuationRuntime as actualGuestRuntime} from '../lib/guestContinuationRuntime';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=true;
plugin({name:'app-first-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const disk=new Map<string,string>();
const durableMode=process.env.BYSI_DURABLE_GUEST==='1';
const createNativeGuestRuntime=actualGuestRuntime;
const secureDisk=new Map<string,string>();
let secureAvailable=true;
let rejectSecureWrites=false;
const restartFile=process.env.BYSI_GUEST_RESTART_FILE;
function abrupt(stage:string){
 if(restartFile&&process.env.BYSI_GUEST_STOP_STAGE===stage){writeFileSync(restartFile,JSON.stringify({disk:[...disk],secure:[...secureDisk],session}),{mode:0o600});process.exit(73);}
}
if(durableMode){
 mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,isAvailableAsync:async()=>secureAvailable,getItemAsync:async(k:string,o:any)=>secureDisk.get(o.keychainService+':'+k)??null,setItemAsync:async(k:string,v:string,o:any)=>{if(rejectSecureWrites)throw Error('synthetic device storage full');assert.ok(Buffer.byteLength(v,'utf8')<=2048,'installed SecureStore per-value limit');assert.equal(o.keychainAccessible,4);assert.equal(o.requireAuthentication,false);assert.ok(o.keychainService.startsWith('bysi.guest.handoff.v1.'));secureDisk.set(o.keychainService+':'+k,v);},deleteItemAsync:async(k:string,o:any)=>{secureDisk.delete(o.keychainService+':'+k);}}));
 mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA-256'},randomUUID,digestStringAsync:async(_:string,s:string)=>createHash('sha256').update(s).digest('hex')}));
 mock.module('@/lib/guestContinuationRuntime',()=>({createGuestContinuationRuntime:(host:any,_platform:string,env:string)=>createNativeGuestRuntime(host,'ios',env)}));
}
let failOwnerRead=false;let failedLogin=false;
let releaseLogin:()=>void=()=>{};const loginGate=new Promise<void>(resolve=>{releaseLogin=resolve;});
const raw={getItem:async(k:string)=>{if(failOwnerRead&&k.includes("registered-A")&&k.endsWith("cc.activePracticeSession.v1")){failOwnerRead=false;throw Error("synthetic precommit read failure");}return disk.get(k)??null;},setItem:async(k:string,v:string)=>{if(k.includes('registered-A')&&k.endsWith('cc.activePracticeSession.v1'))abrupt('issued-before');disk.set(k,v);if(k.includes('synthetic-guest')&&k.endsWith('cc.activePracticeSession.v1')&&JSON.parse(v).sharedResult)abrupt('result-after');if(k.includes('registered-A')&&k.endsWith('cc.activePracticeSession.v1'))abrupt('issued-after');},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{ks.forEach(k=>disk.delete(k));}};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
const listeners=new Set<any>();let session:any=null;let anonymousCalls=0;
if(restartFile&&process.env.BYSI_GUEST_RESUME==='1'){
 const saved=JSON.parse(readFileSync(restartFile,'utf8'));for(const [k,v] of saved.disk)disk.set(k,v);for(const [k,v] of saved.secure)secureDisk.set(k,v);session=saved.session;
}
let coldRefreshSent=false;
const auth={getSession:async()=>{if(process.env.BYSI_GUEST_COLD_REFRESH==='1'&&!coldRefreshSent){coldRefreshSent=true;await Promise.resolve();for(const cb of listeners)cb('TOKEN_REFRESHED',session);}return {data:{session},error:null};},getUser:async()=>({data:{user:process.env.BYSI_GUEST_DENIAL==="wrong-owner"?{...session?.user,id:"wrong-owner"}:process.env.BYSI_GUEST_DENIAL==="expired"?null:session?.user??null},error:process.env.BYSI_GUEST_DENIAL==="expired"?Error("synthetic expired access"):null}),onAuthStateChange:(cb:any)=>{listeners.add(cb);return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},signInAnonymously:async()=>{anonymousCalls++;throw Error('anonymous rollout must remain disabled');},signInWithPassword:async()=>{if(process.env.BYSI_GUEST_DENIAL==='cancel')await loginGate;if(process.env.BYSI_GUEST_DENIAL==='login-retry'&&!failedLogin){failedLogin=true;return {data:{session:null},error:Error('synthetic network failure')};}abrupt('consent');session={user:{id:'registered-A',email:'a@invalid',is_anonymous:false},access_token:'fixture-A'};for(const cb of listeners)cb('SIGNED_IN',session);abrupt('auth');return {data:{session},error:null};},signOut:async()=>{session=null;for(const cb of listeners)cb('SIGNED_OUT',null);return {error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://production.invalid',staging:false},isAuthConfigured:true}));
mock.module('@/lib/purchases',()=>({PRO_ENTITLEMENT:'pro',identifyPurchasesUser:async(id:string|null)=>{if(id==='registered-A'&&process.env.BYSI_GUEST_DENIAL==='late-switch'){session={user:{id:'registered-B',email:'b@invalid',is_anonymous:false},access_token:'fixture-B'};for(const cb of listeners)cb('SIGNED_IN',session);}return null;},clearPurchasesIdentity:async()=>{},useIsPro:()=>false,useCustomerInfo:()=>({data:null,isLoading:false}),useOfferings:()=>({data:null,isLoading:false}),usePurchasePackage:()=>({isPending:false,mutateAsync:async()=>{throw Error('no purchase in navigation fixture');}}),useRestorePurchases:()=>({isPending:false,mutateAsync:async()=>false})}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));
mock.module('@/components/ScenarioPaidPractice',()=>({ScenarioPaidPractice:()=>{throw Error('not the free onboarding branch');}}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false})}));
const producedTerminal=process.env.BYSI_TERMINAL_RESULT_FILE?JSON.parse(readFileSync(process.env.BYSI_TERMINAL_RESULT_FILE,'utf8')):null;
const continuation=process.env.BYSI_CURRENT_GUEST_CONTINUATION==='1';
const positive=process.env.BYSI_APP_FIRST_POSITIVE==='1'||continuation;
const syntheticGenerated={analysis:{mode:'result',starting_index:{overall:process.env.BYSI_GUEST_DENIAL==='nullable'?null:0,observed_dimensions:[{name:'Clarity',score:process.env.BYSI_GUEST_DENIAL==='nullable'?12.75:0,evidence:'Synthetic exact observed evidence.'}],unobserved_dimensions:['Specificity','Steadiness','Listening','Boundaries','Repair']},practice_shift:{headline:'Synthetic exact practice target',practice_target:['Name the owner','Ask for confirmation'],goal_line:'Synthetic exact goal'}},debrief:{headline:'Synthetic exact headline',scores:{clarity:0,empathy:0,assertiveness:0,composure:0},wins:['Synthetic exact observation'],flags:[],script:['Can we name one owner for the handoff?'],nextRep:'Synthetic exact next rep'}};
let scenarioBuilds=0;let counterpartCalls=0;let analysisCalls=0;
mock.module('@/lib/ai',()=>({nextCounterpartTurn:async()=>{counterpartCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='turn')throw new FreeAcquisitionSafetyError();return {reply:counterpartCalls===1?'Synthetic counterpart: I still need the current handoff.':'Synthetic counterpart close: I can try, but the deadline remains.',tension:40};},generateDebrief:async()=>{analysisCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='result')throw new FreeAcquisitionSafetyError();if(process.env.BYSI_GUEST_DENIAL==='secure-full-result')rejectSecureWrites=true;if(positive)return structuredClone(syntheticGenerated);if(producedTerminal)return structuredClone(producedTerminal);return {analysis:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'Synthetic local transport fixture, not a model judgment.',next_step:'Try the rehearsal again.'}},debrief:null};},buildCustomScenario:async()=>{scenarioBuilds++;return {title:'Synthetic builder output',counterpart:'Hope',situation:'Synthetic',goal:'Synthetic',category:'work',opensWith:'user',difficulty:'steady'};},fallbackCustomScenario:()=>{throw Error('unexpected fallback');}}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'web',select:(v:any)=>v.web??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
const icons=['AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'];
mock.module('lucide-react-native',()=>Object.fromEntries(icons.map(i=>[i,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('expo-constants',()=>({default:{expoConfig:{version:'synthetic'}}}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,HeroSurface:Host,MicControl:Host,Thinking:Host,Waveform:Host,Eyebrow:Host,Reveal:Host,Meter:Host,StateDock:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
let route:any=null;let params:any={};const router={replace:(r:any)=>{route=r;},push:(r:any)=>{route=r;},back(){route='BACK';},canGoBack:()=>true,setParams:(p:any)=>{params={...params,...p};}};
mock.module('expo-router',()=>({useRouter:()=>router,useLocalSearchParams:()=>params}));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {AuthProvider,useAuth}=await import('../providers/auth');
const {StoreProvider,useStore}=await import('../providers/store');
const {default:Entry}=await import('../app/entry');
const {default:Onboarding}=await import('../app/onboarding');
const {default:Login}=await import('../app/continue-from-web');
const {default:Rehearse}=await import('../app/rehearse/[id]');
const {default:Debrief}=await import('../app/debrief/[id]');
const {default:Today}=await import('../app/(tabs)/index');
const {default:Library}=await import('../app/(tabs)/library');
const {default:Progress}=await import('../app/(tabs)/progress');
const {default:Settings}=await import('../app/settings');
const {default:Path}=await import('../app/path');
const {RECURRING_PROBLEMS,DESIRED_SHIFTS,DESIRED_SKILLS,PRESSURE_CONDITIONS}=await import('../constants/modules');
const {LAUNCH_DECK_IDS}=await import('../lib/launchCurriculum');
let Screen:any=Entry;let screenKey=0;let account:any,store:any;let root:any;
const Probe=()=>{account=useAuth();store=useStore();return React.createElement(Screen,{key:screenKey});};
const client=new QueryClient();
const tree=()=>React.createElement(QueryClientProvider,{client},React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Probe))));
async function mount(next:any){Screen=next;screenKey++;route=null;await act(async()=>{if(root)root.update(tree());else root=create(tree());});}
const text=()=>JSON.stringify(root.toJSON());
async function press(label:string){const b=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label)&&!n.props.disabled);assert.ok(b,`enabled control: ${label}`);await act(async()=>{await b.props.onPress();});await act(async()=>{await new Promise(r=>setTimeout(r,5));});}
await mount(Entry);
if(restartFile&&process.env.BYSI_GUEST_RESUME==='1'){
 const saved=JSON.parse(readFileSync(restartFile,'utf8'));
 const original=saved.disk.find(([k]:string[])=>k.includes('synthetic-guest')&&k.endsWith('cc.activePracticeSession.v1'))[1];
 if(account.session?.user.is_anonymous){
  assert.equal(account.hasCurrentGuestPractice,true);await mount(Login);
  await act(async()=>{root.root.findAllByType('input')[0].props.onChangeText('a@invalid');root.root.findAllByType('input')[1].props.onChangeText('synthetic-password');});
  await press('Sign in to save this result and continue');
 }
 if(process.env.BYSI_GUEST_EXPECT_UNCERTAIN==='1'){
  assert.equal(store.activePracticeSession,null);assert.ok(account.continuationIssue.includes('could not be verified'));
  const {default:Recovery}=await import('../app/account-practice');await mount(Recovery);assert.ok(text().includes('uncertain save'));
 }else{
  assert.deepEqual(JSON.parse(JSON.stringify(store.activePracticeSession)),JSON.parse(original));
  assert.equal(account.restoredGuestContinuationId,store.activePracticeSession.id,'actual Auth publishes only the receipt-verified startup route');
  params={id:store.activePracticeSession.id};await mount(Debrief);if(JSON.parse(original).freeJourneyCheckpoint==='complete')assert.ok(text().includes('Partial Starting Index card'));
  await act(async()=>account.acknowledgeGuestContinuation(store.activePracticeSession.id));assert.equal(account.restoredGuestContinuationId,null);
 }
 for(const [k,v] of saved.disk)if(k.includes('synthetic-guest'))assert.equal(disk.get(k),v);
 assert.equal(analysisCalls,0);assert.equal(account.user.id,'registered-A');
 console.log('PASS durable separate-process native-adapter reconstruction: exact source/checkpoint; synthetic SecureStore, Auth and native hosts, not device evidence');
 await act(async()=>root.unmount());client.clear();process.exit(0);
}
assert.equal(store.profile,null);assert.equal(store.activePracticeSession,null);
await press('Sign up now');
assert.deepEqual(route,{pathname:'/continue-from-web',params:{mode:'signup'}});assert.equal(anonymousCalls,0);
// Explicit existing guest fixture, not a claim that fresh signup is enabled.
await act(async()=>{session={user:{id:'synthetic-guest',is_anonymous:true},access_token:'synthetic-guest-token'};for(const cb of listeners)cb('SIGNED_IN',session);});
await press('Sign up now');assert.equal(route,'/onboarding');assert.equal(store.nativeJourneyStarted,true);
const branches=[
 {id:'real_conversation',entry:'I have a conversation I need to prepare for'},
 {id:'recurring_problem',entry:'The same communication problem keeps happening'},
 {id:'desired_skill',entry:'I know what I want to get better at'},
];
for(const branch of branches){
 await mount(Onboarding);await press(branch.entry);
 if(branch.id==='real_conversation'){
  await press('Work');
  assert.equal(root.root.findAllByType('button').find((b:any)=>b.props.label==='Continue').props.disabled,true);
  await act(async()=>root.root.findByType('input').props.onChangeText('Synthetic: my colleague interrupts the handoff discussion.'));
  await press('Continue');await press('Say the request clearly');await press('Gets defensive');
 }else{
  await press(branch.id==='recurring_problem'?RECURRING_PROBLEMS[0].label:DESIRED_SKILLS[0].label);
  await press(branch.id==='recurring_problem'?DESIRED_SHIFTS[0].label:PRESSURE_CONDITIONS[0].label);
  await press('Work');
 }
 assert.equal(route.pathname,'/rehearse/[id]');assert.equal(route.params.entry,'onboarding');
 assert.equal(store.activePracticeSession.entryRoute,branch.id);
 assert.equal(route.params.practiceSessionId,store.activePracticeSession.id);
 assert.equal(store.activePracticeSession.scenarioSource,branch.id==='real_conversation'?'user_supplied':'approved_authored');
 assert.equal(store.profile.focus,'work');assert.equal(store.scoredPracticeHistory.length,0);assert.equal(store.completed.length,0);
 assert.ok([...disk.values()].some(v=>v.includes(store.activePracticeSession.id)),'actual owner-scoped durable handoff');
}
assert.equal(scenarioBuilds,1,'authored branches do not invoke the custom builder');
const guestRunId=store.activePracticeSession.id;
const rehearsalParams={...route.params};
if(durableMode){await act(async()=>root.unmount());root=null;await mount(Onboarding);assert.equal(store.activePracticeSession.id,guestRunId);}
params=rehearsalParams;await mount(Rehearse);
await press('Start my rehearsal');assert.ok(text().includes('Microphone access is off.'));
await press('Type this turn instead');
assert.ok(root.root.findAllByType('input').length>0,'denied microphone can still enter typed rehearsal');
for(const line of ['Synthetic opener: can we agree who owns the handoff?','Synthetic reply: I hear the deadline; can you name an owner?']){
 await act(async()=>root.root.findAllByType('input').find((i:any)=>i.props.accessibilityLabel==='Type your line').props.onChangeText(line));
 await press('Send your line');
 if(process.env.BYSI_FREE_TERMINAL_UI==='turn'){
  assert.equal((route as any)?.pathname,'/safety');assert.equal(counterpartCalls,1);assert.equal(analysisCalls,0);
  assert.equal(store.scoredPracticeHistory.length,0);assert.equal(store.activePracticeSession.sharedResult,undefined);
  await act(async()=>root.unmount());client.clear();console.log('PASS safety turn routes to reviewed resources without retry or scores');process.exit(0);
 }
}
assert.equal(counterpartCalls,2,'exercise the counterpart pushback and closing reply');
assert.equal(analysisCalls,0,'no analysis before explicit approval');
await press('Review complete transcript');assert.ok(text().includes('Synthetic counterpart close'));
await press('Approve transcript');
if(process.env.BYSI_FREE_TERMINAL_UI==='result'){
 assert.equal((route as any)?.pathname,'/safety');assert.equal(analysisCalls,1);assert.equal(store.scoredPracticeHistory.length,0);
 assert.equal(store.activePracticeSession.sharedResult,undefined);assert.equal(store.activePracticeSession.recommendation,undefined);
 await act(async()=>root.unmount());client.clear();console.log('PASS safety result cancels loading and routes to resources without score/plan');process.exit(0);
}
if(process.env.BYSI_GUEST_DENIAL==='secure-full-result'){
 const key=[...disk.keys()].find(k=>k.includes('synthetic-guest')&&k.endsWith('cc.activePracticeSession.v1'))!;
 const saved=JSON.parse(disk.get(key)!);
 assert.equal(saved.sharedResult?.pressure_moment.headline,syntheticGenerated.debrief.headline,'secure handoff failure must not discard an already generated assessment');
 assert.equal(account.hasCurrentGuestPractice,false,'no plaintext transfer fallback');
 await mount(Login);assert.ok(text().includes('Device handoff is unavailable'),'storage failure must be visible');
 await act(async()=>root.unmount());root=null;rejectSecureWrites=false;await mount(Debrief);
 assert.deepEqual(store.activePracticeSession.sharedResult,saved.sharedResult,'ordinary guest result survives cold hydration');
 assert.equal(account.hasCurrentGuestPractice,false,'old secure proof cannot authorize changed source');
 assert.equal(analysisCalls,1);
 console.log('PASS current-run secure failure preserves assessment without plaintext capability');
 await act(async()=>root.unmount());client.clear();process.exit(0);
}
assert.equal(analysisCalls,1);assert.equal(route,`/debrief/${guestRunId}`);
if(!positive){
assert.equal(store.activePracticeSession.insufficientEvidence.headline,producedTerminal?.analysis.insufficient_evidence.headline??'Synthetic insufficient evidence');
if(producedTerminal)assert.deepEqual(store.activePracticeSession.insufficientEvidence,{headline:producedTerminal.analysis.insufficient_evidence.headline,note:producedTerminal.analysis.insufficient_evidence.note,nextStep:producedTerminal.analysis.insufficient_evidence.next_step});
assert.equal(store.activePracticeSession.sharedResult,undefined);assert.equal(store.scoredPracticeHistory.length,0);
params={id:guestRunId};await mount(Debrief);
assert.ok(text().includes(producedTerminal?.analysis.insufficient_evidence.headline??'Synthetic insufficient evidence'));
if(producedTerminal){assert.ok(text().includes(producedTerminal.analysis.insufficient_evidence.note));assert.equal(store.scoredPracticeHistory.length,0);}
await press('Practice this conversation again');assert.equal(route.pathname,'/rehearse/[id]');
assert.equal(route.params.practiceSessionId,guestRunId,'retry preserves the actual guest run identity');
}else{
 const exact=structuredClone(store.activePracticeSession.sharedResult);
 assert.equal(exact.pressure_moment.headline,syntheticGenerated.debrief.headline);
 assert.equal(exact.starting_index.index_value,syntheticGenerated.analysis.starting_index.overall);assert.equal(exact.signals.find((s:any)=>s.signal_key==='clarity').score,syntheticGenerated.analysis.starting_index.observed_dimensions[0].score);assert.equal(exact.signals.find((s:any)=>s.signal_key==='listening').score,null);
 params={id:guestRunId};await mount(Debrief);
 assert.ok(text().includes(syntheticGenerated.debrief.headline),'positive result must display exact generated headline, not authored judgment');
 await press('See what changes with practice');assert.ok(text().includes(syntheticGenerated.debrief.script[0]));
 await press('See the practice plan');await press('Review monthly subscription');assert.equal((route as any).pathname,'/paywall');
 params={...(route as any).params};const {default:Paywall}=await import('../app/paywall');await mount(Paywall);
 await press('Close offer. Keep my free debrief for now');assert.equal(route,'BACK');
 assert.deepEqual(store.activePracticeSession.sharedResult,exact);
 await mount(Paywall);await press('Log in before purchasing');assert.equal(route,'/continue-from-web');
 assert.deepEqual(store.activePracticeSession.sharedResult,exact);
}
// A cold process loses the ephemeral creation capability: persisted IDs alone
// never promote historical bytes into eligible content.
const guestDiskBeforeLogin=new Map(disk);
const staleGuestSave=store.saveActivePracticeSession;
const exactGuestStored=JSON.parse([...disk].find(([key])=>key.includes("synthetic-guest")&&key.endsWith("cc.activePracticeSession.v1"))![1]);
const exactGuestResult=structuredClone(store.activePracticeSession.sharedResult);
const exactGuestAttempt=structuredClone(store.activePracticeSession.attemptOne);
if(positive&&!continuation){await act(async()=>root.unmount());root=null;}
if(durableMode){await act(async()=>root.unmount());root=null;await mount(Login);assert.equal(account.hasCurrentGuestPractice,true,'secure new-run proof restored after assessment process death');}
await mount(Login);
assert.ok(text().includes(continuation?'current rehearsal':'Guest practice cannot be transferred'),'login must disclose the actual continuation boundary');
if(continuation)assert.ok(text().includes(durableMode?'24 hours':'Keep this browser session open'),'platform-accurate durable continuation support');
if(durableMode){
 const isolated=createNativeGuestRuntime(raw,'ios','different-environment');assert.equal(await isolated.restore(account.practiceOwner.storage),false);isolated.dispose();
 secureAvailable=false;const unavailable=createNativeGuestRuntime(raw,'ios','unavailable');await assert.rejects(unavailable.restore(account.practiceOwner.storage));unavailable.dispose();secureAvailable=true;
}
await press('Back');assert.equal(route,'BACK');assert.equal(store.activePracticeSession.id,guestRunId,'refusal leaves guest work untouched');
await act(async()=>{root.root.findAllByType('input')[0].props.onChangeText('a@invalid');root.root.findAllByType('input')[1].props.onChangeText('synthetic-password');});
if(continuation&&process.env.BYSI_GUEST_DENIAL==='read-retry')failOwnerRead=true;
const ownerSlot=`bysi.owner.v1:${encodeURIComponent('https://production.invalid:registered-A')}:cc.activePracticeSession.v1`;
const conflictingAccountSnapshot=JSON.stringify({...store.activePracticeSession,updatedAt:123456789});
if(continuation&&process.env.BYSI_GUEST_DENIAL==='conflict')disk.set(ownerSlot,conflictingAccountSnapshot);
route=null;await press(continuation?'Sign in to save this result and continue':'Log in');
if(continuation&&process.env.BYSI_GUEST_DENIAL==='cancel'){
 await press('Back');await act(async()=>{releaseLogin();await new Promise(r=>setTimeout(r,5));});
 assert.equal(route,'BACK','cancelled login must not later navigate or attach');
 assert.equal(store.activePracticeSession.id,guestRunId);assert.equal(account.hasCurrentGuestPractice,true);
 assert.equal(disk.has(ownerSlot),false);
 await press('Sign in to save this result and continue');
}
if(continuation&&['late-switch','wrong-owner','expired'].includes(process.env.BYSI_GUEST_DENIAL??'')){
 assert.equal(route,null,'identity change during post-verification purchase sync must refuse success/navigation');
 assert.equal(account.canAttachCurrentGuestPractice,false);
 assert.equal(store.activePracticeSession,null);
 for(const [key,value] of guestDiskBeforeLogin)assert.equal(disk.get(key),value);
 console.log('PASS current-run continuation refuses late account switch through actual AuthProvider');
 await act(async()=>root.unmount());client.clear();process.exit(0);
}
if(continuation&&process.env.BYSI_GUEST_DENIAL==='login-retry'){
 assert.equal(route,null);assert.equal(store.activePracticeSession.id,guestRunId);assert.equal(account.hasCurrentGuestPractice,true);
 await press('Sign in to save this result and continue');
}
assert.equal(account.user.id,'registered-A');
assert.equal(store.profile,null);assert.ok([...disk.values()].some(v=>v.includes(guestRunId)));
const {default:AccountPractice}=await import('../app/account-practice');
if(continuation){
 if(process.env.BYSI_GUEST_DENIAL==='conflict'){
  assert.equal(route,'/account-practice');assert.equal(disk.get(ownerSlot),conflictingAccountSnapshot);
  await mount(AccountPractice);assert.ok(text().includes('already has a rehearsal'));
  assert.equal(account.canAttachCurrentGuestPractice,false);
  for(const [key,value] of guestDiskBeforeLogin)assert.equal(disk.get(key),value);
  console.log('PASS current-run existing-account conflict preserves both source and owned record');
  await act(async()=>root.unmount());client.clear();process.exit(0);
 }
 if(process.env.BYSI_GUEST_DENIAL==='read-retry'){
  assert.equal(route,'/account-practice');assert.equal(store.activePracticeSession,null);assert.equal(account.canAttachCurrentGuestPractice,true);
  await mount(AccountPractice);await press('Retry saving this result');
 }
 assert.equal(route,`/debrief/${guestRunId}`);
 assert.equal(store.activePracticeSession.id,guestRunId);
 assert.deepEqual(JSON.parse(JSON.stringify(store.activePracticeSession)),exactGuestStored,"all serialized current-run fields and checkpoint survive the owner handoff");
 await assert.rejects(staleGuestSave({...exactGuestStored,updatedAt:Date.now()+1000}));
 assert.deepEqual(store.activePracticeSession.sharedResult,exactGuestResult);
 assert.deepEqual(store.activePracticeSession.attemptOne,exactGuestAttempt);
 assert.equal(store.activePracticeSession.userId,undefined,'never invent server owner provenance');
 assert.equal(store.scoredPracticeHistory.length,0,'no historical import');
 assert.equal(store.convertedLessonProgress.length,0,'no completion grant');
 for(const [key,value] of guestDiskBeforeLogin)assert.equal(disk.get(key),value,'source guest bytes remain unchanged');
 params={id:guestRunId};await mount(Debrief);
 assert.ok(text().includes('Partial Starting Index card'),'resume the exact saved complete checkpoint, not replay assessment');
 assert.ok(text().includes('Local user-provided practice'));
 await press('See my practice path');assert.ok(text().includes(exactGuestResult.first_focus.first_focus_label));
 assert.equal(analysisCalls,1,'continuation never replays provider');
 await act(async()=>root.unmount());root=null;await mount(AccountPractice);
 assert.equal(store.activePracticeSession.id,guestRunId,'cold owner hydration restores the exact claimed run');
 assert.deepEqual(store.activePracticeSession.sharedResult,exactGuestResult);
 assert.deepEqual(store.activePracticeSession.attemptOne,exactGuestAttempt);
 assert.equal(account.canAttachCurrentGuestPractice,false,'cold restart cannot replay capability');
 assert.equal(root.root.findAllByType('button').some((b:any)=>b.props.label==='Attach this rehearsal to this account'),false);
 console.log('PASS current-run local continuation: actual producer, approved result, explicit verified login and consent, same attempt/result, cold owner hydration; synthetic Auth/native/storage/AI, no paid/server ownership grant');
 await act(async()=>root.unmount());client.clear();process.exit(0);
}
assert.equal(route,'/account-practice');assert.equal(store.activePracticeSession,null);
await mount(AccountPractice);assert.ok(text().includes('Guest work has not been attached'));
await press('Continue with this account');assert.equal(route,'/(tabs)');
await mount(AccountPractice);await press('Start a new account rehearsal');assert.equal(route,'/onboarding');
assert.equal(store.nativeJourneyStarted,true);assert.equal(store.activePracticeSession,null);assert.equal(store.scoredPracticeHistory.length,0);
if(positive){
 await mount(Onboarding);await press(branches[2].entry);await press(DESIRED_SKILLS[0].label);await press(PRESSURE_CONDITIONS[0].label);await press('Work');
 const accountRun=store.activePracticeSession;assert.ok([...disk].some(([key,value])=>key.includes('registered-A')&&value.includes(accountRun.id)),'new run is persisted under the registered owner lease, not inferred from a record field');assert.notEqual(accountRun.id,guestRunId);assert.equal(accountRun.sharedResult,undefined);
 params={...(route as any).params};await mount(Rehearse);assert.ok(text().includes('Start my rehearsal'));
 await mount(AccountPractice);assert.equal(root.root.findAllByType('button').find((b:any)=>b.props.label==='Start a new account rehearsal').props.disabled,true,'existing account run cannot be overwritten');
 await press('Continue with this account');assert.equal(route,'/(tabs)');assert.equal(store.activePracticeSession.id,accountRun.id);
 const denied=await account.login('b@invalid','synthetic-password');assert.equal(denied.success,false);assert.equal(account.user.id,'registered-A');assert.equal(store.activePracticeSession.id,accountRun.id);
 const {default:PurchaseSuccess}=await import('../app/purchase-success');await mount(PurchaseSuccess);assert.ok(text().includes('Your entitlement is still being confirmed.'));assert.ok(!text().includes('Subscription active'));
}

await mount(Today);assert.ok(text().includes('Today'));await press('View your practice path');assert.deepEqual(route,{pathname:'/(tabs)/library',params:{view:'lessons'}});
await mount(Library);assert.ok(text().includes('Lessons'));assert.equal(LAUNCH_DECK_IDS.filter((id:string)=>!id.endsWith('close')).length,10);
const {approvedLessonDeck}=await import('../constants/approvedLessons');
for(const id of LAUNCH_DECK_IDS){
 const label=`${approvedLessonDeck(id)!.shortName}. ${id==='m1-l1'?'Current':'Up next'}`;
 await press(label);assert.equal(route.pathname,'/paywall');assert.equal(route.params.gate,'program');
}
await act(async()=>store.toggleDevPro(true));
for(const id of LAUNCH_DECK_IDS){
 const label=`${approvedLessonDeck(id)!.shortName}. ${id==='m1-l1'?'Current':'Up next'}`;
 const button=root.root.findAllByType('button').find((b:any)=>b.props.accessibilityLabel===label);
 assert.ok(button);assert.equal(button.props.disabled,id!=='m1-l1');
}
await press(`${approvedLessonDeck('m1-l1')!.shortName}. Current`);
assert.deepEqual(route,{pathname:'/approved-lesson/[lessonId]',params:{lessonId:'m1-l1'}});
assert.equal(store.convertedLessonProgress.length,0,'opening a lesson never completes it');
await act(async()=>store.toggleDevPro(false));
await press('Show scenarios');assert.equal(params.view,'scenarios');await press('Show lessons');assert.equal(params.view,'lessons');
await mount(Path);assert.ok(text().includes('Get to the Point'));
await mount(Progress);assert.ok(text().includes('No Index history yet'));assert.ok(text().includes('No saved records yet'));assert.ok(text().includes('Not observed'));
await press('How the Communication Index works');assert.equal(route,'/progress/how-it-works');await press('Open Settings');assert.equal(route,'/settings');
await mount(Settings);assert.ok(text().includes('a@invalid'));await press('Privacy & data. See what is stored, shared, retained, and deleted');assert.equal(route,'/privacy');
await press('Sign out');assert.equal(account.user,null);assert.equal(store.activePracticeSession,null);assert.equal(store.scoredPracticeHistory.length,0);
await mount(Entry);assert.ok(text().includes('Sign up now'));
await act(async()=>root.unmount());client.clear();
const {approvedRehearsalConfig}=await import('../lib/approvedRehearsals');
console.log('Launch inventory',JSON.stringify(LAUNCH_DECK_IDS.map((id:string)=>({id,title:approvedLessonDeck(id as any)?.shortName,kind:id.endsWith('close')?'module-close':'lesson',rehearsal:id==='m1-l1'||Boolean(approvedRehearsalConfig(id))}))));
console.log(positive?'PASS actual positive generated-result controls, preserved zero/unobserved scores, offer close/login, verified owner restart and existing-run conflict; unpaid purchase-success denied. Synthetic AI/Auth/storage/router, no receipt/provider/device acceptance.':'PASS actual app-first Entry rollout gate; all three onboarding branch handoffs; denied-mic typed two-turn rehearsal, approved transcript, insufficient result and retry; real owner-store login quarantine; Today/Library/Path/Progress/Settings/logout navigation. Synthetic Auth/native/router/storage/custom builder and AI responses; no model, device or purchase acceptance.');
