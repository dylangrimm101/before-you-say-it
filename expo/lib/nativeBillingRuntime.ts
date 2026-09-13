import {createNativeBilling} from './nativeBilling';
export const normalBillingEnabled=!!process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN && process.env.EXPO_PUBLIC_BYSI_BUILD_MODE!=='staging-account';
function compose(){
 if(!normalBillingEnabled)return null;
 // Preserve disabled/legacy builds: do not initialize new Auth/native modules.
 // eslint-disable-next-line @typescript-eslint/no-require-imports
 const {supabase,authEnvironment}=require('./supabase') as typeof import('./supabase');
 if(authEnvironment?.staging)throw Error('Normal billing cannot use staging Auth');
 return createNativeBilling({enabled:true,authUrl:authEnvironment?.url,origin:process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN,auth:supabase?.auth});
}
export const nativeBilling=compose();
