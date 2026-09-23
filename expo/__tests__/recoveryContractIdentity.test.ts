import {expect,test} from 'bun:test';
import {bysiContract,REACTION_BEHAVIOUR} from '../lib/ai';
import {normalFreeRecoveryContract,normalFreeRecoveryTranscript} from '../lib/normalFreeRecoveryPayload';
import type {Scenario,ReactionPattern} from '../types/convo';
const scenario:Scenario={id:'synthetic',title:'Synthetic',category:'work',counterpart:'Hope',persona:'A colleague',situation:'Synthetic context',goal:'A next step',openingLine:'',opensWith:'user',minutes:5};
test('all 72 route/difficulty/reaction combinations use identical generation and recovery contracts',()=>{
 for(const route of ['real_conversation','recurring_problem','desired_skill'] as const)
 for(const difficulty of ['gentle','steady','challenging'] as const)
 for(const reaction of Object.keys(REACTION_BEHAVIOUR) as ReactionPattern[])
 expect(normalFreeRecoveryContract(scenario,reaction,scenario.goal,route,difficulty)).toEqual(bysiContract(scenario,reaction,scenario.goal,route,difficulty));
});
test('recovery retains exact authorized counterpart text including quotes and role-like prefixes',()=>{
 const text='Hope: “Exact synthetic words.”';
 expect(normalFreeRecoveryTranscript([{id:'u',role:'user',text:'Synthetic opener'},{id:'p',role:'them',text}],scenario).counterpart_pushback).toBe(text);
});
