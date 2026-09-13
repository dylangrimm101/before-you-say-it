import {withRequestDeadline} from './requestDeadline';
export const PAID_VOICE_ENDPOINTS={tts:'https://bysi-signup-staging.vercel.app/api/practice/tts',transcribe:'https://bysi-signup-staging.vercel.app/api/practice/transcribe'} as const;
type User={id:string;is_anonymous?:boolean;email_confirmed_at?:string};
type Auth={getSession():Promise<{data:{session:{access_token:string;user:{id:string}}|null};error:unknown}>;getUser(jwt:string):Promise<{data:{user:User|null};error:unknown}>;onAuthStateChange(cb:(event:string,session:{user:{id:string}}|null)=>void):{data:{subscription:{unsubscribe():void}}}};
/** Exact isolated Auth environment must come from supabase.ts native ID/build gates.
 * No result/CustomerInfo/Pro presentation value participates in authorization. */
export function createPaidVoiceTransport(config:{developmentBuild:boolean;staging:boolean;authUrl:string;endpoints?:{tts:string;transcribe:string};auth:Auth;fetch?:typeof fetch;onInvalidate?:()=>void}) {
 if(!config.developmentBuild||!config.staging||config.authUrl!=='https://pqqxaklcburdxjfeolmd.supabase.co'||config.endpoints?.tts!==PAID_VOICE_ENDPOINTS.tts||config.endpoints?.transcribe!==PAID_VOICE_ENDPOINTS.transcribe)return null;
 const endpoints=config.endpoints,auth=config.auth,send=config.fetch??fetch;
 let revision=0,disposed=false;
 let activeOwner:string|null=null;
 const pending=new Set<AbortController>();
 const invalidate=()=>{revision++;for(const c of pending)c.abort();config.onInvalidate?.();};
 const subscription=auth.onAuthStateChange((event,session)=>{
  const owner=session?.user.id??null;
  const initial=event==='INITIAL_SESSION'&&revision===0&&activeOwner===null;
  if((owner!==activeOwner&&!initial)||(event!=='TOKEN_REFRESHED'&&event!=='INITIAL_SESSION'))invalidate();
  activeOwner=owner;
 }).data.subscription;
 return {
  async request(operation:'tts'|'transcribe',payload:Record<string,unknown>|FormData,timeoutMs=45000,signal?:AbortSignal):Promise<Response>{
   if(disposed)throw Error('Paid transport unavailable');
   const before=revision,control=new AbortController();pending.add(control);
   const abort=()=>control.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const current=()=>{if(disposed||before!==revision||control.signal.aborted)throw Error('Account changed');};
   try{return await withRequestDeadline(async(requestSignal)=>{
    current();requestSignal.throwIfAborted();const session=await auth.getSession();current();requestSignal.throwIfAborted();
    const s=session.data.session;if(session.error||!s||!s.access_token)throw Error('Sign in required');
    activeOwner=s.user.id;
    const verified=await auth.getUser(s.access_token);current();requestSignal.throwIfAborted();
    const user=verified.data.user;if(verified.error||!user||user.id!==s.user.id||user.is_anonymous!==false||!user.email_confirmed_at)throw Error('Confirmed account required');
    const multipart=operation==='transcribe';
    if(multipart!== (payload instanceof FormData))throw Error('Invalid voice payload');
    const response=await send(endpoints[operation],{method:'POST',headers:{...(multipart?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+s.access_token},body:multipart?payload as FormData:JSON.stringify(payload),redirect:'error',credentials:'omit',cache:'no-store',signal:requestSignal});current();
    const limit=operation==='tts'?2*1024*1024:32768;
    if(Number(response.headers.get('content-length'))>limit)throw Error('Voice response too large');
    const reader=response.body?.getReader?.();let size=0;const chunks:Uint8Array[]=[];
    // React Native's fetch polyfill can expose arrayBuffer but no body stream.
    if(!reader){const data=new Uint8Array(await response.arrayBuffer());current();requestSignal.throwIfAborted();if(data.length>limit)throw Error('Voice response too large');size=data.length;chunks.push(data);}
    const cancelReader=()=>{void reader?.cancel().catch(()=>{});};requestSignal.addEventListener('abort',cancelReader,{once:true});
    try{if(reader)while(true){const {done,value}=await reader.read();current();requestSignal.throwIfAborted();if(done)break;size+=value.length;if(size>(operation==='tts'?2*1024*1024:32768)){cancelReader();throw Error('Voice response too large');}chunks.push(value);}}
    finally{requestSignal.removeEventListener('abort',cancelReader);}
    current();const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,headers:response.headers});
   },timeoutMs,control.signal);}finally{pending.delete(control);signal?.removeEventListener('abort',abort);}
  },
  dispose(){disposed=true;invalidate();subscription.unsubscribe();},
 };
}
