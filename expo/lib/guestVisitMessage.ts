/** Content-free visit errors. Never suggest a quota is fixed by checking again. */
export function guestVisitMessage(status: string): string {
  if(['visit_limit','exhausted','recording_limit'].includes(status))return 'This rehearsal’s attempts are used up. Return to Get Started for a new rehearsal.';
  if(status==='spend_limit')return 'Voice practice is temporarily unavailable. Please try later.';
  if(status==='pending')return 'Your last request is still finishing. You can retry shortly or leave this practice.';
  if(status==='saved_result')return 'This result was saved to an account. Sign in to that account to continue.';
  if(status==='visit_complete')return 'This practice is complete. Return to Get Started for another conversation.';
  if(status==='visit_ended'||status==='expired')return 'This guest rehearsal has ended. Return to Get Started for a new rehearsal.';
  return 'We couldn’t continue this practice. You can leave and return to Get Started.';
}
export const canRetryGuestVisit = (status: string) => ['pending','unavailable','proof_expired'].includes(status);
