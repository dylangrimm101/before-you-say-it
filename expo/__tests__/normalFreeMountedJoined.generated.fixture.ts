import {mock} from 'bun:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
const web='/Users/donaldgrimm/bysi-testflight-foundation/artifacts/native-free-release-20260909/source';
const {PGlite}=createRequire('/Users/donaldgrimm/bysi-testflight-foundation/artifacts/native-free-release-20260909/test-deps/package.json')('@electric-sql/pglite');const db=new PGlite();
const origin='https://beforeyousayit.app',authOrigin='https://spvksnddzyvycfoefrcf.supabase.co',owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,aud:'authenticated',role:'authenticated',email:'synthetic@invalid',is_anonymous:false,email_confirmed_at:'2026-01-01',created_at:'2026-01-01',app_metadata:{},user_metadata:{}};
const token=[{alg:'HS256',typ:'JWT'},{sub:owner,exp:Math.floor(Date.now()/1000)+3600},'synthetic'].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
let authReads=0,providerCalls=0;const verifiedTokens:string[]=[];
const authFetch=async(url:any,init:any)=>{authReads++;if(String(url).includes('/token'))return Response.json({access_token:token,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user});verifiedTokens.push(new Headers(init.headers).get('authorization')??'');return Response.json(user);};
const sdk=createClient(authOrigin,'synthetic-public',{global:{fetch:authFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
assert.equal((await sdk.auth.signInWithPassword({email:user.email,password:'synthetic-only-password'})).error,null);
await db.exec('create role anon;create role authenticated;create role service_role;create role bysi_native_service;');await db.exec(readFileSync(web+'/server/native-free/schema.sql','utf8'));await db.exec('set role bysi_native_service');
const {createServerClients}=await import(web+'/server/revenuecat/http.mjs');const verify=createServerClients({authOrigin,publicKey:'synthetic-public',revenueCatKey:'unused',fetch:authFetch});
const runtime={origin,key:'a'.repeat(64),verifyOwner:verify.verifyOwner,rpc:async(owner:string,input:any)=>(await db.query('select public.bysi_native_free($1::uuid,$2::jsonb) value',[owner,input])).rows[0].value};
mock.module(web+'/server/native-free/runtime.mjs',()=>({getFreeRuntime:()=>runtime}));
const mounts:Record<string,any>={};for(const op of ['session','generate','tts','transcribe'])mounts[op]=(await import(web+'/app/api/native/free/'+op+'/route.js')).POST;
const {NextRequest}=await import(web+'/node_modules/next/server.js');
import {FreeAcquisitionSafetyError} from '../lib/freeAcquisitionOutcome';
import {plugin} from 'bun';
import React from 'react';
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
const auth=sdk.auth;
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:authOrigin,staging:false},isAuthConfigured:true}));
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

process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN=origin;delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;process.env.ANTHROPIC_API_KEY='synthetic';
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>secureDisk.get(k)??null,setItemAsync:async(k:string,v:string)=>{secureDisk.set(k,v);}}));
mock.module('expo-crypto',()=>({randomUUID,getRandomBytes:randomBytes,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
const outputMode=process.argv[2]??'insufficient';const {fixture}=await import(web+'/tests/fixtures/generation-output.mjs');
let loseResult=outputMode==='recovery';
const seenOperations:string[]=[];
globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).startsWith(origin+'/api/native/free/')){const op=String(url).split('/').at(-1)!;seenOperations.push(op);const r=await mounts[op](new NextRequest(url,init));if(loseResult&&op==='generate'&&JSON.parse(init.body).type==='free_rehearsal_result'&&r.ok){loseResult=false;throw Error('Synthetic response lost after durable result commit');}return r;}
 assert.equal(String(url),'https://api.anthropic.com/v1/messages');providerCalls++;const body=JSON.parse(JSON.parse(init.body).messages[0].content);
 const full=fixture();full.pressure_moment.ask_quote=body.transcript.user_turn_1;full.pressure_moment.pushback_quote=body.transcript.counterpart_pushback;full.pressure_moment.response_quote=body.transcript.user_turn_2;
 const output=body.turn?{mode:'turn',turn:body.turn,role:'adam',text:body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'I am already stretched with the client work. Which priority should wait?',safety:null}:outputMode!=='insufficient'?full:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'No supported score in this fixture.',next_step:'Use typed practice.'}};
 return Response.json({id:'msg_synthetic_'+providerCalls,model:'synthetic-fixture',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
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

try{
 await mount(Onboarding);assert.equal(account.user.id,owner);
 await press('I know what I want to get better at');await press(DESIRED_SKILLS[0].label);await press(PRESSURE_CONDITIONS[0].label);await press('Work');
 assert.equal(route.pathname,'/rehearse/[id]');params={...route.params};const runId=store.activePracticeSession.id;
 await mount(Rehearse);await press('Start my rehearsal');await press('Type this turn instead');
 for(const line of ['Can we choose one task?','Which one comes first?']){
  await act(async()=>root.root.findAllByType('input').find((n:any)=>n.props.accessibilityLabel==='Type your line').props.onChangeText(line));await press('Send your line');
 }
 await press('Review complete transcript');await press('Approve transcript');
 if(outputMode==='recovery'){
  const {getConversionBuild}=await import('../lib/conversionBuild');
  for(let i=0;i<100&&!getConversionBuild(runId)?.error;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
  assert.ok(getConversionBuild(runId)?.error);params={id:runId};await mount(Debrief);await press('Recover my result');
 }
 for(let i=0;i<100&&!['pressure_moment','insufficient_evidence'].includes(store.activePracticeSession?.freeJourneyCheckpoint);i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
 assert.equal(providerCalls,3);assert.equal(store.activePracticeSession.freeJourneyCheckpoint,outputMode!=='insufficient'?'pressure_moment':'insufficient_evidence');
 params={id:runId};await mount(Debrief);
 if(outputMode!=='insufficient'){
  assert.ok(text().includes('You asked for a task.'));assert.ok(store.activePracticeSession.sharedResult);
  await press('See what changes with practice');await press('See the practice plan');await press('Review monthly subscription');assert.equal(route.pathname,'/paywall');
 }else{assert.ok(text().includes('Synthetic insufficient evidence'));assert.equal(store.activePracticeSession.sharedResult,undefined);assert.equal(store.scoredPracticeHistory.length,0);await press('Back to today');}
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from bysi_native_free.session')).rows[0].n,1);assert.deepEqual(seenOperations,outputMode==='recovery'?['session','generate','generate','generate','generate']:['session','generate','generate','generate']);
 console.log('PASS JOINED ACTUAL Auth SDK + mounted Auth/Store/onboarding/rehearsal/debrief + Next mounts + restricted SQL + private producer; '+outputMode+'; synthetic Auth/provider/native hosts, typed-first, no live/device claims');
}finally{if(root)await act(async()=>root.unmount());client.clear();sdk.auth.stopAutoRefresh();await db.close();}
