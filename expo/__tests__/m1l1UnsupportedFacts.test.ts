import {test,expect} from 'bun:test';
import {m1L1DynamicReplyPassesQuality} from '../lib/m1L1DynamicResponse';
import {M1_L1_CONVERSION} from '../lib/convertedLesson';
const learner='I want us to agree on one handoff owner before quarter close. When ownership is unclear, work gets passed back and forth. Can we name the owner together before we send this handoff?';
const context=[M1_L1_CONVERSION.scenario.title,M1_L1_CONVERSION.scenario.situation,M1_L1_CONVERSION.scenario.persona,learner].join(' ');
test('retained Adam invented workload and other unsupported written quantities are rejected',()=>{
 for(const quantity of ['three','seven','nineteen','sixty','hundred','3','700']) {
  expect(m1L1DynamicReplyPassesQuality(`Naming an owner right now sounds nice, but I've got ${quantity} other client files due before close and can't sit in a planning discussion.`,'pushback_one',learner,context)).toBe(false);
 }
});
test('natural pressure and legitimate contextual learner wording remain allowed',()=>{
 for(const text of ["You want an owner, but how does naming one change the handoff?","Naming an owner sounds simple, but how does that help when quarter-close work keeps shifting between us?","Yesterday left you 40 minutes, but why does that mean noon is the right deadline?"]) expect(m1L1DynamicReplyPassesQuality(text,'pushback_one',learner,context)).toBe(true);
 // This finite lexical gate is NOT semantic proof: same known words can express an invented fact.
 expect(m1L1DynamicReplyPassesQuality("Naming an owner sounds nice, but I've got other client files due before close.",'pushback_one',learner,context)).toBe(true);
});
