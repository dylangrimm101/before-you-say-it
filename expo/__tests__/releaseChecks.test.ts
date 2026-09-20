import { expect, test } from 'bun:test';
import { releaseStages, runStages } from '../scripts/run-release-checks';

test('release command includes dependency verification, native regressions, connected journey and canonical check', () => {
  expect([...releaseStages]).toEqual(['verify:buyer-tests', 'test:release-policy', 'test:spoken', 'test:spoken-joined', 'check']);
  const visited: string[] = [];
  expect(runStages(name => { visited.push(name); return 0; })).toEqual({ completed: [...releaseStages], failed: null });
  expect(visited).toEqual([...releaseStages]);
});

for (const failed of releaseStages) test(`release checks stop on ${failed}, including unavailable test infrastructure`, () => {
  const visited: string[] = [];
  const result = runStages(name => { visited.push(name); return name === failed ? 1 : 0; });
  expect(result.failed).toBe(failed);
  expect(result.completed).toEqual(releaseStages.slice(0, releaseStages.indexOf(failed)));
  expect(visited.at(-1)).toBe(failed);
});
