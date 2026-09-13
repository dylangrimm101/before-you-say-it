import {withRequestDeadline} from './requestDeadline';
export const FREE_STAGING_ENDPOINT = 'https://bysi-signup-staging.vercel.app/api/web-signup/generate';
export type AcquisitionAuth = {
 getSession(): Promise<{data:{session:{access_token:string;user:{id:string}}|null};error:unknown}>;
 getUser(jwt:string): Promise<{data:{user:{id:string}|null};error:unknown}>;
 onAuthStateChange(cb:(event:string,session:{user:{id:string}}|null)=>void): {data:{subscription:{unsubscribe():void}}};
};
type Storage = {getItem(key:string):Promise<string|null>;setItem(key:string,value:string):Promise<void>};
type Config = {developmentBuild:boolean;staging:boolean;authUrl:string;endpoint?:string;auth:AcquisitionAuth;storage:Storage;fetch?:typeof fetch};
export function createFreeAcquisitionTransport(config:Config) {
 if(!config.developmentBuild||!config.staging||config.authUrl!=='https://pqqxaklcburdxjfeolmd.supabase.co'||config.endpoint!==FREE_STAGING_ENDPOINT)return null;
 const origin='https://bysi-signup-staging.vercel.app',send=config.fetch??fetch;
 let disposed=false,revision=0,activeOwner:string|null=null,pending:AbortController|null=null;
 let capability:{owner:string;cookie:string;csrf:string}|null=null;
 const invalidate=()=>{revision++;capability=null;pending?.abort()};
 const subscription=config.auth.onAuthStateChange((event,session)=>{
  const owner=session?.user.id??null;
  const initial=event==='INITIAL_SESSION'&&revision===0&&activeOwner===null;
  if((owner!==activeOwner&&!initial)||(event!=='INITIAL_SESSION'&&event!=='TOKEN_REFRESHED'))invalidate();
  activeOwner=owner;
 }).data.subscription;
 return {
  async request(payload:Record<string,unknown>,timeoutMs=75000,signal?:AbortSignal):Promise<Response>{
   if(disposed||pending)throw Error('Acquisition unavailable or already in progress');
   // Reject paid/unsupported operations before any session-creation side effect.
   const allowed=['type','turn','contract','transcript','avoid_repeating','variation_seed','rewrite_requirement'];
   if(Object.keys(payload).some(k=>!allowed.includes(k))||!['rehearsal_turn','free_rehearsal_result'].includes(String(payload.type)))throw Error('Invalid acquisition operation');
   const {rewrite_requirement:unused,...body}=payload;void unused;
   const serializedBody=JSON.stringify(body);
   const before=revision,controller=new AbortController();pending=controller;
   const abort=()=>controller.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
   const current=()=>{if(disposed||before!==revision||controller.signal.aborted)throw Error('Acquisition account changed')};
   try{return await withRequestDeadline(async requestSignal=>{
    const check=()=>{current();requestSignal.throwIfAborted()};
    check();const session=await config.auth.getSession();check();
    const s=session.data.session;
    if(session.error||!s?.access_token||!/^[a-f0-9-]{36}$/.test(s.user.id))throw Error('Existing signed-in session required');
    activeOwner=s.user.id;
    const verified=await config.auth.getUser(s.access_token);check();
    if(verified.error||verified.data.user?.id!==s.user.id)throw Error('Verified session required');
    // Supabase JWT stays at Auth. The server-owned cookie + CSRF is the existing
    // acquisition authority, NEVER paid entitlement or a browser-supplied result.
    const read=async(response:Response)=>{
     if(response.redirected)throw Error('Acquisition redirect denied');
     const bytes=await response.arrayBuffer();check();
     if(bytes.byteLength>131072)throw Error('Acquisition response too large');
     return new Response([204,205,304].includes(response.status)?null:bytes,{status:response.status,headers:response.headers});
    };
    if(!capability||capability.owner!==s.user.id){
     const key='bysi.free-acquisition.'+s.user.id;
     const saved=await config.storage.getItem(key);check();
     // Persist intent BEFORE the session GET, which can allocate a durable quota
     // identity. A lost response or failed capability write is not permission to
     // create another identity, including after cold restart. No automatic reset.
     if(saved==='issuance-pending-v1')throw Error('Acquisition session recovery required');
     if(saved!==null&&!/^bysi_signup=[a-f0-9]{64}$/.test(saved))throw Error('Acquisition storage invalid');
     if(saved===null){await config.storage.setItem(key,'issuance-pending-v1');check();}
     const response=await read(await send(origin+'/api/web-signup/session',{method:'GET',headers:saved?{Cookie:saved}:{},credentials:'omit',redirect:'error',cache:'no-store',signal:requestSignal}));
     if(!response.ok)throw Error('Acquisition session unavailable');
     const cookie=response.headers.get('set-cookie')?.match(/^(bysi_signup=[a-f0-9]{64});/)?.[1]??saved;
     const body=await response.json();check();
     if(!cookie||body.environment!=='staging'||!/^[a-f0-9]{64}$/.test(body.csrf??''))throw Error('Acquisition session invalid');
     // Persist before spending. Never discard the capability on errors, logout or
     // restart: the hosted lock/lifetime/global quotas remain authoritative.
     await config.storage.setItem(key,cookie);check();
     capability={owner:s.user.id,cookie,csrf:body.csrf};
    }
    // The native rewrite hint is not part of the existing acquisition contract.
    // Do not forward arbitrary lesson/paid fields or invent server capabilities.
    return read(await send(FREE_STAGING_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,Cookie:capability.cookie,'x-bysi-csrf':capability.csrf},body:serializedBody,redirect:'error',credentials:'omit',cache:'no-store',signal:requestSignal}));
   },timeoutMs,controller.signal);}finally{if(pending===controller)pending=null;signal?.removeEventListener('abort',abort)}
  },
  dispose(){disposed=true;invalidate();subscription.unsubscribe()},
 };
}
