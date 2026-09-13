import {writeFileSync} from 'node:fs';
import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import {harness} from './freeAcquisitionHarness.fixture';
import {FREE_STAGING_ENDPOINT} from '../lib/freeAcquisition';
import {APPROVED_ONBOARDING_SCENARIOS,scenarioFromApproved} from '../constants/onboardingScenarios';
import type {Turn} from '../types/convo';
const h=harness();h.control.actualProducer=true;
process.env.EXPO_PUBLIC_BYSI_BUILD_MODE='staging-account';
process.env.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT=FREE_STAGING_ENDPOINT;
process.env.ANTHROPIC_API_KEY='synthetic-only';delete process.env.EXPO_PUBLIC_GENERATE_ENDPOINT;
(globalThis as any).__DEV__=true;
mock.module('../lib/supabase',()=>({supabase:{auth:h.auth},authEnvironment:{staging:true,url:h.options.authUrl}}));
mock.module('expo-secure-store',()=>({AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:1,getItemAsync:h.options.storage.getItem,setItemAsync:h.options.storage.setItem}));
const mode=process.argv[2]??'insufficient';let calls=0;
const terminal={mode:'insufficient_evidence',insufficient_evidence:{headline:'Not enough evidence.',note:'Synthetic provider: no supported score.',next_step:'Try a fuller opener and response.'}};
const nativeFetch=h.options.fetch;
globalThis.fetch=(async(url:any,init:any)=>{
 if(url!=='https://api.anthropic.com/v1/messages')return nativeFetch(url,init);
 calls++;const body=JSON.parse(JSON.parse(init.body).messages[0].content);
 const output=body.turn?{mode:'turn',turn:body.turn,role:'hope',text:body.turn==='pushback'?'The deadline is fixed. Everyone is stretched right now.':'I am already stretched with the client work. Which priority should wait?'}:mode==='safety-result'?{mode:'safety',safety:{note:'Prioritize safety.',resources:[]}}:terminal;
 return Response.json({id:'synthetic-provider',model:'synthetic-model',content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
const ai=await import('../lib/ai');
const scenario=scenarioFromApproved(APPROVED_ONBOARDING_SCENARIOS[0]!,'woman-hope');
const turns:Turn[]=[{id:'one',role:'user',text:mode==='safety-turn'?'I am afraid of their reaction.':'Can we choose one task?'}];
if(mode==='safety-turn'){
 await assert.rejects(()=>ai.nextCounterpartTurn(scenario,'steady',turns,'defensive',scenario.goal),{name:'FreeAcquisitionSafetyError'});
 assert.equal(h.requests.filter(r=>r.method==='POST').length,1);assert.equal(calls,0);
}else{
 const one=await ai.nextCounterpartTurn(scenario,'steady',turns,'defensive',scenario.goal);
 turns.push({id:'pushback',role:'them',text:one.reply},{id:'two',role:'user',text:'Which one comes first?'});
 const two=await ai.nextCounterpartTurn(scenario,'steady',turns,'defensive',scenario.goal);
 turns.push({id:'close',role:'them',text:two.reply});
 if(mode==='safety-result')await assert.rejects(()=>ai.generateDebrief(scenario,'steady',turns,'defensive',scenario.goal),{name:'FreeAcquisitionSafetyError'});
 else {const result=await ai.generateDebrief(scenario,'steady',turns,'defensive',scenario.goal);assert.deepEqual(result.analysis,h.outputs[2]);assert.deepEqual(result.analysis.insufficient_evidence,terminal.insufficient_evidence);assert.equal(result.analysis.starting_index,null);assert.equal(result.debrief,null,'terminal acquisition must not synthesize legacy zero scores');if(process.env.BYSI_TERMINAL_RESULT_FILE)writeFileSync(process.env.BYSI_TERMINAL_RESULT_FILE,JSON.stringify(result),{mode:0o600});}
 assert.equal(calls,3);
 const requests=await Promise.all(h.requests.filter(r=>r.method==='POST').map(r=>r.json()));
 assert.deepEqual(requests[0].contract,requests[2].contract);assert.equal('rewrite_requirement' in requests[2],false);
}
const state=[...h.rows.values()][0];assert.equal(state.phase,'terminal');assert.equal(state.record,undefined);assert.equal(state.proof,undefined);
console.log('PASS actual native → hosted producer → terminal '+mode+'; synthetic Auth/storage/provider, no live calls');
