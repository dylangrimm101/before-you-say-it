import {test,expect} from 'bun:test';
import {createHash} from 'node:crypto';
// Missing implementation is an assertion failure, not an import crash (TDD RED).
const modulePath='../lib/raviSemanticClient';
const api=await import(modulePath).catch(()=>({} as any));
const version='ravi-m1-l2-semantic-v2',sceneVersion='ravi-thursday-scene-v1';
const text="Honestly, that one's on the client, not us—revisions didn't land till three. I don't think one late file means the whole approval process is broken.";
const digest=async(t:string)=>createHash('sha256').update(t).digest('hex');
const input={turn:'pushback',openingTranscript:'Yesterday’s late file is why approval needs a clear owner.',firstPressure:'',firstResponse:'',excluded:[]} as const;
async function response(overrides:Record<string,unknown>={}){
 const result={mode:'turn',turn:'pushback',role:'adam',text};
 const provenance={provider_request_id:'msg_offline',model:'offline',stop_reason:'end_turn',generated_at:'2026-09-07T12:00:00.000Z'};
 return Response.json(result,{headers:{'cache-control':'no-store','x-bysi-generation':JSON.stringify({version:1,provider:'anthropic',attempts:[provenance],response_sha256:await digest(JSON.stringify(result))}),'x-bysi-ravi-grounding':JSON.stringify({version,scene_version:sceneVersion,assessment:'model_assessed',draft_sha256:await digest(text),verifier:provenance,...overrides})}});
}
test('v2 native consumer requests authenticated transport once and accepts exact server evidence, without English grammar',async()=>{
 expect(api.createRaviSemanticClient).toBeFunction();
 const calls:any[]=[];
 const client=api.createRaviSemanticClient({request:async(b:any)=>{calls.push(b);return response();},digest});
 expect(await client.generate(input)).toEqual({reply:text});
 expect(calls).toHaveLength(1);
 expect(calls[0].lesson_constraints).toEqual({lesson_id:'m1-l2',counterpart_id:'ravi',fact_contract_version:version,scene_version:sceneVersion});
 expect(JSON.stringify(calls[0])).not.toContain('verified');
});
test('native rejects missing/fake/stale server contract and never retries',async()=>{
 for(const mutate of [async()=>Response.json({mode:'turn',turn:'pushback',role:'adam',text,verified:true}),async()=>response({assessment:'verified'}),async()=>response({draft_sha256:'0'.repeat(64)}),async()=>response({version:'ravi-m1-l2-natural-facts-v1'}),async()=>response({scene_version:'Wednesday'}),async()=>response({verifier:{verified:true}}),async()=>Response.json({error:'unavailable'},{status:502})]){
  let count=0;const client=api.createRaviSemanticClient({request:async()=>{count++;return mutate();},digest});
  await expect(client.generate(input)).rejects.toThrow();expect(count).toBe(1);
 }
});
test('presentation-only structural checks do not pretend to prove arbitrary English',()=>{
 expect(api.raviSemanticDisplaySafe(text)).toBe(true);
 expect(api.raviSemanticDisplaySafe('The client sent revisions at four.')).toBe(true);
 expect(api.raviSemanticDisplaySafe('Good job learner.')).toBe(false);
});
test('saved receipt cannot substitute for fresh authenticated request',async()=>{
 const saved=await response();let count=0;
 const client=api.createRaviSemanticClient({request:async()=>{count++;throw Error('Entitlement revoked');},digest});
 await expect(client.generate({...input,saved,verified:true})).rejects.toThrow('Entitlement revoked');expect(count).toBe(1);
});
test('v2 production entrypoint exists separately from injected transport fixture',()=>{
 expect(api.generateRaviSemanticReply).toBeFunction();
});
export {input,response,text,digest};
