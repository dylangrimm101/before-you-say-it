import {test,expect} from 'bun:test';
import {approvedRehearsalConfig,hasCanonicalApprovedRehearsalPressureSequence} from '../lib/approvedRehearsals';
import {createScenarioPracticeRun,initializeApprovedRehearsalRun,normalizeScenarioPracticeRun} from '../lib/scenarioPractice';
import {normalizeConvertedLessonProgress,mergeConvertedLessonProgress} from '../lib/convertedLesson';
test('Ravi completion history keeps original v1 alongside v2 without erasure',()=>{
 const c=approvedRehearsalConfig('m1-l2')!;
 const record={lessonId:c.lessonId,moduleId:c.moduleId,practiceId:c.practiceId,contentVersion:legacy,runId:'legacy',lessonCardCheckpoint:c.completionCard,quizGatesCompleted:true as const,rehearsalCompleted:true as const,retryCompleted:true as const,comparisonViewed:true as const,savedMoveId:c.namedMoveId,transferChoice:'finish' as const,completedAt:1,sourceLineage:'approved-html-deck-pinned' as const};
 expect(normalizeConvertedLessonProgress([record])).toEqual([record]);
 const updated={...record,contentVersion:current,runId:'v2',completedAt:2};
 expect(mergeConvertedLessonProgress([record],updated)).toEqual([record,updated]);
});
const current='m1-l2-thursday-semantic-v7-2026-09-07';
const legacy='m1-l2-thursday-natural-facts-v6-2026-09-07';
function saved(version:string){
 const c=approvedRehearsalConfig('m1-l2')!,id='ravi-history';
 const w=initializeApprovedRehearsalRun(createScenarioPracticeRun(c.scenario,'steady','defensive',id,1),1);
 const first={id:`${id}-counterpart-turn-1`,text:"Honestly, that one's on the client, not us—revisions didn't land till three.",source:'provider' as const,reactionId:'m1-l2-dynamic-pressure-1',semanticVoiceKey:'contextual_counterpart' as const,resolvedAudioId:`${w.run.curriculumVersion}-${id}-counterpart-turn-1`,authoredAt:3};
 const second={...first,id:`${id}-counterpart-turn-2`,text:"Tuesday's unowned sign-off explains that file. I'm not convinced it establishes a pattern in the approval process.",reactionId:'m1-l2-dynamic-pressure-2',resolvedAudioId:`${w.run.curriculumVersion}-${id}-counterpart-turn-2`,authoredAt:5};
 return {...w,run:{...w.run,convertedModuleId:c.moduleId,practiceId:c.practiceId,contentVersion:version,counterpartIdentity:c.counterpartId,scenarioContext:{...w.run.scenarioContext!,counterpartId:c.counterpartId},attempt:{id:`${id}-opener`,kind:'opener' as const,transcript:'Yesterday’s file is one example.',representation:'confirmed_transcript' as const,confirmedAt:2},counterpartTurn:first,responseAttempt:{id:`${id}-response`,kind:'response' as const,transcript:'Tuesday had no sign-off owner.',representation:'confirmed_transcript' as const,confirmedAt:4},approvedRehearsal:{beat:4 as const,retryCount:0 as const,pushbackOne:first,pushbackTwo:second},state:'ready_for_second_response' as const,updatedAt:5}};
}
test('current Ravi version restores natural pushback and close without a client English verifier',()=>{
 expect(approvedRehearsalConfig('m1-l2')!.contentVersion).toBe(current);
 const w=saved(current);expect(normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(w)))?.run).toEqual(w.run);
 expect(hasCanonicalApprovedRehearsalPressureSequence(approvedRehearsalConfig('m1-l2')!,w.run)).toBe(true);
});
test('legacy Ravi remains original read-only schema history, never a current v2 resume',()=>{
 const w=saved(legacy),restored=normalizeScenarioPracticeRun(JSON.parse(JSON.stringify(w)));
 expect(restored?.run).toEqual(w.run);
 expect(restored?.run.contentVersion).toBe(legacy);
 expect(hasCanonicalApprovedRehearsalPressureSequence(approvedRehearsalConfig('m1-l2')!,w.run)).toBe(false);
 expect(normalizeScenarioPracticeRun(saved('invented-version'))).toBeNull();
});
