import {nativeBilling} from './nativeBillingRuntime';
import {supabase,authEnvironment} from './supabase';
import {createPaidGenerationTransport} from './paidGeneration';
const transport=supabase&&authEnvironment?createPaidGenerationTransport({developmentBuild:__DEV__,staging:authEnvironment.staging,authUrl:authEnvironment.url,endpoint:process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT,auth:supabase.auth}):null;
export async function requestPaidBysiGeneration(payload:Record<string,unknown>):Promise<Response>{
 if(nativeBilling)return nativeBilling.request('generate',payload);
 if(!transport)throw Error('Isolated paid generation is not configured');
 return transport.request(payload);
}
