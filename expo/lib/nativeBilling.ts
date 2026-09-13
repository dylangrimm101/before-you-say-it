import {withRequestDeadline} from './requestDeadline';
type User={id:string;is_anonymous?:boolean;email_confirmed_at?:string};
type Auth={getSession():Promise<{data:{session:{access_token:string;user:{id:string}}|null};error:unknown}>;getUser(jwt:string):Promise<{data:{user:User|null};error:unknown}>;onAuthStateChange(cb:(event:string,session:{user:{id:string}}|null)=>void):{data:{subscription:{unsubscribe():void}}}};
export function createNativeBilling(config:{enabled:boolean;authUrl?:string;origin?:string;auth?:Auth;fetch?:typeof fetch}) {
 if(!config.enabled)return null;
 if(config.authUrl!=='https://spvksnddzyvycfoefrcf.supabase.co'||config.origin!=='https://beforeyousayit.app'||!config.auth)throw Error('Native billing configuration unavailable');
 const auth=config.auth,origin=config.origin,send=config.fetch??fetch;
 let revision=0,disposed=false,suspended=false,owner:string|null=null;
 const pending=new Set<AbortController>();
 const invalidate=()=>{revision++;for(const control of pending)control.abort();};
 const subscription=auth.onAuthStateChange((event,session)=>{const next=session?.user.id??null;if(next!==owner||!['INITIAL_SESSION','TOKEN_REFRESHED'].includes(event))invalidate();owner=next;}).data.subscription;
 async function request(operation:'identify'|'access'|'generate'|'tts'|'transcribe'|'results/discover'|'results/restore'|'follow-through/discover'|'follow-through/restore'|'follow-through/recovery',payload:Record<string,unknown>|FormData={},timeoutMs=operation==='generate'?75000:operation==='transcribe'?45000:15000,externalSignal?:AbortSignal){
  const before=revision,control=new AbortController();pending.add(control);
  const abort=()=>control.abort();externalSignal?.addEventListener("abort",abort,{once:true});if(externalSignal?.aborted)abort();
  const current=()=>{if(disposed||(suspended&&operation!=='identify')||before!==revision||control.signal.aborted)throw Error('Account changed');};
  try{return await withRequestDeadline(async signal=>{
   current();const s=await auth.getSession();current();const session=s.data.session;
   if(s.error||!session)throw Error('Sign in to verify your purchase');
   const verified=await auth.getUser(session.access_token);current();const user=verified.data.user;
   if(verified.error||!user||user.id!==session.user.id||user.is_anonymous!==false||!user.email_confirmed_at)throw Error('Confirmed account required');
   owner=user.id;
   const response=await send(origin+(operation.startsWith('follow-through/')?'/api/':'/api/native/')+operation,{method:'POST',headers:{...(payload instanceof FormData?{}:{'Content-Type':'application/json'}),Authorization:'Bearer '+session.access_token},body:payload instanceof FormData?payload:JSON.stringify(payload),signal,redirect:'error',credentials:'omit',cache:'no-store'});current();
   const bytes=await response.arrayBuffer();current();signal.throwIfAborted();
   if(bytes.byteLength>(operation==='tts'?2097152:131072)||response.redirected)throw Error('Billing response invalid');
   return new Response(bytes,{status:response.status,headers:response.headers});
  },timeoutMs,control.signal);}finally{pending.delete(control);externalSignal?.removeEventListener("abort",abort);}
 }
 return {request,suspend(){suspended=true;invalidate();},async identify(){const before=revision;const r=await request('identify');const body=await r.json();if(!r.ok||!/^\w{8}-\w{4}-4\w{3}-[89ab]\w{3}-\w{12}$/.test(body.appUserId??''))throw Error('Purchase identity unavailable. Existing purchases are unchanged; retry.');if(before!==revision||disposed)throw Error('Account changed');suspended=false;return body.appUserId as string;},async access(){const r=await request('access');const body=await r.json();if(!r.ok||typeof body.allowed!=='boolean')throw Error('Purchase verification unavailable. Retry, do not repurchase.');return body.allowed as boolean;},invalidate,dispose(){disposed=true;invalidate();subscription.unsubscribe();}};
}
