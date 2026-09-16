import {mock} from 'bun:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {randomBytes,randomUUID,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
const web=new URL('../../server/',import.meta.url).pathname.replace(/\/$/,'');
const {setupContent,capture}=await import(web+'/tests/normal-results-proof.mjs');const {db,database,contentDatabase}=await setupContent();
const origin='https://beforeyousayit.app',authOrigin='https://spvksnddzyvycfoefrcf.supabase.co',owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,aud:'authenticated',role:'authenticated',email:'synthetic@invalid',is_anonymous:false,email_confirmed_at:'2026-01-01',created_at:'2026-01-01',app_metadata:{},user_metadata:{}};
const tokenFor=(id:string)=>{const value=[{alg:'HS256',typ:'JWT'},{sub:id,exp:Math.floor(Date.now()/1000)+3600}].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');return value+'.'+createHmac('sha256','synthetic-local-auth').update(value).digest('base64url');};
const verifiedOwner=(token:string)=>{try{const [head,payload,signature]=token.replace(/^Bearer /,'').split('.');const expected=createHmac('sha256','synthetic-local-auth').update(head+'.'+payload).digest('base64url');if(signature.length!==expected.length||!timingSafeEqual(Buffer.from(signature),Buffer.from(expected)))return null;const claims=JSON.parse(Buffer.from(payload,'base64url').toString());return claims.exp>Date.now()/1000?claims.sub:null;}catch{return null;}};
let authReads=0,providerCalls=0;const verifiedTokens:string[]=[];
let transportUser=user;
const authFetch=async(url:any,init:any)=>{authReads++;if(String(url).includes('/signup'))return Response.json({user,session:null});if(String(url).includes('/logout'))return new Response(null,{status:204});if(String(url).includes('/token'))return Response.json({access_token:tokenFor(transportUser.id),refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:transportUser});const authorization=new Headers(init.headers).get('authorization')??'';verifiedTokens.push(authorization);return verifiedOwner(authorization)===transportUser.id?Response.json(transportUser):Response.json({message:'Synthetic token rejected'},{status:401});};
const sdk=createClient(authOrigin,'synthetic-public',{global:{fetch:authFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
// Same existing owner-bound one-time authority; synthetic Stripe transport only.
await db.exec(readFileSync(web+'/server/follow-through/schema.sql','utf8'));
await db.exec(readFileSync(web+'/server/follow-through/recovery.sql','utf8'));
const {createRuntime:createBenefitRuntime}=await import(web+'/server/follow-through/runtime.mjs');
let checkout:any,checkoutCalls=0;let refund=false;
const originalBenefit={mode:'repair_plan',outcome:'Synthetic unchanged original web benefit',strategy:'Keep the original strategy.'};
const benefit=createBenefitRuntime({database:contentDatabase,env:{BYSI_FOLLOW_THROUGH:'owner-v1',BYSI_FOLLOW_THROUGH_LIVEMODE:'false',BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',STRIPE_SECRET_KEY:'synthetic',STRIPE_BYSI_FOLLOW_THROUGH_PRICE_ID:'price_fixture'},fetch:async(url:any,init:any)=>{
 if(String(url).includes('/auth/'))return authFetch(url,init);
 if(String(url).endsWith('/checkout/sessions')){checkoutCalls++;const body=new URLSearchParams(init.body);checkout={id:'cs_fixture',url:'https://checkout.stripe.com/c/pay/fixture',mode:'payment',payment_status:'paid',livemode:false,metadata:{binding:body.get('metadata[binding]')},line_items:{has_more:false,data:[{price:{id:'price_fixture'},quantity:1}]},payment_intent:{id:'pi_fixture',status:'succeeded',latest_charge:{id:'ch_fixture',payment_intent:'pi_fixture',livemode:false,captured:true,amount_captured:999,paid:true,amount:999,currency:'usd'}}};return Response.json(checkout);}
 if(String(url).includes('/checkout/sessions/cs_fixture'))return Response.json(checkout);
 if(String(url).includes('/refunds?'))return Response.json({has_more:false,data:refund?[{id:'re_fixture',charge:'ch_fixture',payment_intent:'pi_fixture',status:'succeeded',amount:999,currency:'usd'}]:[]});
 throw Error('Unexpected synthetic benefit request');
}});
const benefitAuthority=await benefit;
mock.module(web+'/server/follow-through/runtime.mjs',()=>({getRuntime:()=>benefit,createRuntime:createBenefitRuntime}));
const benefitInput={operationId:randomUUID(),intent:'Synthetic',rawMessage:'Original',negativePattern:'Waiting',situationType:'logistics',forecast:{diagnosis:'fixture'}};
await benefitAuthority!.checkout('Bearer '+tokenFor(owner),benefitInput);
await benefitAuthority!.deliver('Bearer '+tokenFor(owner),'cs_fixture',async()=>originalBenefit);
await benefitAuthority!.checkout('Bearer '+tokenFor(owner),{...benefitInput,operationId:randomUUID()});assert.equal(checkoutCalls,1,'same existing benefit never charges twice');
// Sign in only through mounted customer controls below.
// Real complete source schemas, same DB for result and paid authority.
const {createServerClients}=await import(web+'/server/revenuecat/http.mjs');const verify=createServerClients({authOrigin,publicKey:'synthetic-public',revenueCatKey:'unused',fetch:authFetch});
const {createFreeRuntime}=await import(web+'/server/native-free/runtime.mjs');
const providerCosts=JSON.stringify({pushback:1,close:1,result:1,tts_pushback:1,tts_close:1,transcribe_opener:1,transcribe_reply:1});
const runtime=createFreeRuntime({database:contentDatabase,fetch:authFetch,env:{BYSI_NATIVE_FREE:'registered-v1',BYSI_NATIVE_FREE_PROVENANCE_KEY:'a'.repeat(64),BYSI_NATIVE_FREE_DAILY_SPEND_CENTS:'500',BYSI_NATIVE_FREE_PROVIDER_COST_CENTS:providerCosts,BYSI_NATIVE_SERVICE:'account-v1',BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:fixture@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:'synthetic-webhook-authorization-not-live'}});
mock.module(web+'/server/native-free/runtime.mjs',()=>({createFreeRuntime,getFreeRuntime:()=>runtime}));
const mounts:Record<string,any>={};for(const op of ['session','generate','tts','transcribe'])mounts[op]=(await import(web+'/app/api/native/free/'+op+'/route.js')).POST;
const {NextRequest}=await import(web+'/node_modules/next/server.js');

import {plugin} from 'bun';
import React from 'react';

import {verifyComponentTestDeps} from '../scripts/component-test-deps';
const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;(globalThis as any).__DEV__=false;
plugin({name:'app-first-assets',setup(b){b.onLoad({filter:/\.(png|ttf)$/},()=>({contents:'export default 1',loader:'js'}));}});
// Synthetic disk/native hosts; Auth/Store/root and storage codecs remain real.
const disk=new Map<string,string>(),secureDisk=new Map<string,string>();
const raw={getItem:async(k:string)=>disk.get(k)??null,setItem:async(k:string,v:string)=>{disk.set(k,v);},removeItem:async(k:string)=>{disk.delete(k);},getAllKeys:async()=>[...disk.keys()],multiRemove:async(ks:string[])=>{ks.forEach(k=>disk.delete(k));}};
mock.module('@react-native-async-storage/async-storage',()=>({default:raw}));
const auth=sdk.auth;
mock.module('@/lib/supabase',()=>({supabase:{auth},authEnvironment:{url:authOrigin,staging:false},isAuthConfigured:true}));
let rcId='anonymous';let sequence=0;let sdkPro=false;let restoreHook:any;let observedPro=false;let observedClient:any;let holdAccess=false;let releaseAccess:any;
const now=Date.now(),secret='synthetic-webhook-authorization-not-live';
const snapshot=()=>({request_date_ms:now,subscriber:{entitlements:{pro:{product_identifier:'byis_pro_monthly_5',expires_date:new Date(now+3600000).toISOString()}},subscriptions:{byis_pro_monthly_5:{store:'app_store',is_sandbox:false,ownership_type:'PURCHASED',refunded_at:null,store_transaction_id:'fixture-tx',expires_date:new Date(now+3600000).toISOString()}}}});
const {createServiceRuntime}=await import(web+'/server/revenuecat/service.mjs');
const {createReceiverRuntime}=await import(web+'/server/revenuecat/receiver.mjs');
const {createRuntime}=await import(web+'/server/revenuecat/runtime.mjs');
const paid=createServiceRuntime({database,now:()=>now,env:{BYSI_NATIVE_SERVICE:'production-v1',BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_NATIVE_PAID:'revenuecat-v1',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_DATABASE_URL:'postgres://fixture:fixture@localhost/fixture?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:secret},fetch:async(url:any,init:any)=>String(url).includes('/auth/')?authFetch(url,init):Response.json(snapshot())});
const receiver=createReceiverRuntime({database,now:()=>now,env:{BYSI_REVENUECAT_RECEIVER:'receiver-v1',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_DATABASE_URL:'postgres://bysi_native_runtime:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:secret},fetch:async(url:any,init:any)=>String(url).includes('/auth/')?authFetch(url,init):Response.json(snapshot())});
mock.module(web+'/server/revenuecat/service.mjs',()=>({getServiceRuntime:()=>paid}));
const paidRoutes:any={};for(const op of ['identify','access','generate','tts','transcribe'])paidRoutes[op]=(await import(web+'/app/api/native/'+op+'/route.js')).POST;
const {createResultsRuntime}=await import(web+'/server/normal-results/runtime.mjs');
const content=createResultsRuntime({database:contentDatabase,env:{BYSI_NATIVE_RESULTS:'normal-results-v1',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:fixture@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public'},fetch:authFetch});
mock.module(web+'/server/normal-results/runtime.mjs',()=>({createResultsRuntime,getResultsRuntime:()=>content}));
const contentRoutes:any={};for(const op of ['discover','restore','delete','claim'])contentRoutes[op]=(await import(web+'/app/api/native/results/'+op+'/route.js')).POST;
for(const op of ['discover','restore','recovery'])paidRoutes['follow-through/'+op]=(await import(web+'/app/api/follow-through/'+op+'/route.js')).POST;
async function billingEvent(type='INITIAL_PURCHASE'){
 const r=await receiver.webhook(new NextRequest(origin+'/api/native/webhook',{method:'POST',headers:{authorization:secret,'content-type':'application/json'},body:JSON.stringify({api_version:'1.0',event:{id:'fixture-'+(++sequence),type,app_id:'appab45402f36',event_timestamp_ms:now+sequence,app_user_id:rcId,original_app_user_id:rcId,aliases:[rcId],environment:'PRODUCTION',store:'APP_STORE',product_id:'byis_pro_monthly_5',entitlement_ids:['pro'],transaction_id:'fixture-tx',is_family_share:false}})}));assert.equal(r.status,200);
}
const info=()=>({entitlements:{active:sdkPro?{pro:{}}:{}}});
mock.module('react-native-purchases',()=>({default:{configure(){},getAppUserID:async()=>rcId,isAnonymous:async()=>rcId==='anonymous',getCustomerInfo:async()=>info(),logIn:async(id:string)=>{rcId=id;return {customerInfo:info()};},logOut:async()=>{rcId='anonymous';sdkPro=false;return info();},getOfferings:async()=>({}),restorePurchases:async()=>{sdkPro=true;await billingEvent();return info();}}}));
mock.module('@/lib/reminders',()=>({cancelChallengeNudge:async()=>{},cancelDailyReminder:async()=>{},syncChallengeNudge:async()=>{}}));
mock.module('@/lib/baselineAudio',()=>({deleteAllBaselineAudioStrict:async()=>{},deleteBaselineAudioStrict:async()=>{}}));
const dictation={status:'denied',error:'synthetic permission denied',cancel:async()=>{},reset:async()=>{},requestPermission:async()=>false};
mock.module('@/lib/useDictation',()=>({useDictation:()=>dictation}));

mock.module('@/lib/voice',()=>({deleteGeneratedVoiceCacheStrict:async()=>{},replaySpeech:async()=>{},resetSpeech:async()=>{},speak:async()=>{},stopSpeech:async()=>{},unlockAudioPlayback:async()=>{},useSpeech:()=>({phase:'idle',canReplay:false}),preparePaidPilotAudio:async()=>false,playPreparedPilotAudio:async()=>{},speakPaidPilotAudio:async()=>{},speakPaidPilotAudioToCompletion:async()=>{}}));
const Host=(p:any)=>React.createElement('host',p,p.children);
class Value{constructor(public value=0){}setValue(v:number){this.value=v;}stopAnimation(){}interpolate(){return this;}addListener(){return 'listener';}removeListener(){}}
const animation={start:(cb?:any)=>cb?.({finished:true}),stop(){}};
const Animated={Value,View:Host,Text:Host,ScrollView:Host,event:()=>()=>{},timing:()=>animation,parallel:()=>animation,stagger:()=>animation,multiply:()=>new Value(),add:()=>new Value(),subtract:()=>new Value()};
mock.module('react-native',()=>({View:Host,Text:Host,Image:Host,ScrollView:Host,Pressable:(p:any)=>React.createElement('button',p,p.children),TextInput:(p:any)=>React.createElement('input',p),AppState:{addEventListener:()=>({remove(){}})},AccessibilityInfo:{announceForAccessibility(){}},ActivityIndicator:Host,KeyboardAvoidingView:Host,Animated,Easing:{bezier:()=>()=>{},out:()=>()=>{},cubic:()=>{}},InteractionManager:{runAfterInteractions:(fn:any)=>{fn();return {cancel(){}};}},Keyboard:{dismiss(){},addListener:()=>({remove(){}})},Alert:{alert(){}},Linking:{openURL:async()=>{}},useWindowDimensions:()=>({width:390,height:844}),Platform:{OS:'ios',select:(v:any)=>v.ios??v.default},StyleSheet:{create:(v:any)=>v,absoluteFillObject:{}}}));
const icons=['Bookmark','Star','TrendingUp','X','AlertCircle','ChevronDown','Clock3','ArrowUp','Keyboard','Mic','RotateCcw','Square','Volume2','VolumeX','Lock','ArrowLeft','LockKeyhole','Check','ChevronRight','PenLine','Sparkles','Circle','Info','Settings','Target','Trash2','CreditCard','Database','FileText','FlaskConical','HelpCircle','Mic2','RefreshCw','ShieldCheck','UserRound'];
mock.module('lucide-react-native',()=>Object.fromEntries(icons.map(i=>[i,()=>null])));
mock.module('react-native-svg',()=>({default:Host,Circle:Host,Path:Host,Rect:Host}));
mock.module('expo-blur',()=>({BlurView:Host}));
mock.module('expo-constants',()=>({ExecutionEnvironment:{StoreClient:'go'},default:{executionEnvironment:'standalone',expoConfig:{version:'synthetic'}}}));
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
for(const name of Object.keys(process.env))if(name.startsWith('EXPO_PUBLIC_'))delete process.env[name];
process.env.EAS_BUILD_PROFILE='testflight';process.env.EXPO_PUBLIC_SUPABASE_URL=authOrigin;process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY='sb_publishable_fixture';
process.env.EXPO_PUBLIC_NATIVE_RESULTS='normal-results-v1';process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY='appl_fixture';process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN=origin;delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;process.env.ANTHROPIC_API_KEY='synthetic';
const {default:configureRelease}=await import('../app.config');const releaseConfig=(await import('../app.json')).default;assert.equal(configureRelease({config:releaseConfig.expo} as any).updates?.enabled,false,'actual Release config accepts exact normal content composition');
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,isAvailableAsync:async()=>true,getItemAsync:async(k:string)=>secureDisk.get(k)??null,deleteItemAsync:async(k:string)=>{secureDisk.delete(k);},setItemAsync:async(k:string,v:string)=>{secureDisk.set(k,v);}}));
mock.module('expo-crypto',()=>({randomUUID,getRandomBytes:randomBytes,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
const outputMode=process.argv[2]??'positive';const {fixture}=await import('../../server/tests/fixtures/generation-output.mjs');
let loseResult=outputMode==='recovery';
const seenOperations:string[]=[];let holdResult=false;let releaseResult:any;
globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).startsWith(origin+'/api/follow-through/'))return paidRoutes['follow-through/'+String(url).split('/').at(-1)!](new NextRequest(url,init));
 if(String(url).startsWith(origin+'/api/native/results/')){const response=await contentRoutes[String(url).split('/').at(-1)!](new NextRequest(url,init));if(holdResult&&String(url).endsWith('/restore'))await new Promise(resolve=>releaseResult=resolve);return response;}
 if(String(url).startsWith(origin+'/api/native/')&&!String(url).includes('/free/')){if(holdAccess&&String(url).endsWith('/access'))await new Promise(resolve=>releaseAccess=resolve);const response=await paidRoutes[String(url).split('/api/native/')[1]](new NextRequest(url,init));if(!response.ok)console.log('SYNTHETIC PAID ROUTE DIAGNOSTIC',await response.clone().text());return response;}
 if(String(url).startsWith(origin+'/api/native/free/')){const op=String(url).split('/').at(-1)!;seenOperations.push(op);const r=await mounts[op](new NextRequest(url,init));if(loseResult&&op==='generate'&&JSON.parse(init.body).type==='free_rehearsal_result'&&r.ok){loseResult=false;throw Error('Synthetic response lost after durable result commit');}return r;}
 assert.equal(String(url),'https://api.anthropic.com/v1/messages');providerCalls++;const body=JSON.parse(JSON.parse(init.body).messages[0].content);
 const full=fixture();full.starting_index.overall=null;full.starting_index.observed_dimensions[0].score=43.25;full.pressure_moment.ask_quote=body.transcript.user_turn_1;full.pressure_moment.pushback_quote=body.transcript.counterpart_pushback;full.pressure_moment.response_quote=body.transcript.user_turn_2;
 const output=body.turn?{mode:'turn',turn:body.turn,role:'adam',text:body.lesson_constraints?(body.turn==='pushback'?"I understand the late handoff caused a scramble, but quarter close has been unusually heavy. What timing would give you enough review time?":"I am already stretched at quarter close; what else makes the late handoff a pattern worth changing our process?"):body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'I am already stretched with the client work. Which priority should wait?',safety:null}:outputMode!=='insufficient'?full:{mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'No supported score in this fixture.',next_step:'Use typed practice.'}};
 return Response.json({id:'msg_synthetic_'+providerCalls,model:'synthetic-fixture',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
const actualAI=await import('../lib/ai');
(globalThis as any).requestAnimationFrame=(cb:any)=>{cb(0);return 1;};
const generated:any[]=[];
const actualM1Reply=actualAI.generateM1L1DynamicReply,actualApprovedReply=actualAI.generateApprovedRehearsalDynamicReply;
mock.module('@/lib/ai',()=>({...actualAI,generateM1L1DynamicReply:async(input:any)=>{generated.push(structuredClone(input));return actualM1Reply(input);},generateApprovedRehearsalDynamicReply:async(input:any)=>{generated.push(structuredClone(input));return actualApprovedReply(input);}}));
const {QueryClient,QueryClientProvider,useQueryClient}=await import('@tanstack/react-query');
const {AuthProvider,useAuth}=await import('../providers/auth');
const purchases=await import('../lib/purchases');
assert.ok((await import('node:fs')).existsSync(new URL('../app/saved-result.tsx',import.meta.url)),'normal consumer screen missing despite implemented SQL content contract');
const {default:Saved}=await import('../app/saved-result');
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
const screens:Record<string,any>={'/saved-result':Saved,'/entry':Entry,'/continue-from-web':Login,'/account-practice':AccountPractice,'/onboarding':Onboarding,'/rehearse/[id]':Rehearse,'/debrief/[id]':Debrief,'/(tabs)':Today,'/(tabs)/library':Library,'/paywall':Paywall,'/approved-lesson/[lessonId]':Lesson,'/approved-rehearsal/[lessonId]':LessonRehearsal};
function RouterScreen(){observedPro=purchases.useIsPro();observedClient=useQueryClient();restoreHook=purchases.useRestorePurchases();account=useAuth();store=useStore();const path=routePath();const Screen=screens[path];assert.ok(Screen,'mounted destination '+path);return React.createElement(Screen,{key:JSON.stringify(route)});}
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
 if(outputMode==='saved'){await capture(db);await press('I already have an account');await act(async()=>{const inputs=root.root.findAllByType('input');inputs[0].props.onChangeText(user.email);inputs[1].props.onChangeText('synthetic-only-password');});await press('Log in');assert.equal(routePath(),'/saved-result');}
 else {
 await press('Get started');assert.equal(routePath(),'/onboarding');
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
 assert.ok(text().includes('You asked for a task.'));assert.ok(store.activePracticeSession.sharedResult);
 await press('Continue with saved result');
 }
 assert.equal(routePath(),'/saved-result');await flush();await flush();
 assert.ok(text().includes('You asked for a task.'));
 assert.ok(text().includes('Open saved Follow-Through'),'ordinary login discovers existing original web benefit without a manual lookup');
 await press('Open saved Follow-Through');assert.ok(text().includes(originalBenefit.outcome));assert.equal(checkoutCalls,1);
 const savedBefore=(await db.query('select state from bysi_native_free.session where owner_id=$1',[owner])).rows[0].state.record;
 assert.deepEqual(root.root.findByType((await import('../components/PrivateWebResultPresentation')).PrivateWebResultPresentation).props.record,savedBefore);
 assert.equal(savedBefore.result.starting_index.overall,null);assert.equal(savedBefore.result.starting_index.observed_dimensions[0].score,43.25);
 assert.equal(store.convertedLessonProgress.length,0,'saved content never marks a lesson complete');
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),false);
 assert.ok(text().includes('Review monthly subscription'),'same ordinary additional offer without content-paid grant');
 await press('Review monthly subscription');assert.equal(routePath(),'/paywall');
 await act(async()=>{assert.equal(await restoreHook.mutateAsync(),true);});await flush();
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),true);
 refund=true;await benefitAuthority!.reconcileEvent({type:'charge.refunded',data:{object:{payment_intent:'pi_fixture'}}});
 assert.equal((await db.query('select denied from bysi_follow_through.purchase')).rows[0].denied,true);
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),true,'web refund does not revoke independent native Pro');
 await go('/saved-result');await flush();await flush();await press('Continue to next practice');
 assert.equal(routePath(),'/approved-lesson/[lessonId]');assert.equal(params.lessonId,'m1-l1');
 holdAccess=true;
 if(process.env.BYSI_TEST_DEV_BYPASS==='1'){(globalThis as any).__DEV__=true;await act(async()=>store.toggleDevPro(true));}
 await act(async()=>{void observedClient.invalidateQueries({queryKey:['native','access']});await new Promise(r=>setTimeout(r,20));});
 try{assert.equal(observedPro,false,'cached SQL positive must not admit mounted lesson while current verification is pending');assert.equal(root.root.findAllByType('webview').length,0,'normal server mode must deny lesson despite legacy devPro toggle');}
 finally{holdAccess=false;releaseAccess?.();(globalThis as any).__DEV__=false;}
 await flush();await flush();
  const id='m1-l1',entry:any={steps:[]};
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
 const pendingRun=structuredClone(store.activeScenarioRun);
 holdAccess=true;
 if(process.env.BYSI_TEST_DEV_BYPASS==='1'){(globalThis as any).__DEV__=true;await act(async()=>store.toggleDevPro(true));}
 await act(async()=>{void observedClient.invalidateQueries({queryKey:['native','access']});await new Promise(r=>setTimeout(r,20));});
 try{assert.equal(observedPro,false);assert.equal(root.root.findAllByType('input').length,0,'pending SQL verification hides protected rehearsal controls');assert.deepEqual(store.activeScenarioRun,pendingRun,'pending verification must preserve ongoing owner practice');}
 finally{holdAccess=false;releaseAccess?.();(globalThis as any).__DEV__=false;}
 await flush();await flush();
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
  await press('Log in');await flush();assert.ok(account.user,'second login: '+text());assert.equal(account.user.id,transportUser.id);assert.equal(routePath(),'/saved-result');await flush();assert.ok(!text().includes(originalBenefit.outcome),'owner swap removes web benefit content');assert.ok(text().includes('No original Follow-Through is linked to this account.'),'B cannot discover A benefit');assert.ok(text().includes('We couldn’t find a saved result linked to this account.'));assert.ok(text().includes('Don’t buy the same plan again.'));assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await restart();assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await go('/entry');await press('Sign out');transportUser=user;await press('I already have an account');await act(async()=>{const fields=root.root.findAllByType('input');fields[0].props.onChangeText(user.email);fields[1].props.onChangeText('synthetic-only-password');});await press('Log in');await flush();
  assert.deepEqual(store.convertedLessonProgress,progress);assert.equal(store.activeScenarioRun,null);
  console.log('PASS joined first lesson: library control → approved transcripts → counterpart → retry/comparison → completion → root cold owner hydration; synthetic paid admission/replies only');

 await go('/saved-result');await flush();await flush();
 assert.ok(root.root.findAllByType('button').some((b:any)=>b.props.label==='Delete this saved result'),'saved-result screen exposes explicit server result deletion');
 await billingEvent('EXPIRATION');
 await restart();await go('/saved-result');await flush();await flush();
 assert.ok(text().includes('You asked for a task.'),'paid revocation preserves exact saved content');
 await press('Open saved Follow-Through');assert.ok(text().includes(originalBenefit.outcome),'web refund and native expiry preserve immutable delivered output');assert.equal(checkoutCalls,1);
 await assert.rejects(db.query("update bysi_follow_through.purchase set result='{}'::jsonb"),/immutable/i);
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),false);
 const beforeDeniedDispatch=providerCalls;
 assert.equal((await (await import('../lib/nativeBillingRuntime')).nativeBilling!.request('generate',{type:'bad'})).status,403);
 assert.equal(providerCalls,beforeDeniedDispatch,'revoked SQL source denies protected operation before provider dispatch');
 assert.ok(!root.root.findAllByType('button').some((b:any)=>b.props.label==='Continue to next practice'),'revocation denies consumer gate');
 assert.deepEqual((await db.query('select state from bysi_native_free.session where owner_id=$1',[owner])).rows[0].state.record,savedBefore);
 holdResult=true;await press('Find my latest saved result');await flush();assert.equal(typeof releaseResult,'function');
 await press('Sign out');assert.equal(account.user,null);
 releaseResult();holdResult=false;await flush();await flush();
 assert.ok(!text().includes('You asked for a task.'),'ignored-abort late restore must not republish private content after actual logout');
 assert.equal(providerCalls,outputMode==='native'?5:2,'exact ordinary provider dispatch count; no restoration or missing-owner regeneration');
 console.log('PASS NORMAL JOINED '+outputMode+': installed SDK login -> exact saved producer record -> actual useNativeServerAccess/Next/SQL -> canonical lesson practice/completion; native first and saved arrival share identical authority. Synthetic Auth/RC/provider/native hosts; no hosted/device claims.');
}finally{if(root)await act(async()=>root.unmount());sdk.auth.stopAutoRefresh();await db.close();}
