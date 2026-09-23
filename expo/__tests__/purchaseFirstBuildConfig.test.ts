import {expect,test} from 'bun:test';
import configure from '../app.config';
import app from '../app.json';
import eas from '../eas.json';
import {guardClientProcessEnv,sanitizeClientEnv} from '../lib/clientEnvGuard';
import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

test('actual Metro and Babel preflight retains purchase-first flags before compilation',()=>{
 const root=mkdtempSync(join(tmpdir(),'bysi-build-env-'));
 const preflight=new URL('../scripts/client-env-preflight.cjs',import.meta.url).pathname;
 const result=spawnSync(process.execPath,['-e',`require(${JSON.stringify(preflight)}).runClientEnvPreflight(${JSON.stringify(root)});console.log(JSON.stringify({enabled:process.env.EXPO_PUBLIC_PURCHASE_FIRST==='claim-v1',sandbox:process.env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE==='sandbox',secretRemoved:!process.env.OPENAI_API_KEY}));`],{env:{PATH:process.env.PATH,...eas.build.testflight.env,OPENAI_API_KEY:'synthetic-only'},encoding:'utf8'});
 expect(result.status,result.stderr).toBe(0);
 expect(JSON.parse(result.stdout)).toEqual({enabled:true,sandbox:true,secretRemoved:true});
});

test('actual TestFlight profile preserves reviewed purchase-first flags through client sanitization',()=>{
 const env:Record<string,string|undefined>={...eas.build.testflight.env};
 expect(guardClientProcessEnv(env).removedNames).toEqual([]);
 expect(env.EXPO_PUBLIC_PURCHASE_FIRST).toBe('claim-v1');
 expect(env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE).toBe('sandbox');
 const file=sanitizeClientEnv('EXPO_PUBLIC_PURCHASE_FIRST=claim-v1\nEXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE=sandbox\nOPENAI_API_KEY=synthetic-secret\n');
 expect(file.content).toContain('EXPO_PUBLIC_PURCHASE_FIRST=claim-v1');
 expect(file.content).toContain('EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE=sandbox');
 expect(file.content).not.toContain('synthetic-secret');
});

test('actual TestFlight profile resolves embedded config and rejects unknown purchase capabilities',()=>{
 const saved={...process.env};
 try{
  for(const key of Object.keys(process.env))if(key.startsWith('EXPO_PUBLIC_'))delete process.env[key];
  Object.assign(process.env,eas.build.testflight.env,{EAS_BUILD_PROFILE:'testflight',EXPO_PUBLIC_SUPABASE_ANON_KEY:'sb_publishable_fixtureonly',EXPO_PUBLIC_REVENUECAT_IOS_API_KEY:'appl_fixtureonly'});
  expect(configure({config:app.expo} as any).updates?.enabled).toBe(false);
  process.env.EXPO_PUBLIC_PURCHASE_FIRST='unknown';expect(()=>configure({config:app.expo} as any)).toThrow('TestFlight');
  process.env.EXPO_PUBLIC_PURCHASE_FIRST='claim-v1';
  for(const audience of ['production','unknown','']){
   process.env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE=audience;
   expect(()=>configure({config:app.expo} as any)).toThrow('TestFlight');
  }
  delete process.env.EXPO_PUBLIC_PURCHASE_FIRST;process.env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE='sandbox';
  expect(()=>configure({config:app.expo} as any)).toThrow('TestFlight');
  delete process.env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE;
  expect(configure({config:app.expo} as any).updates?.enabled).toBe(false);
 }finally{
  for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];
  Object.assign(process.env,saved);
 }
});
