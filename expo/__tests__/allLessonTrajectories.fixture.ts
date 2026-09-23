import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
const {verifyComponentTestDeps}=await import('../scripts/component-test-deps');
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=true;
const disk=new Map<string,string>([['cc.profile.v1',JSON.stringify({focus:'work',pattern:'freeze',win:'yes',persona:'woman-hope',reaction:'defensive',createdAt:1})]]);
let failCloseWrite=false;
const raw={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{if(failCloseWrite&&v.includes('approved-r2-close-deck')){failCloseWrite=false;throw Error('Synthetic close disk fault');}disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{ks.forEach(k=>disk.delete(k));}};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
const listeners=new Set<any>();const userA={id:'A',email:'a@invalid',is_anonymous:false,email_confirmed_at:'2026-09-01'};
let session:any={user:userA,access_token:'fixture-A'};
const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session?.user??null},error:null}),onAuthStateChange:(cb:any)=>{listeners.add(cb);return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},signOut:async()=>{session=null;for(const cb of listeners)cb('SIGNED_OUT',null);return {error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://pqqxaklcburdxjfeolmd.supabase.co',key:'sb_publishable_fixture',staging:true},isAuthConfigured:true}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, identifyPurchasesUser:async()=>null,clearPurchasesIdentity:async()=>{},useIsPro:()=>true}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));

import {plugin} from 'bun';
plugin({name:'buyer-journey-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const Host=(p:any)=>React.createElement('view',p,p.children);
const Button=(p:any)=>React.createElement('button',p,p.label??p.children);
const alerts:any[]=[]; const appEvents=new Set<any>();
mock.module('react-native',()=>({View:Host,Text:Host,ScrollView:Host,TextInput:(p:any)=>React.createElement('input',p),Pressable:Button,Keyboard:{dismiss(){}},KeyboardAvoidingView:Host,ActivityIndicator:Host,AppState:{addEventListener:(_:any,cb:any)=>{appEvents.add(cb);return {remove(){appEvents.delete(cb);}};}},Platform:{OS:'web',select:(v:any)=>v.web??v.default},StyleSheet:{create:(v:any)=>v,hairlineWidth:1},Alert:{alert(...args:any[]){alerts.push(args);}},Animated:{Value:class {interpolate(){return 0;} setValue(){}},View:Host,Text:Host},Easing:{},Linking:{},AccessibilityInfo:{announceForAccessibility(){}}}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('lucide-react-native',()=>Object.fromEntries(['Bookmark','ShieldCheck','AlertCircle','Check','ChevronDown','Clock3','RefreshCw','RotateCcw','Sparkles','Star','TrendingUp','Mic','Square','X'].map(x=>[x,()=>null])));
mock.module('@/components/ui',()=>({Backdrop:()=>null,Eyebrow:Host,GlassCard:Host,PressCard:Button,PrimaryButton:Button,GhostButton:Button,Reveal:Host,StateDock:Host,Thinking:Host,MicControl:Button,tap(){},useReducedMotion:()=>true}));
mock.module('@/components/PaidProductUI',()=>({ProductCard:Host,SectionLabel:Host,StatusPill:Host}));
mock.module('react-native-webview',()=>({WebView:(p:any)=>React.createElement('webview',p)}));
mock.module('expo-file-system',()=>({File:class {exists=false;delete(){}}}));
mock.module('expo-crypto',()=>({randomUUID:()=>crypto.randomUUID()}));
// Native deck asset and voice hosts are explicit substitutes, not device proof.
mock.module('@/lib/approvedDeckLoader',()=>({loadApprovedDeckHtml:async()=>'<html>canonical asset host substitute</html>',loadConvertedHandoffDeckHtml:async()=>'<html>canonical asset host substitute</html>',loadModuleCloseDeckHtml:async()=>'<html>canonical asset host substitute</html>'}));
mock.module('@/lib/lessonFeedbackService',()=>({submitLessonFeedback:async()=>{throw Error('No external feedback');}}));
const cancel=async()=>{};
const spokenAudit=process.argv.includes('--spoken-audit');
let spokenDraft='',recordStarts=0,recordStops=0;
mock.module('@/lib/useDictation',()=>({useDictation:()=>({status:'idle',cancel,requestPermission:async()=>true,start:async()=>{recordStarts++;return true;},stop:async()=>{recordStops++;return spokenDraft;}})}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},useSpeech:()=>({status:'idle',phase:'idle'}),resetSpeech:cancel,replaySpeech:cancel,unlockAudioPlayback:cancel,preparePaidPilotAudio:async()=>false,playPreparedPilotAudio:cancel,speakPaidPilotAudio:cancel,speakPaidPilotAudioToCompletion:cancel}));


import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
(globalThis as any).requestAnimationFrame=(cb:any)=>{cb(0);return 1;};
const generated:any[]=[];
const quickRepRequests:any[]=[];
function reply(input:any){generated.push(structuredClone(input));return {reply:!input.lessonId?(input.kind==='pushback_one'?"I understand the late handoff caused a scramble, but quarter close has been unusually heavy. What timing would give you enough review time?":"I don't think two late handoffs make this a pattern."):input.lessonId==='m1-l2'?(input.kind==='pushback_one'?"I don't think one late file proves our approval process is broken.":"Does Tuesday's file prove a pattern with final approval?"):input.kind==='pushback_one'?`I still need a clearer answer about ${input.scenario.title}.`:`Why does ${input.scenario.goal.toLowerCase()} follow from that?`};}
mock.module('@/lib/ai',()=>({drillRoundFeedback:async(...args:any[])=>{quickRepRequests.push(args);throw Error('Synthetic unavailable feedback; no provider output');},generateM1L1DynamicReply:async(input:any)=>reply(input),generateApprovedRehearsalDynamicReply:async(input:any)=>reply(input),generateDebrief:async()=>{throw Error('No evaluator in acceptance');},nextCounterpartTurn:async()=>{throw Error('No generic scenario generation');}}));
globalThis.fetch=async()=>{throw Error('External network prohibited');};
let navigate:any,params:any={},location:any={pathname:'/approved-lesson/[lessonId]',params:{lessonId:'m1-l1'}};
const router={replace:(r:any)=>navigate(r),push:(r:any)=>navigate(r),canGoBack:()=>false,back:()=>navigate('/done')};
mock.module('expo-router',()=>({useRouter:()=>router,useLocalSearchParams:()=>params}));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {AuthProvider}=await import('../providers/auth');
const {StoreProvider,useStore}=await import('../providers/store');
const {default:Lesson}=await import('../app/approved-lesson/[lessonId]');
const {default:Rehearsal}=await import('../app/approved-rehearsal/[lessonId]');
const {default:QuickRep}=await import('../app/quick-rep/[lessonId]');
const {LAUNCH_DECK_IDS,nextLaunchDeck}=await import('../lib/launchCurriculum');
const {approvedLessonDeck}=await import('../constants/approvedLessons');
const {approvedRehearsalConfig}=await import('../lib/approvedRehearsals');
const {M1_L1_CONVERSION}=await import('../lib/convertedLesson');
let store:any;
function RouterHost(){store=useStore();const [route,setRoute]=React.useState<any>(location);navigate=(r:any)=>{location=r;setRoute(r);};params=typeof route==='string'?{}:route.params;const path=typeof route==='string'?route:route.pathname;if(!store.hydrated)return null;return React.createElement(path.startsWith('/approved-lesson')?Lesson:path.startsWith('/approved-rehearsal')?Rehearsal:path.startsWith('/quick-rep')?QuickRep:Host,{key:JSON.stringify(route)});}
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const app=()=>React.createElement(QueryClientProvider,{client},React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(RouterHost))));
let root:any;
const flush=()=>act(async()=>{await new Promise(r=>setTimeout(r,15));});
const nodeText=(node:any):string=>typeof node==='string'?node:Array.isArray(node)?node.map(nodeText).join(' '):node&&typeof node==='object'?nodeText(node.children??[]):'';
const text=()=>nodeText(root.toJSON());
const buttons=()=>root.root.findAllByType('button');
const button=(label:string)=>buttons().find((x:any)=>x.props.label===label||x.props.accessibilityLabel===label||nodeText(x).includes(label));
async function press(label:string){const b=button(label);assert.ok(b,`Missing ${label} at ${JSON.stringify(location)} state ${store.activeScenarioRun?.run.state}; buttons ${buttons().map((b:any)=>b.props.label)}`);assert.ok(!b.props.disabled);await act(async()=>{await b.props.onPress();});await flush();}
async function route(r:any){await act(async()=>navigate(r));await flush();}
async function mount(){await act(async()=>{root=create(app());});await flush();await flush();await flush();}
async function restart(){await act(async()=>root.unmount());await mount();}
async function message(type:string){await act(async()=>{await root.root.findByType('webview').props.onMessage({nativeEvent:{data:JSON.stringify({type})}});});await flush();}
async function input(value:string){
 if(spokenAudit){
  spokenDraft=value;const before=recordStarts;
  await press('Start recording');if(button('Allow microphone'))await press('Allow microphone');
  assert.equal(recordStarts,before+1,'Record must start capture exactly once');
  assert.ok(store.activeScenarioRun.run.state.startsWith('listening_'));
  await press('Done speaking');assert.equal(recordStops,recordStarts);
  assert.ok(store.activeScenarioRun.run.state.startsWith('confirm_'));
  assert.equal(root.root.findByType('input').props.value,value,'Stop must present transcript for approval');
  return;
 }
 assert.equal(root.root.findAllByType('input').length,1,`input unavailable: ${text()} run ${store.activeScenarioRun?.run.state}`);await act(async()=>root.root.findByType('input').props.onChangeText(value));await press('Review typed transcript');
}
const ledger:any={schemaVersion:1,evidenceClass:'mounted-component-controls with real owner StoreProvider and serialized synthetic AsyncStorage',substitutes:['Auth','Pro entitlement','native primitives','WebView/asset loading','AI replies','audio unavailable'],notProven:['real WebView cards or pointer hit testing','live AI semantics','native device media/restart','payments'],entries:[]};
ledger.sourceDigests=Object.fromEntries(['app/approved-lesson/[lessonId].tsx','app/approved-rehearsal/[lessonId].tsx','components/M1L1PaidPractice.tsx','components/ScenarioPaidPractice.tsx','constants/approvedLessons.ts','lib/approvedRehearsals.ts','lib/convertedLesson.ts'].map(path=>[path,createHash('sha256').update(readFileSync(new URL('../'+path,import.meta.url))).digest('hex')]));
function save(){ledger.captureMode=spokenAudit?'Record/Stop controls, simulated dictation':'typed';ledger.recordStarts=recordStarts;ledger.recordStops=recordStops;writeFileSync(process.env.BYSI_LESSON_AUDIT_OUTPUT??new URL('../../docs/NATIVE-ALL-LESSON-TRAJECTORIES.json',import.meta.url),JSON.stringify(ledger,null,2)+'\n');}
await mount();
for(const id of LAUNCH_DECK_IDS){
 const deck=approvedLessonDeck(id)!;const entry:any={id,kind:deck.isCloseDeck?'module-close':'lesson',status:'running',steps:[]};ledger.entries.push(entry);save();
 assert.equal(nextLaunchDeck(store.convertedLessonProgress,store.moduleCloseProgress),id);
 await route({pathname:'/approved-lesson/[lessonId]',params:{lessonId:id}});
 assert.equal(root.root.findAllByType('webview').length,1);entry.steps.push('admitted canonical deck route');
 if(deck.isCloseDeck){
  assert.equal(approvedRehearsalConfig(id),undefined);
  const posted:any[]=[];let counter='8 / 9';let mutation!:()=>void;
  const doc={querySelector:()=>null,querySelectorAll:(selector:string)=>selector==='[data-tnum]'?[{textContent:counter}]:[],getElementById:()=>null,addEventListener:()=>{}};
  const windowHost={addEventListener:()=>{},ReactNativeWebView:{postMessage:(data:string)=>posted.push(JSON.parse(data))}};
  new Function('document','window','MutationObserver',root.root.findByType('webview').props.injectedJavaScript)(doc,windowHost,class {constructor(callback:()=>void){mutation=callback;}observe(){}});
  assert.deepEqual(posted,[],'close must not complete before its final card');counter='9 / 9';mutation();mutation();
  assert.deepEqual(posted,[{type:'module-close-complete'}],`${id}: actual injected final-card bridge must emit completion exactly once`);
  failCloseWrite=true;await message(posted[0].type);assert.ok(!store.moduleCloseProgress.some((p:any)=>p.lessonId===id));
  await press('Retry saving module completion');assert.ok(store.moduleCloseProgress.some((p:any)=>p.lessonId===id));
  await restart();assert.ok(store.moduleCloseProgress.some((p:any)=>p.lessonId===id));entry.steps.push('actual injected bridge executed against synthetic final-card DOM','failed storage does not complete or unlock','native retry control → actual WebView completion callback','serialized owner store remount');entry.status='component-local';save();continue;
 }
 const config=id==='m1-l1'?M1_L1_CONVERSION:approvedRehearsalConfig(id)!;
 await message('start-rehearsal');const runId=store.activeScenarioRun.run.id;
 assert.equal(store.activeScenarioRun.run.scenarioContext.situation,config.scenario.situation);
 assert.equal(store.activeScenarioRun.run.counterpartIdentity,config.counterpartId);
 entry.canonicalSceneSha256=createHash('sha256').update(config.scenario.situation).digest('hex');entry.counterpart={id:config.counterpartId,name:store.activeScenarioRun.run.scenarioContext.counterpartName,role:store.activeScenarioRun.run.scenarioContext.counterpartRole};
 assert.equal(text().split(config.scenario.situation).length-1,1);entry.steps.push('canonical scene and counterpart identity');
 const opener=`I want to discuss ${config.scenario.title}.`;const response='There is also another issue and several more examples to discuss.';const retry=`I am asking for one thing: ${config.scenario.goal}`;
 const before=generated.length;await input(opener);assert.equal(generated.length,before);await press('Approve this transcript');
 assert.equal(store.activeScenarioRun.run.state,'ready_for_response',JSON.stringify(alerts));assert.equal(generated.at(-1).scenario.situation,config.scenario.situation);assert.equal(generated.at(-1).approvedTranscript,opener);
 const pressure=store.activeScenarioRun.run.counterpartTurn;
 await restart();assert.equal(store.activeScenarioRun.run.id,runId);assert.deepEqual(store.activeScenarioRun.run.counterpartTurn,pressure);entry.steps.push('approved opener → simulated counterpart one','cold owner-store remount preserves exact pressure');
 await input(response);await press('Approve this transcript');assert.equal(store.activeScenarioRun.run.state,'hope_coaching',JSON.stringify(alerts));
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
 await route({pathname:'/approved-lesson/[lessonId]',params:{lessonId:id}});await restart();assert.ok(store.convertedLessonProgress.some((p:any)=>p.lessonId===id));assert.ok(!text().includes(opener));entry.steps.push('completed lesson revisit without private transcript');entry.status='component-local';entry.liveSemanticStatus=id==='m1-l2'?'NO-GO: unresolved Ravi attribution; offline fixtures do not cure it':'not verified';save();
}
assert.equal(new Set(ledger.entries.map((e:any)=>e.id)).size,12);assert.equal(ledger.entries.filter((e:any)=>e.kind==='lesson').length,10);assert.equal(ledger.entries.filter((e:any)=>e.kind==='module-close').length,2);assert.equal(store.convertedLessonProgress.length,10);assert.equal(store.moduleCloseProgress.length,2);ledger.complete=true;save();
// Actual completed progress above unlocks this route; no completion row is seeded.
const beforeQuickRep=structuredClone(store.drillLog);
await route({pathname:'/quick-rep/[lessonId]',params:{lessonId:'m1-l1'}});
assert.ok(!text().includes('Quick Rep is unavailable.'));
await press('Use typing instead');
const quickDraft='Can we agree to send the file by Tuesday at noon?';
await act(async()=>root.root.findByType('input').props.onChangeText(quickDraft));
await press('Check my rep');
assert.equal(quickRepRequests.length,1);assert.equal(quickRepRequests[0][3],quickDraft);
assert.ok(text().includes("We couldn't check this rep yet"));
assert.equal(root.root.findByType('input').props.value,quickDraft);
const retryQuick=buttons().find((b:any)=>b.props.accessibilityLabel==='Retry checking Quick Rep');
assert.ok(retryQuick);await act(async()=>retryQuick.props.onPress());await flush();
assert.equal(quickRepRequests.length,2);assert.deepEqual(quickRepRequests[1],quickRepRequests[0]);
assert.deepEqual(store.drillLog,beforeQuickRep,'unavailable feedback must not fabricate completion or scores');
const closeQuick=buttons().find((b:any)=>b.props.accessibilityLabel==='Close Quick Rep');
assert.ok(closeQuick);await act(async()=>closeQuick.props.onPress());await flush();assert.equal(location,'/(tabs)');
ledger.quickRep={status:'component-local',lessonId:'m1-l1',steps:['earned completion unlock','typing control','exact request with synthetic unavailable feedback','draft retained','actual retry control','no fabricated completion or score','close to Today'],notProven:['successful feedback/completion trajectory','provider semantics','device recording']};save();
await act(async()=>root.unmount());client.clear();console.log('PASS actual all launch lesson trajectories: 10 lessons + 2 closes; Quick Rep unavailable-feedback controls; synthetic dependencies, no live semantic acceptance.');
