process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN='https://beforeyousayit.app';
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
const originalNow=Date.now;let now=originalNow();Date.now=()=>now;
let appStateListener:(s:string)=>void=()=>{};
let recovery='start';const requests:any[]=[];
mock.module('@/lib/normalFreeRuntime',()=>({normalFreeRecoveryEnabled:true,currentNormalFreeSessionId:async()=>null,requestNormalFree:async(op:string,body:any)=>{requests.push({op,body});return Response.json({status:recovery,used:false});}}));
mock.module('expo-crypto',()=>({getRandomBytes:()=>Uint8Array.from({length:32},()=>Math.floor(Math.random()*256))}));
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
const {bysiContract,fallbackCustomScenario:localScenario}=await import('../lib/ai');
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
const cold=process.argv.includes('cold');
if(cold){session={user:{id:'synthetic-guest',is_anonymous:true},access_token:'synthetic-guest-token'};disk.set('bysi.owner.v1:'+encodeURIComponent('https://spvksnddzyvycfoefrcf.supabase.co:synthetic-guest')+':cc.activePracticeSession.v1',JSON.stringify({id:'old-visit',topic:'Synthetic old conversation'}));}
let coldRefreshSent=false;
const auth={getSession:async()=>{if(process.env.BYSI_GUEST_COLD_REFRESH==='1'&&!coldRefreshSent){coldRefreshSent=true;await Promise.resolve();for(const cb of listeners)cb('TOKEN_REFRESHED',session);}return {data:{session},error:null};},getUser:async()=>({data:{user:process.env.BYSI_GUEST_DENIAL==="wrong-owner"?{...session?.user,id:"wrong-owner"}:process.env.BYSI_GUEST_DENIAL==="expired"?null:session?.user??null},error:process.env.BYSI_GUEST_DENIAL==="expired"?Error("synthetic expired access"):null}),onAuthStateChange:(cb:any)=>{listeners.add(cb);return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},signInAnonymously:async()=>{anonymousCalls++;session={user:{id:'synthetic-guest',is_anonymous:true},access_token:'synthetic-guest-token'};for(const cb of listeners)cb('SIGNED_IN',session);return {data:{session},error:null};},signInWithPassword:async()=>{if(process.env.BYSI_GUEST_DENIAL==='cancel')await loginGate;if(process.env.BYSI_GUEST_DENIAL==='login-retry'&&!failedLogin){failedLogin=true;return {data:{session:null},error:Error('synthetic network failure')};}abrupt('consent');session={user:{id:'registered-A',email:'a@invalid',is_anonymous:false},access_token:'fixture-A'};for(const cb of listeners)cb('SIGNED_IN',session);abrupt('auth');return {data:{session},error:null};},signOut:async()=>{session=null;for(const cb of listeners)cb('SIGNED_OUT',null);return {error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://spvksnddzyvycfoefrcf.supabase.co',staging:false},isAuthConfigured:true}));
mock.module('@/lib/purchases',()=>({PRO_ENTITLEMENT:'pro',identifyPurchasesUser:async(id:string|null)=>{if(id==='registered-A'&&process.env.BYSI_GUEST_DENIAL==='late-switch'){session={user:{id:'registered-B',email:'b@invalid',is_anonymous:false},access_token:'fixture-B'};for(const cb of listeners)cb('SIGNED_IN',session);}return null;},clearPurchasesIdentity:async()=>{},useIsPro:()=>false,useCustomerInfo:()=>({data:null,isLoading:false}),useOfferings:()=>({data:null,isLoading:false}),usePurchasePackage:()=>({isPending:false,mutateAsync:async()=>{throw Error('no purchase in navigation fixture');}}),useRestorePurchases:()=>({isPending:false,mutateAsync:async()=>false})}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));
mock.module('@/components/ScenarioPaidPractice',()=>({ScenarioPaidPractice:()=>{throw Error('not the free onboarding branch');}}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false})}));
const producedTerminal=process.env.BYSI_TERMINAL_RESULT_FILE?JSON.parse(readFileSync(process.env.BYSI_TERMINAL_RESULT_FILE,'utf8')):null;
const continuation=process.env.BYSI_CURRENT_GUEST_CONTINUATION==='1';
const positive=process.env.BYSI_APP_FIRST_POSITIVE==='1'||continuation||process.argv.includes('repeat');
const syntheticGenerated={analysis:{mode:'result',starting_index:{overall:process.env.BYSI_GUEST_DENIAL==='nullable'?null:0,observed_dimensions:[{name:'Clarity',score:process.env.BYSI_GUEST_DENIAL==='nullable'?12.75:0,evidence:'Synthetic exact observed evidence.'}],unobserved_dimensions:['Specificity','Steadiness','Listening','Boundaries','Repair']},practice_shift:{headline:'Synthetic exact practice target',practice_target:['Name the owner','Ask for confirmation'],goal_line:'Synthetic exact goal'}},debrief:{headline:'Synthetic exact headline',scores:{clarity:0,empathy:0,assertiveness:0,composure:0},wins:['Synthetic exact observation'],flags:[],script:['Can we name one owner for the handoff?'],nextRep:'Synthetic exact next rep'}};
let scenarioBuilds=0;let counterpartCalls=0;let analysisCalls=0;
mock.module('@/lib/ai',()=>({nextCounterpartTurn:async()=>{counterpartCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='turn')throw new FreeAcquisitionSafetyError();return {reply:counterpartCalls===1?'Synthetic counterpart: I still need the current handoff.':'Synthetic counterpart close: I can try, but the deadline remains.',tension:40};},generateDebrief:async()=>{analysisCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='result')throw new FreeAcquisitionSafetyError();if(process.env.BYSI_GUEST_DENIAL==='secure-full-result')rejectSecureWrites=true;if(positive)return structuredClone(syntheticGenerated);if(producedTerminal)return structuredClone(producedTerminal);return {analysis:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'Synthetic local transport fixture, not a model judgment.',next_step:'Try the rehearsal again.'}},debrief:null};},buildCustomScenario:async()=>{scenarioBuilds++;return {title:'Synthetic builder output',counterpart:'Hope',situation:'Synthetic',goal:'Synthetic',category:'work',opensWith:'user',difficulty:'steady'};},bysiContract,fallbackCustomScenario:localScenario}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({AppState:{addEventListener:(_:string,fn:(s:string)=>void)=>{appStateListener=fn;return {remove(){}};}},View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(_title:string,_message:string,buttons:any[]){buttons?.at(-1)?.onPress?.();}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'web',select:(v:any)=>v.web??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
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

async function chooseTrack(){
 await mount(Onboarding);
 if(process.argv.includes('real')){
  await press('I have a conversation I need to prepare for');await press('Work');
  await act(async()=>root.root.findByType('input').props.onChangeText('Synthetic colleague interrupts our handoff discussion.'));
  await press('Continue');await press('Say the request clearly');await press('Gets defensive');
 }else if(process.argv.includes('recurring')){
  await press('The same communication problem keeps happening');await press(RECURRING_PROBLEMS[0].label);await press(DESIRED_SHIFTS[0].label);await press('Work');
 }else{await press('I know what I want to get better at');await press(DESIRED_SKILLS[0].label);await press(PRESSURE_CONDITIONS[0].label);await press('Work');}
}
await mount(Entry);await press('Get started');assert.equal(account.isGuestVisit,true);assert.equal(route,'/onboarding');
await chooseTrack();
assert.equal(route.pathname,'/rehearse/[id]');params={...route.params};
const id=store.activePracticeSession.id;
assert.equal([...disk.values()].some(v=>v.includes(id)),false,'guest conversation stays off disk');
await mount(Rehearse);await press('Start my rehearsal');await press('Type this turn instead');
for(const line of ['Synthetic opener, let us choose a task.','Synthetic reply, which one comes first?']){
 await act(async()=>root.root.findAllByType('input').find((i:any)=>i.props.accessibilityLabel==='Type your line').props.onChangeText(line));
 await press('Send your line');
}
assert.equal(counterpartCalls,2,'both learner turns reach actual screen generation');
assert.ok(!text().includes('Continue your practice'),'no cross-visit recovery maze during second turn');
if(process.argv.includes('repeat')){
 await press('Review complete transcript');await press('Approve transcript');
 for(let i=0;i<30&&!store.activePracticeSession.sharedResult;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
 assert.ok(store.activePracticeSession.sharedResult);
 params={id};await mount(Debrief);
 await mount(Entry);await press('Get started');
 assert.equal(store.activePracticeSession,null,'explicit Get Started clears the completed visit');
 assert.ok(requests.some(r=>r.op==='endVisit'));assert.equal(session.user.id,'synthetic-guest');
 await chooseTrack();assert.notEqual(store.activePracticeSession.id,id);
 params={...route.params};await mount(Rehearse);await press('Start my rehearsal');
 assert.ok(!text().includes('Practice unavailable'));
 await act(async()=>root.unmount());client.clear();Date.now=originalNow;
 console.log('PASS actual completed visit → Get Started → new guest journey, same authentication');process.exit(0);
}
await act(async()=>{appStateListener('background');now+=5*60*1000;appStateListener('active');});
assert.equal(store.activePracticeSession.id,id,'brief interruption retains the visit');
await act(async()=>{appStateListener('background');now+=30*60*1000;appStateListener('active');});
assert.equal(store.activePracticeSession,null,'30 minute absence clears current content');assert.equal(store.profile,null);
assert.equal(session.user.id,'synthetic-guest','authentication identity is retained');assert.equal(anonymousCalls,cold?0:1);
assert.equal([...disk.values()].some(v=>v.includes(id)),false);
await mount(Entry);await press('Get started');
await chooseTrack();
params={...route.params};recovery='resume_required';await mount(Rehearse);
assert.ok(text().includes('Practice unavailable'));assert.ok(!text().includes('Choose your account'));
await press('Back to Get Started');
for(let i=0;i<20&&route!=='/entry';i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
assert.equal(route,'/entry');assert.equal(store.activePracticeSession,null);assert.equal(session.user.id,'synthetic-guest');
await act(async()=>root.unmount());client.clear();Date.now=originalNow;
console.log('PASS actual Auth/Store/Onboarding/Rehearse: two turns, transient interruption, 30-minute visit reset, unchanged auth, content-free disk, recovery escape. Synthetic media/server hosts; not a device or hosted claim.');
