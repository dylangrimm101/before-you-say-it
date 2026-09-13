// Offline composition. Auth, RPC, provider and storage are fixtures; no network permitted.
import assert from 'node:assert/strict';
import {mock} from 'bun:test';
import retained from './fixtures/m1l1-retained.json';
import {M1_L1_CONVERSION as c} from '../lib/convertedLesson';
import {createPaidGenerationTransport,PAID_STAGING_ENDPOINT} from '../lib/paidGeneration';
import {createScenarioPracticeRun,initializeM1L1Run,preserveScenarioAttempt,attachM1L1PushbackOne,normalizeScenarioPracticeRun} from '../lib/scenarioPractice';
import {m1L1ProviderTurn} from '../lib/m1L1DynamicResponse';
const serverRoot=process.env.OFFLINE_M1L1_SERVER_ROOT || '/Users/donaldgrimm/Projects/bysi-web-claude-parity';
assert.ok(serverRoot.startsWith('/Users/donaldgrimm/'),'local source only');
const {POST}=await import(serverRoot+'/app/api/practice/generate/route.js');
process.env.EXPO_PUBLIC_BYSI_BUILD_MODE='staging-account';
const origin='https://bysi-signup-staging.vercel.app';
Object.assign(process.env,{BYSI_HOSTED_SIGNUP_STAGING:'pqqxaklcburdxjfeolmd',BYSI_HOSTED_ORIGIN:origin,BYSI_STAGING_PUBLISHABLE_KEY:'sb_publishable_fixture',BYSI_STAGING_SERVER_KEY:'synthetic',ANTHROPIC_API_KEY:'synthetic'});
const user={id:'11111111-1111-4111-8111-111111111111',role:'authenticated',is_anonymous:false,email_confirmed_at:'2026-01-01'};
let outputs:any[]=[];const provider:any[]=[],bodies:any[]=[],statuses:number[]=[];
const original=global.fetch;
global.fetch=async(url,init)=>{
 if(String(url).endsWith('/auth/v1/user'))return Response.json(user);
 if(String(url).includes('/rpc/'))return Response.json(true);
 assert.equal(String(url),'https://api.anthropic.com/v1/messages','no network');
 provider.push(JSON.parse(String(init?.body)));
 return Response.json({id:'msg_offline_'+provider.length,model:'offline-fixture',stop_reason:'end_turn',content:[{type:'text',text:JSON.stringify(outputs.shift()??retained.response)}]});
};
const transport=createPaidGenerationTransport({developmentBuild:true,staging:true,authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co',endpoint:PAID_STAGING_ENDPOINT,auth:{getSession:async()=>({data:{session:{access_token:'a.b.c',user}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},fetch:async(url,init)=>{bodies.push(JSON.parse(String(init?.body)));const r=await POST(new Request(String(url),init));statuses.push(r.status);return r;}})!;
try {
 mock.module('../lib/paidGenerationRuntime',()=>({requestPaidBysiGeneration:(b:Record<string,unknown>)=>transport.request(b)}));
 const {generateM1L1DynamicReply}=await import('../lib/ai');
 const learner=retained.request.transcript.user_turn_1;
 const input={scenario:c.scenario,kind:'pushback_one' as const,approvedTranscript:learner,openingTranscript:learner,authoredCorpus:[...c.pushbackOneBank,c.authoredEvidenceTrap],runId:'lesson-m1-l1-mtt4bc49'};
 const positive="You want an owner, but how does naming one change the handoff?"; // Human-authored positive fixture, not a provider success claim.
 outputs=[retained.response,{...retained.response,text:positive}];
 const answer=await generateM1L1DynamicReply(input);
 assert.equal(provider.length,2,'retained bad draft must enter the existing single server repair');
 assert.deepEqual(bodies[0],retained.request,'exact retained native request');
 assert.deepEqual(JSON.parse(provider[1].messages[1].content),retained.response,'repair sees unchanged rejected draft');
 assert.equal(answer.reply,positive);
 let value=initializeM1L1Run(createScenarioPracticeRun(c.scenario,'steady','defensive',input.runId,1),1);
 value={...value,run:{...value.run,convertedModuleId:c.moduleId,practiceId:c.practiceId,contentVersion:c.contentVersion,counterpartIdentity:'adam',scenarioContext:{...value.run.scenarioContext!,counterpartId:'adam',counterpartName:'Adam',counterpartRole:'your colleague',category:'work'}}};
 value=preserveScenarioAttempt(value,'opener',learner,2);
 value=attachM1L1PushbackOne(value,m1L1ProviderTurn(input.runId,'pushback_one',answer.reply),3);
 const restored=normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(value)))!;
 assert.ok(restored);assert.equal(restored.run.counterpartTurn?.text,positive);
 const contaminated=structuredClone(value);contaminated.run.m1L1!.pushbackOne!.text=retained.response.text;contaminated.run.counterpartTurn!.text=retained.response.text;
 assert.equal(normalizeScenarioPracticeRun(contaminated),null,'durable consumer denies retained unsupported quantity');
 const before=provider.length;
 const beforeRequests=bodies.length;
 await assert.rejects(generateM1L1DynamicReply(input));
 assert.equal(bodies.length-beforeRequests,1,'paid server owns repair; native must not start another generation after exhaustion');
 assert.equal(provider.length-before,2,'one repair then fail closed, no fallback text');
 assert.equal(statuses.at(-1),502);
 const prompt=JSON.parse(provider[0].messages[0].content);
 assert.match(prompt.validation_instruction,/M1 L1/);
 assert.match(prompt.validation_instruction,/No closed vocabulary/);
 assert.match(prompt.validation_instruction,/workload/);
 console.log(JSON.stringify({passed:true,exactRequest:true,repairFixtureCalls:2,exhaustionFixtureCalls:2,storageReadback:true,realCalls:0,semanticAcceptance:false}));
}finally{transport.dispose();global.fetch=original;}
