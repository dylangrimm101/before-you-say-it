import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';

test('mounted saved-result screen opens older result history and accepts delete-all above one hundred',()=>{
 const cwd=new URL('..',import.meta.url).pathname;
 const run=spawnSync('bun',['__tests__/savedResultMountedHistory.fixture.ts'],{cwd,encoding:'utf8',env:{...process.env,BYSI_COMPONENT_TEST_DEPS:process.env.BYSI_COMPONENT_TEST_DEPS??`${cwd}/../component-deps`,LC_ALL:'en_US.UTF-8',LANG:'en_US.UTF-8',LC_CTYPE:'en_US.UTF-8'}});
 expect(run.stdout+run.stderr).toContain('PASS mounted saved-result history');
 expect(run.status).toBe(0);
});
