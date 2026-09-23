import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { practiceGraph } from '../constants/practiceGraph';
test('explicit back still cancels a login waiting for billing identity',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstJourney.fixture.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_RETURNING_LOGIN:'empty',BYSI_SLOW_IDENTITY:'1',BYSI_CANCEL_LOGIN:'1'},encoding:'utf8',timeout:60000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS explicit cancellation during billing identity');
},65000);
for(const saved of ['empty','saved'])for(const delay of ['0','1'])test(`returning login restores without onboarding loop: ${saved}, delayed identity ${delay}`,()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstJourney.fixture.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_RETURNING_LOGIN:saved,BYSI_SLOW_IDENTITY:delay},encoding:'utf8',timeout:60000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS returning login restore Home');
},65000);
test('signup login interruption retries without duplicate account or purchase',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstJourney.fixture.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_AUTO_CONFIRM_TEST:'1',BYSI_AUTO_CONFIRM_RETRY:'1'},encoding:'utf8',timeout:60000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
},65000);
test('immediate signup session reaches purchase claim and Lesson 1 without email confirmation',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstJourney.fixture.ts'],{cwd:new URL('..',import.meta.url),env:{...process.env,BYSI_AUTO_CONFIRM_TEST:'1'},encoding:'utf8',timeout:60000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS purchase-first connected journey');
},65000);

test('practice preview uses inset explicit arrowheads rather than native SVG markers',()=>{
  expect(practiceGraph).not.toContain('<marker');
  expect(practiceGraph).not.toContain('marker-end');
  expect(practiceGraph).toContain('points="294,14 280,16 284,24"');
  expect(practiceGraph).toContain('points="269,146 257,140 257,152"');
});
import { CTX, DIFF, answersComplete, chooseAnswer, firstPracticeScenario, nextAnswerScreen, normalizeAnswers, recognitionOptions, suggestedFocus } from '../lib/answerFirst';

test('every authored difficulty/context branch reaches a valid deterministic suggestion and spoken handoff',()=>{
  for(const diff of DIFF)for(const ctx of CTX){
    const a={diff:diff.id,ctx:ctx.id};const options=recognitionOptions(a);
    expect(options.length>0).toBe(diff.id!=='other');
    if(diff.id==='other'){expect(nextAnswerScreen('q2',a)).toBe('building');expect(answersComplete(a)).toBe(true);}
    else expect(nextAnswerScreen('q2',a)).toBe('q3');
    for(const option of options.length?options:[{id:undefined}]){
      const answers={...a,rec:option.id};const focus=suggestedFocus(answers);
      expect(answersComplete(answers)).toBe(true);expect(focus.headline.length).toBeGreaterThan(0);
      expect(focus.scene.length).toBeGreaterThan(0);expect(focus.name.length).toBeGreaterThan(0);
      const scenario=firstPracticeScenario(answers);expect(scenario.opensWith).toBe('user');expect(scenario.situation).toBe(focus.scene);
      expect(scenario.id).toContain(focus.key);
    }
  }
});
test('context changes preserve valid recognition, discard invalid recognition, and reject injected choices',()=>{
  expect(chooseAnswer({diff:'raise',ctx:'work',rec:'feedback'},'ctx','partner')).toEqual({diff:'raise',ctx:'partner'});
  expect(chooseAnswer({diff:'clarity',ctx:'work',rec:'bury'},'ctx','friends').rec).toBe('bury');
  expect(normalizeAnswers({diff:'listen',ctx:'work',rec:'interview',strokes:['private drawing'],score:100})).toEqual({diff:'listen',ctx:'work'});
  expect(normalizeAnswers({diff:'raise',ctx:'work',rec:'unsafe'}).rec).toBeUndefined();
  expect(answersComplete({diff:'clarity',ctx:'work'})).toBe(false);
  expect(suggestedFocus({diff:'needs',ctx:'work',rec:'notsure'}).key).toBe('other');
});
test('new native onboarding interactions, billing boundaries, and retained answers',()=>{
  const result=spawnSync(process.execPath,['__tests__/answerFirst.fixture.tsx'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS answer-first mounted');
});
test('native route connects owner storage, account return and verified commerce without pre-access practice',()=>{
  const result=spawnSync(process.execPath,['__tests__/answerFirstAdapter.fixture.tsx'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS answer-first adapter');
});
test('purchase-first billing keeps Apple confirmation separate from verified account admission',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstBilling.fixture.tsx'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS purchase-first billing');
});
test('purchase-first controller handles account return, pending claims and resumed reminders',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstController.fixture.tsx'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
});
test('purchase-first policy distinguishes public and sandbox admission',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstPolicy.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
});

test('connected purchase-first onboarding reaches earned Lesson 1 Index and actual Home',()=>{
  const result=spawnSync(process.execPath,['__tests__/purchaseFirstJourney.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:60000});
  expect(result.status,result.stdout+result.stderr).toBe(0);
  expect(result.stdout).toContain('PASS purchase-first connected journey');
},65000);
