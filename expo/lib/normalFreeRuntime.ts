import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import {supabase,authEnvironment} from './supabase';
import {resetSpeech} from './voice';
import {createNormalFreeSession,type RecordingIdentity} from './normalFreeSession';
const options={keychainService:'beforeyousayit.normal.free-session',keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
const origin=process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN;
const transport=origin&&process.env.EXPO_PUBLIC_BYSI_BUILD_MODE!=='staging-account'&&supabase&&authEnvironment&&!authEnvironment.staging?createNormalFreeSession({origin,authUrl:authEnvironment.url,auth:supabase.auth,
 storage:{getItem:key=>SecureStore.getItemAsync(key,options),setItem:(key,value)=>SecureStore.setItemAsync(key,value,options)},
 onInvalidate:()=>{void resetSpeech();},
 random:()=>Array.from(Crypto.getRandomBytes(32),b=>b.toString(16).padStart(2,'0')).join(''),hash:value=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,value),
}):null;
export async function requestNormalFree(operation:'generate'|'tts'|'transcribe',payload:Record<string,unknown>|FormData,signal?:AbortSignal,recording?:RecordingIdentity):Promise<Response>{
 if(!transport)throw Error('Normal registered free service is not configured');return transport.request(operation,payload,signal,recording);
}
