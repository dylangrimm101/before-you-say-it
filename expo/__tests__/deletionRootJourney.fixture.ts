import {mock} from 'bun:test';
import {plugin} from 'bun';
import assert from 'node:assert/strict';
import React from 'react';
import {createClient} from '@supabase/supabase-js';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createMigratingSecureSessionStorage} from '../lib/secureSessionStorage';
const {verifyComponentTestDeps}=await import('../scripts/component-test-deps');
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=true;
plugin({name:'deletion-native-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
const url='https://spvksnddzyvycfoefrcf.supabase.co',A='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const disk=new Map<string,string>(),secureDisk=new Map<string,string>();
const host={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(keys:string[])=>{for(const k of keys)disk.delete(k);}};
const secure={getItem:async(k:string)=>secureDisk.get(k)??null,setItem:async(k:string,v:string)=>{assert.ok(Buffer.byteLength(v)<=1800);secureDisk.set(k,v);},removeItem:async(k:string)=>{secureDisk.delete(k);}};
const sdkStorage=createMigratingSecureSessionStorage({secure,legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},namespaceForKey:async()=> 'sdk.fixture',generation:()=>randomUUID()});
const user={id:A,aud:'authenticated',role:'authenticated',email:'a@example.invalid',email_confirmed_at:'2026-01-01',is_anonymous:false,created_at:'2026-01-01',app_metadata:{},user_metadata:{}};
const jwt=()=>[Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify({sub:A,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'synthetic'].join('.');
let revoked=false,removed=false,logoutCalls=0,refreshDenials=0;
const {PGlite}=createRequire('/tmp/bysi-hosted-tests.BlrHHI/package.json')('@electric-sql/pglite');
const dir=await mkdtemp(join(tmpdir(),'bysi-delete-root-'));let db:any=new PGlite(dir);
await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;CREATE ROLE service_role BYPASSRLS;CREATE ROLE bysi_native_service;CREATE ROLE bysi_account_deletion_api;CREATE ROLE bysi_account_deletion_worker;CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,is_anonymous boolean DEFAULT false,deleted_at timestamptz);CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;GRANT USAGE ON SCHEMA auth TO authenticated;GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;`);
for(const name of ['202608290001_create_lesson_feedback','202609060001_web_bridge','202609060002_private_web_result','202609060003_private_result_service_acl','202609060004_checkout_binding','202609060005_owner_result_discovery','202609060006_staging_paid_access','202609070001_hosted_browser_sessions','202609090001_native_free_sessions'])await db.exec(await readFile(new URL('../../backend/supabase/migrations/'+name+'.sql',import.meta.url),'utf8'));
await db.exec(await readFile('/Users/donaldgrimm/Projects/bysi-web-claude-parity/server/revenuecat/schema.sql','utf8'));
await db.exec(await readFile(new URL('../../backend/supabase/migrations/202609100001_account_deletion.sql',import.meta.url),'utf8'));
await db.query(`INSERT INTO auth.users(id,email,email_confirmed_at) VALUES($1,'a@example.invalid',now()),($2,'b@example.invalid',now())`,[A,B]);
const upstream:typeof fetch=async(input:any,init:any={})=>{
 const target=new URL(String(input)),path=target.pathname,body=init.body?JSON.parse(String(init.body)):{};
 if(target.origin!==url)throw Error('No external network allowed');
 if(path==='/auth/v1/token'){
  if(revoked||removed){refreshDenials++;return Response.json({code:'refresh_token_not_found',msg:'Synthetic revoked'},{status:400,headers:{'x-supabase-api-version':'2024-01-01'}});}
  return Response.json({access_token:jwt(),refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user});
 }
 if(path==='/auth/v1/user')return removed?Response.json({code:'user_not_found',msg:'Synthetic absent'},{status:404}):Response.json(user);
 if(path==='/auth/v1/logout'){logoutCalls++;revoked=true;return new Response(null,{status:204});}
 if(path===`/auth/v1/admin/users/${A}`){if(init.method==='DELETE'){removed=true;await db.query('DELETE FROM auth.users WHERE id=$1',[A]);return new Response(null,{status:204});}return removed?new Response(null,{status:404}):Response.json(user);}
 if(path.startsWith('/rest/v1/rpc/')){
  const worker=new Headers(init.headers).get('authorization')==='Bearer worker-fixture';
  const name=path.split('/').at(-1)!;
  const rpc:Record<string,any>={bysi_account_deletion_request:['SELECT public.bysi_account_deletion_request($1,$2) v',[body.p_owner,body.p_receipt_digest]],bysi_account_deletion_status:['SELECT public.bysi_account_deletion_status($1) v',[body.p_receipt_secret]],bysi_account_deletion_work:['SELECT public.bysi_account_deletion_work($1) v',[body.p_limit]],bysi_account_deletion_claim_external:['SELECT public.bysi_account_deletion_claim_external($1) v',[body.p_lease]],bysi_account_deletion_provider_retry:['SELECT public.bysi_account_deletion_provider_retry($1,$2,$3::jsonb) v',[body.p_request,body.p_lease,JSON.stringify(body.p_evidence)]],bysi_account_deletion_complete:['SELECT public.bysi_account_deletion_complete($1,$2::jsonb,$3::jsonb,$4) v',[body.p_request,JSON.stringify(body.p_provider_evidence),JSON.stringify(body.p_auth_evidence),body.p_lease]]};
  assert.ok(rpc[name]);await db.exec('SET ROLE '+(worker?'bysi_account_deletion_worker':'bysi_account_deletion_api'));
  try{return Response.json((await db.query(...rpc[name])).rows[0].v);}finally{await db.exec('RESET ROLE');}
 }
 throw Error('Unmodeled synthetic HTTP '+path);
};
const makeSdk=()=>createClient(url,'synthetic-public',{global:{fetch:upstream},auth:{storage:sdkStorage,persistSession:true,autoRefreshToken:false,detectSessionInUrl:false,storageKey:'synthetic-auth'}});
let sdk=makeSdk();
mock.module('@react-native-async-storage/async-storage',()=>({default:host}));
mock.module('@/lib/supabase',()=>({supabase:{get auth(){return sdk.auth;}},authEnvironment:{url,keychainService:'beforeyousayit.supabase',staging:false},isAuthConfigured:true}));
mock.module('expo-secure-store',()=>({isAvailableAsync:async()=>true,AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,getItemAsync:async(k:string,o:any)=>{assert.match(k,/^[A-Za-z0-9._-]+$/);return secure.getItem(`${o?.keychainService??'default'}:${k}`);},setItemAsync:async(k:string,v:string,o:any)=>{assert.match(k,/^[A-Za-z0-9._-]+$/);return secure.setItem(`${o?.keychainService??'default'}:${k}`,v);},deleteItemAsync:async(k:string,o:any)=>secure.removeItem(`${o?.keychainService??'default'}:${k}`)}));
mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA256'},randomUUID,digestStringAsync:async(_:string,v:string)=>createHash('sha256').update(v).digest('hex')}));
mock.module('expo-file-system/legacy',()=>({cacheDirectory:'cache/',getInfoAsync:async()=>({exists:false})}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{setValue(){}stopAnimation(){}interpolate(){return this;}addListener(){return 'x';}removeListener(){}}
const animation={start:(cb:any)=>cb?.({finished:true}),stop(){}};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),AppState:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){}},ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated:{Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation},Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:(v:any)=>v.ios??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
mock.module('@/lib/purchases',()=>({trialEligibility: async () => 0, PRO_ENTITLEMENT:'pro',useNativeServerAccess:()=>({data:false,isPending:false}),identifyPurchasesUser:async()=>null,clearPurchasesIdentity:async()=>{},useIsPro:()=>false,useCustomerInfo:()=>({data:null,isLoading:false}),useOfferings:()=>({data:null,isLoading:false}),usePurchasePackage:()=>({isPending:false}),useRestorePurchases:()=>({isPending:false})}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({baselineFileName:(id:string)=>`${id.replace(/[^a-zA-Z0-9_-]/g,'')||'session'}.m4a`,listBaselineAudioFileNamesStrict:async()=>[],deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},resetSpeech:async()=>{},stopSpeech:async()=>{}}));
mock.module('lucide-react-native',()=>Object.fromEntries(['Bookmark','Star','TrendingUp','X','AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'].map(k=>[k,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('react-native-safe-area-context',()=>({useSafeAreaInsets:()=>({top:0,bottom:0})}));
mock.module('@/components/ui',()=>({Backdrop:()=>null,HeroSurface:Host,Eyebrow:Host,Meter:Host,StateDock:Host,Thinking:Host,MicControl:Host,Waveform:Host,Reveal:Host,GlassCard:Host,PressCard:(p:any)=>React.createElement('button',p,p.children),GhostButton:(p:any)=>React.createElement('button',p,p.label),PrimaryButton:(p:any)=>React.createElement('button',p,p.label),tap(){},useReducedMotion:()=>true}));
mock.module('react-native-gesture-handler',()=>({GestureHandlerRootView:Host}));
mock.module('expo-font',()=>({useFonts:()=>[true,null]}));mock.module('expo-status-bar',()=>({StatusBar:()=>null}));mock.module('expo-splash-screen',()=>({preventAutoHideAsync:async()=>{},hideAsync:async()=>{}}));
mock.module('@/components/LaunchExperience',()=>({LaunchExperience:()=>null}));mock.module('@/components/MigrationNotice',()=>({MigrationNotice:()=>null}));
mock.module('@/components/PaidProductUI',()=>({ProductCard:Host,SectionLabel:Host,StatusPill:Host,PaidHeader:Host}));
mock.module('expo-constants',()=>({default:{expoConfig:{version:'synthetic'}}}));
let route='/entry',navigate:any,account:any,root:any;
const router={replace:(r:any)=>{route=typeof r==='string'?r:r.pathname;navigate?.(route);},push:(r:any)=>router.replace(r),back:()=>router.replace('/settings'),canGoBack:()=>true,setParams(){}};
const Stack=Object.assign(()=>React.createElement(RouterScreen),{Screen:()=>null});
mock.module('expo-router',()=>({Stack,useRouter:()=>router,useLocalSearchParams:()=>({}),useGlobalSearchParams:()=>({}),useSegments:()=>route.split('/').filter(Boolean),useFocusEffect:(cb:any)=>React.useEffect(cb,[cb])}));
const {createDeletionService,createSupabaseAccountDeletionStore,createSupabaseAuthAdmin}=await import('../../backend/account-lifecycle/service');
const {createAccountDeletionWorker,createRevenueCatDeletionProvider}=await import('../../backend/account-lifecycle/worker');
const {requestAccountDeletion,checkAccountDeletionStatus}=await import('../lib/accountDeletion');
const actualRuntime=await import('../lib/accountLifecycleRuntime');
const handler=createDeletionService({enabled:true,url,publicKey:'synthetic-public',adminKey:'admin-fixture',deletionRpcKey:'api-fixture'},upstream);
const receiptStore=actualRuntime.accountDeletionReceiptStore;
const requestFetch:typeof fetch=async(input,init)=>handler(new Request(input,init));
mock.module('@/lib/accountLifecycleRuntime',()=>({...actualRuntime,accountDeletionAvailable:true,deleteAccountIdentity:(owner:string,password:string,billing:any)=>requestAccountDeletion(sdk.auth,url+'/functions/v1/account-delete',owner,password,billing,receiptStore,requestFetch),checkAccountDeletionStatus:(owner:string|null=null)=>checkAccountDeletionStatus(url+'/functions/v1/account-delete',owner,receiptStore,requestFetch)}));
const {useAuth}=await import('../providers/auth');
const {default:Root}=await import('../app/_layout');
const {default:Entry}=await import('../app/entry');
const {default:Login}=await import('../app/continue-from-web');
const {default:Settings}=await import('../app/settings');
const {default:Delete}=await import('../app/delete-account');
const screens:Record<string,any>={'/(tabs)':()=>React.createElement('button',{label:'Open settings',onPress:()=>router.push('/settings')},'Open settings'),'/entry':Entry,'/continue-from-web':Login,'/settings':Settings,'/delete-account':Delete,'/account-practice':()=>React.createElement('button',{label:'Open settings',onPress:()=>router.push('/settings')},'Open settings')};
function RouterScreen(){account=useAuth();const Screen=screens[route];assert.ok(Screen,'route '+route);return React.createElement(Screen);}
function Harness(){const [location,setLocation]=React.useState(route);route=location;navigate=setLocation;return React.createElement(Root);}
const text=()=>JSON.stringify(root.toJSON());
async function flush(){await act(async()=>{await new Promise(r=>setTimeout(r,25));});}
async function press(label:string){const control=root.root.findAllByType('button').find((n:any)=>(n.props.label===label||n.props.accessibilityLabel===label||n.props.accessibilityLabel?.startsWith(label+'. '))&&!n.props.disabled);assert.ok(control,`Missing ${label}: ${text().slice(-1800)}`);await act(async()=>{await control.props.onPress();});await flush();}
try{
 await act(async()=>{root=create(React.createElement(Harness));});await flush();await flush();
 await press('Log in');
 await act(async()=>{const inputs=root.root.findAllByType('input');inputs[0].props.onChangeText(user.email);inputs[1].props.onChangeText('synthetic-password');});
 await press('Log in');await flush();assert.equal(account.user.id,A);
 await press('Open settings');await press('Delete account');assert.equal(route,'/delete-account');
 const prefix=(owner:string)=>`bysi.owner.v1:${encodeURIComponent(url+':'+owner)}:`;
 await host.setItem(prefix(A)+'cc.profile.v1',JSON.stringify({name:'synthetic A'}));await host.setItem(prefix(B)+'cc.profile.v1',JSON.stringify({name:'synthetic B'}));
 await act(async()=>root.root.findAllByType('input')[0].props.onChangeText('synthetic-password'));
 await press('Delete account anyway');assert.match(text(),/Deletion requested/);assert.equal((await sdk.auth.getSession()).data.session?.user.id,A,'remote revoke does not clear installed SDK');
 await act(async()=>root.unmount());await db.close();db=new PGlite(dir);route='/delete-account';sdk=makeSdk();
 await act(async()=>{root=create(React.createElement(Harness));});await flush();await flush();
 const worker=createAccountDeletionWorker({store:createSupabaseAccountDeletionStore({url,workerRpcKey:'worker-fixture'},upstream),providers:createRevenueCatDeletionProvider({secretKey:'synthetic',fetch:async()=>{throw Error('No RC binding: must not dispatch');}}),authAdmin:createSupabaseAuthAdmin({url,adminKey:'synthetic'},upstream)});
 assert.deepEqual(await worker.runOnce(),{erased:1,providerRetry:0,completed:1});
 await press('Check deletion status');await flush();
 assert.equal((await sdk.auth.getSession()).data.session,null,'completion must clear actual persisted SDK session');
 assert.ok(![...secureDisk.keys()].some(key=>key.startsWith('sdk.fixture.')),'SDK logout removes all protected session chunks');
 assert.equal(account.user,null);assert.equal(await host.getItem(prefix(A)+'cc.profile.v1'),null);assert.ok(await host.getItem(prefix(B)+'cc.profile.v1'));
 const refreshed=await sdk.auth.refreshSession({refresh_token:'synthetic-refresh'});assert.ok(refreshed.error);assert.ok(refreshDenials>0);assert.ok(logoutCalls>0);
 await act(async()=>root.unmount());sdk=makeSdk();route='/delete-account';await act(async()=>{root=create(React.createElement(Harness));});await flush();await flush();await press('Check deletion status');assert.match(text(),/Your account has been deleted/);assert.equal(account.user,null);
 console.log('PASS mounted Root/Auth/Store deletion -> installed SDK -> handler/restricted file-backed SQL -> worker -> local SDK logout -> SDK and root reopen -> receipt. Synthetic upstream and native primitives only.');
}finally{if(root)await act(async()=>root.unmount());await db.close();await rm(dir,{recursive:true,force:true});}
