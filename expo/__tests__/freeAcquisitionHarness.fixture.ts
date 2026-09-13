// OFFLINE ONLY: actual hosted handler/provenance, synthetic Auth/store/provider.
// No default fetch is used; no server credentials or provider calls.
import {createFreeAcquisitionTransport,FREE_STAGING_ENDPOINT} from '../lib/freeAcquisition';
// @ts-ignore sibling server source deliberately exercised without copying its contracts
import {createSignupHandler} from '../../../Projects/bysi-web-claude-parity/server/web-signup/handler.mjs';
// @ts-ignore sibling server source
import {prepareHostedCapture,attachHostedCapture} from '../../../Projects/bysi-web-claude-parity/server/web-signup/hosted-provenance.mjs';
// @ts-ignore actual producer, provider transport is explicitly synthetic in fixture
import {POST} from '../../../Projects/bysi-web-claude-parity/app/api/generate/route.js';
// @ts-ignore synthetic provider fixture
import {fixture} from '../../../Projects/bysi-web-claude-parity/tests/fixtures/generation-output.mjs';
export function harness(){
 const rows=new Map<string,any>(),locks=new Set<string>(),secure=new Map<string,string>();
 const requests:Request[]=[],outputs:any[]=[];let listener:Function=()=>{};
 let owner:string|null='11111111-1111-4111-8111-111111111111';
 const control={providerFailure:false,globalQuota:true,actualProducer:false};
 const storage={async load(id:string){return structuredClone(rows.get(id)||null)},async save(id:string,s:any){rows.set(id,structuredClone(s))},async lock(id:string){if(locks.has(id))throw Error();locks.add(id)},async unlock(id:string){locks.delete(id)},async rate(){return true}};
 const config={enabled:true,hosted:true,origin:'https://bysi-signup-staging.vercel.app',storage,async prepareGeneration(body:any,state:any){
  if(!control.globalQuota)throw Error('Synthetic global quota denied');
  const cap=prepareHostedCapture(body,state,'a'.repeat(64));
  return async()=>{
   if(control.actualProducer){
    const req=new Request(config.origin+'/api/generate',{method:'POST',headers:{origin:config.origin,'content-type':'application/json'},body:JSON.stringify(body)});
    attachHostedCapture(req,cap);const response=await POST(req);outputs.push(await response.clone().json());return response;
   }
   if(control.providerFailure)throw Error('Synthetic provider unavailable');
   const output=body.type==='rehearsal_turn'?{mode:'turn',text:body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'That still leaves the other work on my plate. Which priority should wait?'}:{...fixture(),outputVersion:'bysi-free-rehearsal-result-v1-2026-08-12'};
   outputs.push(output);
   await cap.finish(output,{source:'server_generation',generation_id:'synthetic-generation',provider_request_id:'synthetic-provider',model:'synthetic-model',producer_version:'synthetic-fixture',generated_at:'2026-09-08T00:00:00Z'});
   return Response.json(output);
  };
 }};
 const auth={async getSession(){return {data:{session:owner?{access_token:'synthetic.jwt.only',user:{id:owner}}:null},error:null}},async getUser(){return {data:{user:owner?{id:owner}:null},error:null}},onAuthStateChange(cb:Function){listener=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const options={developmentBuild:true,staging:true,authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co',endpoint:FREE_STAGING_ENDPOINT,auth,storage:{async getItem(k:string){return secure.get(k)||null},async setItem(k:string,v:string){secure.set(k,v)}},fetch:async(url:any,init:any)=>{const req=new Request(url,init);requests.push(req.clone());return createSignupHandler(config)(req)}};
 return {options,requests,outputs,rows,secure,control,auth,create:()=>createFreeAcquisitionTransport(options)!,change(id:string|null){owner=id;listener('SIGNED_OUT',id?{user:{id}}:null)}};
}
export const contract={entry_route:'real_conversation',context:'Work',scenario:'Scope keeps changing.',success_target:'Make a request',pressure_condition:'They disagree'};
export const pushback={type:'rehearsal_turn',turn:'pushback',contract,transcript:{user_turn_1:'Can we choose one task?'}};
export async function completeTransport(h:ReturnType<typeof harness>,client=h.create()){
 const one=await (await client.request(pushback)).json();
 const transcript={...pushback.transcript,counterpart_pushback:one.text,user_turn_2:'Which one comes first?'};
 const two=await (await client.request({...pushback,turn:'close',transcript})).json();
 return client.request({type:'free_rehearsal_result',contract,transcript:{...transcript,counterpart_close:two.text},rewrite_requirement:{output:'existing native hint'}});
}
