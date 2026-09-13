import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
for(const mode of ['safety-turn','safety-result','insufficient','quota'])test('normal free acquisition terminal '+mode,()=>{
 const r=spawnSync('bun',['__tests__/normalFreeTerminal.fixture.ts',mode],{cwd:process.cwd(),encoding:'utf8',timeout:15000});
 expect({status:r.status,output:r.status===0?'verified':r.stdout+r.stderr}).toEqual({status:0,output:'verified'});
});
