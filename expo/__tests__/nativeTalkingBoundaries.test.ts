import {test,expect} from 'bun:test';
import {createNativeBilling} from '../lib/nativeBilling';
const user={id:'A',is_anonymous:false,email_confirmed_at:'2026-01-01'};
function fixture(send:any,override:any={}){
 let event:Function=()=>{};const session={access_token:'synthetic',user:{...user,...override}};
 const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session.user},error:null}),onAuthStateChange:(cb:Function)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const billing=createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:send})!;
 return {billing,event:(name:string,id:string|null)=>event(name,id?{user:{id}}:null)};
}
test('first request is cancelled by owner change during getUser before verification finishes',async()=>{
 let event:Function=()=>{},calls=0;
 const user={id:'A',is_anonymous:false,email_confirmed_at:'2026-01-01'};
 const auth={getSession:async()=>({data:{session:{access_token:'synthetic',user}},error:null}),getUser:async()=>{event('SIGNED_IN',{user:{id:'B'}});return {data:{user},error:null}},onAuthStateChange:(cb:Function)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const b=createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:async()=>{calls++;return Response.json({allowed:true})}})!;
 try{await expect(b.access()).rejects.toThrow(/aborted|changed/i);expect(calls).toBe(0)}finally{b.dispose()}
});
for(const stage of ['getSession','getUser'])test(`explicit logout during initial ${stage} cancels before paid dispatch`,async()=>{
 let event:Function=()=>{},calls=0;
 const user={id:'A',is_anonymous:false,email_confirmed_at:'2026-01-01'};
 const auth={getSession:async()=>{if(stage==='getSession')event('SIGNED_OUT',null);return {data:{session:{access_token:'synthetic',user}},error:null}},getUser:async()=>{if(stage==='getUser')event('SIGNED_OUT',null);return {data:{user},error:null}},onAuthStateChange:(cb:Function)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const b=createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:async()=>{calls++;return Response.json({allowed:true})}})!;
 try{await expect(b.access()).rejects.toThrow(/aborted|changed/i);expect(calls).toBe(0)}finally{b.dispose()}
});
for(const operation of ['identify','access','generate','transcribe','tts'] as const)test(`Hermes-safe ${operation} retains bytes, bearer, envelope and denied status`,async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'throwIfAborted')!;
 Object.defineProperty(AbortSignal.prototype,'throwIfAborted',{configurable:true,value:undefined});
 const calls:any[]=[];const bytes=new Uint8Array([0,1,127,128,255]);
 const f=fixture(async(url:any,init:any)=>{calls.push({url,init});return new Response(bytes,{status:403})});
 try{const r=await f.billing.request(operation,{text:'synthetic'});expect(r.status).toBe(403);expect(new Uint8Array(await r.arrayBuffer())).toEqual(bytes);expect(calls[0].url).toBe('https://beforeyousayit.app/api/native/'+operation);expect(calls[0].init.headers.Authorization).toBe('Bearer synthetic');expect(calls[0].init.redirect).toBe('error');expect(calls[0].init.credentials).toBe('omit')}finally{f.billing.dispose();Object.defineProperty(AbortSignal.prototype,'throwIfAborted',descriptor)}
});
for(const kind of ['SIGNED_OUT','different-owner','external','suspend','dispose','deadline'])test(`${kind} still cancels a pending paid response body`,async()=>{
 let entered!:()=>void,release!:()=>void,signal!:AbortSignal;
 const gate=new Promise<void>(r=>entered=r);
 const f=fixture(async(_url:any,init:any)=>{signal=init.signal;return {arrayBuffer:async()=>{entered();await new Promise<void>(r=>release=r);return new ArrayBuffer(1)},headers:new Headers(),status:200,redirected:false}});
 const control=new AbortController();const pending=f.billing.request('transcribe',{},kind==='deadline'?20:1000,control.signal).then(()=>null,e=>e);
 await gate;
 if(kind==='SIGNED_OUT')f.event('SIGNED_OUT',null);
 if(kind==='different-owner')f.event('SIGNED_IN','B');
 if(kind==='external')control.abort();if(kind==='suspend')f.billing.suspend();if(kind==='dispose')f.billing.dispose();
 const error=await pending;expect(error).toBeInstanceOf(Error);expect(signal.aborted).toBe(true);release();f.billing.dispose();
});
for(const invalid of [{is_anonymous:true},{email_confirmed_at:undefined}])test('paid registered/confirmed gate remains fail closed',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return Response.json({allowed:true})},invalid);
 try{await expect(f.billing.access()).rejects.toThrow('Confirmed account required');expect(calls).toBe(0)}finally{f.billing.dispose()}
});
