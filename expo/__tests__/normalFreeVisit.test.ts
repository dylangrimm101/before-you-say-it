import {expect,test} from 'bun:test';
import {createHash} from 'node:crypto';
import {createNormalFreeSession} from '../lib/normalFreeSession';

function fixture(guest=true,override?:(body:any,signal?:AbortSignal|null)=>Promise<Response|undefined>){
 const storage=new Map<string,string>(), calls:any[]=[];let id='a'.repeat(64),n=1;
 const changed=new Set<()=>void>();
 const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:guest,email_confirmed_at:guest?undefined:'2026-01-01'};
 const client=createNormalFreeSession({origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',
  auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  random:()=>String(++n).padStart(64,'0'),hash:async text=>createHash('sha256').update(text).digest('hex'),
  storage:{getItem:async key=>storage.get(key)??null,setItem:async(key,value)=>{storage.set(key,value);}},
  guestVisit:{current:()=>id,subscribe:listener=>{changed.add(listener);return()=>{changed.delete(listener);};}},
  fetch:async(_url,init)=>{const body=JSON.parse(init.body as string);calls.push({body,headers:init.headers});
   const custom=await override?.(body,init.signal);if(custom)return custom;
   if(body.visit==='begin')return Response.json({code:'ok',status:'started',sessionId:user.id,generation:n,canStart:true});
   if(body.visit==='end')return Response.json({code:'ok',status:'ended'});
   if(body.recover)return Response.json({status:'start',sessionId:user.id,generation:n,used:false});
   return Response.json({sessionId:user.id,generation:n});
  }});
 return {client,calls,storage,rotate(){id='b'.repeat(64);for(const f of changed)f();}};
}
test('guest begins once per visit, preserves its opaque journal, and never resumes an older visit',async()=>{
 const f=fixture();try{
  expect((await f.client.request('recover',{})).ok).toBe(true);
  await f.client.request('recover',{});
  expect(f.calls.filter(c=>c.body.visit==='begin')).toHaveLength(1);
  const nonce=JSON.parse([...f.storage.values()][0]).nonce;
  f.rotate();await f.client.request('recover',{});
  expect(f.calls.filter(c=>c.body.visit==='begin')).toHaveLength(2);
  expect(JSON.parse([...f.storage.values()][0]).nonce).toBe(nonce);
  expect(f.calls.at(-1).headers['x-bysi-guest-visit']).toBe('b'.repeat(64));
 }finally{f.client.dispose();}
});

test('an unsupported server fails closed without legacy issue, restart or generation',async()=>{
 const f=fixture(true,async()=>Response.json({code:'invalid'},{status:400}));
 try{expect((await f.client.request('recover',{})).status).toBe(400);expect(f.calls.map(c=>c.body)).toEqual([{visit:'begin'}]);}
 finally{f.client.dispose();}
});
test('lost begin response retries the same visit, and allowance refusal never dispatches generation',async()=>{
 let lost=true;const f=fixture(true,async body=>{
  if(body.visit==='begin'){if(lost){lost=false;throw Error('synthetic lost acknowledgement');}return Response.json({status:'started',sessionId:'11111111-1111-4111-8111-111111111111',generation:1,canStart:false});}
 });
 try{
  await expect(f.client.request('recover',{})).rejects.toThrow();
  expect((await (await f.client.request('recover',{})).json()).status).toBe('visit_limit');
  expect((await f.client.request('generate',{type:'rehearsal_turn',turn:'pushback',contract:{},transcript:{}})).status).toBe(429);
  expect(f.calls).toHaveLength(2);expect(f.calls[0].headers['x-bysi-guest-visit']).toBe(f.calls[1].headers['x-bysi-guest-visit']);
 }finally{f.client.dispose();}
});
test('rotation aborts old in-flight and queued calls without returning their content',async()=>{
 let release!:()=>void,seen!:()=>void;const gate=new Promise<void>(r=>{release=r;}),started=new Promise<void>(r=>{seen=r;});let signal:AbortSignal|null|undefined;
 const f=fixture(true,async(body,s)=>{if(body.visit==='begin'){signal=s;seen();await gate;}return undefined;});
 try{
  const first=f.client.request('recover',{}).catch(e=>e);const queued=f.client.request('recover',{}).catch(e=>e);
  await started;f.rotate();expect(signal?.aborted).toBe(true);release();
  expect(await first).toBeInstanceOf(Error);expect(await queued).toBeInstanceOf(Error);expect(f.calls).toHaveLength(1);
 }finally{release();f.client.dispose();}
});
test('registered accounts do not send the guest protocol',async()=>{
 const f=fixture(false);try{await f.client.request('recover',{});expect(f.calls).toHaveLength(1);expect(f.calls[0].headers['x-bysi-guest-visit']).toBeUndefined();}finally{f.client.dispose();}
});
test('explicit guest end uses its current visit and never restarts or issues extra capacity',async()=>{
 const f=fixture();try{await f.client.request('recover',{});await f.client.request('endVisit',{});expect(f.calls.at(-1).body).toEqual({visit:'end'});expect(f.calls.some(c=>c.body.restart||c.body.nonce)).toBe(false);}finally{f.client.dispose();}
});
