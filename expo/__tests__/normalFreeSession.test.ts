import {test,expect} from 'bun:test';
import {createHash,randomBytes} from 'node:crypto';
test('account changes invalidate owner-bound free playback',async()=>{
 const {createNormalFreeSession}=await import('../lib/normalFreeSession');let event:(name:string,s:any)=>void=()=>{};let invalidated=0;
 const auth={getSession:async()=>({data:{session:null},error:null}),getUser:async()=>({data:{user:null},error:null}),onAuthStateChange:(cb:typeof event)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}};}};
 const client=createNormalFreeSession({auth,origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',random:()=>randomBytes(32).toString('hex'),hash:async(s:string)=>s,storage:{getItem:async()=>null,setItem:async()=>{}},onInvalidate:()=>{invalidated++;}});
 event('SIGNED_OUT',null);expect(invalidated).toBe(1);client.dispose();
});

test('native FormData without get supports explicit recording identity',async()=>{
 const {createNormalFreeSession}=await import('../lib/normalFreeSession');
 const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:false,email_confirmed_at:'2026-01-01'};
 const auth={getSession:async()=>({data:{session:{access_token:'synthetic',user}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 const data=new Map<string,string>();let dispatched=false;
 const client=createNormalFreeSession({auth,origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',random:()=>randomBytes(32).toString('hex'),hash:async(s:string)=>createHash('sha256').update(s).digest('hex'),storage:{getItem:async(k)=>data.get(k)??null,setItem:async(k,v)=>{data.set(k,v);}},fetch:async(url)=>url.endsWith('session')?Response.json({sessionId:user.id}):(dispatched=true,Response.json({text:'Synthetic'}))});
 const body=new FormData();Object.defineProperty(body,'get',{value:undefined});
 const response=await client.request('transcribe',body,undefined,{turn:'opener',identity:'file:///synthetic.m4a'});
 expect(response.status).toBe(200);expect(dispatched).toBe(true);client.dispose();
});

test('normal Release transport persists issuance and exact operation before dispatch and recovers lost responses',async()=>{
 const mod=await import('../lib/normalFreeSession').catch(()=>null);expect(mod).not.toBeNull();if(!mod)return;
 const data=new Map<string,string>();let sessionCalls=0,generationCalls=0,lose=true;const ids:string[]=[];
 const auth={getSession:async()=>({data:{session:{access_token:'synthetic',user:{id:'11111111-1111-4111-8111-111111111111'}}},error:null}),getUser:async()=>({data:{user:{id:'11111111-1111-4111-8111-111111111111',is_anonymous:false,email_confirmed_at:'2026-01-01'}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 const config={auth,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',storage:{getItem:async(k:string)=>data.get(k)??null,setItem:async(k:string,v:string)=>{data.set(k,v);}},random:()=>randomBytes(32).toString('hex'),hash:async(s:string)=>createHash('sha256').update(s).digest('hex'),fetch:async(url:any,init:any)=>{
  expect(data.size).toBe(1);if(String(url).endsWith('/session')){sessionCalls++;return Response.json({sessionId:'22222222-2222-4222-8222-222222222222',expires:'2026-12-01',phase:'start'});}
  generationCalls++;ids.push(init.headers['x-bysi-operation']);expect(init.headers.Authorization).toBe('Bearer synthetic');if(lose){lose=false;throw Error('Lost committed response');}return Response.json({mode:'turn',text:'Synthetic'});
 }};
 const payload={type:'rehearsal_turn',turn:'pushback',contract:{scene:'same'},transcript:{user_turn_1:'hello'},variation_seed:'volatile'};
 const first=mod.createNormalFreeSession(config);await expect(first.request('generate',payload)).rejects.toThrow();first.dispose();
 const resumed=mod.createNormalFreeSession(config);expect((await resumed.request('generate',{...payload,variation_seed:'changed'})).status).toBe(200);expect(sessionCalls).toBe(1);expect(generationCalls).toBe(2);expect(ids[0]).toBe(ids[1]);resumed.dispose();
});
