import * as SecureStore from 'expo-secure-store';
import {supabase,authEnvironment} from './supabase';
import {createFreeAcquisitionTransport} from './freeAcquisition';
// Separate protected acquisition capability storage; contains no transcript.
// Never shared with production, paid transport, WebViews or the system cookie jar.
const options={keychainService:'beforeyousayit.staging.free-acquisition',keychainAccessible:SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY};
const transport=supabase&&authEnvironment?createFreeAcquisitionTransport({
 developmentBuild:__DEV__,staging:authEnvironment.staging,authUrl:authEnvironment.url,
 endpoint:process.env.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT,auth:supabase.auth,
 storage:{getItem:key=>SecureStore.getItemAsync(key,options),setItem:(key,value)=>SecureStore.setItemAsync(key,value,options)},
}):null;
export async function requestFreeBysiGeneration(payload:Record<string,unknown>):Promise<Response>{
 if(!transport)throw Error('Isolated free acquisition is not configured');
 return transport.request(payload);
}
