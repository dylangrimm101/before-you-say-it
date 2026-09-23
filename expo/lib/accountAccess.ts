/** Navigation only. Server authorization still protects every paid operation. */
export type AccountAccessState = 'allowed' | 'checking' | 'unavailable' | 'paywall' | 'login';
export function accountAccessState(account: boolean, access: {data?: boolean; isPending?: boolean; isError?: boolean; isFetching?: boolean}): AccountAccessState {
  if (!account) return 'login';
  if (access.isError) return 'unavailable';
  if (access.isPending || access.data === undefined) return 'checking';
  // A routine refresh is not expiration. Never invent access from an SDK login.
  if (access.data === true) return 'allowed';
  return access.isFetching ? 'checking' : 'paywall';
}
const publicRoutes = new Set(['entry', 'answer-onboarding', 'continue-from-web', 'account-practice', 'paywall', 'purchase-success', 'privacy', 'safety', 'forgot-password', 'reset-password', 'delete-account', 'settings', 'staging-web-result']);
export function accountAccessRoute(route: string | undefined, account: boolean, source?: string) {
  const landing = account && (route === 'entry' || route === 'answer-onboarding') && (!source || source === 'account-login');
  return {landing, protected: landing || !publicRoutes.has(route ?? '')};
}
