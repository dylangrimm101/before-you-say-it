import {mock} from 'bun:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
const web='/Users/donaldgrimm/bysi-testflight-foundation/artifacts/native-free-release-20260909/source';
const {PGlite}=createRequire('/Users/donaldgrimm/bysi-testflight-foundation/artifacts/native-free-release-20260909/test-deps/package.json')('@electric-sql/pglite');const db=new PGlite();
const origin='https://beforeyousayit.app',authOrigin='https://spvksnddzyvycfoefrcf.supabase.co',owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,aud:'authenticated',role:'authenticated',email:'synthetic@invalid',is_anonymous:false,email_confirmed_at:'2026-01-01',created_at:'2026-01-01',app_metadata:{},user_metadata:{}};
const tokenFor=(id:string)=>[{alg:'HS256',typ:'JWT'},{sub:id,exp:Math.floor(Date.now()/1000)+3600},'synthetic'].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
let authReads=0,providerCalls=0;const verifiedTokens:string[]=[];
let transportUser=user;
const authFetch=async(url:any,init:any)=>{authReads++;if(String(url).includes('/signup'))return Response.json({user,session:null});if(String(url).includes('/logout'))return new Response(null,{status:204});if(String(url).includes('/token'))return Response.json({access_token:tokenFor(transportUser.id),refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:transportUser});verifiedTokens.push(new Headers(init.headers).get('authorization')??'');return Response.json(transportUser);};
const sdk=createClient(authOrigin,'synthetic-public',{global:{fetch:authFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
// Sign in only through mounted customer controls below.
await db.exec('create role anon;create role authenticated;create role service_role;create role bysi_native_service;');await db.exec(readFileSync(web+'/server/native-free/schema.sql','utf8'));await db.exec('set role bysi_native_service');
const {createServerClients}=await import(web+'/server/revenuecat/http.mjs');const verify=createServerClients({authOrigin,publicKey:'synthetic-public',revenueCatKey:'unused',fetch:authFetch});
const runtime={origin,key:'a'.repeat(64),verifyOwner:verify.verifyOwner,rpc:async(owner:string,input:any)=>(await db.query('select public.bysi_native_free($1::uuid,$2::jsonb) value',[owner,input])).rows[0].value};
mock.module(web+'/server/native-free/runtime.mjs',()=>({getFreeRuntime:()=>runtime}));
const mounts:Record<string,any>={};for(const op of ['session','generate','tts','transcribe'])mounts[op]=(await import(web+'/app/api/native/free/'+op+'/route.js')).POST;
const {NextRequest}=await import(web+'/node_modules/next/server.js');

import {plugin} from 'bun';
import React from 'react';

import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=true;
plugin({name:'app-first-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
// Synthetic disk/native hosts; Auth/Store/root and storage codecs remain real.
const disk=new Map<string,string>(),secureDisk=new Map<string,string>();
const raw={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{ks.forEach(k=>disk.delete(k));}};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
let syntheticPro=false;
const auth=sdk.auth;
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:authOrigin,staging:false},isAuthConfigured:true}));
mock.module('@/lib/purchases',()=>({PRO_ENTITLEMENT:'pro',useNativeServerAccess:()=>({data:syntheticPro,isError:false,isPending:false,isFetching:false,refetch:async()=>{}}),identifyPurchasesUser:async()=>null,clearPurchasesIdentity:async()=>{},useIsPro:()=>syntheticPro,useCustomerInfo:()=>({data:null,isLoading:false}),useOfferings:()=>({data:null,isLoading:false}),usePurchasePackage:()=>({isPending:false,mutateAsync:async()=>{throw Error('No purchases in this fixture');}}),useRestorePurchases:()=>({isPending:false,mutateAsync:async()=>false})}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));

mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false}),preparePaidPilotAudio:async()=>false,playPreparedPilotAudio:async()=>{},speakPaidPilotAudio:async()=>{},speakPaidPilotAudioToCompletion:async()=>{}}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),AppState:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){}},ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'web',select:(v:any)=>v.web??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
const icons=['Bookmark','Star','TrendingUp','X','AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'];
mock.module('lucide-react-native',()=>Object.fromEntries(icons.map(i=>[i,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('expo-constants',()=>({default:{expoConfig:{version:'synthetic'}}}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,HeroSurface:Host,MicControl:Host,Thinking:Host,Waveform:Host,Eyebrow:Host,Reveal:Host,Meter:Host,StateDock:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
let route:any='/(tabs)',params:any={},navigate:any;
const router={replace:(r:any)=>{route=r;navigate?.(r);},push:(r:any)=>{route=r;navigate?.(r);},back(){router.replace('/(tabs)');},canGoBack:()=>true,setParams:(p:any)=>{params={...params,...p};}};
function routePath(){return typeof route==='string'?route:route.pathname;}
const Stack=Object.assign(()=>React.createElement(RouterScreen),{Screen:()=>null});
mock.module('expo-router',()=>({Stack,useRouter:()=>router,useLocalSearchParams:()=>params,useGlobalSearchParams:()=>params,useSegments:()=>routePath().split('/').filter(Boolean)}));
mock.module('react-native-gesture-handler',()=>({GestureHandlerRootView:Host}));
mock.module('expo-font',()=>({useFonts:()=>[true,null]}));
mock.module('expo-status-bar',()=>({StatusBar:()=>null}));
mock.module('expo-splash-screen',()=>({preventAutoHideAsync:async()=>{},hideAsync:async()=>{}}));
mock.module('@/components/LaunchExperience',()=>({LaunchExperience:()=>null}));
mock.module('@/components/MigrationNotice',()=>({MigrationNotice:()=>null}));
mock.module('@/components/PaidProductUI',()=>({ProductCard:Host,SectionLabel:Host,StatusPill:Host,PaidHeader:Host}));
mock.module('react-native-webview',()=>({WebView:(p:any)=>React.createElement('webview',p)}));
mock.module('expo-file-system',()=>({File:class {exists=false;delete(){}}}));
mock.module('@/lib/approvedDeckLoader',()=>({loadApprovedDeckHtml:async()=>'<html>synthetic asset host</html>',loadConvertedHandoffDeckHtml:async()=>'<html>synthetic asset host</html>',loadModuleCloseDeckHtml:async()=>'<html>synthetic asset host</html>'}));
mock.module('@/lib/lessonFeedbackService',()=>({submitLessonFeedback:async()=>{throw Error('No external feedback');}}));
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN=origin;delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;process.env.ANTHROPIC_API_KEY='synthetic';
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>secureDisk.get(k)??null,setItemAsync:async(k:string,v:string)=>{secureDisk.set(k,v);}}));
mock.module('expo-crypto',()=>({randomUUID,getRandomBytes:randomBytes,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
const outputMode=process.argv[2]??'positive';const {fixture}=await import(web+'/tests/fixtures/generation-output.mjs');
let loseResult=outputMode==='recovery';
const seenOperations:string[]=[];
globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).startsWith(origin+'/api/native/free/')){const op=String(url).split('/').at(-1)!;seenOperations.push(op);const r=await mounts[op](new NextRequest(url,init));if(loseResult&&op==='generate'&&JSON.parse(init.body).type==='free_rehearsal_result'&&r.ok){loseResult=false;throw Error('Synthetic response lost after durable result commit');}return r;}
 assert.equal(String(url),'https://api.anthropic.com/v1/messages');providerCalls++;const body=JSON.parse(JSON.parse(init.body).messages[0].content);
 const full=fixture();full.pressure_moment.ask_quote=body.transcript.user_turn_1;full.pressure_moment.pushback_quote=body.transcript.counterpart_pushback;full.pressure_moment.response_quote=body.transcript.user_turn_2;
 const output=body.turn?{mode:'turn',turn:body.turn,role:'adam',text:body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'I am already stretched with the client work. Which priority should wait?',safety:null}:outputMode!=='insufficient'?full:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'No supported score in this fixture.',next_step:'Use typed practice.'}};
 return Response.json({id:'msg_synthetic_'+providerCalls,model:'synthetic-fixture',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
const actualAI=await import('../lib/ai');
(globalThis as any).requestAnimationFrame=(cb:any)=>{cb(0);return 1;};
const generated:any[]=[];
function lessonReply(input:any){generated.push(structuredClone(input));return {reply:input.kind==='pushback_one'?"I understand the late handoff caused a scramble, but quarter close has been unusually heavy. What timing would give you enough review time?":"I don't think two late handoffs make this a pattern."};}
mock.module('@/lib/ai',()=>({...actualAI,generateM1L1DynamicReply:async(input:any)=>lessonReply(input),generateApprovedRehearsalDynamicReply:async(input:any)=>lessonReply(input)}));
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
const {default:AccountPractice}=await import('../app/account-practice');
const {default:Paywall}=await import('../app/paywall');
const {default:Lesson}=await import('../app/approved-lesson/[lessonId]');
const {default:LessonRehearsal}=await import('../app/approved-rehearsal/[lessonId]');
const {default:Root}=await import('../app/_layout');
let account:any,store:any,root:any;
const screens:Record<string,any>={'/entry':Entry,'/continue-from-web':Login,'/account-practice':AccountPractice,'/onboarding':Onboarding,'/rehearse/[id]':Rehearse,'/debrief/[id]':Debrief,'/(tabs)':Today,'/(tabs)/library':Library,'/paywall':Paywall,'/approved-lesson/[lessonId]':Lesson,'/approved-rehearsal/[lessonId]':LessonRehearsal};
function RouterScreen(){account=useAuth();store=useStore();const path=routePath();const Screen=screens[path];assert.ok(Screen,'mounted destination '+path);return React.createElement(Screen,{key:JSON.stringify(route)});}
function Harness(){const [location,setLocation]=React.useState(route);navigate=setLocation;route=location;if(typeof route==='string'&&route.startsWith('/debrief/'))route={pathname:'/debrief/[id]',params:{id:route.split('/')[2]}};params=typeof route==='string'?{}:route.params??{};return React.createElement(Root);}
const nodeText=(node:any):string=>typeof node==='string'?node:Array.isArray(node)?node.map(nodeText).join(' '):node&&typeof node==='object'?nodeText(node.children??[]):'';
const text=()=>nodeText(root.toJSON());
async function flush(){await act(async()=>{await new Promise(r=>setTimeout(r,20));});}
async function press(label:string){const b=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label||nodeText(n).includes(label))&&!n.props.disabled);assert.ok(b,`enabled control: ${label} at ${routePath()} ${text().slice(-1500)}`);await act(async()=>{await b.props.onPress();});await flush();}
async function go(r:any){await act(async()=>router.replace(r));await flush();}
async function restart(){await act(async()=>root.unmount());await act(async()=>{root=create(React.createElement(Harness));});await flush();await flush();}

async function message(type:string){await act(async()=>{await root.root.findByType('webview').props.onMessage({nativeEvent:{data:JSON.stringify({type})}});});await flush();}
async function input(value:string){assert.equal(root.root.findAllByType('input').length,1);await act(async()=>root.root.findByType('input').props.onChangeText(value));await press('Review typed transcript');}

try{
 await act(async()=>{root=create(React.createElement(Harness));});await flush();await flush();
 assert.equal(routePath(),'/entry');assert.equal(account.user,null);
 await press('Get started');assert.equal(routePath(),'/continue-from-web');
 await act(async()=>{const inputs=root.root.findAllByType('input');inputs[0].props.onChangeText(user.email);inputs[1].props.onChangeText('synthetic-only-password');});
 await press('Create account');assert.ok(text().includes('Check your email'));assert.equal(account.user,null);
 await press('I confirmed my email — log in');await flush();assert.equal(account.user.id,owner);assert.equal(routePath(),'/account-practice');
 await press('Start a new account rehearsal');assert.equal(routePath(),'/onboarding');
 await press('I know what I want to get better at');await press(DESIRED_SKILLS[0].label);await press(PRESSURE_CONDITIONS[0].label);await press('Work');
 assert.equal(route.pathname,'/rehearse/[id]');const runId=store.activePracticeSession.id;
 assert.equal(routePath(),'/rehearse/[id]');await press('Start my rehearsal');await press('Type this turn instead');
 for(const line of ['Can we choose one task?','Which one comes first?']){
  await act(async()=>root.root.findAllByType('input').find((n:any)=>n.props.accessibilityLabel==='Type your line').props.onChangeText(line));await press('Send your line');
 }
 await press('Review complete transcript');await press('Approve transcript');
 if(outputMode==='recovery'){
  const {getConversionBuild}=await import('../lib/conversionBuild');
  for(let i=0;i<100&&!getConversionBuild(runId)?.error;i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
  assert.ok(getConversionBuild(runId)?.error);await go({pathname:'/debrief/[id]',params:{id:runId}});await press('Recover my result');
 }
 for(let i=0;i<100&&!['pressure_moment','insufficient_evidence'].includes(store.activePracticeSession?.freeJourneyCheckpoint);i++)await act(async()=>{await new Promise(r=>setTimeout(r,5));});
 assert.equal(providerCalls,3);assert.equal(store.activePracticeSession.freeJourneyCheckpoint,outputMode!=='insufficient'?'pressure_moment':'insufficient_evidence');
 await go({pathname:'/debrief/[id]',params:{id:runId}});
 if(outputMode!=='insufficient'){
  assert.ok(text().includes('You asked for a task.'));assert.ok(store.activePracticeSession.sharedResult);
  await press('See what changes with practice');await press('See the practice plan');await press('Review monthly subscription');assert.equal(routePath(),'/paywall');
  // Explicit synthetic server admission; no receipt or user benefit is created.
  syntheticPro=true;await restart();await press('Continue to practice');
  assert.equal(routePath(),'/(tabs)/library','verified normal access must leave earned result for the library');
  const id='m1-l1',entry:any={steps:[]};
  const {approvedLessonDeck}=await import('../constants/approvedLessons');
  const deck=approvedLessonDeck(id)!;
  const lessonButton=root.root.findAllByType('button').find((b:any)=>b.props.accessibilityLabel?.startsWith(deck.shortName+'. '));
  assert.ok(lessonButton,'library actual first lesson control');await act(async()=>lessonButton.props.onPress());await flush();
  assert.equal(routePath(),'/approved-lesson/[lessonId]');assert.equal(params.lessonId,id);
 const {M1_L1_CONVERSION:config}=await import('../lib/convertedLesson');
 await message('start-rehearsal');const runId=store.activeScenarioRun.run.id;
 assert.equal(store.activeScenarioRun.run.scenarioContext.situation,config.scenario.situation);
 assert.equal(store.activeScenarioRun.run.counterpartIdentity,config.counterpartId);
 entry.canonicalSceneSha256=createHash('sha256').update(config.scenario.situation).digest('hex');entry.counterpart={id:config.counterpartId,name:store.activeScenarioRun.run.scenarioContext.counterpartName,role:store.activeScenarioRun.run.scenarioContext.counterpartRole};
 assert.equal(text().split(config.scenario.situation).length-1,1);entry.steps.push('canonical scene and counterpart identity');
 const opener=`I want to discuss ${config.scenario.title}.`;const response='There is also another issue and several more examples to discuss.';const retry=`I am asking for one thing: ${config.scenario.goal}`;
 const before=generated.length;await input(opener);assert.equal(generated.length,before);await press('Approve this transcript');
 assert.equal(store.activeScenarioRun.run.state,'ready_for_response','approved lesson state');assert.equal(generated.at(-1).scenario.situation,config.scenario.situation);assert.equal(generated.at(-1).approvedTranscript,opener);
 const pressure=store.activeScenarioRun.run.counterpartTurn;
 await restart();assert.equal(store.activeScenarioRun.run.id,runId);assert.deepEqual(store.activeScenarioRun.run.counterpartTurn,pressure);entry.steps.push('approved opener → simulated counterpart one','cold owner-store remount preserves exact pressure');
 await input(response);await press('Approve this transcript');assert.equal(store.activeScenarioRun.run.state,'hope_coaching','approved lesson state');
 assert.equal(generated.at(-1).approvedTranscript,response);
 entry.steps.push('approved response → simulated counterpart two');
 if(id!=='m1-l1'){assert.ok(text().includes('Assessment unavailable'));assert.equal(store.activeScenarioRun.run.coachingObservation,undefined);await press(`Retry the same ${store.activeScenarioRun.run.scenarioContext.counterpartName} moment`);entry.assessment='not_assessed';}
 else {await press(store.activeScenarioRun.run.m1L1.coachedBeat===1?'Reset to the top of the scene':'Replay the exact flagged pressure');entry.assessment='existing local heuristic, not provider quality';}
 if(store.activeScenarioRun.run.state==='replay_pending')await press('I read the exact pressure');
 assert.equal(store.activeScenarioRun.run.state,'ready_for_retry');await input(retry);await press('Approve this transcript');assert.equal(store.activeScenarioRun.run.state,'attempt_comparison');
 const comparison=structuredClone(store.activeScenarioRun.run.comparison);const comparedRun=structuredClone(store.activeScenarioRun.run);await restart();assert.deepEqual(store.activeScenarioRun.run,comparedRun,'all persisted attempts, counterpart IDs/text, replay and coaching/comparison survive remount');assert.equal(store.activeScenarioRun.run.id,runId);assert.deepEqual(store.activeScenarioRun.run.comparison,comparison);assert.equal(store.activeScenarioRun.run.retryAttempt.transcript,retry);
 entry.steps.push('same-moment replay/text acknowledgement','approved retry → comparison','comparison remount exact persistence');
 await press('See my results');
 await press('Done — back to Home');assert.ok(store.convertedLessonProgress.some((p:any)=>p.lessonId===id));assert.equal(store.activeScenarioRun,null);if(id!=='m1-l1')assert.ok(!store.scoredPracticeHistory.some((record:any)=>record.rehearsalId===runId),'unassessed lesson never fabricates scored history');
 entry.steps.push('return to actual completion component','finish → private run deletion → durable progress');
 await go({pathname:'/approved-lesson/[lessonId]',params:{lessonId:id}});await restart();assert.ok(store.convertedLessonProgress.some((p:any)=>p.lessonId===id));assert.ok(!text().includes(opener));entry.steps.push('completed lesson revisit without private transcript');entry.status='component-local';entry.liveSemanticStatus=id==='m1-l2'?'NO-GO: unresolved Ravi attribution; offline fixtures do not cure it':'not verified';
  await go('/(tabs)');assert.equal(routePath(),'/(tabs)');
  const progress=structuredClone(store.convertedLessonProgress);await restart();assert.deepEqual(store.convertedLessonProgress,progress);assert.equal(progress.length,1);
  assert.equal(new Set(progress.map((p:any)=>p.lessonId)).size,1);
  const oldOwner=account.practiceOwner;await go('/entry');await press('Sign out');await flush();
  assert.equal(account.user,null);assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activeScenarioRun,null);assert.equal(oldOwner.storage.isActive(),false);
  transportUser={...user,id:'22222222-2222-4222-8222-222222222222',email:'second@invalid'};
  await press('I already have an account');await act(async()=>{const fields=root.root.findAllByType('input');fields[0].props.onChangeText(transportUser.email);fields[1].props.onChangeText('synthetic-only-password');});
  await press('Log in');await flush();assert.equal(account.user.id,transportUser.id);assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await restart();assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await go('/entry');await press('Sign out');transportUser=user;await press('I already have an account');await act(async()=>{const fields=root.root.findAllByType('input');fields[0].props.onChangeText(user.email);fields[1].props.onChangeText('synthetic-only-password');});await press('Log in');await flush();
  assert.deepEqual(store.convertedLessonProgress,progress);assert.equal(store.activeScenarioRun,null);
  console.log('PASS joined first lesson: library control → approved transcripts → counterpart → retry/comparison → completion → root cold owner hydration; synthetic paid admission/replies only');

 }else{assert.ok(text().includes('Synthetic insufficient evidence'));assert.equal(store.activePracticeSession.sharedResult,undefined);assert.equal(store.scoredPracticeHistory.length,0);await press('Back to today');}
 await db.exec('reset role');assert.equal((await db.query('select count(*)::int n from bysi_native_free.session')).rows[0].n,1);assert.deepEqual(seenOperations,outputMode==='recovery'?['session','generate','generate','generate','generate']:['session','generate','generate','generate']);
 console.log('PASS JOINED ACTUAL Auth SDK + mounted Auth/Store/onboarding/rehearsal/debrief + Next mounts + restricted SQL + private producer; '+outputMode+'; synthetic Auth/provider/native hosts, typed-first, no live/device claims');
}finally{if(root)await act(async()=>root.unmount());sdk.auth.stopAutoRefresh();await db.close();}



