import {expect, test} from 'bun:test';
import {spawnSync} from 'node:child_process';
test('actual nine builders isolate Ravi facts and prevent native repair multiplication', () => {
 const result=spawnSync(process.execPath,['__tests__/raviNaturalAdapter.fixture.ts'],{cwd:process.cwd(),encoding:'utf8'});
 expect(result.status, result.stdout+result.stderr).toBe(0);
 expect(result.stdout).toContain('"builders":9,"passed":true');
});
