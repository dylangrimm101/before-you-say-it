import type { LifecycleBridgeAuth } from './privateWebBridgeCoordinator';
import { STAGING_AUTH_URL } from './authEnvironment';
import { withRequestDeadline } from './requestDeadline';
export type PracticeAdmissionState = { status: 'idle' | 'checking' | 'allowed' | 'denied' | 'unavailable'; owner: string | null; expiresAt: number };
export const NO_PRACTICE_ADMISSION: PracticeAdmissionState = { status: 'idle', owner: null, expiresAt: 0 };
/** UI admission only. The protected generation/voice handlers independently query
 * this same account-level SQL policy on every operation. No result, purchase
 * warning, client Pro override, or chosen session participates in this decision. */
export function createStagingPracticeAccess(config: { developmentBuild: boolean; staging: boolean; authUrl: string; key: string; auth: LifecycleBridgeAuth; fetch?: typeof fetch }) {
  if (!config.developmentBuild || !config.staging || config.authUrl !== STAGING_AUTH_URL || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(config.key)) return null;
  const auth = config.auth, send = config.fetch ?? fetch, key = config.key;
  let state = NO_PRACTICE_ADMISSION, revision = 0, disposed = false;
  let controller: AbortController | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const publish = (next: PracticeAdmissionState) => { state = next; listeners.forEach(fn => fn()); };
  const invalidate = () => { ++revision; controller?.abort(); clearTimeout(expiry); publish(NO_PRACTICE_ADMISSION); };
  const subscription = auth.onAuthStateChange((event, session) => {
    if (event === 'TOKEN_REFRESHED' && session?.user.id === state.owner) return;
    invalidate();
  }).data.subscription;
  return {
    getSnapshot: () => state,
    subscribe: (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    invalidate,
    async verify(): Promise<boolean> {
      if (disposed) return false;
      invalidate(); const before = revision; const control = new AbortController(); controller = control;
      publish({ status: 'checking', owner: null, expiresAt: 0 });
      const current = () => { if (disposed || revision !== before) throw new Error('Account changed'); };
      try {
        const owner = await withRequestDeadline(async signal => {
          const session = await auth.getSession(); current();
          const s = session.data.session;
          if (session.error || !s) throw new Error('Sign in required');
          const result = await auth.getUser(s.access_token); current();
          if (result.error || result.data.user?.id !== s.user.id || result.data.user.is_anonymous !== false || !result.data.user.email_confirmed_at) throw new Error('Confirmed account required');
          const response = await send(`${STAGING_AUTH_URL}/rest/v1/rpc/bysi_staging_paid_access`, {
            method: 'POST', headers: { apikey: key, Authorization: `Bearer ${s.access_token}`, 'Content-Type': 'application/json' },
            body: '{}', signal, redirect: 'error', credentials: 'omit', cache: 'no-store',
          }); current();
          if (response.status !== 200 || response.redirected) throw new Error('Verification unavailable');
          const text = await response.text(); current(); signal.throwIfAborted();
          if (text !== 'true' && text !== 'false') throw new Error('Invalid decision');
          return { id: s.user.id, allowed: text === 'true' };
        }, 10000, control.signal);
        current();
        publish({ status: owner.allowed ? 'allowed' : 'denied', owner: owner.id, expiresAt: owner.allowed ? Date.now() + 30000 : 0 });
        if (owner.allowed) expiry = setTimeout(invalidate, 30000);
        return owner.allowed;
      } catch {
        if (!disposed && revision === before) publish({ status: 'unavailable', owner: null, expiresAt: 0 });
        return false;
      }
    },
    dispose() { disposed = true; invalidate(); subscription.unsubscribe(); listeners.clear(); },
  };
}
export type StagingPracticeAccess = ReturnType<typeof createStagingPracticeAccess>;
