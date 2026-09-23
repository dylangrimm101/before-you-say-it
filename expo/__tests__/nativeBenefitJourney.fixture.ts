import {mock} from 'bun:test';import assert from 'node:assert/strict';import {readFileSync,writeFileSync} from 'node:fs';import {createRequire} from 'node:module';import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
const web=new URL('../../server/',import.meta.url).pathname.replace(/\/$/,'');
const {setupContent,capture}=await import(web+'/tests/normal-results-proof.mjs');const {db,database,contentDatabase}=await setupContent();
const origin='https://beforeyousayit.app',authOrigin='https://spvksnddzyvycfoefrcf.supabase.co',owner='11111111-1111-4111-8111-111111111111';
const user={id:owner,aud:'authenticated',role:'authenticated',email:'synthetic@invalid',is_anonymous:false,email_confirmed_at:'2026-01-01',created_at:'2026-01-01',app_metadata:{},user_metadata:{}};
const fixtureTokenExpiry=Math.floor(Date.now()/1000)+3600;
const tokenFor=(id:string)=>[{alg:'HS256',typ:'JWT'},{sub:id,exp:fixtureTokenExpiry},'synthetic'].map(x=>Buffer.from(JSON.stringify(x)).toString('base64url')).join('.');
let authReads=0,providerCalls=0;const verifiedTokens:string[]=[];
const guestUser={...user,id:'33333333-3333-4333-8333-333333333333',email:'',is_anonymous:true,email_confirmed_at:undefined};
let transportUser:typeof user|typeof guestUser=user;
const authSession=(identity:typeof transportUser)=>({access_token:tokenFor(identity.id),refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:identity});
// Anonymous signup returns an actual SDK session. Confirmation-required email
// signup intentionally does not. The old endpoint-blind stub conflated them.
const authFetch=async(url:any,init:any)=>{
 authReads++;
 if(String(url).includes('/signup')){
  const body=JSON.parse(init.body??'{}');
  if(body.email)return Response.json({user,session:null});
  transportUser=guestUser;return Response.json(authSession(guestUser));
 }
 if(String(url).includes('/logout'))return new Response(null,{status:204});
 if(String(url).includes('/token')){if(JSON.parse(init.body??'{}').email===user.email)transportUser=user;return Response.json(authSession(transportUser));}
 const authorization=new Headers(init.headers).get('authorization')??'';verifiedTokens.push(authorization);
 if(authorization==='Bearer '+tokenFor(guestUser.id))return Response.json(guestUser);
 return Response.json(transportUser);
};
const sdk=createClient(authOrigin,'synthetic-public',{global:{fetch:authFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
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
const {createRuntime}=await import(web+'/server/revenuecat/runtime.mjs');
const paid=createRuntime({database,now:()=>now,env:{BYSI_NATIVE_PAID:'revenuecat-v1',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_DATABASE_URL:'postgres://fixture:fixture@localhost/fixture?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_REVENUECAT_SERVER_KEY:'synthetic-server',BYSI_REVENUECAT_WEBHOOK_AUTHORIZATION:secret},fetch:async(url:any,init:any)=>String(url).includes('/auth/')?authFetch(url,init):Response.json(snapshot())});
mock.module(web+'/server/revenuecat/service.mjs',()=>({getServiceRuntime:()=>paid}));
const paidRoutes:any={};for(const op of ['identify','access','generate','tts','transcribe'])paidRoutes[op]=(await import(web+'/app/api/native/'+op+'/route.js')).POST;
const {createResultsRuntime}=await import(web+'/server/normal-results/runtime.mjs');
const content=createResultsRuntime({database:contentDatabase,env:{BYSI_NATIVE_RESULTS:'normal-results-v1',BYSI_NATIVE_ORIGIN:origin,BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:fixture@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public'},fetch:authFetch});
mock.module(web+'/server/normal-results/runtime.mjs',()=>({createResultsRuntime,getResultsRuntime:()=>content}));
const contentRoutes:any={};for(const op of ['discover','restore','delete','claim'])contentRoutes[op]=(await import(web+'/app/api/native/results/'+op+'/route.js')).POST;
// Same migrated SQL and role-restricted transaction adapter as normal content and native Pro.
await db.exec(readFileSync(web+'/server/follow-through/schema.sql','utf8'));
await db.exec(readFileSync(web+'/server/follow-through/recovery.sql','utf8'));
let followProviderCalls=0,checkoutCalls=0,followRefunds:any[]=[];
const checkoutRecords=new Map<string,any>();
const originalBenefit:any=process.env.BENEFIT_SAFETY==='1'?{mode:'safety',note:'Original safety note: prioritize support and safety.',resources:['Original support resource'],reason:'internal_classifier_metadata'}:{mode:'repair_plan',outcome:'Keep the exact original kitchen agreement.',strategy:'One owned loop — no scoreboard.',likely_reaction:'They may defend their record.',response_options:[{label:'If they defend their record',move:'Refuse the scoreboard',text:'I am asking for this one loop.'}],close_the_loop:'Agree who owns the sink through Sunday.',follow_up_text:'Can we check Sunday?'};
const originalHeadline=originalBenefit.mode==='safety'?originalBenefit.note:originalBenefit.outcome;
const historicalBenefit={...originalBenefit,...(originalBenefit.mode==='safety'?{note:'Exact retained historical safety output.'}:{outcome:'Exact retained historical Follow-Through — distinct original source.'})};
const historicalHeadline=historicalBenefit.mode==='safety'?historicalBenefit.note:historicalBenefit.outcome;
const {createRuntime:createFollowRuntime}=await import(web+'/server/follow-through/runtime.mjs');
const follow=await createFollowRuntime({database:contentDatabase,env:{BYSI_FOLLOW_THROUGH:'owner-v1',BYSI_FOLLOW_THROUGH_LIVEMODE:'false',BYSI_NATIVE_AUTH_ORIGIN:authOrigin,BYSI_NATIVE_PUBLISHABLE_KEY:'synthetic-public',BYSI_NATIVE_SERVICE_DATABASE_URL:'postgres://bysi_native_service:synthetic@db.spvksnddzyvycfoefrcf.supabase.co:5432/postgres?sslmode=verify-full',STRIPE_SECRET_KEY:'synthetic',STRIPE_BYSI_FOLLOW_THROUGH_PRICE_ID:'price_fixture'},fetch:async(url:any,init:any)=>{
 if(String(url).startsWith(authOrigin))return authFetch(url,init);
 const path=String(url).replace('https://api.stripe.com/v1','');
 if(path==='/checkout/sessions'){checkoutCalls++;const p=new URLSearchParams(init.body),id='cs_fixture_'+checkoutCalls;const c={id,url:'https://checkout.stripe.com/c/pay/fixture',mode:'payment',payment_status:'paid',livemode:false,metadata:{binding:p.get('metadata[binding]')},line_items:{has_more:false,data:[{price:{id:'price_fixture'},quantity:1}]},payment_intent:{id:'pi_fixture_'+checkoutCalls,status:'succeeded',latest_charge:{id:'ch_fixture_'+checkoutCalls,payment_intent:'pi_fixture_'+checkoutCalls,livemode:false,captured:true,amount_captured:999,paid:true,amount:999,currency:'usd'}}};checkoutRecords.set(id,c);return Response.json(c);}
 if(path.startsWith('/checkout/sessions/'))return Response.json(checkoutRecords.get(path.split('/')[3].split('?')[0]));
 if(path.startsWith('/refunds?')){const charge=new URL(String(url)).searchParams.get('charge');return Response.json({has_more:false,data:followRefunds.filter(r=>r.charge===charge)});}
 throw Error('Unexpected Follow-Through upstream '+path);
}});
mock.module(web+'/server/follow-through/runtime.mjs',()=>({createRuntime:createFollowRuntime,getRuntime:async()=>follow}));
const followRoutes:any={};for(const op of ['discover','restore','recovery'])followRoutes[op]=(await import(web+'/app/api/follow-through/'+op+'/route.js')).POST;
const followInput={operationId:randomUUID(),intent:'School pickup',rawMessage:'Tomorrow?',negativePattern:'Waiting',situationType:'logistics',forecast:{diagnosis:'synthetic original source'}};
const originalCheckout=await follow.checkout('Bearer '+tokenFor(owner),followInput);
await follow.deliver('Bearer '+tokenFor(owner),originalCheckout.sessionId,async()=>{followProviderCalls++;return originalBenefit;});
const followRequests:any[]=[];let holdFollow=false,releaseFollow:any,loseFollowRequest=false;
async function billingEvent(type='INITIAL_PURCHASE'){
 const r=await paid.authority.webhook(new NextRequest(origin+'/api/native/webhook',{method:'POST',headers:{authorization:secret,'content-type':'application/json'},body:JSON.stringify({api_version:'1.0',event:{id:'fixture-'+(++sequence),type,app_id:'appab45402f36',event_timestamp_ms:now+sequence,app_user_id:rcId,original_app_user_id:rcId,aliases:[rcId],environment:'PRODUCTION',store:'APP_STORE',product_id:'byis_pro_monthly_5',entitlement_ids:['pro'],transaction_id:'fixture-tx',is_family_share:false}})}));assert.equal(r.status,200);
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
process.env.EXPO_PUBLIC_NATIVE_RESULTS='normal-results-v1';process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY='appl_fixture';process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN=origin;delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;process.env.ANTHROPIC_API_KEY='synthetic';
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,isAvailableAsync:async()=>true,getItemAsync:async(k:string)=>secureDisk.get(k)??null,deleteItemAsync:async(k:string)=>{secureDisk.delete(k);},setItemAsync:async(k:string,v:string)=>{secureDisk.set(k,v);}}));
mock.module('expo-crypto',()=>({randomUUID,getRandomBytes:randomBytes,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
const outputMode=process.argv[2]??'positive';const {fixture}=await import('../../server/tests/fixtures/generation-output.mjs');
let loseResult=outputMode==='recovery';
const seenOperations:string[]=[];let holdResult=false;let releaseResult:any;
globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).startsWith(origin+'/api/follow-through/')){const op=String(url).split('/').at(-1)!;followRequests.push({op,body:JSON.parse(init.body),authorization:new Headers(init.headers).get('authorization')});const r=await followRoutes[op](new NextRequest(url,init));if(loseFollowRequest&&op==='recovery'&&JSON.parse(init.body).action==='request'){loseFollowRequest=false;followRequests.at(-1).lostResponseStatus=r.status;throw Error('Synthetic recovery response lost after SQL commit');}if(holdFollow&&op==='restore')await new Promise(resolve=>releaseFollow=resolve);return r;}
 if(String(url).startsWith(origin+'/api/native/results/')){const response=await contentRoutes[String(url).split('/').at(-1)!](new NextRequest(url,init));if(holdResult&&String(url).endsWith('/restore'))await new Promise(resolve=>releaseResult=resolve);return response;}
 if(String(url).startsWith(origin+'/api/native/')&&!String(url).includes('/free/')){if(holdAccess&&String(url).endsWith('/access'))await new Promise(resolve=>releaseAccess=resolve);const response=await paidRoutes[String(url).split('/').at(-1)!](new NextRequest(url,init));if(!response.ok)console.log('SYNTHETIC PAID ROUTE DIAGNOSTIC',await response.clone().text());return response;}
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
const {LegacyEntryScreen:Entry}=await import('../app/entry');
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
 assert.equal(account.session.user.id,guestUser.id);assert.equal(account.user,null);
 await press('See what changes with practice');await press('See the practice plan');await press('See my practice plan');
 await press('Continue');await press('Continue');await press('Restore purchases');
 await act(async()=>{const inputs=root.root.findAllByType('input');inputs[0].props.onChangeText(user.email);inputs[1].props.onChangeText('synthetic-only-password');});
 await press('Sign in to save this result and continue');await flush();await flush();
 assert.equal(account.user.id,owner);
 assert.equal(routePath(),'/paywall','subscription account verification returns to its offer');
 await go('/saved-result');
 const claimed=(await db.query('select owner_id,phase from bysi_native_free.session where owner_id=$1',[owner])).rows;
 assert.ok(claimed.some((row:any)=>row.owner_id===owner&&row.phase==='result'),'registered owner owns the generated result after actual login claim');
 }
 assert.equal(routePath(),'/saved-result');await flush();await flush();
 await press('Find my original Follow-Through');
 await press('Open saved Follow-Through');
 assert.ok(text().includes(originalHeadline),'mounted original saved benefit, not native free substitute');
 const originalText=nodeText(root.root.findByType((await import('../components/OriginalFollowThrough')).OriginalBenefitPresentation));
 assert.ok(!originalText.includes('repair_plan'),'customer original benefit is not a raw JSON inspector');
 if(originalBenefit.mode==='safety'){assert.ok(originalText.includes('Safety and support'));assert.ok(originalText.includes(originalBenefit.resources[0]));assert.ok(!originalText.includes('internal_classifier_metadata'));}
 else {
 for(const heading of ['Outcome','Strategy','Likely reaction','Response options','Close the loop','Follow-up text'])assert.ok(originalText.includes(heading),heading);
 for(const exact of [originalBenefit.outcome,originalBenefit.strategy,originalBenefit.likely_reaction,originalBenefit.close_the_loop,originalBenefit.follow_up_text,...originalBenefit.response_options.flatMap((o:any)=>[o.label,o.move,o.text])])assert.ok(originalText.includes(exact),'unchanged saved prose');
 }
 assert.deepEqual(root.root.findByType((await import('../components/OriginalFollowThrough')).OriginalBenefitPresentation).props.result,originalBenefit);
 assert.equal(followProviderCalls,1);assert.equal(checkoutCalls,1,'native restore never creates a checkout');
 assert.ok(followRequests.slice(0,-1).every(r=>r.op==='discover'));
 assert.equal(followRequests.at(-1)?.op,'restore');
 assert.equal(followRequests.filter(r=>r.op==='restore').length,1);
 assert.deepEqual(followRequests[0].body,{});assert.equal(followRequests[1].authorization,'Bearer '+tokenFor(owner));
 loseFollowRequest=true;await press('Request original benefit recovery');
 assert.equal(followRequests.at(-1).lostResponseStatus,200);
 assert.ok(text().includes('Your recovery request may already be recorded. Check its status before trying again.'));
 await press('Check original recovery status');
 assert.ok(text().includes('Independent purchase ownership and original-content proof are required.'));
 assert.ok(text().includes('This is not purchase approval or a promise that the original content can be recovered.'));
 const recoveryBefore=(await db.query('select id,owner_id from bysi_follow_through.recovery_request')).rows;
 assert.equal(recoveryBefore.length,1);assert.equal(recoveryBefore[0].owner_id,owner);
 await restart();await press('Check original recovery status');
 assert.ok(text().includes('Recovery needs review'));
 const receiptInput=()=>root.root.findAllByType('input').find((n:any)=>n.props.accessibilityLabel==='Optional checkout receipt reference');
 assert.ok(receiptInput(),'actual optional untrusted receipt control');
 await act(async()=>receiptInput().props.onChangeText('cs_untrusted_locator'));
 await press('Send receipt reference for review');
 assert.equal((await db.query('select receipt_reference from bysi_follow_through.recovery_request where owner_id=$1',[owner])).rows[0].receipt_reference,'cs_untrusted_locator');
 assert.deepEqual(followRequests.at(-1).body,{action:'request',receiptReference:'cs_untrusted_locator'});
 await act(async()=>receiptInput().props.onChangeText('cs_different_locator'));
 await press('Send receipt reference for review');
 assert.ok(text().includes('A different receipt reference is already recorded. It has not been replaced. Check recovery status.'));
 assert.equal((await db.query('select receipt_reference from bysi_follow_through.recovery_request where owner_id=$1',[owner])).rows[0].receipt_reference,'cs_untrusted_locator');
 assert.ok(text().includes('A receipt reference is only a locator, not proof of purchase or account ownership.'));
 assert.ok(!text().includes('Evidence collection and independent review are not available in this app.'));
 assert.deepEqual((await db.query('select id,owner_id from bysi_follow_through.recovery_request')).rows,recoveryBefore);
 assert.equal(followProviderCalls,1);assert.equal(checkoutCalls,1);
 const {reviewSyntheticOriginal}=await import('./nativeBenefitReview');
 await reviewSyntheticOriginal({web,db,owner,requestId:recoveryBefore[0].id,result:historicalBenefit});
 await press('Check original recovery status');
 assert.ok(text().includes('Recovery has an existing original output.'));
 await press('Find my original Follow-Through');
 assert.equal((await account.normalResults.discoverBenefit()).items[0].source,'reviewed_original');
 await press('Open saved Follow-Through');
 assert.ok(text().includes(historicalHeadline));
 assert.deepEqual(root.root.findByType((await import('../components/OriginalFollowThrough')).OriginalBenefitPresentation).props.result,historicalBenefit);
 assert.equal(followProviderCalls,1);assert.equal(checkoutCalls,1,'review/restoration cannot create a checkout');
 assert.ok(text().includes('You asked for a task.'));
 const savedBefore=(await db.query('select state from bysi_native_free.session where owner_id=$1',[owner])).rows[0].state.record;
 assert.deepEqual(root.root.findByType((await import('../components/PrivateWebResultPresentation')).PrivateWebResultPresentation).props.record,savedBefore);
 assert.equal(savedBefore.result.starting_index.overall,null);assert.equal(savedBefore.result.starting_index.observed_dimensions[0].score,43.25);
 assert.equal(store.convertedLessonProgress.length,0,'saved content never marks a lesson complete');
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),false);
 assert.ok(text().includes('Review monthly subscription'),'same ordinary additional offer without content-paid grant');
 await press('Review monthly subscription');assert.equal(routePath(),'/paywall');
 await act(async()=>{assert.equal(await restoreHook.mutateAsync(),true);});await flush();
 assert.equal(await (await import('../lib/nativeBillingRuntime')).nativeBilling!.access(),true);
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
  await press('Log in');await flush();assert.ok(account.user,'second login: '+text());assert.equal(account.user.id,transportUser.id);assert.equal(routePath(),'/saved-result');await flush();assert.ok(text().includes('We couldn’t find a saved result linked to this account.'));assert.ok(text().includes('Don’t buy the same plan again.'));assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await restart();assert.equal(store.convertedLessonProgress.length,0);assert.equal(store.activePracticeSession,null);
  await go('/entry');await press('Sign out');transportUser=user;await press('I already have an account');await act(async()=>{const fields=root.root.findAllByType('input');fields[0].props.onChangeText(user.email);fields[1].props.onChangeText('synthetic-only-password');});await press('Log in');await flush();
  assert.deepEqual(store.convertedLessonProgress,progress);assert.equal(store.activeScenarioRun,null);
  console.log('PASS joined first lesson: library control → approved transcripts → counterpart → retry/comparison → completion → root cold owner hydration; synthetic paid admission/replies only');

 await go('/saved-result');await flush();await flush();
 await billingEvent('EXPIRATION');
 await restart();await go('/saved-result');await flush();await flush();
 assert.ok(text().includes('You asked for a task.'),'paid revocation preserves exact saved content');
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
 assert.equal(providerCalls,outputMode==='saved'?2:5,'exact ordinary provider dispatch count; no restoration or missing-owner regeneration');
 console.log('PASS NORMAL JOINED '+outputMode+': installed SDK login -> exact saved producer record -> actual useNativeServerAccess/Next/SQL -> canonical lesson practice/completion; native first and saved arrival share identical authority. Synthetic Auth/RC/provider/native hosts; no hosted/device claims.');
}finally{if(root)await act(async()=>root.unmount());sdk.auth.stopAutoRefresh();await db.close();}
