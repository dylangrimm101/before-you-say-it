import {expect,test} from 'bun:test';
import configure from '../app.config';
import app from '../app.json';

test('normal TestFlight binds the reviewed EAS owner/project/slug, not any plausible UUID',()=>{
 const saved={...process.env};
 for(const n of Object.keys(process.env))if(n.startsWith('EXPO_PUBLIC_'))delete process.env[n];
 Object.assign(process.env,{EAS_BUILD_PROFILE:'testflight',EXPO_PUBLIC_SUPABASE_URL:'https://spvksnddzyvycfoefrcf.supabase.co',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fixtureonly',EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_fixtureonly',EXPO_PUBLIC_NATIVE_BILLING_ORIGIN:'https://beforeyousayit.app'});
 try {
  expect(configure({config:app.expo} as any).updates?.enabled).toBe(false);
  for(const config of [
   {...app.expo,owner:'other-account'},
   {...app.expo,slug:'other-project'},
   {...app.expo,extra:{eas:{projectId:'00000000-0000-4000-8000-000000000001'}}},
   {...app.expo,extra:{eas:{projectId:'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44'}}},
  ])expect(()=>configure({config} as any)).toThrow('TestFlight');
 } finally {for(const n of Object.keys(process.env))if(!(n in saved))delete process.env[n];Object.assign(process.env,saved);}
});
