import {withRequestDeadline} from './requestDeadline';
import {sessionCanTalk} from './nativeAuth';
import type {createNativeBilling} from './nativeBilling';
type Auth=NonNullable<Parameters<typeof createNativeBilling>[0]['auth']>;
export type RecordingIdentity={turn:'opener'|'reply';identity:string};
type Journal={nonce:string;sessionId?:string;operations:Record<string,{id:string;digest:string}>;audio?:{digest:string;turn:string;role:string}};
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
export function createNormalFreeSession(config:{origin:string;authUrl:string;auth:Auth;storage:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<unknown>};random():string;hash(s:string):Promise<string>;onInvalidate?():void;fetch?:(url:string,init:RequestInit)=>Promise<Response>}){
 if(config.origin!=='https://beforeyousayit.app'||config.authUrl!=='https://spvksnddzyvycfoefrcf.supabase.co')throw Error('Normal free configuration invalid');
 let revision=0,owner:string|null=null,disposed=false,queue=Promise.resolve();const pending=new Set<AbortController>();
 const invalidate=()=>{revision++;for(const c of pending)c.abort();config.onInvalidate?.();};
 const subscription=config.auth.onAuthStateChange((event,s)=>{const next=s?.user.id??null;if(next!==owner||!['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event))invalidate();owner=next;}).data.subscription;
 async function perform(operation:'generate'|'tts'|'transcribe',input:Record<string,unknown>|FormData,externalSignal?:AbortSignal,recording?:RecordingIdentity):Promise<Response>{
  const before=revision,controller=new AbortController();pending.add(controller);const abort=()=>controller.abort();externalSignal?.addEventListener('abort',abort,{once:true});if(externalSignal?.aborted)abort();
  const current=()=>{if(disposed||before!==revision||controller.signal.aborted)throw Error('Account changed');};
  // Freeze JSON before asynchronous Auth. Ignore only existing non-contract hints.
  let payload=input instanceof FormData?input:JSON.parse(JSON.stringify(input)) as Record<string,unknown>;
  if(operation==='generate'){
   if(Object.keys(payload).some(k=>!['type','turn','contract','transcript','avoid_repeating','variation_seed','rewrite_requirement'].includes(k)))throw Error('Invalid free request');
   payload=Object.fromEntries(Object.entries(payload).filter(([k])=>['type','turn','contract','transcript'].includes(k)));
  }
  try{return await withRequestDeadline(async signal=>{
   current();const s=await config.auth.getSession();current();const session=s.data.session;
   if(s.error||!session)throw Error('Confirmed account required');
   const verified=await config.auth.getUser(session.access_token);current();const user=verified.data.user;
   if(verified.error||!user||user.id!==session.user.id)throw Error('Confirmed account required');
   if(!sessionCanTalk({...session.user,...user}))throw Error('Confirmed account required');owner=user.id;
   const key='normal-free-v1.'+user.id;const stored=await config.storage.getItem(key);current();
   const journal:Journal=stored?JSON.parse(stored):{nonce:config.random(),operations:{}};
   if(!/^[a-f0-9]{64}$/.test(journal.nonce)||!journal.operations)throw Error('Free session recovery required');
   const save=async()=>{current();await config.storage.setItem(key,JSON.stringify(journal));current();};
   const send=async(op:string,body:Record<string,unknown>|FormData,extra:Record<string,string>={})=>{
    current();const r=await (config.fetch??fetch)(config.origin+'/api/native/free/'+op,{method:'POST',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+session.access_token,...extra},body:body instanceof FormData?body:JSON.stringify(body),signal,redirect:'error',credentials:'omit',cache:'no-store'});
    current();const bytes=await r.arrayBuffer();current();if(signal.aborted)throw Error('Request aborted');if(r.redirected||bytes.byteLength>(op==='tts'?2097152:131072))throw Error('Invalid free response');return new Response(bytes,{status:r.status,headers:r.headers});
   };
   if(!journal.sessionId){await save();const issued=await send('session',{nonce:journal.nonce});if(!issued.ok)return issued;const allocation=await issued.json();if(!/^[a-f0-9-]{36}$/.test(allocation.sessionId??''))throw Error('Free session recovery required');journal.sessionId=allocation.sessionId;await save();}
   let kind:string,fingerprint:string;
   if(payload instanceof FormData){
    if(recording){kind='transcribe_'+recording.turn;fingerprint=JSON.stringify(recording);}
    else{kind='transcribe_'+String(payload.get('turn'));const file=payload.get('audio');fingerprint=JSON.stringify([kind,file instanceof Blob?[file.size,file.type,await config.hash(await file.text())]:file]);}
   }
   else {
    if(operation==='tts'){
     if(!journal.audio||await config.hash(String(payload.text))!==journal.audio.digest||payload.role!==journal.audio.role)throw Error('Only approved counterpart voice is available');
     payload={...payload,turn:journal.audio.turn};
    }
    kind=operation==='generate'?String(payload.type==='free_rehearsal_result'?'result':payload.turn):'tts_'+String(payload.turn);
    fingerprint=JSON.stringify(canonical(payload));
   }
   const hash=await config.hash(fingerprint);let op=journal.operations[kind];
   if(!op||op.digest!==hash){op={id:config.random(),digest:hash};journal.operations[kind]=op;await save();}
   const response=await send(operation,payload,{'x-bysi-session':journal.sessionId!,'x-bysi-operation':op.id});
   if(response.ok&&operation==='generate'){
    const output=await response.clone().json();if(output.mode==='turn'){journal.audio={digest:await config.hash(output.text),turn:output.turn,role:output.role};await save();}
   }else if(!response.ok){const result=await response.clone().json().catch(()=>({}));if(['failed','unverified_exchange'].includes(result.code)){delete journal.operations[kind];await save();}}
   return response;
  },95000,controller.signal);}finally{pending.delete(controller);externalSignal?.removeEventListener('abort',abort);}
 }
 return {request(operation:'generate'|'tts'|'transcribe',payload:Record<string,unknown>|FormData,signal?:AbortSignal,recording?:RecordingIdentity){
  const snapshot=payload instanceof FormData?payload:JSON.parse(JSON.stringify(payload));const epoch=revision;
  const run=queue.then(()=>{if(epoch!==revision)throw Error('Account changed');return perform(operation,snapshot,signal,recording);});queue=run.then(()=>{},()=>{});return run;
 },dispose(){disposed=true;invalidate();subscription.unsubscribe();}};
}
