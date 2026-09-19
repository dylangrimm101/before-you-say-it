import {expect,test} from 'bun:test';
import {recoveryDiagnostic} from '../lib/recoveryDiagnostic';
test('recovery support codes never echo unrecognized server values',()=>{
  expect(recoveryDiagnostic('context_mismatch')).toBe('R-CONTEXT');
  for(const value of ['constructor','__proto__','private transcript or credential','']){
    expect(recoveryDiagnostic(value)).toBe('R-UNAVAILABLE');
  }
});
