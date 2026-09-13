import assert from 'node:assert/strict';
process.env.EXPO_PUBLIC_GENERATE_ENDPOINT='https://bysi-signup-staging.vercel.app/api/generate';
process.env.EXPO_PUBLIC_BYSI_BUILD_MODE='';
const {generateApprovedRehearsalDynamicReply}=await import('../lib/ai');
const {approvedRehearsalConfig,approvedRehearsalAuthoredCorpus}=await import('../lib/approvedRehearsals');
const original=global.fetch;
const observed:any[]=[];
const text="The client didn't send revisions until three. That's on them, not our approval process.";
try {
 for(const id of ['m1-l2','m1-l3','m1-l4','m1-l5','m2-l1','m2-l2','m2-l3','m2-l4','m2-l5']) {
  const c=approvedRehearsalConfig(id)!;
  const calls:any[]=[];
  global.fetch=async(_,init)=>{calls.push(JSON.parse(String(init?.body))); return Response.json({mode:'turn',text});};
  const input={scenario:c.scenario,lessonId:c.lessonId,kind:'pushback_one' as const,counterpartId:c.counterpartId,namedMove:c.namedMove,coachedBehaviorId:c.coachedBehaviorId,retryDirection:c.retryDirection,approvedTranscript:'Yesterday’s late file is why approval needs a clear owner.',openingTranscript:'Yesterday’s late file is why approval needs a clear owner.',authoredCorpus:approvedRehearsalAuthoredCorpus(c),runId:'offline-contract'};
  let accepted=false;
  try { accepted=(await generateApprovedRehearsalDynamicReply(input)).reply===text; } catch {}
  observed.push({id,calls,accepted});
  if(id==='m1-l2') {
   assert.equal(calls.length,0,'Ravi cannot fall back to the legacy public endpoint without paid configuration');
   assert.equal(accepted,false);
   calls.length=0;
   global.fetch=async()=>{calls.push({});return Response.json({error:'unavailable'},{status:502});};
   await assert.rejects(generateApprovedRehearsalDynamicReply(input));
   assert.equal(calls.length,0,'No paid configuration means no legacy endpoint request');
  } else {
   assert.equal(calls[0]?.lesson_constraints.fact_contract_version,undefined);
  }
 }
 console.log(JSON.stringify({builders:observed.length,passed:true}));
} finally {global.fetch=original;}
