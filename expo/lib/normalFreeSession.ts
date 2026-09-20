import {withRequestDeadline} from './requestDeadline';
import {sessionCanTalk} from './nativeAuth';
import {nativeResponseText} from './nativeResponseText';
import type {createNativeBilling} from './nativeBilling';
type Auth=NonNullable<Parameters<typeof createNativeBilling>[0]['auth']>;
export type RecordingIdentity={turn:'opener'|'reply';identity:string};
type Journal={nonce:string;visitId?:string;visitCanStart?:boolean;generation?:number;restart?:{id:string;generation:number};sessionId?:string;operations:Record<string,{id:string;digest:string}>;audio?:{digest:string;turn:string;role:string}};
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)])):v;
// React Native's locked whatwg-fetch Response has instance json(), but not the
// newer static Response.json(). Preserve local refusal bodies/status on device.
const localJson=(body:Record<string,unknown>,status=200):Response=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
export function createNormalFreeSession(config:{origin:string;authUrl:string;auth:Auth;storage:{getItem(k:string):Promise<string|null>;setItem(k:string,v:string):Promise<unknown>};random():string;hash(s:string):Promise<string>;onInvalidate?():void;guestVisit?:{current(owner:string):string|null;subscribe(listener:()=>void):()=>void};fetch?:(url:string,init:RequestInit)=>Promise<Response>}){
 if(config.origin!=='https://beforeyousayit.app'||config.authUrl!=='https://spvksnddzyvycfoefrcf.supabase.co')throw Error('Normal free configuration invalid');
 let revision=0,owner:string|null=null,disposed=false,queue=Promise.resolve();const pending=new Set<AbortController>();
 const invalidate=()=>{revision++;for(const c of pending)c.abort();config.onInvalidate?.();};
 const unsubscribeVisit=config.guestVisit?.subscribe(invalidate);
 const subscription=config.auth.onAuthStateChange((event,s)=>{const next=s?.user.id??null;if(event==='SIGNED_OUT'){invalidate();owner=null;}else if(next!==owner){if(owner!==null)invalidate();owner=next;}}).data.subscription;
 async function perform(operation:'generate'|'tts'|'transcribe'|'recover'|'restart'|'endVisit',input:Record<string,unknown>|FormData,externalSignal?:AbortSignal,recording?:RecordingIdentity):Promise<Response>{
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
   if(owner!==null&&owner!==session.user.id)throw Error('Account changed');
   owner=session.user.id;
   const verified=await config.auth.getUser(session.access_token);current();const user=verified.data.user;
   if(verified.error||!user||user.id!==session.user.id)throw Error('Confirmed account required');
   if(!sessionCanTalk({...session.user,...user}))throw Error('Confirmed account required');owner=user.id;
   const visitId=user.is_anonymous===true&&config.guestVisit?config.guestVisit.current(user.id):null;
   if(user.is_anonymous===true&&config.guestVisit&&!/^[a-f0-9]{64}$/.test(visitId??''))throw Error('Guest visit changed');
   const key='normal-free-v1.'+user.id;const stored=await config.storage.getItem(key);current();
   const journal:Journal=stored?JSON.parse(stored):{nonce:config.random(),operations:{}};
   if(!/^[a-f0-9]{64}$/.test(journal.nonce)||!journal.operations)throw Error('Free session recovery required');
   const save=async()=>{current();await config.storage.setItem(key,JSON.stringify(journal));current();};
   const send=async(op:string,body:Record<string,unknown>|FormData,extra:Record<string,string>={})=>{
    current();const r=await (config.fetch??fetch)(config.origin+'/api/native/free/'+op,{method:'POST',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+session.access_token,...(visitId?{'x-bysi-guest-visit':visitId}:{}),...extra},body:body instanceof FormData?body:JSON.stringify(body),signal,redirect:'error',credentials:'omit',cache:'no-store'});
    current();const bytes=await r.arrayBuffer();current();if(signal.aborted)throw Error('Request aborted');if(r.redirected||bytes.byteLength>(op==='tts'?2097152:131072))throw Error('Invalid free response');
    // JSON must be UTF-8 decoded before constructing the native Response.
    // Preserve successful MPEG audio as bytes, including non-text byte values.
    const responseBody=op==='tts'&&r.ok?bytes:nativeResponseText(bytes);
    return new Response(responseBody,{status:r.status,headers:r.headers});
   };
   if(operation==='endVisit'){
    if(!visitId||journal.visitId!==visitId)return localJson({status:'not_started'});
    return send('session',{visit:'end'});
   }
   if(visitId&&journal.visitId!==visitId){
    // Explicit new-visit protocol. No legacy fallback: an old server cannot
    // silently restore an earlier conversation or mint an extra allowance.
    await save();
    const started=await send('session',{visit:'begin'});if(!started.ok)return started;
    const allocation=await started.json();
    if(allocation.status!=='started'||!/^[a-f0-9-]{36}$/.test(allocation.sessionId??'')||!Number.isInteger(allocation.generation)||allocation.generation<0||typeof allocation.canStart!=='boolean')throw Error('Guest visit unavailable');
    journal.visitId=visitId;journal.visitCanStart=allocation.canStart;
    journal.sessionId=allocation.sessionId;journal.generation=allocation.generation;
    journal.operations={};delete journal.audio;delete journal.restart;await save();
   }
   if(visitId&&journal.visitCanStart===false)return operation==='recover'
    ?localJson({status:'visit_limit',sessionId:journal.sessionId,generation:journal.generation})
    :localJson({code:'visit_limit'},429);
   if(visitId&&operation==='restart')return localJson({code:'visit_ended'},409);
   const issue=async(clear:boolean)=>{
    if(clear){journal.operations={};delete journal.audio;delete journal.sessionId;}
    await save();const issued=await send('session',{nonce:journal.nonce});if(!issued.ok)return issued;
    const allocation=await issued.json();if(!/^[a-f0-9-]{36}$/.test(allocation.sessionId??'')||!Number.isInteger(allocation.generation??0))throw Error('Free session recovery required');
    journal.sessionId=allocation.sessionId;journal.generation=allocation.generation??0;await save();return null;
   };
   if(operation==='restart'){
    const request=payload as Record<string,unknown>;
    if(!journal.sessionId||request.sessionId!==journal.sessionId||!Number.isInteger(request.generation))throw Error('Check your practice before starting another');
    const generation=request.generation as number;
    if(!journal.restart||journal.restart.generation!==generation){journal.restart={id:config.random(),generation};await save();}
    const response=await send('session',{restart:true,sessionId:journal.sessionId,generation,restartId:journal.restart.id});
    if(response.ok){
     const result=await response.clone().json();
     if(result.status!=='restarted'||result.sessionId!==journal.sessionId||result.generation!==generation+1)throw Error('Free session recovery required');
     journal.generation=result.generation;delete journal.audio;await save();revision++;config.onInvalidate?.();
    }
    return response;
   }
   if(operation==='recover'){
    const recover=()=>send('session',{...payload,recover:true});
    let response=await recover();
    if(!response.ok)return response;
    let recovered=await response.clone().json();
    if(recovered.status==='new'&&journal.sessionId){
     journal.operations={};delete journal.audio;delete journal.sessionId;delete journal.generation;delete journal.restart;await save();
    }
    if(!visitId&&['expired','exhausted'].includes(recovered.status)){
     const issued=await issue(recovered.status==='exhausted');if(issued)return issued;
     response=await recover();if(!response.ok)return response;
     recovered=await response.clone().json();
    }
    if(recovered.sessionId){
     if(!/^[a-f0-9-]{36}$/.test(recovered.sessionId)||(journal.sessionId&&journal.sessionId!==recovered.sessionId))throw Error('Free session recovery required');
     if(!Number.isInteger(recovered.generation)||recovered.generation<0)throw Error('Free session recovery required');
     const generationChanged=(journal.generation??0)!==recovered.generation;
     if(generationChanged)delete journal.audio;
     journal.sessionId=recovered.sessionId;journal.generation=recovered.generation;
     if(recovered.status==='resume'&&recovered.audio){
      const audio=recovered.audio;
      if(typeof audio.text!=='string'||!['pushback','close'].includes(audio.turn)||typeof audio.role!=='string')throw Error('Free session recovery required');
      journal.audio={digest:await config.hash(audio.text),turn:audio.turn,role:audio.role};
      if(recovered.playback){
       const playback=recovered.playback;
       const digest=await config.hash(JSON.stringify(canonical({text:audio.text,role:audio.role,turn:audio.turn})));
       if(!/^[a-f0-9]{64}$/.test(playback.id)||playback.digest!==digest)throw Error('Free session recovery required');
       const kind='tts_'+audio.turn;const operationKey=journal.generation?`${journal.generation}:${kind}`:kind;
       journal.operations[operationKey]={id:playback.id,digest};
      }
     }
     await save();
     if(generationChanged){revision++;config.onInvalidate?.();}
    }
    return response;
   }
   if(!journal.sessionId){const issued=await issue(false);if(issued)return issued;}
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
   let operationKey=journal.generation?`${journal.generation}:${kind}`:kind;
   const hash=await config.hash(fingerprint);let op=journal.operations[operationKey];
   if(!op||op.digest!==hash){op={id:config.random(),digest:hash};journal.operations[operationKey]=op;await save();}
   let response=await send(operation,payload,{'x-bysi-session':journal.sessionId!,'x-bysi-operation':op.id,'x-bysi-generation':String(journal.generation??0)});
   if(!response.ok){
    const result=await response.clone().json().catch(()=>({}));
    if(!visitId&&['expired','exhausted'].includes(result.code)&&['pushback','transcribe_opener'].includes(kind)){
     const issued=await issue(true);if(issued)return issued;
     operationKey=journal.generation?`${journal.generation}:${kind}`:kind;
     op={id:config.random(),digest:hash};journal.operations[operationKey]=op;await save();
     response=await send(operation,payload,{'x-bysi-session':journal.sessionId!,'x-bysi-operation':op.id,'x-bysi-generation':String(journal.generation??0)});
    }
   }
   if(response.ok&&operation==='generate'){
    const output=await response.clone().json();if(output.mode==='turn'){journal.audio={digest:await config.hash(output.text),turn:output.turn,role:output.role};await save();}
   }else if(!response.ok){const result=await response.clone().json().catch(()=>({}));if(['failed','unverified_exchange'].includes(result.code)){delete journal.operations[operationKey];await save();}}
   return response;
  },95000,controller.signal);}finally{pending.delete(controller);externalSignal?.removeEventListener('abort',abort);}
 }
 return {request(operation:'generate'|'tts'|'transcribe'|'recover'|'restart'|'endVisit',payload:Record<string,unknown>|FormData,signal?:AbortSignal,recording?:RecordingIdentity){
  const snapshot=payload instanceof FormData?payload:JSON.parse(JSON.stringify(payload));const epoch=revision;
  const run=queue.then(()=>{if(epoch!==revision)throw Error('Account changed');return perform(operation,snapshot,signal,recording);});queue=run.then(()=>{},()=>{});return run;
 },dispose(){disposed=true;invalidate();subscription.unsubscribe();unsubscribeVisit?.();}};
}
