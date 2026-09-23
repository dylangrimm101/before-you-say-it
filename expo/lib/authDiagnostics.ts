// Fixed labels only. Never log identities, credentials, URLs or session objects.
const events = ['login-start', 'credentials-accepted', 'verification-rejected',
  'identity-sync-start', 'identity-sync-end', 'login-published', 'login-exception',
  'login-finished', 'login-cancelled', 'session-published-account',
  'session-published-guest', 'session-published-none'] as const;
export type AuthDiagnosticEvent = typeof events[number];
export function authDiagnostic(event: AuthDiagnosticEvent): void {
  if (!(events as readonly string[]).includes(event)) return;
  try { console.warn(`[BYSI_AUTH_V1] ${event}`); } catch { /* No auth side effects. */ }
}
export function routeDiagnostic(route: string | undefined, account: boolean, loading: boolean): void {
  const safeRoute = ['entry', 'continue-from-web', 'answer-onboarding', 'first-practice', '(tabs)', 'account-practice', 'paywall'].includes(route ?? '') ? route : 'other';
  try { console.warn(`[BYSI_ROUTE_V1] route=${safeRoute} account=${account === true} loading=${loading === true}`); } catch { /* No navigation side effects. */ }
}
