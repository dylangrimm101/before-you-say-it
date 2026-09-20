import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';

// Run explicitly with test:spoken-joined. Requires the supplied local backend;
// ordinary mobile-only test discovery must not require private backend source.
// Do not silently
// skip the connected regression or download backend code into the mobile repo.
for(const track of ['real','recurring','skill']){
  test(`connected spoken screen → transport → route → proof → SQL: ${track}`,()=>{
    expect(process.env.BYSI_GUEST_BACKEND?.startsWith('/')).toBe(true);
    const result=spawnSync(process.execPath,['--no-env-file','__tests__/recordExchange.fixture.ts','fresh',track,'continue',...(track==='real'?[]:['partner'])],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:120000});
    expect({code:result.status,output:result.status?result.stdout+result.stderr:''}).toEqual({code:0,output:''});
    expect(result.stdout).toContain('PASS connected Record exchange');
  },130000);
}
for(const mode of ['verified-check','blocked-check','expired-proof'])test(`real verification rejection preserves reply: ${mode}`,()=>{
  const result=spawnSync(process.execPath,['--no-env-file','__tests__/recordExchange.fixture.ts','fresh','recurring','continue','partner','mismatch',mode],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:120000});
  expect({code:result.status,output:result.status?result.stdout+result.stderr:''}).toEqual({code:0,output:''});
  expect(result.stdout).toContain('PASS connected Record exchange');
},130000);
for(const track of ['real','recurring','skill'])test(`original briefing survives context drift through both spoken turns and debrief: ${track}`,()=>{
  const result=spawnSync(process.execPath,['--no-env-file','__tests__/recordExchange.fixture.ts','fresh',track,'continue',...(track==='real'?[]:['partner']),'native-timing','context-drift'],{cwd:import.meta.dir+'/..',encoding:'utf8',timeout:120000});
  expect({code:result.status,output:result.status?result.stdout+result.stderr:''}).toEqual({code:0,output:''});
  expect(result.stdout).toContain('PASS connected Record exchange');
},130000);
