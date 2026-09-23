import {mayRequestRestart,type RecoveryState} from './phaseRecovery';

type Request=(operation:'recover'|'restart',payload:Record<string,unknown>)=>Promise<Response>;
// A normal scene choice requests a NEW conversation, never a fabricated resume.
// The existing CAS transition is the only authority: no identity, allowance,
// proof lifetime, reservation or stored approved exchange is reconstructed here.
export async function startNormalFreeConversation(request:Request):Promise<RecoveryState>{
 const response=await request('recover',{});
 if(!response.ok){const refusal=await response.json().catch(()=>({}));return {status:typeof refusal.code==='string'?refusal.code:'unavailable'};}
 const state:RecoveryState=await response.json();
 if(state.status==='new'||(state.status==='start'&&!state.used))return state;
 if(state.status==='resume')return state;
 if(!mayRequestRestart(state))return state;
 const started=await request('restart',{sessionId:state.sessionId,generation:state.generation});
 if(!started.ok){const refusal=await started.json();return {...state,status:refusal.code};}
 // The normal free transport validates the exact session/generation and commits
 // the journal before returning success. Response loss is retried by inspection.
 return {...state,status:'start',used:false,generation:state.generation!+1};
}
