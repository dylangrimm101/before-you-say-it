import {test,expect} from 'bun:test';
import {candidateAccountDeletionEndpoint,requestAccountDeletion,reviewedDeletionEndpoint,NORMAL_ACCOUNT_DELETION_ENDPOINT} from '../lib/accountDeletion';
import configure from '../app.config';
import {sanitizeClientEnv} from '../lib/clientEnvGuard';
const valid={authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',flag:'normal-results-local-v1',development:true};
test('normal candidate is explicit, development-only, exact Auth and never staging',()=>{
 expect(candidateAccountDeletionEndpoint(valid)).toEqual({url:NORMAL_ACCOUNT_DELETION_ENDPOINT,backend:'normal-results-local-v1'});
 for(const change of [{flag:undefined},{flag:'true'},{development:false},{staging:true},{buildMode:'staging-account'},{authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co'},{authUrl:valid.authUrl+'/'}])expect(candidateAccountDeletionEndpoint({...valid,...change})).toBeNull();
 expect(reviewedDeletionEndpoint(valid.authUrl,false)).toBeNull();
 expect(reviewedDeletionEndpoint(valid.authUrl,true)).toBe(valid.authUrl+'/functions/v1/account-delete');
});
test('bare or forged Next destination never forwards a bearer',async()=>{
 let calls=0;
 for(const endpoint of [NORMAL_ACCOUNT_DELETION_ENDPOINT,{url:NORMAL_ACCOUNT_DELETION_ENDPOINT,backend:'normal-results-local-v1'}]){
 const result=await requestAccountDeletion({} as any,endpoint as any,'owner','password',{kind:'unknown'},{} as any,async()=>{calls++;throw Error('forbidden');});
 expect(result.success).toBe(false);
 }
 expect(calls).toBe(0);
});
test('actual TestFlight configuration rejects the candidate public input',()=>{
 const original={...process.env};try{
 for(const name of Object.keys(process.env))if(name.startsWith('EXPO_PUBLIC_'))delete process.env[name];
 Object.assign(process.env,{EAS_BUILD_PROFILE:'testflight',EXPO_PUBLIC_SUPABASE_URL:valid.authUrl,EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_synthetic',EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_synthetic',EXPO_PUBLIC_NATIVE_BILLING_ORIGIN:'https://beforeyousayit.app'});
 const config:any={ios:{bundleIdentifier:'app.rork.8fc4qwsqaurkxk0pimyvx'},owner:'dgrim101',slug:'8fc4qwsqaurkxk0pimyvx',extra:{eas:{projectId:'1b655360-557d-4dba-ad69-fbf26120e852'}}};
 expect(configure({config} as any).updates?.enabled).toBe(false);
 process.env.EXPO_PUBLIC_NATIVE_ACCOUNT_DELETION=valid.flag;
 expect(()=>configure({config} as any)).toThrow('TestFlight rejects unreviewed public inputs');
 }finally{for(const name of Object.keys(process.env))if(!(name in original))delete process.env[name];Object.assign(process.env,original);}
});
test('development sanitizer retains only the explicit candidate input',()=>{
 expect(sanitizeClientEnv('EXPO_PUBLIC_NATIVE_ACCOUNT_DELETION=normal-results-local-v1').removedNames).toEqual([]);
});
