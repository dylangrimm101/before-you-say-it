import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {LAUNCH_DECK_IDS} from '../lib/launchCurriculum';

test('all canonical launch lessons and closes execute actual learner controls and owner-store remounts',()=>{
  const result=spawnSync(process.execPath,['__tests__/allLessonTrajectories.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:60000});
  expect(result.stdout+result.stderr).toContain('PASS actual all launch lesson trajectories');
  expect(result.status).toBe(0);
  const ledger=JSON.parse(readFileSync(new URL('../../docs/NATIVE-ALL-LESSON-TRAJECTORIES.json',import.meta.url),'utf8'));
  expect(ledger.complete).toBe(true);
  expect(ledger.entries.map((entry:any)=>entry.id)).toEqual([...LAUNCH_DECK_IDS]);
  expect(ledger.entries.filter((entry:any)=>entry.kind==='lesson')).toHaveLength(10);
  expect(ledger.entries.filter((entry:any)=>entry.kind==='module-close')).toHaveLength(2);
  expect(ledger.entries.every((entry:any)=>entry.status==='component-local')).toBe(true);
},65000);
