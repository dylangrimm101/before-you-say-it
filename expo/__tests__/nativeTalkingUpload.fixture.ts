import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transformSync} from '@babel/core';
import vm from 'node:vm';
// Installed RN serializer; Flow stripping only, no replacement getParts logic.
const file=require.resolve('react-native/Libraries/Network/FormData.js');
const code=transformSync(readFileSync(file,'utf8'),{filename:file,babelrc:false,configFile:false,plugins:[require.resolve('@babel/plugin-transform-flow-strip-types'),require.resolve('@babel/plugin-transform-modules-commonjs')]} )!.code!;
const sandbox:any={module:{exports:{}}};sandbox.exports=sandbox.module.exports;vm.runInNewContext(code,sandbox);
(globalThis as any).FormData=sandbox.module.exports.default ?? sandbox.module.exports;
Object.defineProperty(AbortSignal.prototype,'throwIfAborted',{value:undefined,configurable:true});
(globalThis as any).__DEV__=false;
process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN='https://beforeyousayit.app';
mock.module('react-native',()=>({Platform:{OS:'ios'}}));
const user={id:'synthetic-owner',is_anonymous:false,email_confirmed_at:'2026-01-01'};
let event:Function=()=>{};
const auth={getSession:async()=>{event('SIGNED_IN',{user});return {data:{session:{access_token:'synthetic',user}},error:null}},getUser:async()=>({data:{user},error:null}),onAuthStateChange:(cb:Function)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}}}};
mock.module('../lib/supabase',()=>({supabase:{auth},authEnvironment:{url:'https://spvksnddzyvycfoefrcf.supabase.co'}}));
const {createNativeBilling}=await import('../lib/nativeBilling');
const calls:any[]=[];
const nativeBilling=createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:async(url,init)=>{calls.push({url,init,parts:(init!.body as any).getParts()});return Response.json({text:'Synthetic unapproved words'})}})!;
mock.module('../lib/nativeBillingRuntime',()=>({nativeBilling}));
mock.module('../lib/voice',()=>({resetSpeech:async()=>{}}));
let uriReads=0;globalThis.fetch=async()=>{uriReads++;throw Error('External or URI read prohibited')};
const {transcribeRecording}=await import('../lib/transcription');
try{
 assert.equal(await transcribeRecording('file:///synthetic/recording.m4a','audio/mp4','opener',{paidPractice:true}),'Synthetic unapproved words');
 assert.equal(uriReads,0);assert.equal(calls.length,1);assert.equal(calls[0].url,'https://beforeyousayit.app/api/native/transcribe');
 const audio=calls[0].parts.find((p:any)=>p.fieldName==='audio');assert.equal(audio.uri,'file:///synthetic/recording.m4a');assert.equal(audio.name,'recording.m4a');assert.equal(audio.type,'audio/mp4');assert.equal(audio.headers['content-type'],'audio/mp4');assert.equal('_data' in audio,false);assert.equal(calls[0].init.headers['Content-Type'],undefined);
 console.log('PASS actual transcribeRecording -> paid runtime -> nativeBilling -> installed RN FormData getParts; file URI descriptor intact; zero URI reads. No native file/network allocation claim.');
}finally{nativeBilling.dispose()}
