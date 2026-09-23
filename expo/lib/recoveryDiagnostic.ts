/** Fixed support codes only: never display or log server-provided free text. */
export function recoveryDiagnostic(status: string): string {
  const codes: Record<string, string> = {
    context_mismatch: 'R-CONTEXT', conflict: 'R-CONFLICT', pending: 'R-PENDING',
    proof_expired: 'R-PROOF', expired: 'R-EXPIRED', visit_ended: 'R-ENDED',
    recording_limit: 'R-RECORDING', spend_limit: 'R-SERVICE', exhausted: 'R-ATTEMPTS',
    unauthorized: 'R-AUTH', start: 'R-START', new: 'R-NEW',
    terminal: 'R-TERMINAL', result: 'R-RESULT', visit_complete: 'R-COMPLETE',
  };
  return Object.hasOwn(codes,status) ? codes[status] : 'R-UNAVAILABLE';
}
