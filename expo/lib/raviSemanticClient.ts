import {canonicalCounterpartLine} from './counterpartLineCanonicalization';
export const RAVI_SEMANTIC_VERSION='ravi-m1-l2-semantic-v2';
export const RAVI_SCENE_VERSION='ravi-thursday-scene-v1';
type Turn='pushback'|'close';
export type RaviSemanticInput={turn:Turn;openingTranscript:string;firstPressure:string;firstResponse:string;excluded:readonly string[]};
type Dependencies={request:(body:Record<string,unknown>)=>Promise<Response>;digest:(text:string)=>Promise<string>};
const record=(value:unknown):value is Record<string,any>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
const exact=(v:unknown,keys:string[]):v is Record<string,any>=>record(v)&&Object.keys(v).length===keys.length&&keys.every(k=>Object.hasOwn(v,k));
const provenance=(v:unknown)=>exact(v,['provider_request_id','model','stop_reason','generated_at'])&&['provider_request_id','model'].every(k=>typeof v[k]==='string'&&/^[A-Za-z0-9_.:-]{1,160}$/.test(v[k]))&&v.stop_reason==='end_turn'&&typeof v.generated_at==='string'&&Number.isFinite(Date.parse(v.generated_at));

/** Presentation-only hard checks. NOT an English fact proof or access authority.
 * Saved offline history may use structural checks, but cannot skip a fresh server
 * generation, authorize payment/access, or claim cryptographically verified facts.
 */
export function raviSemanticDisplaySafe(text:unknown):text is string{
 if(typeof text!=='string'||text!==text.trim()||text.length<3||text.length>320||/[\p{Cc}\p{Cf}]/u.test(text))return false;
 const words=text.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)||[];
 return words.length>=2&&words.length<=42&&!/\b(?:learner|lesson|practice|rehearsal|coach|coaching|rubric|transcript|named move|try saying|you should say|good job|well done|text(?:ed|ing)?|message(?:d|s|ing)?|dm(?:s|ed|ing)?|chat(?:ted|ting)?|phone call|call(?:ed|ing)?|facetime|zoom|email(?:ed|ing)?|video call)\b/i.test(text)&&! /^(?:i hear you|you(?:'|’)re right|that(?:'|’)s fair|okay|i get that)\b/i.test(text);
}

/** Dependency injection is a transport test seam, not a client-supplied verifier.
 * Production MUST bind request to requestPaidBysiGeneration (fixed HTTPS origin,
 * current confirmed auth, server entitlement/rate limits), never generic fetch.
 * Hashes bind metadata to bytes; authenticity comes from that fresh transport,
 * not from hashes, JSON flags, local storage or a saved history receipt.
 */
export async function generateRaviSemanticReply(input:RaviSemanticInput):Promise<{reply:string}>{
 // No caller may select another origin or supply an attestation/paid status.
 const [{requestPaidBysiGeneration},Crypto]=await Promise.all([import('./paidGenerationRuntime'),import('expo-crypto')]);
 return createRaviSemanticClient({request:requestPaidBysiGeneration,digest:text=>Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,text)}).generate(input);
}

export function createRaviSemanticClient({request,digest}:Dependencies){
 return {async generate(input:RaviSemanticInput):Promise<{reply:string}>{
  if(!['pushback','close'].includes(input.turn)||!['openingTranscript','firstPressure','firstResponse'].every(k=>typeof input[k as keyof RaviSemanticInput]==='string'))throw Error('Invalid Ravi exchange');
  const payload={type:'rehearsal_turn',turn:input.turn,lesson_constraints:{lesson_id:'m1-l2',counterpart_id:'ravi',fact_contract_version:RAVI_SEMANTIC_VERSION,scene_version:RAVI_SCENE_VERSION},transcript:{user_turn_1:input.openingTranscript,counterpart_pushback:input.firstPressure,user_turn_2:input.firstResponse,counterpart_close:''},avoid_repeating:[...input.excluded]};
  // Exactly one native dispatch. The server owns the single overall repair.
  const response=await request(payload);
  if(response.status!==200||response.headers.get('cache-control')!=='no-store')throw Error('Ravi server unavailable');
  const raw=await response.text();if(raw.length>8192)throw Error('Ravi response too large');
  const value:unknown=JSON.parse(raw);
  if(!exact(value,['mode','turn','role','text'])||value.mode!=='turn'||value.turn!==input.turn||value.role!=='adam'||!raviSemanticDisplaySafe(value.text))throw Error('Invalid Ravi response');
  if([...input.excluded,input.firstPressure,'One anchor. The rest stays in the folder.'].some(s=>s&&canonicalCounterpartLine(s)===canonicalCounterpartLine(value.text)))throw Error('Repeated Ravi response');
  const header=response.headers.get('x-bysi-ravi-grounding'),generated=response.headers.get('x-bysi-generation');
  if(!header||header.length>4096||!generated||generated.length>8192)throw Error('Missing Ravi server evidence');
  const receipt:unknown=JSON.parse(header),generation:unknown=JSON.parse(generated);
  if(!exact(receipt,['version','scene_version','assessment','draft_sha256','verifier'])||receipt.version!==RAVI_SEMANTIC_VERSION||receipt.scene_version!==RAVI_SCENE_VERSION||receipt.assessment!=='model_assessed'||!provenance(receipt.verifier)||receipt.draft_sha256!==await digest(value.text))throw Error('Invalid Ravi server evidence');
  if(!exact(generation,['version','provider','attempts','response_sha256'])||generation.version!==1||generation.provider!=='anthropic'||!Array.isArray(generation.attempts)||generation.attempts.length<1||generation.attempts.length>2||!generation.attempts.every(provenance)||generation.response_sha256!==await digest(JSON.stringify(value)))throw Error('Invalid Ravi generation evidence');
  return {reply:value.text};
 }};
}
