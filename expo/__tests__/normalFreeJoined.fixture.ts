import {mock} from 'bun:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createRequire} from 'node:module';import {randomBytes,createHash} from 'node:crypto';
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
const client=createClient(authOrigin,'synthetic-public',{global:{fetch:authFetch},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
assert.equal((await client.auth.signInWithPassword({email:user.email,password:'synthetic-only-password'})).error,null);
await db.exec('create role anon;create role authenticated;create role service_role;create role bysi_native_service;');await db.exec(readFileSync(web+'/server/native-free/schema.sql','utf8'));await db.exec('set role bysi_native_service');
const {createServerClients}=await import(web+'/server/revenuecat/http.mjs');const verify=createServerClients({authOrigin,publicKey:'synthetic-public',revenueCatKey:'unused',fetch:authFetch});
const runtime={origin,key:'a'.repeat(64),verifyOwner:verify.verifyOwner,rpc:async(owner:string,input:any)=>(await db.query('select public.bysi_native_free($1::uuid,$2::jsonb) value',[owner,input])).rows[0].value};
mock.module(web+'/server/native-free/runtime.mjs',()=>({getFreeRuntime:()=>runtime}));
const mounts:Record<string,any>={};for(const op of ['session','generate','tts','transcribe'])mounts[op]=(await import(web+'/app/api/native/free/'+op+'/route.js')).POST;
const {NextRequest}=await import(web+'/node_modules/next/server.js');
mock.module('../lib/voice',()=>({resetSpeech:async()=>{}}));
const disk=new Map<string,string>();mock.module('../lib/supabase',()=>({supabase:client,authEnvironment:{url:authOrigin,staging:false}}));
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:async(k:string)=>disk.get(k)??null,setItemAsync:async(k:string,v:string)=>{disk.set(k,v);}}));
mock.module('expo-crypto',()=>({getRandomBytes:randomBytes,CryptoDigestAlgorithm:{SHA256:'sha256'},digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN=origin;delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;process.env.ANTHROPIC_API_KEY='synthetic';process.env.OPENAI_API_KEY='synthetic';
const terminal={mode:'insufficient_evidence',insufficient_evidence:{headline:'Synthetic insufficient evidence',note:'No supported score in this fixture.',next_step:'Keep practising with typed input.'}};
const positive=process.argv[2]==='positive';const {fixture}=await import(web+'/tests/fixtures/generation-output.mjs');
const requests:any[]=[];globalThis.fetch=(async(url:any,init:any)=>{
 if(String(url).startsWith(origin+'/api/native/free/')){const op=String(url).split('/').at(-1)!;requests.push({op,token:new Headers(init.headers).get('authorization')});return mounts[op](new NextRequest(url,init));}
 if(String(url)==='https://api.openai.com/v1/audio/transcriptions'){providerCalls++;return Response.json({text:'Can we choose one task?'});}
 assert.equal(String(url),'https://api.anthropic.com/v1/messages');providerCalls++;const body=JSON.parse(JSON.parse(init.body).messages[0].content);
 const full=fixture();full.pressure_moment.pushback_quote='The deadline is fixed. Everyone is stretched right now.';
 const output=body.turn?{mode:'turn',turn:body.turn,role:'hope',text:body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'I am already stretched with the client work. Which priority should wait?',safety:null}:positive?full:terminal;
 return Response.json({id:'msg_synthetic_'+providerCalls,model:'synthetic-fixture',stop_reason:'end_turn',usage:{input_tokens:100,output_tokens:100},content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
const {requestNormalFree}=await import('../lib/normalFreeRuntime');const {nextCounterpartTurn,generateDebrief}=await import('../lib/ai');
try{
 const form=new FormData();form.append('turn','opener');form.append('audio',new Blob([new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0])],{type:'audio/mp4'}),'synthetic.m4a');
 const transcribed=await requestNormalFree('transcribe',form);assert.equal(transcribed.status,200,await transcribed.clone().text());assert.equal((await transcribed.json()).text,'Can we choose one task?');
 const scenario=scenarioFromApproved(APPROVED_ONBOARDING_SCENARIOS[0]!,'woman-hope');const turns:Turn[]=[{id:'one',role:'user',text:'Can we choose one task?'}];
 const first=await nextCounterpartTurn(scenario,'steady',turns,'defensive',scenario.goal);turns.push({id:'p',role:'them',text:first.reply},{id:'two',role:'user',text:'Which one comes first?'});
 const second=await nextCounterpartTurn(scenario,'steady',turns,'defensive',scenario.goal);turns.push({id:'c',role:'them',text:second.reply});
 const result=await generateDebrief(scenario,'steady',turns,'defensive',scenario.goal);if(positive){assert.ok(result.debrief);assert.equal(result.analysis.mode,'result');}else{assert.equal(result.debrief,null);assert.deepEqual(result.analysis.insufficient_evidence,terminal.insufficient_evidence);}assert.equal(providerCalls,4);
 assert.ok(requests.every(x=>x.token==='Bearer '+token));assert.ok(verifiedTokens.every(x=>x==='Bearer '+token));assert.ok(authReads>=requests.length);
 await db.exec('reset role');const rows=(await db.query('select phase,state from bysi_native_free.session')).rows;assert.equal(rows.length,1);assert.equal(rows[0].phase,positive?'result':'terminal');if(!positive)assert.deepEqual(rows[0].state,{});else assert.equal(rows[0].state.record.provenance.source,'server_generation');
 console.log('PASS actual registered Auth SDK → native builders/transcribe → NextRequest mounts → restricted real SQL → private producer fixture → '+(positive?'sufficient result':'scoreless terminal')+'. SYNTHETIC provider/Auth HTTP, no device/live claims.');
}finally{await db.close();client.auth.stopAutoRefresh();}
