import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).__DEV__=false;
plugin({name:'remaining-route-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
// Synthetic only: no network, provider, billing, OS link, or device storage calls.
const disk=new Map<string,string>();
let syntheticPro=false,failBuild=false,failDrill=false,rejectWrites=false,rejectDeletes=false;
let scenarioBuilds=0;
const alerts:any[]=[],openedURLs:string[]=[];
const raw={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{if(rejectWrites)throw Error('synthetic storage unavailable');disk.set(k,v);},removeItem:async(k:string)=>{if(rejectDeletes)throw Error('synthetic deletion unavailable');disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{if(rejectDeletes)throw Error('synthetic deletion unavailable');ks.forEach(k=>disk.delete(k));}};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
const listeners=new Set<any>();let session:any=null;
const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session?.user??null},error:null}),onAuthStateChange:(cb:any)=>{listeners.add(cb);return {data:{subscription:{unsubscribe(){listeners.delete(cb);}}}};},signInAnonymously:async()=>{throw Error('anonymous rollout stays disabled');},signOut:async()=>{session=null;for(const cb of listeners)cb('SIGNED_OUT',null);return {error:null};}};
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://production.invalid',staging:false},isAuthConfigured:true}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, PRO_ENTITLEMENT:'pro',identifyPurchasesUser:async()=>null,clearPurchasesIdentity:async()=>{},useIsPro:()=>syntheticPro}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));
mock.module('@/lib/voice',()=>({speakPaidPilotAudio:async()=>{},deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false})}));
mock.module('@/lib/ai',()=>({evaluatePilotAttempt:async()=>{throw Error('not a lesson fixture');},nextPilotCounterpart:async()=>{throw Error('not a lesson fixture');},drillRoundFeedback:async()=>{if(failDrill)throw Error('synthetic feedback unavailable');return {score:40,feedback:'Synthetic feedback, not measured skill',better:'Synthetic alternative'};},buildCustomScenario:async()=>{scenarioBuilds++;if(failBuild)throw Error('synthetic generation unavailable');return {title:'Synthetic builder output',counterpart:'Hope',situation:'Synthetic',goal:'Synthetic',category:'work',opensWith:'user',difficulty:'steady'};}}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({Switch:(p:any)=>React.createElement('switch',p),View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert:(...args:any[])=>{alerts.push(args);}},Linking:{openURL:async(url:string)=>{openedURLs.push(url);}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'web',select:(v:any)=>v.web??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
const icons=['BookOpen','Layers3','X','ChevronLeft','ExternalLink','Phone','Quote','Minus','Flag','Pause','Play','AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'];
mock.module('lucide-react-native',()=>Object.fromEntries(icons.map(i=>[i,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({SelectionWipe:Host,Backdrop:()=>null,MicControl:Host,Eyebrow:Host,Reveal:Host,Meter:Host,StateDock:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
let route:any=null,params:any={};const router={navigate:(r:any)=>{route=r;},replace:(r:any)=>{route=r;},push:(r:any)=>{route=r;},back(){route='BACK';},canGoBack:()=>true};
const Tabs:any=(p:any)=>React.createElement('tabs',p,p.children);Tabs.Screen=(p:any)=>React.createElement('tab-screen',p);
mock.module('expo-router',()=>({Tabs,Stack:{Screen:Host},useRouter:()=>router,useLocalSearchParams:()=>params}));
mock.module('@/lib/useKeyboardReveal',()=>({useKeyboardReveal:()=>({scrollRef:{current:null},onScroll(){},trackFocus(){}})}));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {AuthProvider,useAuth}=await import('../providers/auth');
const {StoreProvider,useStore}=await import('../providers/store');
let Screen:any=()=>null,screenKey=0,account:any,store:any,root:any;
const Probe=()=>{account=useAuth();store=useStore();return React.createElement(Screen,{key:screenKey});};
const client=new QueryClient();
const tree=()=>React.createElement(QueryClientProvider,{client},React.createElement(AuthProvider,null,React.createElement(StoreProvider,null,React.createElement(Probe))));
async function mount(next:any){Screen=next;screenKey++;route=null;await act(async()=>{if(root)root.update(tree());else root=create(tree());});}
const text=()=>JSON.stringify(root.toJSON());
const nodeText=(n:any):string=>typeof n==='string'?n:(n?.children??[]).map(nodeText).join('');
async function press(label:string){const b=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label||nodeText(n).startsWith(label))&&!n.props.disabled);assert.ok(b,`enabled control: ${label}`);await act(async()=>{await b.props.onPress();});await act(async()=>{await new Promise(r=>setTimeout(r,5));});}
const destination=():any=>route;
// Real route components + Store/Auth; synthetic session, billing, native hosts and AI.
session={user:{id:'route-owner',email:'route-owner@invalid',is_anonymous:false},access_token:'synthetic-route-token'};
const screens:any={};
for(const name of ['+not-found','approved-lessons','scenario/[id]','custom','drill/[id]','module/[day]','interrupted/[moduleId]','progress/dimension/[signal]','progress/how-it-works','privacy','safety','qa-access','internal-review-evidence','(tabs)/_layout'])screens[name]=(await import('../app/'+name+'.tsx')).default;
await mount(screens['+not-found']);await press('Back to Today');assert.equal(route,'/(tabs)');
for(const name of ['approved-lessons','qa-access','internal-review-evidence']){
 await mount(screens[name]);assert.ok(text().includes('unavailable'));assert.equal(root.root.findAllByType('switch').length,0);await press('Back to Today');assert.equal(route,'/(tabs)');
}
await mount(screens['(tabs)/_layout']);assert.equal(root.root.findByType('tabs').props.initialRouteName,'index');
const tabs=root.root.findAllByType('tab-screen');assert.deepEqual(tabs.map((n:any)=>n.props.name),['index','library','progress']);
for(const tab of tabs){for(const focused of [false,true]){let label:any;await act(async()=>{label=create(tab.props.options.tabBarLabel({focused}));});assert.ok(JSON.stringify(label.toJSON()).includes(tab.props.options.title));await act(async()=>label.unmount());}}
const {redirectSystemPath}=await import('../app/+native-intent');
for(const initial of [false,true]){assert.equal(redirectSystemPath({path:'bysi://continue-from-web',initial}),'/continue-from-web');assert.equal(redirectSystemPath({path:'https://beforeyousayit.app/progress/dimension/clarity',initial}),'/progress/dimension/clarity');for(const path of ['bysi://qa-access','https://foreign.invalid/settings','/%ZZ','/../qa-access'])assert.equal(redirectSystemPath({path,initial}),'/');}
for(const signal of ['not-a-signal','clarity','listening']){params={signal};await mount(screens['progress/dimension/[signal]']);assert.ok(text().includes(signal==='not-a-signal'?'That signal is not available':'Not observed yet'));await press('Back to Progress');assert.equal(route,'/(tabs)/progress');}
await mount(screens['progress/how-it-works']);assert.ok(text().includes('Unobserved signals are not treated as zero'));await press('Back to Progress');assert.equal(route,'/(tabs)/progress');
params={};await mount(screens.safety);for(const label of ['Immediate danger. Call 911','Suicide & Crisis Lifeline. Call or text 988','National Domestic Violence Hotline. Call 1-800-799-SAFE (7233)','Open the National Domestic Violence Hotline website'])await press(label);
assert.deepEqual(openedURLs,['tel:911','tel:988','tel:18007997233','https://www.thehotline.org']);await press('Return safely');assert.equal(route,'BACK');
params={id:'missing'};await mount(screens['scenario/[id]']);await press('Go back');assert.equal(route,'BACK');
params={id:'missing'};await mount(screens['drill/[id]']);await press('Back to Library');assert.equal(route,'/(tabs)/library');
params={moduleId:'missing'};await mount(screens['interrupted/[moduleId]']);await press('Back to Today');assert.equal(route,'/(tabs)');
params={day:'missing'};await mount(screens['module/[day]']);await press('Back to Today');assert.equal(route,'/(tabs)');
params={};await mount(screens.custom);await press('Build the rehearsal');assert.ok(text().includes('Give me a sentence'));assert.equal(scenarioBuilds,0);
await act(async()=>root.root.findAllByType('input')[0].props.onChangeText('Synthetic: agree on who handles the handoff.'));
await press('Gets defensive');await press('Gentle: They listen, but they still feel');
failBuild=true;await press('Build the rehearsal');assert.ok(text().includes("Couldn't build that one"));assert.equal(route,null);
failBuild=false;await press('Build the rehearsal');assert.equal(destination().pathname,'/scenario/[id]');const customId=destination().params.id;assert.equal(destination().params.level,'gentle');assert.equal(destination().params.reaction,'defensive');assert.equal(store.findScenario(customId).isCustom,true);
assert.ok(![...disk.values()].some(v=>v.includes('Synthetic builder output')),'custom text stays out of durable storage without consent');
params={...destination().params};await mount(screens['scenario/[id]']);await press('Start the rehearsal');assert.equal(destination().pathname,'/rehearse/[id]');assert.equal(store.activeScenarioRun.run.scenarioContext.scenarioId,customId);const runId=store.activeScenarioRun.run.id;await mount(screens['scenario/[id]']);await press('Start the rehearsal');assert.equal(destination().params.scenarioRunId,runId,'resume exact run, not a second creation');
await mount(screens.privacy);await act(async()=>root.root.findByType('switch').props.onValueChange(true));assert.equal(store.consent.saveCustomScenarioText,true);
await act(async()=>root.unmount());root=null;await mount(screens.privacy);assert.equal(root.root.findByType('switch').props.value,true,'actual consent persisted through owner cold hydration');
await press('Back');assert.equal(route,'BACK');
if(process.env.BYSI_ROUTE_CASE==='privacy-write-failure'){
 const unhandled:unknown[]=[];const onUnhandled=(e:unknown)=>{unhandled.push(e);};process.on('unhandledRejection',onUnhandled);
 await mount(screens.privacy);rejectWrites=true;
 await act(async()=>{root.root.findByType('switch').props.onValueChange(false);await new Promise(r=>setTimeout(r,20));});
 assert.ok(text().includes('Couldn’t save your privacy choice'),'failed durable consent must surface actionable error');
 assert.equal(store.consent.saveCustomScenarioText,true);assert.equal(unhandled.length,0,'privacy actions must handle storage rejection');
 rejectWrites=false;await act(async()=>{root.root.findByType('switch').props.onValueChange(false);await new Promise(r=>setTimeout(r,20));});assert.equal(store.consent.saveCustomScenarioText,false);assert.ok(!text().includes('Couldn’t save your privacy choice'));
 await act(async()=>{root.root.findByType('switch').props.onValueChange(true);await new Promise(r=>setTimeout(r,20));});process.off('unhandledRejection',onUnhandled);
}

// An authored scenario reaches durable owner storage before navigation.
const {SCENARIOS,DIFFICULTY}=await import('../constants/scenarios');
params={id:SCENARIOS[0].id};await mount(screens['scenario/[id]']);await press(`${DIFFICULTY.challenging.label}: ${DIFFICULTY.challenging.note}`);
rejectWrites=true;await press('Start the rehearsal');assert.equal(route,null);assert.equal(alerts.at(-1)[0],'Couldn’t start the rehearsal');rejectWrites=false;
await press('Start the rehearsal');const durableRun=structuredClone(store.activeScenarioRun);assert.equal(durableRun.run.scenarioContext.difficulty,'challenging');assert.equal(destination().params.scenarioRunId,durableRun.run.id);
await act(async()=>root.unmount());root=null;await mount(screens['scenario/[id]']);assert.deepEqual(store.activeScenarioRun,durableRun);await press('Start the rehearsal');assert.equal(destination().params.scenarioRunId,durableRun.run.id);

// Serialized synthetic observed history; no lesson completion or measured claim.
const {createScoredPracticeRecord}=await import('../lib/scoredPracticeHistory');
const {PROGRESS_SIGNAL_ORDER}=await import('../lib/progressEvidence');
const result:any={contract_version:1,rehearsal_id:'synthetic-history',pressure_moment:null,practice_shift:null,starting_index:null,first_focus:null,signals:PROGRESS_SIGNAL_ORDER.map((key:string)=>({signal_key:key,observation_status:key==='clarity'?'observed':'unobserved',score:key==='clarity'?0:null,evidence_turn_ids:key==='clarity'?['synthetic-approved-turn']:[],signal_version:'signal-v1'}))};
const record=createScoredPracticeRecord(result,{completedAt:123456,scenarioId:'chores',approvedTextByTurnId:new Map([['synthetic-approved-turn','Synthetic approved evidence, not provider output']])});assert.ok(record);
await account.practiceOwner.storage.setItem('cc.scoredPracticeHistory.v1',JSON.stringify([record]));
await act(async()=>root.unmount());root=null;params={signal:'clarity'};await mount(screens['progress/dimension/[signal]']);assert.ok(text().includes('Synthetic approved evidence'));assert.ok(text().includes('Clarity observed history: 0'));await press('Back to Progress');assert.equal(route,'/(tabs)/progress');
params={signal:'listening'};await mount(screens['progress/dimension/[signal]']);assert.ok(text().includes('Not observed yet'));assert.ok(!text().includes('observed history:'));await press('Back to Progress');
const {createPresetPracticeSession,createPilotDayRun,upsertPilotDayRun}=await import('../lib/practiceSession');
let saved=createPresetPracticeSession(store.anonymousUserId);saved=upsertPilotDayRun(saved,createPilotDayRun(saved,2,Date.now(),'make_a_clear_ask'));
await act(async()=>store.saveActivePracticeSession(saved));
params={moduleId:'make_a_clear_ask'};await mount(screens['interrupted/[moduleId]']);assert.ok(text().includes('Saved checkpoint'));const continueButton=root.root.findAllByType('button').find((b:any)=>b.props.label?.startsWith('Continue'));assert.ok(continueButton);await press(continueButton.props.label);assert.equal(route,'/module/make_a_clear_ask');
params={day:'make_a_clear_ask'};await mount(screens['module/[day]']);await press('See the program');assert.equal(destination().pathname,'/paywall');assert.equal(destination().params.moduleId,'make_a_clear_ask');
syntheticPro=true;await mount(screens['module/[day]']);assert.equal(root.root.findAllByType('button').filter((b:any)=>b.props.accessibilityLabel?.includes('Runnable')).length,0,'release has zero review practices even with synthetic Pro');await press('Back to Today');assert.equal(route,'/(tabs)');syntheticPro=false;
// Actual legacy drill rounds, synthetic feedback, durable log, no lesson promotion.
const {DRILLS}=await import('../constants/drills');params={id:DRILLS[0].id};await mount(screens['drill/[id]']);
for(let i=0;i<DRILLS[0].rounds.length;i++){
 await act(async()=>root.root.findByType('input').props.onChangeText('Synthetic learner response '+i));
 const send=()=>root.root.findAllByType('button').find((b:any)=>b.props.disabled===false&&!b.props.label);assert.ok(send());
 if(i===0){failDrill=true;await act(async()=>send().props.onPress());assert.ok(text().includes("Couldn't score that one"));assert.equal(root.root.findByType('input').props.value,'Synthetic learner response 0');failDrill=false;}
 await act(async()=>send().props.onPress());assert.ok(text().includes('Synthetic feedback, not measured skill'));
 if(i===DRILLS[0].rounds.length-1&&process.env.BYSI_ROUTE_CASE==='drill-save-failure'){
  rejectWrites=true;let escaped:unknown;try{await press('See your score');}catch(e){escaped=e;}
  assert.ok(text().includes('Couldn’t save this drill'),'failed log must show retryable save error, not completion');assert.equal(escaped,undefined);assert.equal(store.drillLog.length,0);assert.ok(!text().includes('Drill complete'));rejectWrites=false;
 }
 if(i===DRILLS[0].rounds.length-1&&process.env.BYSI_ROUTE_CASE==='drill-double-save'){
  const finish=root.root.findAllByType('button').find((b:any)=>b.props.label==='See your score');await act(async()=>{await Promise.all([finish.props.onPress(),finish.props.onPress()]);});assert.equal(store.drillLog.length,1,'rapid repeated final control must write exactly one drill log');
 }else await press(i===DRILLS[0].rounds.length-1?'See your score':'Next round');
}
assert.ok(text().includes('Drill complete'));assert.equal(store.drillLog.length,1);assert.equal(store.drillLog[0].score,40);assert.equal(store.completed.length,0);await press('Done');assert.equal(route,'BACK');
await act(async()=>root.unmount());root=null;await mount(screens.privacy);assert.equal(store.drillLog.length,1);assert.equal(store.activePracticeSession.id,saved.id);
// Privacy deletion uses actual controls, then owner-store readback and cold hydration.
params={};await mount(screens.custom);await act(async()=>root.root.findAllByType('input')[0].props.onChangeText('Synthetic consented custom scenario text'));await press('Build the rehearsal');const retainedCustomId=destination().params.id;
assert.ok([...disk.values()].some(v=>v.includes(retainedCustomId)));
await act(async()=>store.upsertSession({schemaVersion:2,id:'synthetic-history-record',scenarioId:'chores',category:'partner',difficulty:'steady',skillIds:[],turnCount:0,userTurnCount:0,retryCount:0,completed:false,startedAt:123456,contentRetained:false}));
await mount(screens.privacy);assert.equal(store.sessions.length,1,'history deletion starts nonempty without inventing completion');
if(process.env.BYSI_ROUTE_CASE==='privacy-history-failure'||process.env.BYSI_ROUTE_CASE==='privacy-reset-failure'){
 const unhandled:unknown[]=[];const onUnhandled=(e:unknown)=>{unhandled.push(e);};process.on('unhandledRejection',onUnhandled);rejectDeletes=true;
 const resetCase=process.env.BYSI_ROUTE_CASE==='privacy-reset-failure';await press(resetCase?'Reset all app data':'Delete all practice history');
 assert.ok(text().includes(resetCase?'Couldn’t reset app data':'Couldn’t delete practice history'),'failed privacy operation must surface error');assert.equal(route,null);assert.equal(store.sessions.length,1);assert.equal(unhandled.length,0);rejectDeletes=false;process.off('unhandledRejection',onUnhandled);
}
if(process.env.BYSI_ROUTE_CASE==='privacy-delete-failure'){
 const unhandled:unknown[]=[];const onUnhandled=(e:unknown)=>{unhandled.push(e);};process.on('unhandledRejection',onUnhandled);
 rejectDeletes=true;await press('Delete scenarios I wrote');assert.ok(text().includes('Couldn’t delete your scenarios'),'failed delete must not silently look successful');assert.ok(store.customScenarios.some((s:any)=>s.id===retainedCustomId));assert.equal(unhandled.length,0);
 rejectDeletes=false;process.off('unhandledRejection',onUnhandled);
}
await press('Delete scenarios I wrote');assert.equal(store.customScenarios.length,0);assert.ok(![...disk.values()].some(v=>v.includes(retainedCustomId)));await press('Delete all practice history');assert.equal(store.sessions.length,0);assert.equal(store.activePracticeSession.id,saved.id);
if(process.env.BYSI_ROUTE_CASE==='safety-mismatch'){
 params={returnTo:'generating',sessionId:'stale-other-session'};await mount(screens.safety);await press('Return safely');assert.equal(route,'BACK','stale safety link must not open an unrelated current rehearsal');assert.equal(store.activePracticeSession.id,saved.id);
}
if(process.env.BYSI_ROUTE_CASE==='privacy-disclosure'){
 await mount(screens.privacy);assert.ok(!text().includes('practice and conversation content never goes there'),'disclosure must describe the new secure guest handoff rather than falsely deny protected content');assert.ok(!text().includes('Rehearsals outside the active journey and setup answers for later practice remain in memory only.'),'persisted approved scenario attempts must not be described as memory-only');
}
await mount(screens.privacy);await press('Reset all app data');assert.equal(route,'/onboarding');assert.equal(store.activePracticeSession,null);assert.equal(store.drillLog.length,0);assert.equal(store.scoredPracticeHistory.length,0);
await act(async()=>root.unmount());root=null;await mount(screens.privacy);assert.equal(store.activePracticeSession,null);assert.equal(store.consent.saveCustomScenarioText,false);

console.log('PASS actual remaining route controls: release denial, recovery, custom build/error, scenario create/resume, consent cold hydration; synthetic dependencies, not device/provider acceptance');
await act(async()=>root.unmount());client.clear();

