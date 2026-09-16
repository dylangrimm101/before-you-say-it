import {test,expect} from 'bun:test';
import {applyRecovery,mayRequestRestart} from '../lib/phaseRecovery';
const opener={id:'u',role:'user' as const,text:'Approved opener'};
const hope={id:'h',role:'them' as const,text:'Approved counterpart'};
const reply={id:'r',role:'user' as const,text:'Approved reply'};
const state={status:'resume',phase:'pushback',used:true,recordingLimited:true,sessionId:'synthetic',generation:0,audio:{text:hope.text,turn:'pushback',role:'hope'}};
test('recording-limited continuation requires approved reply; never offers mic or restart',()=>{
 expect(applyRecovery(state,[opener,hope]).ready).toBe(false);
 expect(applyRecovery(state,[opener,hope,reply]).ready).toBe(true);
 expect(mayRequestRestart(state)).toBe(false);
 expect(applyRecovery(state,[opener,hope,{...reply,text:' '}]).ready).toBe(false);
});
test('recording-limited start continues only an existing approved opener',()=>{
 const start={...state,status:'start',phase:'start',audio:undefined};
 expect(applyRecovery(start,[]).ready).toBe(false);
 expect(applyRecovery(start,[opener]).ready).toBe(true);
 expect(applyRecovery(start,[{...opener,text:' '}]).ready).toBe(false);
 expect(applyRecovery({...state,status:'context_mismatch'},[opener,hope,reply]).ready).toBe(false);
});
