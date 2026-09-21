import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';



import {createMigratingSecureSessionStorage} from '../lib/secureSessionStorage';
const {verifyComponentTestDeps}=await import('../scripts/component-test-deps');
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
plugin({name:'deletion-native-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const stagingAccount=process.env.DEVICE_STAGING_ACCOUNT==='1';
(globalThis as any).__DEV__=!stagingAccount;
const url=stagingAccount?'https://pqqxaklcburdxjfeolmd.supabase.co':'https://spvksnddzyvycfoefrcf.supabase.co',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const endpointPath=stagingAccount?'/functions/v1/bysi-task1-account-delete':'/functions/v1/account-delete';
const emailA=stagingAccount?'bysi-task1-a-20260910@acceptance.invalid':'a@example.invalid';
const emailB=stagingAccount?'bysi-task1-b-20260910@acceptance.invalid':'b@example.invalid';
if(stagingAccount){
 for(const name of Object.keys(process.env))if(name.startsWith('EXPO_PUBLIC_'))delete process.env[name];
 Object.assign(process.env,{
  EXPO_PUBLIC_BYSI_BUILD_MODE:'staging-account',
  EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE:'1',
  EXPO_PUBLIC_STAGING_SUPABASE_URL:url,
  EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',
  EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED:'reviewed-task1-20260910',
 });
}
const statePath=process.env.DEVICE_STATE!;
const saved=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{disk:[],secure:[]};
const disk=new Map<string,string>(saved.disk),secureDisk=new Map<string,string>(saved.secure);
const audioFiles=new Map<string,string>(saved.audio??[]);
const baselineFiles=new Map<string,string>(saved.baseline??[]);
const baselineDirs=new Set<string>(saved.baselineDirs??[]);
const persist=()=>writeFileSync(statePath,JSON.stringify({disk:[...disk],secure:[...secureDisk],audio:[...audioFiles],baseline:[...baselineFiles],baselineDirs:[...baselineDirs]}));
let offline=false,failCleanup=false,failSecure=false;
let holdStatus=false;const heldStatus:(()=>void)[]=[];
const host={getItem:async(key:string)=>disk.get(key)??null,setItem:async(key:string,value:string)=>{disk.set(key,value);persist();},removeItem:async(key:string)=>{if(failCleanup&&key.includes(encodeURIComponent(url+':'+A)))throw Error('synthetic interrupted erasure');disk.delete(key);persist();},getAllKeys:async()=>[...disk.keys()],multiRemove:async(keys:string[])=>{for(const key of keys)await host.removeItem(key);}};
const primitiveKey=(key:string)=>{assert.match(key,/^[A-Za-z0-9._-]+$/);return key;};
const secure={getItem:async(key:string)=>secureDisk.get(key)??null,setItem:async(key:string,value:string)=>{if(failSecure&&key.includes('bysi.deletion.journal.'))throw Error('synthetic journal SecureStore write failure');assert.ok(Buffer.byteLength(value)<=1800);secureDisk.set(key,value);persist();},removeItem:async(key:string)=>{if(failSecure&&key.includes('bysi.deletion.journal.'))throw Error('synthetic journal SecureStore write failure');secureDisk.delete(key);persist();}};
const sdkStorage=createMigratingSecureSessionStorage({secure,legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},namespaceForKey:async()=> 'sdk.fixture',generation:()=>randomUUID()});
const user={id:A,email:emailA};
let httpSequence=0;
const upstream:typeof fetch=async(input,init)=>{
 if(offline)throw Error('synthetic offline device');
 const target=new URL(String(input));assert.equal(target.origin,url);
 const request=new Request(input,init);const body=await request.text();
 if(holdStatus&&body.includes('deviceStatusSecret'))await new Promise<void>(resolve=>heldStatus.push(resolve));
 return new Promise<Response>((resolve,reject)=>{
  const httpId=++httpSequence;
  const timer=setTimeout(()=>{process.off('message',listener);reject(Error('Synthetic IPC HTTP timeout'));},10000);
  const listener=(message:any)=>{if(message.httpResponse!==httpId)return;clearTimeout(timer);process.off('message',listener);if(message.error)reject(Error(message.error));else resolve(new Response(message.status===204?null:message.body,{status:message.status,headers:message.headers}));};
  process.on('message',listener);process.send?.({httpId,url:String(input),method:request.method,headers:Object.fromEntries(request.headers),body});
 });
};
globalThis.fetch=upstream;
let sdk:any=createClient(url,'synthetic-public',{global:{fetch:upstream},auth:{storage:sdkStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'synthetic-auth'}});
mock.module('@react-native-async-storage/async-storage',()=>({default:host}));
if(!stagingAccount)mock.module('@/lib/supabase',()=>({supabase:sdk,authEnvironment:{url,keychainService:'beforeyousayit.supabase',staging:false},isAuthConfigured:true}));
mock.module('expo-secure-store',()=>({isAvailableAsync:async()=>true,AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,getItemAsync:async(key:string,options:any)=>secure.getItem(`${options?.keychainService??'default'}:${primitiveKey(key)}`),setItemAsync:async(key:string,value:string,options:any)=>secure.setItem(`${options?.keychainService??'default'}:${primitiveKey(key)}`,value),deleteItemAsync:async(key:string,options:any)=>secure.removeItem(`${options?.keychainService??'default'}:${primitiveKey(key)}`)}));
mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA256'},randomUUID,digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
const audioHost={cacheDirectory:'cache/',EncodingType:{Base64:'base64'},makeDirectoryAsync:async()=>{},writeAsStringAsync:async(key:string,value:string)=>{audioFiles.set(key,value);persist();},getInfoAsync:async(key:string)=>({exists:[...audioFiles.keys()].some(file=>file===key||file.startsWith(key))}),deleteAsync:async(key:string)=>{for(const file of audioFiles.keys())if(file===key||file.startsWith(key))audioFiles.delete(file);persist();},readDirectoryAsync:async(key:string)=>[...new Set([...audioFiles.keys()].filter(file=>file.startsWith(key)).map(file=>file.slice(key.length).split('/')[0]))]};
mock.module('expo-file-system/legacy',()=>audioHost);
const joinUri=(parts:(string|{uri:string})[])=>parts.map(part=>typeof part==='string'?part:part.uri).filter(Boolean).reduce((left,right)=>left?`${left.replace(/\/$/,'')}/${right.replace(/^\//,'')}`:right,'');
class BaselineFile{uri:string;constructor(...parts:(string|{uri:string})[]){this.uri=joinUri(parts);}get exists(){return baselineFiles.has(this.uri);}copy(target:BaselineFile){const value=baselineFiles.get(this.uri)??audioFiles.get(this.uri);if(value===undefined)throw Error('baseline source missing');baselineFiles.set(target.uri,value);baselineDirs.add(target.uri.replace(/\/[^/]+$/,''));persist();}delete(){baselineFiles.delete(this.uri);persist();}}
class BaselineDirectory{uri:string;constructor(...parts:(string|{uri:string})[]){this.uri=joinUri(parts);}get exists(){return baselineDirs.has(this.uri)||[...baselineFiles.keys()].some(file=>file.startsWith(this.uri.replace(/\/$/,'')+'/'));}create(){baselineDirs.add(this.uri);persist();}list(){const prefix=this.uri.replace(/\/$/,'')+'/';return [...baselineFiles.keys()].filter(file=>file.startsWith(prefix)&&!file.slice(prefix.length).includes('/')).map(file=>new BaselineFile(file));}delete(){const prefix=this.uri.replace(/\/$/,'')+'/';for(const file of baselineFiles.keys())if(file.startsWith(prefix))baselineFiles.delete(file);baselineDirs.delete(this.uri);persist();}}
mock.module('expo-file-system',()=>({File:BaselineFile,Directory:BaselineDirectory,Paths:{document:{uri:'file:///device/Documents'},cache:{uri:'file:///device/Caches'}}}));
const appStateListeners=new Set<(state:string)=>void>();
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{setValue(){}stopAnimation(){}interpolate(){return this;}addListener(){return 'x';}removeListener(){}}
const animation={start:(cb:any)=>cb?.({finished:true}),stop(){}};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),AppState:{addEventListener:(_type:string,listener:(state:string)=>void)=>{appStateListeners.add(listener);return {remove(){appStateListeners.delete(listener);}}}},AccessibilityInfo:{announceForAccessibility(){}},ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated:{Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation},Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:(v:any)=>v.ios??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, PRO_ENTITLEMENT:'pro',useNativeServerAccess:()=>({data:false,isPending:false}),identifyPurchasesUser:async()=>null,clearPurchasesIdentity:async()=>{},useIsPro:()=>false,useCustomerInfo:()=>({data:null,isLoading:false}),useOfferings:()=>({data:null,isLoading:false}),usePurchasePackage:()=>({isPending:false}),useRestorePurchases:()=>({isPending:false})}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},resetSpeech:async()=>{},stopSpeech:async()=>{}}));
mock.module('lucide-react-native',()=>Object.fromEntries(['Bookmark','Star','TrendingUp','X','AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'].map(k=>[k,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,HeroSurface:Host,Eyebrow:Host,Meter:Host,StateDock:Host,Thinking:Host,MicControl:Host,Waveform:Host,Reveal:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
mock.module('react-native-gesture-handler',()=>({GestureHandlerRootView:Host}));
mock.module('expo-font',()=>({useFonts:()=>[true,null]}));mock.module('expo-status-bar',()=>({StatusBar:()=>null}));mock.module('expo-splash-screen',()=>({preventAutoHideAsync:async()=>{},hideAsync:async()=>{}}));
mock.module('react-native-url-polyfill/auto',()=>({}));
mock.module('@/components/LaunchExperience',()=>({LaunchExperience:()=>null}));mock.module('@/components/MigrationNotice',()=>({MigrationNotice:()=>null}));
mock.module('@/components/PaidProductUI',()=>({ProductCard:Host,SectionLabel:Host,StatusPill:Host,PaidHeader:Host}));
mock.module('expo-constants',()=>({default:{expoConfig:{version:'synthetic',extra:{eas:{projectId:stagingAccount?'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44':'1b655360-557d-4dba-ad69-fbf26120e852'}}}}}));
mock.module('expo-application',()=>({applicationId:stagingAccount?'app.bysi.staging.account':'app.rork.8fc4qwsqaurkxk0pimyvx'}));
if(stagingAccount){
 const selected=await import('../lib/supabase');
 assert.equal(selected.authEnvironment?.staging,true);
 assert.equal(selected.authEnvironment?.url,url);
 assert.equal(selected.authEnvironment?.storageKey,'bysi.staging.pqqxaklcburdxjfeolmd.auth');
 assert.ok(selected.supabase);
 sdk=selected.supabase;
}
let route='/entry',navigate:any,account:any,root:any;
const router={replace:(r:any)=>{route=typeof r==='string'?r:r.pathname;navigate?.(route);},push:(r:any)=>router.replace(r),back:()=>router.replace('/settings'),canGoBack:()=>true,setParams(){}};
const Stack=Object.assign(()=>React.createElement(RouterScreen),{Screen:()=>null});
mock.module('expo-router',()=>({Stack,useRouter:()=>router,useLocalSearchParams:()=>({}),useGlobalSearchParams:()=>({}),useSegments:()=>route.split('/').filter(Boolean),useFocusEffect:(cb:any)=>React.useEffect(cb,[cb])}));
const {requestAccountDeletion,checkAccountDeletionStatus,ensureReceiptlessDeletionCapability,checkReceiptlessDeletionNotice}=await import('../lib/accountDeletion');
const actualRuntime=await import('../lib/accountLifecycleRuntime');
const {createOwnerVoiceCache}=await import('../lib/ownerVoiceCache');
const voiceCache=createOwnerVoiceCache(audioHost as any);let capturedVoice:ReturnType<typeof voiceCache.lease>|null=null;
const receiptStore=actualRuntime.accountDeletionReceiptStore;
if(!stagingAccount)mock.module('@/lib/accountLifecycleRuntime',()=>({...actualRuntime,accountDeletionAvailable:true,
 deleteAccountIdentity:(owner:string,password:string,billing:any)=>requestAccountDeletion(sdk.auth,url+endpointPath,owner,password,billing,receiptStore,upstream),
 checkAccountDeletionStatus:(owner:string|null=null)=>checkAccountDeletionStatus(url+endpointPath,owner,receiptStore,upstream),
 enrollReceiptlessDeletionNotice:(owner:string)=>ensureReceiptlessDeletionCapability(sdk.auth,url+endpointPath,owner,actualRuntime.receiptlessDeletionCapabilityStore,upstream),
 checkReceiptlessAccountDeletionNotice:(owner:string)=>checkReceiptlessDeletionNotice(url+endpointPath,owner,actualRuntime.receiptlessDeletionCapabilityStore,upstream),
}));
const {useAuth}=await import('../providers/auth');
const {useStore}=await import('../providers/store');
const {createPresetPracticeSession,associatePracticeSessionUser,preserveFreeRehearsalArtifact}=await import('../lib/practiceSession');
const {BASELINE_DIR_NAME,baselineFileName}=await import('../lib/baselineAudio');
let practiceStore:any,latePractice:(()=>Promise<void>)|null=null;
const {default:Root}=await import('../app/_layout');
const {default:Entry}=await import('../app/entry');
const {default:Login}=await import('../app/continue-from-web');
const {default:Settings}=await import('../app/settings');
const {default:Delete}=await import('../app/delete-account');
const mountedHome=()=>React.createElement('button',{label:'Open settings',onPress:()=>router.push('/settings')},'Open settings');
const screens:Record<string,any>={'/(tabs)':mountedHome,'/entry':Entry,'/continue-from-web':Login,'/settings':Settings,'/delete-account':Delete,'/account-practice':mountedHome,'/staging-web-result':mountedHome};
function RouterScreen(){account=useAuth();practiceStore=useStore();const Screen=screens[route];assert.ok(Screen,'route '+route);return React.createElement(Screen);}
function Harness(){const [location,setLocation]=React.useState(route);route=location;navigate=setLocation;return React.createElement(Root);}
const text=()=>JSON.stringify(root.toJSON());
async function flush(){await act(async()=>{await new Promise(r=>setTimeout(r,25));});}
async function press(label:string){const control=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label||n.props.accessibilityLabel?.startsWith(label+'. '))&&!n.props.disabled);assert.ok(control,`Missing ${label}: ${text().slice(-1800)}`);await act(async()=>{await control.props.onPress();});await flush();}
const prefix=(owner:string)=>`bysi.owner.v1:${encodeURIComponent(url+':'+owner)}:`;
let capturedSession:any=null;
async function settle(){for(let index=0;index<5;index++)await flush();}
async function command(message:any){
 switch(message.command){
  case 'mount':await act(async()=>{root=create(React.createElement(Harness));});await settle();break;
  case 'login':{
   if(route!=='/entry')await act(async()=>router.replace('/entry'));
   await press('Log in');
   await act(async()=>{const inputs=root.root.findAllByType('input');inputs[0].props.onChangeText(message.owner==='B'?emailB:user.email);inputs[1].props.onChangeText(message.invalid?'wrong-password':'synthetic-password');});
   assert.equal(root.root.findAllByType('input')[0].props.value,message.owner==='B'?emailB:user.email,'mounted email state must settle before submission');
   assert.equal(root.root.findAllByType('input')[1].props.value,message.invalid?'wrong-password':'synthetic-password','mounted password state must settle before submission');
   await press('Log in');await settle();
   if(!message.invalid){assert.equal(account.user?.id,message.owner==='B'?B:A,text().slice(-1800));capturedSession=(await sdk.auth.getSession()).data.session;if(!message.skipCheck){await press('Check account status');await settle();}}
   break;
  }
  case 'practice':{
   const session=associatePracticeSessionUser(preserveFreeRehearsalArtifact(createPresetPracticeSession('synthetic-local-guest'),[{role:'user',text:'Synthetic saved customer practice',timestamp:Date.now()}] as any),A);
   const save=practiceStore.saveActivePracticeSession;
   await act(async()=>{await save(session);});latePractice=()=>save(session);
   assert.equal(practiceStore.activePracticeSession.id,session.id);
   assert.ok([...disk.entries()].some(([key,value])=>key.includes(encodeURIComponent(url+':'+A))&&value.includes(session.id)),'real StoreProvider saved owner practice');
   break;
  }
  case 'seed':await host.setItem(prefix(A)+'cc.profile.v1',JSON.stringify({name:'A private'}));await host.setItem(prefix(B)+'cc.profile.v1',JSON.stringify({name:'B private'}));capturedVoice=voiceCache.lease(url+':'+A);await capturedVoice.write('owned.wav','YQ==');await voiceCache.lease(url+':'+B).write('owned.wav','Yg==');break;
  case 'baseline':{
   const root='file:///device/Documents/'+BASELINE_DIR_NAME;
   baselineDirs.add(root);
   const owned=associatePracticeSessionUser({...createPresetPracticeSession('synthetic-local-guest'),id:'owned-A-baseline'},A);
   const colliding=associatePracticeSessionUser({...createPresetPracticeSession('synthetic-local-guest'),id:'shared:baseline'},A);
   await act(async()=>{await practiceStore.saveActivePracticeSession(owned);});
   await host.setItem(prefix(A)+'cc.sessions.v2',JSON.stringify([{schemaVersion:2,id:colliding.id,scenarioId:'bysi-v3-preset-bedtime',category:'partner',difficulty:'gentle',skillIds:[],turnCount:1,userTurnCount:1,retryCount:0,completed:true,hasKeptAudio:true,startedAt:1,contentRetained:false}]));
   await host.setItem(prefix(B)+'cc.sessions.v2',JSON.stringify([{schemaVersion:2,id:'sharedbaseline',scenarioId:'bysi-v3-preset-bedtime',category:'partner',difficulty:'gentle',skillIds:[],turnCount:1,userTurnCount:1,retryCount:0,completed:true,hasKeptAudio:true,startedAt:1,contentRetained:false}]));
   baselineFiles.set(root+'/'+baselineFileName(owned.id),'owned A retained');
   baselineFiles.set(root+'/'+baselineFileName(colliding.id),'ambiguous shared retained');
   baselineFiles.set(root+'/orphaned-historical.m4a','unknown retained');
   persist();
   break;
  }
  case 'historical':await audioHost.writeAsStringAsync('cache/rehearsal-voice/legacy.wav','synthetic unknown unchanged');break;
  case 'offline':offline=message.value;break;
  case 'failCleanup':failCleanup=message.value;break;
  case 'failSecure':failSecure=message.value;break;
  case 'holdStatus':holdStatus=message.value;if(!holdStatus)for(const release of heldStatus.splice(0))release();break;
  case 'awaitHeld':while(!heldStatus.length)await new Promise(resolve=>setTimeout(resolve,5));break;
  case 'periodic':await act(async()=>{await new Promise(resolve=>setTimeout(resolve,31000));});await settle();break;
  case 'delete':
   await press('Open settings');await press('Delete account');
   await act(async()=>root.root.findAllByType('input')[0].props.onChangeText('synthetic-password'));
   await press('Delete account anyway');assert.match(text(),/Deletion requested/);break;
  case 'receipt':await press('Check deletion status');await settle();break;
  case 'check':await press('Check account status');if(!holdStatus)await act(async()=>{await account.checkAccountStatus();});await settle();break;
  case 'foreground':await act(async()=>{for(const listener of appStateListeners)listener('active');});await settle();break;
  case 'refresh':{
   const actualNow=Date.now;Date.now=()=>actualNow()+7200000;
   await act(async()=>{await sdk.auth.refreshSession({refresh_token:'synthetic-refresh'});});await settle();break;
  }
  case 'stale':if(latePractice)await assert.rejects(latePractice());await act(async()=>{for(let index=0;index<10;index++)await (sdk.auth as any)._notifyAllSubscribers('TOKEN_REFRESHED',message.session??capturedSession);});if(capturedVoice)await assert.rejects(capturedVoice.write('late.wav','YQ=='));assert.throws(()=>voiceCache.lease(url+':'+A));await voiceCache.lease(url+':'+B).write('still-valid.wav','Yg==');await settle();break;
  case 'stop':if(root)await act(async()=>root.unmount());return {stopped:true};
 }
 const session=(await sdk.auth.getSession()).data.session;
 return {pid:process.pid,user:account?.user?.id??null,sdkOwner:session?.user.id??null,notice:account?.deletionNotice??'',text:text(),records:await actualRuntime.receiptlessDeletionJournal.records(),receipt:await receiptStore.loadLatest(),keys:[...disk.keys()],audioKeys:[...audioFiles.keys()],baselineKeys:[...baselineFiles.keys()],sdkChunks:[...secureDisk.keys()].filter(key=>key.startsWith('sdk.fixture.')),registered:await actualRuntime.receiptlessDeletionCapabilityStore.listRegisteredOwners(),capturedSession};
}
process.on('message',async(message:any)=>{
 if(!message.command)return;
 try{const result=await command(message);process.send?.({id:message.id,result});if(message.command==='stop')process.exit(0);}
 catch(error){process.send?.({id:message.id,error:String(error)+'\n'+(error as Error).stack});}
});
process.send?.({ready:true,pid:process.pid});
