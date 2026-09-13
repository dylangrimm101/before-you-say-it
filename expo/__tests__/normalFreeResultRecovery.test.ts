import {test,expect} from 'bun:test';import {beginConversionBuild,failConversionBuild,getConversionBuild,cancelConversionBuild} from '../lib/conversionBuild';
test('result recovery retains explicit retry callback and terminal reason rather than restarting free issuance',async()=>{
 let calls=0;beginConversionBuild({id:'normal-free-recovery',scenarioTitle:'Synthetic',counterpartName:'Synthetic',turns:[]});
 failConversionBuild('normal-free-recovery',{message:'Recover the same operation',retry:async()=>{calls++;}});
 const state=getConversionBuild('normal-free-recovery')!;expect(state.error).toBe('Recover the same operation');await state.retry?.();expect(calls).toBe(1);
 failConversionBuild('normal-free-recovery',{message:'Session exhausted'});expect(getConversionBuild('normal-free-recovery')!.retry).toBeUndefined();cancelConversionBuild('normal-free-recovery');
});
