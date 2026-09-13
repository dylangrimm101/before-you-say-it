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
const durableMode=true;
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
const auth={getSession:async()=>{if(process.env.BYSI_GUEST_COLD_REFRESH==='1'&&!coldRefreshSent){coldRefreshSent=true;await Promise.resolve();for(const cb of listeners)cb('TOKEN_REFRESHED',session);}return {data:{session},error:null};},getUser:async()=>({data:{user:process.env.BYSI_GUEST_DENIAL==="wrong-owner"?{...session?.user,id:"wrong-owner"}:process.env.BYSI_GUEST_DENIAL==="expired"?null:session?.user??null},error:process.env.BYSI_GUEST_DENIAL==="expired"?Error("synthetic expired access"):null}),onAuthStateChange:(cb:any)=>{listeners.add(cb);return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},signUp:async()=>({data:{session:null,user:null},error:null}),resend:async()=>({error:null}),signInAnonymously:async()=>{anonymousCalls++;throw Error('anonymous rollout must remain disabled');},signInWithPassword:async()=>{if(process.env.BYSI_GUEST_DENIAL==='cancel')await loginGate;if(process.env.BYSI_GUEST_DENIAL==='login-retry'&&!failedLogin){failedLogin=true;return {data:{session:null},error:Error('synthetic network failure')};}abrupt('consent');session={user:{id:'registered-A',email:'a@invalid',is_anonymous:false},access_token:'fixture-A'};for(const cb of listeners)cb('SIGNED_IN',session);abrupt('auth');return {data:{session},error:null};},signOut:async()=>{session=null;for(const cb of listeners)cb('SIGNED_OUT',null);return {error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://production.invalid',staging:false},isAuthConfigured:true}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));
mock.module('@/components/ScenarioPaidPractice',()=>({ScenarioPaidPractice:()=>{throw Error('not the free onboarding branch');}}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false})}));
const producedTerminal=process.env.BYSI_TERMINAL_RESULT_FILE?JSON.parse(readFileSync(process.env.BYSI_TERMINAL_RESULT_FILE,'utf8')):null;
const continuation=process.env.BYSI_CURRENT_GUEST_CONTINUATION==='1';
const positive=true;
const syntheticGenerated={analysis:{mode:'result',starting_index:{overall:process.env.BYSI_GUEST_DENIAL==='nullable'?null:0,observed_dimensions:[{name:'Clarity',score:process.env.BYSI_GUEST_DENIAL==='nullable'?12.75:0,evidence:'Synthetic exact observed evidence.'}],unobserved_dimensions:['Specificity','Steadiness','Listening','Boundaries','Repair']},practice_shift:{headline:'Synthetic exact practice target',practice_target:['Name the owner','Ask for confirmation'],goal_line:'Synthetic exact goal'}},debrief:{headline:'Synthetic exact headline',scores:{clarity:0,empathy:0,assertiveness:0,composure:0},wins:['Synthetic exact observation'],flags:[],script:['Can we name one owner for the handoff?'],nextRep:'Synthetic exact next rep'}};
let scenarioBuilds=0;let counterpartCalls=0;let analysisCalls=0;
mock.module('@/lib/ai',()=>({nextCounterpartTurn:async()=>{counterpartCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='turn')throw new FreeAcquisitionSafetyError();return {reply:counterpartCalls===1?'Synthetic counterpart: I still need the current handoff.':'Synthetic counterpart close: I can try, but the deadline remains.',tension:40};},generateDebrief:async()=>{analysisCalls++;if(process.env.BYSI_FREE_TERMINAL_UI==='result')throw new FreeAcquisitionSafetyError();if(process.env.BYSI_GUEST_DENIAL==='secure-full-result')rejectSecureWrites=true;if(positive)return structuredClone(syntheticGenerated);if(producedTerminal)return structuredClone(producedTerminal);return {analysis:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'Synthetic local transport fixture, not a model judgment.',next_step:'Try the rehearsal again.'}},debrief:null};},buildCustomScenario:async()=>{scenarioBuilds++;return {title:'Synthetic builder output',counterpart:'Hope',situation:'Synthetic',goal:'Synthetic',category:'work',opensWith:'user',difficulty:'steady'};},fallbackCustomScenario:()=>{throw Error('unexpected fallback');}}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:(v:any)=>v.ios??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
const icons=['AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'];
mock.module('lucide-react-native',()=>Object.fromEntries(icons.map(i=>[i,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,HeroSurface:Host,MicControl:Host,Thinking:Host,Waveform:Host,Eyebrow:Host,Reveal:Host,Meter:Host,StateDock:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
let route:any=null;let params:any={};const router={replace:(r:any)=>{route=r;},push:(r:any)=>{route=r;},back(){route='BACK';},canGoBack:()=>true,setParams:(p:any)=>{params={...params,...p};}};
mock.module('expo-router',()=>({useRouter:()=>router,useLocalSearchParams:()=>params}));
process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY='appl_synthetic_not_a_key';
mock.module('expo-constants',()=>({ExecutionEnvironment:{StoreClient:'storeClient'},default:{executionEnvironment:'standalone'}}));
const monthly:any={identifier:'$rc_monthly',product:{identifier:'byis_pro_monthly_5',priceString:'$5.00',subscriptionPeriod:'P1M',introPrice:null}};
let purchaseCalls=0,restoreCalls=0;
let providerInfo:any={entitlements:{active:{}}};
mock.module('react-native-purchases',()=>({default:{configure(){},isAnonymous:async()=>false,logIn:async()=>({customerInfo:providerInfo}),logOut:async()=>providerInfo,getCustomerInfo:async()=>providerInfo,getOfferings:async()=>({current:{monthly,annual:null,availablePackages:[monthly]}}),purchasePackage:async(pkg:any)=>{assert.equal(pkg,monthly);purchaseCalls++;providerInfo={entitlements:{active:{pro:{}}}};return {customerInfo:providerInfo};},restorePurchases:async()=>{restoreCalls++;providerInfo={entitlements:{active:{pro:{}}}};return providerInfo;}}}));
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
await mount(Entry);await press('Sign up now');params={mode:'signup'};await mount(Login);
await act(async()=>{root.root.findAllByType('input')[0].props.onChangeText('a@invalid');root.root.findAllByType('input')[1].props.onChangeText('synthetic-password');});
await press('Create account');assert.ok(text().includes('Check your email'));assert.equal(account.user,null);
await press('I confirmed my email — log in');assert.equal(account.user.id,'registered-A');
const {default:AccountPractice}=await import('../app/account-practice');await mount(AccountPractice);await press('Start a new account rehearsal');assert.equal(route,'/onboarding');
params={};await mount(Onboarding);await press('I know what I want to get better at');await press(DESIRED_SKILLS[0].label);await press(PRESSURE_CONDITIONS[0].label);await press('Work');
const rehearsalId=store.activePracticeSession.id;params={...route.params};await mount(Rehearse);
await press('Start my rehearsal');await press('Type this turn instead');
for(const line of ['Synthetic opener: can we agree who owns the handoff?','Synthetic reply: I hear the deadline; can you name an owner?']){
 await act(async()=>root.root.findAllByType('input').find((i:any)=>i.props.accessibilityLabel==='Type your line').props.onChangeText(line));await press('Send your line');
}
await press('Review complete transcript');await press('Approve transcript');
params={id:rehearsalId};await mount(Debrief);await press('See what changes with practice');await press('See the practice plan');await press('Review monthly subscription');
params={...route.params};
const {default:Paywall}=await import('../app/paywall');
await mount(Paywall);await act(async()=>{await new Promise(r=>setTimeout(r,30));});
await press('Continue');await press('Continue');
assert.ok(!text().includes('7 days free'),'no unsupported trial claim');
await press('Subscribe monthly');
assert.equal(purchaseCalls,1);assert.equal(route.pathname,'/purchase-success');
assert.equal((await import('../lib/purchases')).hasPro(client.getQueryData(['rc','customerInfo']) as any),true);
providerInfo={entitlements:{active:{}}};await act(async()=>client.setQueryData(['rc','customerInfo'],providerInfo));
await mount(Paywall);assert.equal(store.activePracticeSession.postRehearsalState,'pay3');await press('Restore purchases');
assert.equal(restoreCalls,1);assert.equal(route.pathname,'/purchase-success');
const savedResult=structuredClone(store.activePracticeSession.sharedResult);
await act(async()=>root.unmount());root=null;params={};await mount(Library);await act(async()=>{await new Promise(r=>setTimeout(r,20));});
assert.equal(account.user.id,'registered-A');assert.deepEqual(store.activePracticeSession.sharedResult,savedResult);
assert.equal(store.access.entitlement,'pro');
const currentLesson=root.root.findAllByType('button').find((n:any)=>n.props.accessibilityLabel?.endsWith('. Current'));assert.ok(currentLesson);await press(currentLesson.props.accessibilityLabel);assert.equal(route.pathname,'/approved-lesson/[lessonId]');assert.equal(route.params.lessonId,'m1-l1');
await act(async()=>root.unmount());client.clear();
console.log('PASS actual RevenueCat hooks + monthly paywall purchase/restore controls with synthetic native SDK; not receipt proof');
