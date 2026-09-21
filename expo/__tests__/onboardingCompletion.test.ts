import {expect,test} from 'bun:test';
import {spawnSync} from 'node:child_process';

// Local connected coverage only. Auth, recording/player, providers and store
// catalog are simulated; no Apple purchase or physical-device acceptance.
for(const track of ['real','recurring','skill']){
  for(const mode of ['through-offer','result-budget-block','alert-only-through-offer']){
    test(`connected onboarding ${track}: ${mode}`,()=>{
      const run=spawnSync(process.execPath,['--no-env-file','__tests__/recordExchange.fixture.ts','fresh',track,'continue','partner','native-timing','production-budget',...(mode==='alert-only-through-offer'?['alert-only-budget','through-offer']:[mode])],{
        cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:180000,
      });
      expect(run.status,run.stdout+run.stderr).toBe(0);
      expect(run.stdout).toContain(mode!=='result-budget-block'
        ?'PASS connected fresh spoken journey through report, cards, all offer screens and account entry; purchase NOT performed'
        :'REPRODUCED result 429 and blocked recovery; payment NOT reached');
    },190000);
  }
}
