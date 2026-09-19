import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {supabase,authEnvironment} from './supabase';
import {resetSpeech} from './voice';
import {encodeFreeJournal,decodeFreeJournal} from './freeJournalStorage';
import {createNormalFreeSession,type RecordingIdentity} from './normalFreeSession';
import {guestVisit,guestVisitsEnabled} from './guestVisitRuntime';
const options={keychainService:'beforeyousayit.normal.free-session',keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
const origin=process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN;
const transport=origin&&process.env.EXPO_PUBLIC_BYSI_BUILD_MODE!=='staging-account'&&supabase&&authEnvironment&&!authEnvironment.staging?createNormalFreeSession({origin,authUrl:authEnvironment.url,auth:supabase.auth,
 storage:{getItem:async key=>{const value=await SecureStore.getItemAsync(key,options);return value===null?null:decodeFreeJournal(value);},setItem:(key,value)=>SecureStore.setItemAsync(key,encodeFreeJournal(value),options)},
 onInvalidate:()=>{void resetSpeech();},
 guestVisit:guestVisitsEnabled?guestVisit:undefined,
 random:()=>Array.from(Crypto.getRandomBytes(32),b=>b.toString(16).padStart(2,'0')).join(''),hash:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value),
}):null;
export const normalFreeRecoveryEnabled=!!transport;
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export async function currentNormalFreeSessionId(session?:{access_token?:string;user?:{id?:string}}|null):Promise<string|null>{
 const active=session??(await supabase?.auth.getSession())?.data.session;
 const id=active?.user?.id;
 if(!transport||!id)return null;
 const value=await SecureStore.getItemAsync('normal-free-v1.'+id,options);
 if(value===null)return null;
 const journal=JSON.parse(decodeFreeJournal(value)) as {sessionId?:unknown};
 return typeof journal.sessionId==='string'&&UUID.test(journal.sessionId)?journal.sessionId:null;
}
export async function requestNormalFree(operation:'generate'|'tts'|'transcribe'|'recover'|'restart'|'endVisit',payload:Record<string,unknown>|FormData,signal?:AbortSignal,recording?:RecordingIdentity):Promise<Response>{
 if(!transport)throw Error('Normal registered free service is not configured');return transport.request(operation,payload,signal,recording);
}
