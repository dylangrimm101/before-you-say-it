import {expect, test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {createClient} from '@supabase/supabase-js';

for (const isolated of ['0','1']) {
  test(`mounted signup confirmation return and changed-email recovery (isolated=${isolated}; synthetic services)`, () => {
    const result=spawnSync(process.execPath,['__tests__/registeredSignup.fixture.ts'],{
      cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_SIGNUP_ISOLATED:isolated},encoding:'utf8',timeout:60000,
    });
    expect(result.stdout+result.stderr).toContain('PASS registered signup controls');
    expect(result.status).toBe(0);
  },65000);
}

test('installed Supabase SDK serializes signup and resend return URLs without creating a session (synthetic HTTP)',async()=>{
  const requests:{url:URL;body:any}[]=[];
  const client=createClient('https://fixture.supabase.co','synthetic-public-key',{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>{
      requests.push({url:new URL(String(input)),body:JSON.parse(String(init?.body))});
      return new Response(JSON.stringify({id:'00000000-0000-4000-8000-000000000001',email:'signup@example.invalid',identities:[]}),{status:200,headers:{'content-type':'application/json'}});
    }},
  });
  const options={emailRedirectTo:'https://beforeyousayit.app/'};
  const signed=await client.auth.signUp({email:'signup@example.invalid',password:'synthetic-password',options});
  const resent=await client.auth.resend({type:'signup',email:'signup@example.invalid',options});
  expect(signed.error).toBeNull();expect(signed.data.session).toBeNull();expect(resent.error).toBeNull();
  expect(requests.map(r=>r.url.pathname)).toEqual(['/auth/v1/signup','/auth/v1/resend']);
  expect(requests.map(r=>r.url.searchParams.get('redirect_to'))).toEqual([options.emailRedirectTo,options.emailRedirectTo]);
  expect(requests[1].body.type).toBe('signup');
  expect((await client.auth.getSession()).data.session).toBeNull();
});
