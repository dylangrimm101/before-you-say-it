import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const track of ['real','recurring','skill'])for(const outcome of ['continue','reject']){
  test(`Record transition: ${track}/${outcome}`,()=>{
    const result=spawnSync(process.execPath,['__tests__/recordTransition.fixture.ts','fresh',track,outcome],{cwd:import.meta.dir+'/..',encoding:'utf8'});
    expect({code:result.status,output:result.status?result.stdout+result.stderr:''}).toEqual({code:0,output:''});
    expect(result.stdout).toContain('PASS Record transition');
  },30000);
}
