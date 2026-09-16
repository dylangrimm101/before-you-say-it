import type {Turn} from '../types/convo';
type Checkpoint={revision?:number;phase?:string;contract?:unknown;provenance?:Record<string,unknown>;transcript?:{user_turn_1?:string;counterpart_pushback?:string;user_turn_2?:string;counterpart_close?:string}};
export type RecoveryState={status:string;recordingLimited?:boolean;phase?:string;sessionId?:string;generation?:number;used?:boolean;audio?:{text:string;role:string;turn:string};checkpoint?:Checkpoint};
export function recoveryMessage(status:string):string{
 return ({spend_limit:'Voice practice is temporarily unavailable because the service spending limit has been reached. Your practice is kept. Please try later.',recording_limit:'This practice has reached its recording limit. Your approved words are kept; another recording or restart is not available for this practice.',pending:'Your previous request is still being checked. Check again before recording.',proof_expired:'This practice needs a fresh server check before it can continue.',context_mismatch:'This screen does not match your saved conversation. Resume the original rehearsal, or start a fresh checked rehearsal.',expired:'This practice needs a fresh server check before recording.',terminal:'This rehearsal has ended and cannot be restarted.',result:'This rehearsal already has a result. Return to your saved result.',exhausted:'This practice needs a fresh server check before another spoken rehearsal.',conflict:'Your practice changed elsewhere. Check again before continuing.',start:'An earlier rehearsal is already in progress. Resume it or explicitly start another checked rehearsal.'} as Record<string,string>)[status]??'We could not check your practice. Check your connection and try again.';
}
export function reservationRecoveryMessage(code:unknown):string|null{
 if(typeof code!=='string'||!['phase','pending','conflict','expired','exhausted','recording_limit','spend_limit'].includes(code))return null;
 return recoveryMessage(code==='phase'?'context_mismatch':code);
}
export function applyRecovery(state:RecoveryState,turns:Turn[]):{ready:boolean;turns:Turn[];audio?:RecoveryState['audio']}{
 const blocked={ready:false,turns};
 if(state.recordingLimited===true){
  const retained=applyRecovery({...state,recordingLimited:false},turns);
  const count=state.status==='start'?1:state.status==='resume'&&state.phase==='pushback'?3:state.status==='resume'&&state.phase==='close'?4:0;
  const ready=retained.ready&&count>0&&retained.turns.length===count&&retained.turns.every(t=>t.text.trim().length>0);
  return {...retained,ready,audio:ready?retained.audio:undefined};
 }
 if(state.status==='recording_limit'){
  const retained=applyRecovery({...state,status:'resume'},turns);
  return {...retained,ready:false,audio:undefined};
 }
 if(state.status==='new')return {ready:turns.length===0,turns};
 if(state.status==='start')return {ready:turns.length===0||(!!state.used&&turns.length===1&&turns[0].role==='user'),turns};
 if(state.status!=='resume'||!state.audio)return blocked;
 if(turns.length===0&&state.checkpoint?.transcript){
  const t=state.checkpoint.transcript;
  if(state.phase==='pushback'&&typeof t.user_turn_1==='string'&&typeof t.counterpart_pushback==='string'&&state.audio.text===t.counterpart_pushback){
   return {ready:true,turns:[{id:`recovered-${state.sessionId}-${state.generation}-u1`,role:'user' as const,text:t.user_turn_1},{id:`recovered-${state.sessionId}-${state.generation}-p`,role:'them' as const,text:t.counterpart_pushback}],audio:state.audio};
  }
  if(state.phase==='close'&&typeof t.user_turn_1==='string'&&typeof t.counterpart_pushback==='string'&&typeof t.user_turn_2==='string'&&typeof t.counterpart_close==='string'&&state.audio.text===t.counterpart_close){
   return {ready:true,turns:[{id:`recovered-${state.sessionId}-${state.generation}-u1`,role:'user' as const,text:t.user_turn_1},{id:`recovered-${state.sessionId}-${state.generation}-p`,role:'them' as const,text:t.counterpart_pushback},{id:`recovered-${state.sessionId}-${state.generation}-u2`,role:'user' as const,text:t.user_turn_2},{id:`recovered-${state.sessionId}-${state.generation}-c`,role:'them' as const,text:t.counterpart_close}],audio:state.audio};
  }
 }
 const count=state.phase==='pushback'?1:state.phase==='close'?3:-1;
 if(count<0||turns.length<count||turns.slice(0,count).some((t,i)=>t.role!==(i%2?'them':'user')))return blocked;
 if(turns.length>Math.min(count+2,4)||turns.some((t,i)=>t.role!==(i%2?'them':'user')))return blocked;
 const existing=turns[count];
 if(existing&&(existing.role!=='them'||existing.text!==state.audio.text))return blocked;
 const restored=existing?turns:[...turns,{id:`recovered-${state.sessionId}-${state.generation}-${state.phase}`,role:'them' as const,text:state.audio.text}];
 return {ready:true,turns:restored,audio:state.audio};
}
export const mayRequestRestart=(state:RecoveryState)=>state.recordingLimited!==true&&['start','resume','context_mismatch','proof_expired'].includes(state.status)&&!!state.sessionId&&Number.isInteger(state.generation);
