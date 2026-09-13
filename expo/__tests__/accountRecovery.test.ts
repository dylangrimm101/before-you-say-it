import { test, expect } from 'bun:test';
import * as recovery from '../lib/accountRecovery';
import {createClient} from '@supabase/supabase-js';
test('original recovery link sets password with verified recovery session and global revocation', async()=>{
 const calls:string[]=[];
 const auth:any={verifyOtp:async(input:any)=>{calls.push(input.type+':'+input.token_hash);return {data:{user:{id:'A'},session:{access_token:'recovery',user:{id:'A'}}},error:null}},getUser:async()=>({data:{user:{id:'A',is_anonymous:false}},error:null}),updateUser:async(input:any)=>{calls.push(input.password);return {data:{user:{id:'A'}},error:null}},signOut:async(input:any)=>{calls.push(input.scope);return {error:null}}};
 const flow=recovery.createAccountRecovery(auth,'https://example.supabase.co');
 expect(typeof flow.complete).toBe('function');
 const result=await flow.complete('https://example.supabase.co/auth/v1/verify?type=recovery&token=abc123','new-password');
 expect(result.success).toBe(true);expect(calls).toEqual(['recovery:abc123','new-password','global','local']);
});
test('real SDK recovery serialization and password update stay on isolated memory client',async()=>{
 const seen:any[]=[];const user={id:'A',email:'a@example.invalid',aud:'authenticated',role:'authenticated',created_at:'2026-01-01',is_anonymous:false};
 const client=createClient('https://example.supabase.co','synthetic-public',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(url,init)=>{
  const path=new URL(String(url)).pathname;seen.push({path,body:init?.body?JSON.parse(String(init.body)):null});
  if(path.endsWith('/recover'))return Response.json({});
  if(path.endsWith('/verify'))return Response.json({access_token:'fixture-token',refresh_token:'fixture-refresh',expires_in:3600,token_type:'bearer',user});
  if(path.endsWith('/logout'))return new Response(null,{status:204});
  return Response.json(user);
 }}});
 const flow=recovery.createAccountRecovery(client.auth,'https://example.supabase.co');
 expect((await flow.request('a@example.invalid')).success).toBe(true);
 expect((await flow.complete('https://example.supabase.co/auth/v1/verify?token=abc123&type=recovery','new-password')).success).toBe(true);
 expect(seen.find(x=>x.path.endsWith('/verify')).body).toEqual({token_hash:'abc123',type:'recovery',gotrue_meta_security:{}});
 expect(seen.some(x=>x.body?.password==='new-password')).toBe(true);
 expect((await client.auth.getSession()).data.session).toBe(null);
});
for(const scenario of ['wrong-host','wrong-type','expired','wrong-owner','update-error','revoke-error'])test('recovery fail closed: '+scenario,async()=>{
 let updates=0;const auth:any={verifyOtp:async()=>({data:{user:{id:'A'},session:{access_token:'t',user:{id:'A'}}},error:scenario==='expired'?{}:null}),getUser:async()=>({data:{user:{id:scenario==='wrong-owner'?'B':'A'}},error:null}),updateUser:async()=>{updates++;return {data:{user:{id:'A'}},error:scenario==='update-error'?{}:null}},signOut:async()=>({error:scenario==='revoke-error'?{}:null})};
 const result=await recovery.createAccountRecovery(auth,'https://example.supabase.co').complete(`https://${scenario==='wrong-host'?'attacker.invalid':'example.supabase.co'}/auth/v1/verify?token=abc123&type=${scenario==='wrong-type'?'signup':'recovery'}`,'new-password');
 expect(result.success).toBe(false);if(!['update-error','revoke-error'].includes(scenario))expect(updates).toBe(0);
});
test('recovery rejects mixed callback credentials before exchanging any token',async()=>{
 let calls=0;const auth:any={verifyOtp:async()=>{calls++;throw Error()},signOut:async()=>({error:null})};
 const flow=recovery.createAccountRecovery(auth,'https://example.supabase.co');
 for(const extra of ['&code=pkce','&access_token=credential','&redirect_to=https://beforeyousayit.app/&redirect_to=https://other.invalid','&unknown=1']) {
  expect((await flow.complete('https://example.supabase.co/auth/v1/verify?token=abc123&type=recovery'+extra,'new-password')).success).toBe(false);
 }
 expect(calls).toBe(0);
});
test('concurrent recovery links cannot replace the isolated password-update session',async()=>{
 let release:any;let calls=0;
 const auth:any={verifyOtp:async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return {data:{user:{id:'A'},session:{access_token:'t',user:{id:'A'}}},error:null}},getUser:async()=>({data:{user:{id:'A'}},error:null}),updateUser:async()=>({data:{user:{id:'A'}},error:null}),signOut:async()=>({error:null})};
 const flow=recovery.createAccountRecovery(auth,'https://example.supabase.co');const link='https://example.supabase.co/auth/v1/verify?token=abc123&type=recovery';
 const first=flow.complete(link,'new-password');
 const second=await flow.complete(link,'other-password');release();await first;
 expect(second.success).toBe(false);expect(calls).toBe(1);
});
test('recovery never distinguishes a missing account from accepted email',async()=>{
 const flow=recovery.createAccountRecovery({resetPasswordForEmail:async()=>({error:{status:400,code:'user_not_found',message:'User not found'}})} as any,'https://example.supabase.co');
 expect(await flow.request('nobody@example.invalid')).toEqual({success:true,message:recovery.RECOVERY_CONFIRMATION});
});
test('recovery request uses existing provider without claiming delivery; throttles duplicate requests', async () => {
 expect(typeof recovery.createAccountRecovery).toBe('function');
 const calls:any[]=[];
 const flow=recovery.createAccountRecovery({resetPasswordForEmail:async (...args:any[])=>{calls.push(args);return {error:null};}} as any,'https://example.supabase.co');
 expect((await flow.request(' A@example.com ')).success).toBe(true);
 expect(calls).toEqual([['a@example.com',{redirectTo:'https://beforeyousayit.app/reset-password'}]]);
 expect(recovery.RECOVERY_CONFIRMATION).not.toMatch(/copy|paste/i);
 expect(recovery.RECOVERY_CONFIRMATION).toMatch(/Tap Reset password/);
 expect((await flow.request('b@example.com')).success).toBe(false);
 expect(calls.length).toBe(1);
});
