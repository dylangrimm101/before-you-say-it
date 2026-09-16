import {test,expect} from 'bun:test';
import {createClient} from '@supabase/supabase-js';
import {createNativeBilling} from '../lib/nativeBilling';
const origin='https://spvksnddzyvycfoefrcf.supabase.co';
const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',is_anonymous:false,email_confirmed_at:'2026-01-01',app_metadata:{},user_metadata:{},created_at:'2026-01-01'};
const token=[{alg:'HS256'},{sub:user.id,exp:Math.floor(Date.now()/1000)+3600},'synthetic'].map(v=>Buffer.from(JSON.stringify(v)).toString('base64url')).join('.');
test('installed Supabase SDK same-owner SIGNED_IN during paid body read preserves response; logout still cancels',async()=>{
 const events:string[]=[];
 const sdk=createClient(origin,'synthetic-public',{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:async(input)=>{
  if(String(input).endsWith('/user'))return Response.json(user);
  if(String(input).includes('/logout'))return new Response(null,{status:204});
  throw Error('Unexpected synthetic Auth route');
 }}});
 await sdk.auth.initialize();await sdk.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'});
 const sub=sdk.auth.onAuthStateChange(event=>{events.push(event)});
 let release!:()=>void,entered!:()=>void;
 let gate=new Promise<void>(r=>entered=r);let signal:AbortSignal|undefined;
 const billing=createNativeBilling({enabled:true,authUrl:origin,origin:'https://beforeyousayit.app',auth:sdk.auth,fetch:async(_url,init)=>{signal=init?.signal as AbortSignal;entered();await new Promise<void>(r=>release=r);return Response.json({allowed:true})}})!;
 // Let the SDK deliver INITIAL_SESSION before testing its repeated SIGNED_IN.
 await new Promise(resolve=>setTimeout(resolve,0));
 try{
  const pending=billing.access();await gate;
  await sdk.auth.setSession({access_token:token,refresh_token:'synthetic-refresh'});
  expect(events).toContain('SIGNED_IN');expect(signal?.aborted).toBe(false);release();expect(await pending).toBe(true);
  gate=new Promise<void>(r=>entered=r);const next=billing.access().then(()=>null,error=>error);await gate;
  await sdk.auth.signOut();expect(signal?.aborted).toBe(true);release();expect((await next)?.message).toMatch(/aborted|changed/i);
 }finally{billing.dispose();sub.data.subscription.unsubscribe();await sdk.auth.stopAutoRefresh()}
});
