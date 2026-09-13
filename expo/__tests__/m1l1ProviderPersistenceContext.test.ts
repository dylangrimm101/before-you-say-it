import {test,expect} from 'bun:test';
import {M1_L1_CONVERSION,hasCanonicalM1L1PressureSequence} from '@/lib/convertedLesson';
import {createScenarioPracticeRun,initializeM1L1Run,preserveScenarioAttempt,attachM1L1PushbackOne,normalizeScenarioPracticeRun} from '@/lib/scenarioPractice';
import {m1L1ProviderTurn} from '@/lib/m1L1DynamicResponse';

test('provider reply grounded in approved learner wording survives canonical storage without losing that context',()=>{
 let value=initializeM1L1Run(createScenarioPracticeRun(M1_L1_CONVERSION.scenario,'steady','defensive','context-regression',1),1);
 value={...value,run:{...value.run,convertedModuleId:M1_L1_CONVERSION.moduleId,practiceId:M1_L1_CONVERSION.practiceId,contentVersion:M1_L1_CONVERSION.contentVersion,counterpartIdentity:'adam',scenarioContext:{...value.run.scenarioContext!,counterpartId:'adam',counterpartName:'Adam',counterpartRole:'your colleague',category:'work'}}};
 value=preserveScenarioAttempt(value,'opener','Can we name one owner together before quarter close?',2);
 value=attachM1L1PushbackOne(value,m1L1ProviderTurn(value.run.id,'pushback_one','Naming an owner sounds simple, but how does that help when quarter-close work keeps shifting between us?'),3);
 expect(hasCanonicalM1L1PressureSequence(value.run)).toBe(true);
 expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(value)))).toEqual(value);
 const bad=structuredClone(value);bad.run.m1L1!.pushbackOne!.text='The vendor changed the software yesterday, but that is your problem.';
 expect(normalizeScenarioPracticeRun(bad)).toBeNull();
});
