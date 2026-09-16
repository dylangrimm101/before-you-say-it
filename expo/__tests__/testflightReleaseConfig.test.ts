import {expect,test} from 'bun:test';
import eas from '../eas.json';
import configure from '../app.config';
import app from '../app.json';

test('TestFlight refuses a service-stripped/unassociated Release instead of exporting a blank candidate',()=>{
 const before=process.env.EAS_BUILD_PROFILE;
 process.env.EAS_BUILD_PROFILE='testflight';
 try { expect(()=>configure({config:app.expo} as any)).toThrow('TestFlight'); }
 finally { if(before===undefined)delete process.env.EAS_BUILD_PROFILE;else process.env.EAS_BUILD_PROFILE=before; }
});

test.each(['testflight', 'rork-production'])('fixture-only exact config accepts embedded Release and rejects endpoint/staging drift: %s',(runner)=>{
 const saved={...process.env};
 for(const name of Object.keys(process.env))if(name.startsWith('EXPO_PUBLIC_'))delete process.env[name];
 Object.assign(process.env,{
  EAS_BUILD_PROFILE:'testflight',
  EXPO_PUBLIC_SUPABASE_URL:'https://spvksnddzyvycfoefrcf.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fixtureonly',
  EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_fixtureonly',
  EXPO_PUBLIC_NATIVE_BILLING_ORIGIN:'https://beforeyousayit.app',
  // Registered free and paid routes both derive from the pinned native origin.
  // Legacy public-funnel endpoint inputs must not be required in TestFlight.
 });
 if(runner==='rork-production') {
  delete process.env.EAS_BUILD_PROFILE;
  process.env.NODE_ENV='production';
 }
 // Shape fixtures only, never actual project/key-ownership acceptance.
 const config={...app.expo}; // Reviewed public EAS identity; keys remain synthetic.
 try {
  expect(configure({config} as any).updates?.enabled).toBe(false);
  process.env.EXPO_PUBLIC_PROJECT_ROOT='/tmp/expo-cli-inject';
  expect(configure({config} as any).updates?.enabled).toBe(false);
  delete process.env.EXPO_PUBLIC_PROJECT_ROOT;
  process.env.EXPO_PUBLIC_NATIVE_RESULTS='normal-results-v1';
  expect(configure({config} as any).updates?.enabled).toBe(false);
  process.env.EXPO_PUBLIC_NATIVE_RESULTS='unknown';
  expect(()=>configure({config} as any)).toThrow('TestFlight');
  delete process.env.EXPO_PUBLIC_NATIVE_RESULTS;
  for(const [name,value] of Object.entries({EXPO_PUBLIC_SUPABASE_ANON_KEY:'not-a-publishable-key',EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT:'https://bysi-signup-staging.vercel.app/api/practice/generate',EXPO_PUBLIC_REVENUECAT_TEST_API_KEY:'test_fixture',EXPO_PUBLIC_BYSI_BUILD_MODE:'staging-account',EXPO_PUBLIC_NATIVE_BILLING_ORIGIN:'https://beforeyousayit.app?bypass=1',EXPO_PUBLIC_GENERATE_ENDPOINT:'https://wrong.example/api/generate'})){
   if(runner==='rork-production' && name==='EXPO_PUBLIC_BYSI_BUILD_MODE') continue;
   const original=process.env[name];process.env[name]=value;
   expect(()=>configure({config} as any)).toThrow('TestFlight');
   if(original===undefined)delete process.env[name];else process.env[name]=original;
  }
  for(const name of ['EXPO_PUBLIC_GENERATE_ENDPOINT','EXPO_PUBLIC_TTS_ENDPOINT','EXPO_PUBLIC_TRANSCRIBE_ENDPOINT','EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY','EXPO_PUBLIC_UNREVIEWED_SERVICE']) {
   process.env[name]='https://beforeyousayit.app/api/generate';
   expect(()=>configure({config} as any)).toThrow('TestFlight');delete process.env[name];
  }
  for(const name of ['EXPO_PUBLIC_SUPABASE_URL','EXPO_PUBLIC_SUPABASE_ANON_KEY','EXPO_PUBLIC_REVENUECAT_IOS_API_KEY','EXPO_PUBLIC_NATIVE_BILLING_ORIGIN']) {
   const original=process.env[name];delete process.env[name];
   expect(()=>configure({config} as any)).toThrow('TestFlight');process.env[name]=original;
  }
  expect(()=>configure({config:{...config,extra:{eas:{projectId:'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44'}}}} as any)).toThrow('TestFlight');
 } finally {for(const name of Object.keys(process.env))if(!(name in saved))delete process.env[name];Object.assign(process.env,saved);}
});

test('TestFlight is explicitly normal iOS Release/store, not staging or a development client',()=>{
 const p=(eas.build as any).testflight;
 expect(p).toBeDefined();
 expect(p.extends).toBe('production');
 expect(p.distribution).toBe('store');
 expect(p.developmentClient).toBe(false);
 expect(p.ios).toEqual({simulator:false,buildConfiguration:'Release'});
 expect(p.environment).toBe('production');
 expect(p.channel).toBe('testflight');
 expect(p.env.EXPO_NO_DOTENV).toBe('1');
 expect(p.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN).toBe('https://beforeyousayit.app');
 expect(p.env.EXPO_PUBLIC_SUPABASE_URL).toBe('https://spvksnddzyvycfoefrcf.supabase.co');
 expect(p.env.EXPO_PUBLIC_BYSI_BUILD_MODE).toBeUndefined();
 expect(eas.cli.requireCommit).toBe(true);
});
