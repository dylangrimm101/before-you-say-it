// Actual native v2 client -> actual paid transport -> actual local paid handler.
// ALL provider/auth/RPC responses are offline fixtures, never live evidence.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mock} from 'bun:test';
import {approvedRehearsalConfig,approvedRehearsalAuthoredCorpus} from '../lib/approvedRehearsals';
import {createPaidGenerationTransport,PAID_STAGING_ENDPOINT} from '../lib/paidGeneration';
const web='/Users/donaldgrimm/Projects/bysi-web-claude-parity';
const {POST}=await import(web+'/app/api/practice/generate/route.js');
const origin='https://bysi-signup-staging.vercel.app';
Object.assign(process.env,{BYSI_HOSTED_SIGNUP_STAGING:'pqqxaklcburdxjfeolmd',BYSI_HOSTED_ORIGIN:origin,BYSI_STAGING_PUBLISHABLE_KEY:'sb_publishable_fixture',BYSI_STAGING_SERVER_KEY:'synthetic',ANTHROPIC_API_KEY:'synthetic'});
const digest=(t:string)=>createHash('sha256').update(t).digest('hex');
const text="Honestly, that one's on the client, not us—revisions didn't land till three. I don't think one late file means the whole approval process is broken.";
const close="Tuesday's unowned sign-off explains that file. I'm not convinced it establishes a pattern in the approval process.";
const user={id:'11111111-1111-4111-8111-111111111111',role:'authenticated',is_anonymous:false,email_confirmed_at:'2026-09-07'};
let entitled=true,dispatches=0,providerCalls=0,judgeCalls=0;
const requests:any[]=[];
const original=global.fetch;
global.fetch=async(url,init)=>{
 if(String(url).endsWith('/auth/v1/user'))return Response.json(user);
 if(String(url).includes('/rpc/'))return Response.json(entitled);
 assert.equal(String(url),'https://api.anthropic.com/v1/messages','No real network path is allowed');
 const p=JSON.parse(String(init?.body)),payload=JSON.parse(p.messages[0].content);requests.push(p);providerCalls++;
 const judge=p.system[0].text.includes('RAVI_SEMANTIC_JUDGE_V2');
 const draft=payload.requested_turn==='close'?close:text;
 if(judge)judgeCalls++;
 const output=judge?{evidence_version:'ravi-immutable-refs-v1',segments:[{id:'draft_0',labels:['attributed_stance','objective_fact','approval_skepticism'],verdict:'supported',fact_ids:['approval_skepticism']}],checks:['attribution','chronology','actors_and_quantities','ownership','causes','resistance','instruction_boundary'].map(id=>({id,verdict:'pass',evidence:['draft_0']}))}:{mode:'turn',turn:payload.requested_turn,role:'adam',text:draft};
 return Response.json({id:'msg_fixture_'+providerCalls,model:'offline',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(output)}]});
};
const transport=createPaidGenerationTransport({developmentBuild:true,staging:true,authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co',endpoint:PAID_STAGING_ENDPOINT,auth:{getSession:async()=>({data:{session:{access_token:'a.b.c',user}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},fetch:async(url,init)=>{dispatches++;return POST(new Request(String(url),init));}})!;
try{
 mock.module('../lib/paidGenerationRuntime',()=>({requestPaidBysiGeneration:(b:Record<string,unknown>)=>transport.request(b)}));
 mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async(_:string,t:string)=>digest(t)}));
 const {generateApprovedRehearsalDynamicReply}=await import('../lib/ai');
 const c=approvedRehearsalConfig('m1-l2')!;
 const client={generate:(input:any)=>generateApprovedRehearsalDynamicReply({scenario:c.scenario,lessonId:c.lessonId,counterpartId:c.counterpartId,kind:input.turn==='pushback'?'pushback_one':'pushback_two',namedMove:c.namedMove,coachedBehaviorId:c.coachedBehaviorId,retryDirection:c.retryDirection,approvedTranscript:input.firstResponse||input.openingTranscript,openingTranscript:input.openingTranscript,firstPressure:input.firstPressure,firstResponse:input.firstResponse,authoredCorpus:approvedRehearsalAuthoredCorpus(c),runId:'offline-builder'})};
 const input={turn:'pushback' as const,openingTranscript:'Yesterday’s late file is why approval needs a clear owner.',firstPressure:'',firstResponse:'',excluded:[]};
 const {createScenarioPracticeRun,initializeApprovedRehearsalRun,attachApprovedRehearsalPushbackOne,attachApprovedRehearsalPushbackTwo,advanceApprovedRehearsalFirstResponse,normalizeScenarioPracticeRun}=await import('../lib/scenarioPractice');
 const id='offline-builder';
 let w=initializeApprovedRehearsalRun(createScenarioPracticeRun(c.scenario,'steady','defensive',id,1),1);
 w={...w,run:{...w.run,convertedModuleId:c.moduleId,practiceId:c.practiceId,contentVersion:c.contentVersion,counterpartIdentity:c.counterpartId,scenarioContext:{...w.run.scenarioContext!,counterpartId:c.counterpartId},attempt:{id:`${id}-opener`,kind:'opener',transcript:input.openingTranscript,representation:'confirmed_transcript',confirmedAt:2}}};
 const first=await client.generate(input);assert.deepEqual(first,{reply:text});
 const turn=(n:number,reply:string)=>({id:`${id}-counterpart-turn-${n}`,text:reply,source:'provider' as const,reactionId:`m1-l2-dynamic-pressure-${n}`,semanticVoiceKey:'contextual_counterpart' as const,resolvedAudioId:`${w.run.curriculumVersion}-${id}-counterpart-turn-${n}`});
 w=attachApprovedRehearsalPushbackOne(w,turn(1,first.reply),3);
 w=normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(w)))!;assert.ok(w);assert.equal(w.run.counterpartTurn?.text,text);
 const firstResponse='Tuesday’s file had no sign-off owner. That is the example I mean.';
 w={...w,run:{...w.run,responseAttempt:{id:`${id}-response`,kind:'response',transcript:firstResponse,representation:'confirmed_transcript',confirmedAt:4}}};
 w=advanceApprovedRehearsalFirstResponse(w,4);
 const second=await client.generate({...input,turn:'close',firstPressure:w.run.counterpartTurn!.text,firstResponse});assert.deepEqual(second,{reply:close});
 w=attachApprovedRehearsalPushbackTwo(w,turn(2,second.reply),5);
 const restored=normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(w)));assert.ok(restored);assert.equal(restored.run.approvedRehearsal?.pushbackTwo?.text,close);assert.equal(restored.run.contentVersion,c.contentVersion);
 assert.equal(providerCalls,4);assert.equal(judgeCalls,2);assert.equal(dispatches,2);
 const saved={reply:text,verified:true};entitled=false;
 await assert.rejects(client.generate({...input,...saved}));
 assert.equal(providerCalls,4);assert.equal(dispatches,3,'No native repair after entitlement failure');
 for(const p of requests)assert.ok(!JSON.stringify(p).includes('a.b.c'),'Bearer cannot reach provider');
 console.log(JSON.stringify({passed:true,pushback:true,close:true,providerFixtureCalls:providerCalls,judgeFixtureCalls:judgeCalls,nativeDispatches:dispatches,revocationDenied:true}));
}finally{transport.dispose();global.fetch=original;}
