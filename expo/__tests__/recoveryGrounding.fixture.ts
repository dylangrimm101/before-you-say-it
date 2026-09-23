import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';

// Mounted real screen/store/AI gate. Only native facilities, owner storage and
// service responses are synthetic; no private backend dependencies are required.
// Separate offline integration receipts exercise the actual backend proof helpers.
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN='https://beforeyousayit.app';
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
const channel=process.argv[2]??'email';
const variant=process.argv[3]??'persona';
const closeLine=`The scope still needs covering by ${channel}. I'm already trying, and this is bigger than one task; not now.`;
assert.ok(['email','text','phone call'].includes(channel));
assert.ok(['persona','situation','opening','no-remount','unsupported','other-session'].includes(variant));
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
(globalThis as any).__DEV__=false;
plugin({name:'offline-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const Host=(p:any)=>React.createElement('host',p,p.children);
const Button=(p:any)=>React.createElement('button',p,p.label??p.children);
class Value{setValue(){}stopAnimation(){}interpolate(){return this;}addListener(){return 'x';}removeListener(){}}
const anim={start:(cb:any)=>cb?.({finished:true}),stop(){}};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:Button,TextInput:(p:any)=>React.createElement('input',p),ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated:{Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>anim,spring:()=>anim,parallel:()=>anim,stagger:()=>anim,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()},Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:(v:any)=>v.ios??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
mock.module('lucide-react-native',()=>Object.fromEntries(['ArrowUp','Keyboard','Mic','RotateCcw','Settings','Square','Volume2','VolumeX'].map(i=>[i,Host])));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,MicControl:Button,Thinking:Host,Waveform:Host,Meter:Host,StateDock:Host,PressCard:Button,GhostButton:Button,PrimaryButton:Button,tap(){},useReducedMotion:()=>true}));
mock.module('@/components/RehearsalBriefing',()=>({RehearsalBriefing:Host}));
mock.module('@/components/ScenarioPaidPractice',()=>({ScenarioPaidPractice:()=>{throw Error('Unexpected paid route');}}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, useIsPro:()=>false,clearPurchasesIdentity:async()=>{}}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const spoken:string[]=[];
const voices:string[]=[];
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},resetSpeech:async()=>{},speak:async(text:string,voice:string)=>{spoken.push(text);voices.push(voice);},stopSpeech:async()=>{},replaySpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false})}));
// Exercise recording -> editable transcript -> explicit approval on the screen;
// hardware and transcription services are outside this diagnostic's scope.
let microphoneStarts=0;
mock.module('@/lib/useDictation',()=>({useDictation:()=>{
 const [status,setStatus]=React.useState('idle');
 const reset=React.useCallback(async()=>{setStatus('idle');},[]);
 return {status,error:null,cancel:reset,reset,requestPermission:async()=>true,
 start:async()=>{microphoneStarts++;setStatus('recording');},
 stop:async()=>{setStatus('idle');return 'Which one comes first?';}};
}}));
const disk=new Map<string,string>();
const storage={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{ks.forEach(k=>disk.delete(k));},localContinuation:async()=>false,forgetContinuationSnapshot:async()=>{}};
const auth={practiceOwner:{key:'synthetic-owner',storage},logout:async()=>{},startNativeSession:async()=>({success:true}),beginCurrentGuestPractice:async()=>{}};
mock.module('@/providers/auth',()=>({useAuth:()=>auth}));
const routeId='custom-synthetic-old-route';
const practiceId='practice-synthetic';
const params:any={id:routeId,entry:'onboarding',practiceSessionId:practiceId,difficulty:'steady',reaction:'not-sure',persona:'woman-hope'};
const routeEvents:any[]=[];
mock.module('expo-router',()=>({useRouter:()=>({replace:(p:any)=>routeEvents.push(p),push:(p:any)=>routeEvents.push(p),back(){},canGoBack:()=>true}),useLocalSearchParams:()=>params}));
globalThis.fetch=async()=>{throw Error('Unexpected network; OS sandbox also denies network');};
const serverId='11111111-1111-4111-8111-111111111111';
let recovery:any={status:'start',used:true,phase:'start',sessionId:serverId,generation:0};
const requests:any[]=[];
const generations:any[]=[];
mock.module('@/lib/normalFreeRuntime',()=>({normalFreeRecoveryEnabled:true,requestNormalFree:async(op:string,payload:any)=>{
 requests.push({op,payload});
 if(op==='recover')return Response.json(recovery);
 assert.equal(op,'generate');
 assert.equal(payload.type,'rehearsal_turn');
 const line=payload.turn==='pushback'?'Everything matters.':closeLine;
 generations.push({turn:payload.turn,status:200,text:line,contract:payload.contract,transcript:payload.transcript});
 recovery={status:'resume',phase:payload.turn,sessionId:serverId,generation:0,
  audio:{text:line,role:'hope',turn:payload.turn},
  checkpoint:{revision:payload.turn==='pushback'?1:2,phase:payload.turn,contract:payload.contract,
   transcript:{...payload.transcript,[payload.turn==='pushback'?'counterpart_pushback':'counterpart_close']:line},
   provenance:{source:'server_generation'}}};
 // Deliberately return a channel even for the negative case: the client must
 // still reject an ungrounded response rather than trusting status 200 alone.
 return Response.json({mode:'turn',turn:payload.turn,role:'hope',text:line,safety:null});
}}));
const {createOnboardingPracticeSession}=await import('@/lib/practiceSession');
const {sanitizeActivePracticeSessionForPersistence}=await import('@/lib/privacyPersistence');
const {DEFAULT_CONSENT}=await import('@/lib/consent');
const seedScenario:any={id:routeId,category:'work',title:'Scope',counterpart:'Hope',situation:'Scope keeps changing.',persona:'Resistant colleague',goal:'Choose a task',opensWith:'user',openingLine:'',minutes:5,isCustom:true};
const seed=createOnboardingPracticeSession(practiceId,'synthetic-owner',seedScenario,seedScenario.goal,'not-sure',Date.now(),{entryRoute:'real_conversation',scenarioSource:'user_supplied',scenarioTitle:seedScenario.title,counterpartRelationship:seedScenario.persona,counterpartDisplayLabel:'Hope',behavioralGoal:seedScenario.goal,persona:'woman-hope'});
// Existing supported continuation: approved opener retained, no committed
// generation yet, context absent because custom-text retention is off.
disk.set('cc.activePracticeSession.v1',JSON.stringify(sanitizeActivePracticeSessionForPersistence({...seed,freeJourneyCheckpoint:'rehearsal',freeRehearsalTurns:[{id:'u1',role:'user',text:'Can we choose one task?'}]},DEFAULT_CONSENT)));
const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
const {StoreProvider,useStore}=await import('@/providers/store');
const {default:Rehearse}=await import('../app/rehearse/[id]');
let store:any,root:any,rerender:any;
let screenKey=0;
function Screen(){store=useStore();return store.hydrated?React.createElement(Rehearse,{key:screenKey}):null;}
const query=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0}}});
function Harness(){const [,setRevision]=React.useState(0);rerender=()=>setRevision((n:number)=>n+1);return React.createElement(QueryClientProvider,{client:query},React.createElement(StoreProvider,null,React.createElement(Screen)));}
const nodeText=(n:any):string=>typeof n==='string'?n:Array.isArray(n)?n.map(nodeText).join(' '):n&&typeof n==='object'?nodeText(n.children??[]):'';
const text=()=>nodeText(root.toJSON());
const flush=async()=>{for(let i=0;i<10;i++)await act(async()=>{await new Promise(r=>setTimeout(r,0));});};
const press=async(label:string)=>{
 const button=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label||nodeText(n)===label)&&!n.props.disabled);
 assert.ok(button,`Missing enabled control ${label}: ${text()}`);
 await act(async()=>{await button.props.onPress();});await flush();
};
const input=async(label:string,value:string)=>{const n=root.root.findAllByType('input').find((n:any)=>n.props.accessibilityLabel===label);assert.ok(n,label);await act(async()=>n.props.onChangeText(value));await flush();};
await act(async()=>{root=create(React.createElement(Harness));});await flush();
assert.ok(store.hydrated);
assert.ok(text().includes('Restore your conversation context'));
assert.equal(generations.length,0);
assert.ok(!root.root.findAllByType('button').some((n:any)=>n.props.accessibilityLabel==='Record your line'),'Missing contract keeps recording gated');
const fields:any={title:'Scope',counterpart:'Hope',situation:variant==='situation'?`Scope keeps changing by ${channel}.`:'Scope keeps changing.',goal:'Choose a task',persona:['persona','no-remount'].includes(variant)?`Discuss the scope by ${channel}.`:'Resistant colleague',openingLine:variant==='opening'?`We discuss the scope by ${channel}.`:''};
for(const [key,label] of Object.entries({title:'Restore conversation title',counterpart:'Restore counterpart',situation:'Restore situation',goal:'Restore goal',persona:'Restore counterpart behavior',openingLine:'Restore opening line'}))await input(label as string,fields[key]);
await press('Confirm restored context');
const approvedContract=structuredClone(store.activePracticeSession.normalFreeContract);
assert.equal(approvedContract.counterpart_persona,fields.persona);
assert.equal(approvedContract.opening_line,fields.openingLine);
assert.equal(JSON.parse(disk.get('cc.activePracticeSession.v1')!).normalFreeContract,undefined,'Privacy consent remains off');
assert.equal(store.customScenarios.length,0,'No custom scenario retained in library');
await press('Retry sending');
assert.equal(generations.length,1);
assert.equal(store.activePracticeSession.freeRehearsalTurns.length,2);
assert.ok(spoken.includes('Everything matters.'));
assert.equal(store.activePracticeSession.scenarioId,routeId);
if(variant!=='no-remount'){
 // Reopen same rehearsal screen without restarting the provider. This is a
 // screen lifecycle operation, not a hand-mutated scenario/session injection.
 await act(async()=>{screenKey++;rerender();});await flush();
 assert.equal(store.activePracticeSession.scenarioId,`normal-free-${serverId}`);
 assert.equal(store.findScenario(routeId),undefined,'Real store no longer resolves original route');
 assert.equal(routeEvents.length,0,'Screen recovery does not replace old route');
 assert.equal(params.id,routeId);
}
if(variant==='other-session'){
 const before=structuredClone(store.activePracticeSession);
 const generationsBefore=generations.length;
 params.practiceSessionId='different-practice';
 recovery={status:'start',used:true,phase:'start',sessionId:serverId,generation:0};
 await act(async()=>{screenKey++;rerender();});await flush();
 assert.deepEqual(requests.at(-1),{op:'recover',payload:{}},'Other practice cannot donate its contract');
 assert.ok(!root.root.findAllByType('button').some((n:any)=>n.props.accessibilityLabel==='Record your line'));
 assert.equal(generations.length,generationsBefore);
 assert.deepEqual(store.activePracticeSession,before);
 assert.equal(microphoneStarts,0);
 await act(async()=>root.unmount());query.clear();
 console.log(`PASS recovery grounding ${channel} ${variant}`);
 process.exit(0);
}
// Real mic callback itself also calls checkRecovery before starting, so the
// no-remount case probes whether screen navigation is even required.
await press('Record your line');
assert.equal(microphoneStarts,1);
assert.equal(store.activePracticeSession.scenarioId,`normal-free-${serverId}`);
assert.equal(store.findScenario(routeId),undefined);
await press('Stop and review your line');
await input('Your line, ready to send','Which one comes first?');
await press('Use this reply');
const closes=generations.filter(g=>g.turn==='close');
for(const g of generations)assert.deepEqual(g.contract,approvedContract,'Exact authorized contract preserved through screen');
assert.ok(closes.length>=1);
assert.ok(closes.every(g=>g.status===200&&g.text===closeLine));
const shouldReject=variant==='unsupported';
if(shouldReject){
 assert.equal(closes.length,2,'Client retries rejected exact line');
 assert.equal(store.activePracticeSession.freeRehearsalTurns.length,3,'Valid close never reaches local transcript');
 assert.ok(!spoken.includes(closes[0].text),'Rejected close does not play');
 assert.ok(root.root.findAllByType('button').some((n:any)=>n.props.accessibilityLabel==='Retry sending'),'Visible recovery error offers retry');
}else{
 assert.equal(closes.length,1,'Supported authoritative context needs no retry');
 assert.equal(store.activePracticeSession.freeRehearsalTurns.length,4);
 assert.ok(spoken.includes(closes[0].text));
 await press('Review complete transcript');
 assert.ok(text().includes('Approve transcript'));
}
assert.ok(voices.every(voice=>voice==='woman-hope'),'Counterpart behavior never becomes the voice ID');
assert.equal(approvedContract.opens_with,'user','Restoring opening context does not invent a counterpart opening turn');
assert.deepEqual(store.activePracticeSession.freeRehearsalTurns.map((t:any)=>t.role),shouldReject?['user','them','user']:['user','them','user','them']);
assert.equal(routeEvents.length,0,'Recovery keeps recording on the current screen');
assert.equal(JSON.parse(disk.get('cc.activePracticeSession.v1')!).normalFreeContract,undefined);
console.log(`PASS recovery grounding ${channel} ${variant}`);
await act(async()=>root.unmount());query.clear();
