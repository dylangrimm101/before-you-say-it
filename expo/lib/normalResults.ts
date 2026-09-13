import {createNativeBilling} from './nativeBilling';
import {restorePrivateWebResult} from './privateWebResult';
export type OriginalBenefit = {mode:'repair_plan'|'safety';[key:string]:unknown};
export type BenefitItem = {id:string;createdAt:string;source:'original_purchase'|'reviewed_original';status:'saved'|'delivery_pending'|'recovery_required'};
export type BenefitRecovery = {status:'not_requested'|'review_needed'|'restored';requestId?:string};
export type BenefitListing = {ok:true;items:BenefitItem[];recovery:BenefitRecovery;hasMore:boolean};
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const validRecovery=(v:any)=>v&&['not_requested','review_needed','restored'].includes(v.status)&&(v.requestId===undefined||UUID.test(v.requestId));
/** Content transport reuses the normal verified bearer/deadline/identity rules,
 * but has its OWN instance: no identify, paid or subscription query is needed. */
export function createNormalResults(config:Parameters<typeof createNativeBilling>[0]){
 const transport=createNativeBilling(config);if(!transport)return null;
 let blocked=false,revision=0;
 const metadata=(v:any)=>{
  if(!v||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(v.sessionId)||v.source!=='normal-native-free'||!Number.isFinite(Date.parse(v.capturedAt))||!Number.isFinite(Date.parse(v.expiresAt))||Date.parse(v.expiresAt)<=Date.now())throw Error('Saved result unavailable');
  return {sessionId:v.sessionId as string,source:'normal-native-free' as const,capturedAt:v.capturedAt as string,expiresAt:v.expiresAt as string};
 };
 const benefitRequest=async(operation:'follow-through/discover'|'follow-through/restore'|'follow-through/recovery',body:Record<string,unknown>,signal?:AbortSignal)=>{
  const before=revision;const current=()=>{if(blocked||before!==revision||signal?.aborted)throw Error('Account changed');};current();
  const response=await transport.request(operation,body,15000,signal);current();
  const value=await response.json();current();
  if(operation==='follow-through/recovery'&&response.status===409&&value?.error==='recovery_conflict')throw Error('Recovery conflict');
  if(!response.ok||value?.ok!==true)throw Error('Original benefit unavailable');
  return value;
 }
 return {
 async discoverBenefit(signal?:AbortSignal):Promise<BenefitListing>{
  const v=await benefitRequest('follow-through/discover',{},signal);
  if(!Array.isArray(v.items)||v.items.length>100||typeof v.hasMore!=='boolean'||!validRecovery(v.recovery)||v.items.some((i:any)=>!UUID.test(i?.id)||!Number.isFinite(Date.parse(i.createdAt))||!['original_purchase','reviewed_original'].includes(i.source)||!['saved','delivery_pending','recovery_required'].includes(i.status)))throw Error('Original benefit unavailable');
  return v;
 },
 async recoverBenefit(action:'request'|'status',signal?:AbortSignal,receiptReference?:string):Promise<BenefitRecovery>{
  if(receiptReference!==undefined&&(action!=='request'||!/^cs_[A-Za-z0-9_]{1,196}$/.test(receiptReference)))throw Error('Invalid receipt reference');
  const v=await benefitRequest('follow-through/recovery',{action,...(receiptReference===undefined?{}:{receiptReference})},signal);
  if(!validRecovery(v.recovery)||JSON.stringify(v.proofRequired)!==JSON.stringify(['independently_verified_purchase_ownership','original_content_provenance']))throw Error('Original recovery unavailable');
  return v.recovery;
 },
 async restoreBenefit(id:string,signal?:AbortSignal):Promise<OriginalBenefit>{
  if(!UUID.test(id))throw Error('Original benefit unavailable');
  const v=await benefitRequest('follow-through/restore',{id},signal);
  if(v.id!==id||!v.result||typeof v.result!=='object'||Array.isArray(v.result)||!['repair_plan','safety'].includes(v.result.mode))throw Error('Original benefit unavailable');
  return v.result;
 },
 suspend(){blocked=true;revision++;transport.invalidate();},resume(){blocked=false;},invalidate(){revision++;transport.invalidate();},dispose:transport.dispose,async latest(signal?:AbortSignal){
  const before=revision;const current=()=>{if(blocked||before!==revision||signal?.aborted)throw Error('Account changed');};current();
  const r=await transport.request('results/discover',{limit:1,cursor:null},15000,signal);current();
  const listing=await r.json();current();
  if(!r.ok||!Array.isArray(listing.items)||listing.items.length>1||listing.nextCursor!==null||Object.keys(listing).some(k=>!['items','nextCursor'].includes(k)))throw Error('Saved result unavailable');
  if(!listing.items.length)return null;
  const item=metadata(listing.items[0]);
  const response=await transport.request('results/restore',{sessionId:item.sessionId},15000,signal);current();
  const restored=await response.json();current();
  if(!response.ok||Object.keys(restored).some(k=>!['sessionId','source','capturedAt','expiresAt','privateResult'].includes(k)))throw Error('Saved result unavailable');
  const restoredMetadata=metadata(restored);
  if(JSON.stringify(restoredMetadata)!==JSON.stringify(item))throw Error('Saved result changed');
  const privateResult=restorePrivateWebResult(restored.privateResult);
  if(privateResult.provenance.generated_at!==item.capturedAt)throw Error('Saved result changed');
  return {...item,privateResult};
 }};
}
