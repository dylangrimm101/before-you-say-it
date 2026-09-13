import {nativeBilling} from './nativeBillingRuntime';
import {supabase,authEnvironment} from './supabase';
import {createPaidVoiceTransport,PAID_VOICE_ENDPOINTS} from './paidVoice';
import {PAID_STAGING_ENDPOINT} from './paidGeneration';
import {resetSpeech} from './voice';
const transport=supabase&&authEnvironment?createPaidVoiceTransport({developmentBuild:__DEV__,staging:authEnvironment.staging,authUrl:authEnvironment.url,endpoints:process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT===PAID_STAGING_ENDPOINT?PAID_VOICE_ENDPOINTS:undefined,auth:supabase.auth,onInvalidate:()=>{void resetSpeech();}}):null;
export async function requestPaidVoice(operation:'tts'|'transcribe',body:Record<string,unknown>|FormData,signal?:AbortSignal):Promise<Response>{
 if(nativeBilling)return nativeBilling.request(operation,body,operation==='tts'?15000:45000,signal);
 if(!transport)throw Error('Isolated paid voice is not configured');
 return transport.request(operation,body,operation==='tts'?15000:45000,signal);
}
