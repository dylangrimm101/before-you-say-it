import type {SupabaseClient} from '@supabase/supabase-js';
export type AccountDeletionBilling={kind:'free'|'apple'|'web'|'unknown';store?:string;product_id?:string;will_renew?:boolean|null;expiration_date?:string|null;revenuecat_app_user_id?:string|null;provider?:string|null;one_time?:boolean|null};
export type AccountDeletionReceipt={ownerId:string;secret:string;digest:string;requestId?:string;status?:string};
export type AccountDeletionReceiptStore={load(ownerId:string):Promise<AccountDeletionReceipt|null>;loadLatest?():Promise<AccountDeletionReceipt|null>;save(receipt:AccountDeletionReceipt):Promise<void>};
export type AccountDeletionResult={success:boolean;message:string;status?:string;ownerId?:string};
export type ReceiptlessDeletionCapability={ownerId:string;secret:string;digest:string;registered?:boolean};
export type ReceiptlessDeletionCapabilityStore={load(ownerId:string):Promise<ReceiptlessDeletionCapability|null>;save(capability:ReceiptlessDeletionCapability):Promise<void>;listRegisteredOwners?():Promise<string[]>};
export type ReceiptlessDeletionNotice={deleted:boolean;uncertain?:boolean;ownerId?:string;status?:'deleting'|'deleted'|'active'};
export const STAGING_ACCOUNT_DELETION_REVIEW_FLAG='reviewed-task1-20260910';
export const STAGING_ACCOUNT_DELETION_ENDPOINT='https://pqqxaklcburdxjfeolmd.supabase.co/functions/v1/bysi-task1-account-delete';
export type AccountDeletionEndpointReview={authUrl:string|null;enabled:boolean;staging?:boolean;buildMode?:string;applicationId?:string|null;projectId?:string|null;reviewFlag?:string|null};
export const NORMAL_ACCOUNT_DELETION_ENDPOINT='https://beforeyousayit.app/functions/v1/account-delete';
export type DeletionDestination=string|Readonly<{url:string;backend:'normal-results-local-v1'}>;
const candidateDestinations=new WeakSet<object>();
export function candidateAccountDeletionEndpoint(input:{authUrl:string|null;flag?:string;development:boolean;staging?:boolean;buildMode?:string}):DeletionDestination|null {
 if(input.authUrl!=='https://spvksnddzyvycfoefrcf.supabase.co'||input.flag!=='normal-results-local-v1'||!input.development||input.staging||input.buildMode)return null;
 const destination=Object.freeze({url:NORMAL_ACCOUNT_DELETION_ENDPOINT,backend:'normal-results-local-v1' as const});
 candidateDestinations.add(destination);return destination;
}
const deletionUrl=(endpoint:DeletionDestination)=>typeof endpoint==='string'?endpoint:endpoint.url;
const submissionOwners=new Set<string>();
function bounded<T>(promise:Promise<T>,signal:AbortSignal):Promise<T>{
 return new Promise((resolve,reject)=>{
  const abort=()=>reject(new Error('Account request stopped'));
  if(signal.aborted){void promise.catch(()=>{});abort();return;}
  signal.addEventListener('abort',abort,{once:true});
  promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
 });
}
export function reviewedDeletionEndpoint(authUrl:string|null,enabled:boolean):string|null {
 return enabled && authUrl==='https://spvksnddzyvycfoefrcf.supabase.co'?`${authUrl}/functions/v1/account-delete`:null;
}
export function reviewedAccountDeletionEndpoint(input:AccountDeletionEndpointReview):string|null {
 if(!input.staging)return reviewedDeletionEndpoint(input.authUrl,input.enabled);
 if(!input.enabled)return null;
 return input.authUrl==='https://pqqxaklcburdxjfeolmd.supabase.co'
  && input.buildMode==='staging-account'
  && input.applicationId==='app.bysi.staging.account'
  && input.projectId==='b25c7aba-ef9d-4f88-b7c5-4da1678fcf44'
  && input.reviewFlag===STAGING_ACCOUNT_DELETION_REVIEW_FLAG
  ? STAGING_ACCOUNT_DELETION_ENDPOINT:null;
}
const isReviewedDeletionEndpoint=(endpoint:DeletionDestination)=>typeof endpoint==='object'?candidateDestinations.has(endpoint):endpoint==='https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete' || endpoint===STAGING_ACCOUNT_DELETION_ENDPOINT;
async function makeReceipt(ownerId:string):Promise<AccountDeletionReceipt>{
 try{
  const crypto=await import('expo-crypto');
  const secret=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
  const digest=await crypto.digestStringAsync(crypto.CryptoDigestAlgorithm.SHA256,secret);
  return {ownerId,secret,digest};
 }catch{}
 const bytes=new Uint8Array(32);globalThis.crypto.getRandomValues(bytes);
 const secret=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(secret));
 const hashed=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
 return {ownerId,secret,digest:hashed};
}
async function makeReceiptlessCapability(ownerId:string):Promise<ReceiptlessDeletionCapability>{
 const receipt=await makeReceipt(ownerId);
 return {ownerId,secret:receipt.secret,digest:receipt.digest};
}
export async function ensureReceiptlessDeletionCapability(auth:SupabaseClient['auth'],endpoint:DeletionDestination,owner:string,capabilityStore:ReceiptlessDeletionCapabilityStore,fetcher:typeof fetch=fetch,options:{signal?:AbortSignal;deadlineMs?:number}={}):Promise<{registered:boolean;uncertain?:boolean;ownerId?:string}>{
 if(!isReviewedDeletionEndpoint(endpoint))return {registered:false,uncertain:true,ownerId:owner};
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(15000,options.deadlineMs??15000)));
 const stop=()=>controller.abort();options.signal?.addEventListener('abort',stop,{once:true});if(options.signal?.aborted)stop();
 try{
  const before=await bounded(auth.getSession(),controller.signal);const session=before.data.session;
  if(before.error || !session || session.user.id!==owner || session.user.is_anonymous)return {registered:false,uncertain:true,ownerId:owner};
  const verified=await bounded(auth.getUser(session.access_token),controller.signal);const current=await bounded(auth.getSession(),controller.signal);
  if(verified.error || verified.data.user?.id!==owner || current.error || current.data.session?.access_token!==session.access_token)return {registered:false,uncertain:true,ownerId:owner};
  let capability=await bounded(capabilityStore.load(owner),controller.signal);
  if(!capability || capability.ownerId!==owner){capability=await bounded(makeReceiptlessCapability(owner),controller.signal);await bounded(capabilityStore.save(capability),controller.signal);}
  if(capability.registered)return {registered:true,ownerId:owner};
  const response=await bounded(fetcher(deletionUrl(endpoint),{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({deviceStatusDigest:capability.digest}),signal:controller.signal,redirect:'error'}),controller.signal);
  if(!response.ok)return {registered:false,uncertain:true,ownerId:owner};
  const body=await bounded(response.json(),controller.signal);
  if(body.code!=='ok')return {registered:false,uncertain:true,ownerId:owner};
  await bounded(capabilityStore.save({...capability,registered:true}),controller.signal);
  return {registered:true,ownerId:owner};
 }catch{return {registered:false,uncertain:true,ownerId:owner};}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);}
}
export async function checkReceiptlessDeletionNotice(endpoint:DeletionDestination,owner:string,capabilityStore:ReceiptlessDeletionCapabilityStore,fetcher:typeof fetch=fetch,options:{signal?:AbortSignal;deadlineMs?:number}={}):Promise<ReceiptlessDeletionNotice>{
 if(!isReviewedDeletionEndpoint(endpoint))return {deleted:false,uncertain:true,ownerId:owner};
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(15000,options.deadlineMs??15000)));
 const stop=()=>controller.abort();options.signal?.addEventListener('abort',stop,{once:true});if(options.signal?.aborted)stop();
 try{
  const capability=await bounded(capabilityStore.load(owner),controller.signal);
  if(!capability || capability.ownerId!==owner)return {deleted:false,uncertain:true,ownerId:owner};
  const response=await bounded(fetcher(deletionUrl(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceStatusSecret:capability.secret}),signal:controller.signal,redirect:'error'}),controller.signal);
  if(!response.ok)return {deleted:false,uncertain:true,ownerId:owner};
  const body=await bounded(response.json(),controller.signal);
  if(body.code!=='ok' || body.ownerId!==owner || !['active','deleting','deleted'].includes(body.status))return {deleted:false,uncertain:true,ownerId:owner};
  if(body.status==='deleted')return {deleted:true,ownerId:owner,status:body.status};
  if(body.status==='deleting')return {deleted:false,ownerId:owner,status:body.status};
  return {deleted:false,ownerId:owner,status:'active'};
 }catch{return {deleted:false,uncertain:true,ownerId:owner};}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);}
}
export async function requestAccountDeletion(auth:SupabaseClient['auth'],endpoint:DeletionDestination,owner:string,password:string,billing:AccountDeletionBilling,receiptStore:AccountDeletionReceiptStore,fetcher:typeof fetch=fetch,options:{signal?:AbortSignal;deadlineMs?:number}={}):Promise<AccountDeletionResult>{
 if(!isReviewedDeletionEndpoint(endpoint))return {success:false,message:'Account deletion is unavailable. No request was sent.'};
 void billing;
 if(submissionOwners.has(owner))return {success:false,message:'Account deletion is already being requested. Wait for the current request to finish before trying again.'};
 submissionOwners.add(owner);
 let dispatched=false;
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(70000,options.deadlineMs??70000)));
 const stop=()=>controller.abort();options.signal?.addEventListener('abort',stop,{once:true});if(options.signal?.aborted)stop();
 try{
  const before=await bounded(auth.getSession(),controller.signal);const session=before.data.session;
  if(before.error || !session || session.user.id!==owner || session.user.is_anonymous)throw new Error();
  const verified=await bounded(auth.getUser(session.access_token),controller.signal);const current=await bounded(auth.getSession(),controller.signal);
  if(verified.error || verified.data.user?.id!==owner || current.error || current.data.session?.access_token!==session.access_token)throw new Error();
  let receipt=await bounded(receiptStore.load(owner),controller.signal);
  if(!receipt || receipt.ownerId!==owner){receipt=await bounded(makeReceipt(owner),controller.signal);await bounded(receiptStore.save(receipt),controller.signal);}
  if(controller.signal.aborted)throw new Error('Request stopped before dispatch');
  const latest=await bounded(auth.getSession(),controller.signal);if(latest.data.session?.user.id!==owner)throw new Error('Account changed');
  dispatched=true;
  const response=await bounded(fetcher(deletionUrl(endpoint),{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({password,receiptDigest:receipt.digest}),signal:controller.signal,redirect:'error'}),controller.signal);
  if(response.status===403)return {success:false,status:'rejected',ownerId:owner,message:'Your password was not accepted. Re-enter your BYSI password or use Forgot password.'};
  if(response.status===401)return {success:false,status:'rejected',ownerId:owner,message:'Your login has expired. Sign in again before requesting deletion.'};
  if(!response.ok)throw new Error();
  const body=await bounded(response.json(),controller.signal);
  if(typeof body.requestId!=='string' || body.requestId.length<1 || body.requestId.length>128 || (body.status!=='accepted' && body.status!=='data_erased' && body.status!=='provider_retry' && body.status!=='complete'))throw new Error();
  await bounded(receiptStore.save({...receipt,requestId:body.requestId,status:body.status}),controller.signal);
  return {success:true,status:body.status,ownerId:owner,message:body.status==='complete'?'Your account has been deleted.':'Deletion requested. You can close the app and check status from this device.'};
 }catch{return {success:false,status:dispatched?'uncertain':'unavailable',ownerId:owner,message:'Account deletion was not confirmed. Your password may need re-entry, or the service may be unavailable. If the request timed out after submission, the outcome is uncertain; use the saved deletion receipt status before retrying.'};}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);submissionOwners.delete(owner);}
}
export async function checkAccountDeletionStatus(endpoint:DeletionDestination,owner:string|null,receiptStore:AccountDeletionReceiptStore,fetcher:typeof fetch=fetch,options:{signal?:AbortSignal;deadlineMs?:number}={}):Promise<AccountDeletionResult>{
 if(!isReviewedDeletionEndpoint(endpoint))return {success:false,message:'Account deletion status is unavailable in this build.'};
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),Math.max(1,Math.min(15000,options.deadlineMs??15000)));
 const stop=()=>controller.abort();options.signal?.addEventListener('abort',stop,{once:true});if(options.signal?.aborted)stop();
 try{
  const receipt=owner?await bounded(receiptStore.load(owner),controller.signal):await bounded(Promise.resolve(receiptStore.loadLatest?.()),controller.signal);
  if(!receipt || (owner && receipt.ownerId!==owner))return {success:false,message:'No deletion receipt was found on this device.'};
  const response=await bounded(fetcher(deletionUrl(endpoint),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({receiptSecret:receipt.secret}),signal:controller.signal,redirect:'error'}),controller.signal);
  if(!response.ok)return {success:false,message:'Deletion status could not be checked. Try again later.'};
  const body=await bounded(response.json(),controller.signal);
  if(body.code!=='ok' || typeof body.requestId!=='string' || body.requestId.length<1 || body.requestId.length>128 || !['accepted','processing','data_erased','provider_retry','complete','failed'].includes(body.status))throw new Error();
  await bounded(receiptStore.save({...receipt,requestId:body.requestId,status:body.status}),controller.signal);
  if(body.status==='complete')return {success:true,status:'complete',ownerId:receipt.ownerId,message:'Your account has been deleted.'};
  if(body.status==='failed')return {success:false,status:'failed',ownerId:receipt.ownerId,message:'Deletion needs support review. Do not submit another request from this device.'};
  return {success:true,status:body.status,ownerId:receipt.ownerId,message:'Deletion is still in progress.'};
 }catch{return {success:false,message:'Deletion status could not be checked. Try again later.'};}
 finally{clearTimeout(timer);options.signal?.removeEventListener('abort',stop);}
}
