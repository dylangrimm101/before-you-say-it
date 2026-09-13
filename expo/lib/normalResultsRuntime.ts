import {createNormalResults} from './normalResults';
function compose(){
 if(process.env.EXPO_PUBLIC_NATIVE_RESULTS!=='normal-results-v1')return null;
 const {supabase,authEnvironment}=require('./supabase') as typeof import('./supabase');
 if(authEnvironment?.staging||process.env.EXPO_PUBLIC_BYSI_BUILD_MODE==='staging-account')throw Error('Normal results cannot use staging Auth');
 return createNormalResults({enabled:true,authUrl:authEnvironment?.url,origin:process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN,auth:supabase?.auth});
}
/** Prospective local capability. No hosted enablement is implied by this code. */
export const normalResults=compose();
