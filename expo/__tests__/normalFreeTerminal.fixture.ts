// Native normal acquisition adapter; synthetic provider transport, zero network.
import assert from 'node:assert/strict';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
process.env.EXPO_PUBLIC_GENERATE_ENDPOINT='https://beforeyousayit.app/api/generate';
const mode=process.argv[2];let calls=0;
const terminal={mode:'insufficient_evidence',insufficient_evidence:{headline:'Not enough evidence.',note:'There is no supported score.',next_step:'Try a fuller response.'}};
globalThis.fetch=(async()=>{calls++;return mode==='quota'?Response.json({error:'Free assessment limit reached'},{status:429}):Response.json(mode==='insufficient'?terminal:{mode:'safety',safety:{note:'Prioritize safety.',resources:[]}});}) as typeof fetch;
const ai=await import('../lib/ai');
const scenario=scenarioFromApproved(APPROVED_ONBOARDING_SCENARIOS[0]!,'woman-hope');
const turns:Turn[]=[{id:'one',role:'user',text:'Can we choose one task?'}];
if(mode==='quota')await assert.rejects(()=>ai.nextCounterpartTurn(scenario,'steady',turns),{name:'FreeAcquisitionRequestError'});
else if(mode==='safety-turn')await assert.rejects(()=>ai.nextCounterpartTurn(scenario,'steady',turns),{name:'FreeAcquisitionSafetyError'});
else if(mode==='safety-result')await assert.rejects(()=>ai.generateDebrief(scenario,'steady',turns),{name:'FreeAcquisitionSafetyError'});
else {const result=await ai.generateDebrief(scenario,'steady',turns);assert.deepEqual(result.analysis,terminal);assert.equal(result.debrief,null,'normal free terminal must not synthesize zero-score debrief');}
assert.equal(calls,1,'terminal response must not cause another provider dispatch');
console.log('PASS normal free '+mode+'; synthetic fetch only');
