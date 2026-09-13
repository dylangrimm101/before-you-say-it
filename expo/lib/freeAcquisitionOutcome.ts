// A terminal safety outcome is not a failed counterpart to retry or a score.
// Keep this marker content-free; the UI uses its existing reviewed resources.
export class FreeAcquisitionRequestError extends Error {
 readonly retryable:boolean;
 constructor(readonly status:number,readonly code:unknown=undefined){
  const terminal=['exhausted','expired','phase','conflict'].includes(String(code));
  super(terminal?'This free session cannot continue. Your saved conversation is unchanged. Return to Home or contact support.':code==='pending'?'Your request may still be finishing. Retry to recover the same operation; do not restart the conversation.':`Free rehearsal request unavailable (${status}). Retry to recover your conversation.`);
  this.name='FreeAcquisitionRequestError';this.retryable=!terminal;
 }
}

export class FreeAcquisitionSafetyError extends Error {
 constructor(){super('Rehearsal stopped for safety');this.name='FreeAcquisitionSafetyError';}
}
