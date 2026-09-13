export const AUTH_URL = 'https://spvksnddzyvycfoefrcf.supabase.co';
export const RESET_URL = 'https://beforeyousayit.app/reset-password';
export const FORGOT_URL = 'https://beforeyousayit.app/forgot-password';

type RecoveryAuth = {
  setSession: (session: {access_token: string; refresh_token: string}) => Promise<{error: {code?: string} | null}>;
  getUser: (token?: string) => Promise<{data: {user: RecoveryUser | null}; error: {code?: string} | null}>;
  refreshSession: () => Promise<{data: {session: unknown; user: RecoveryUser | null}; error: {code?: string} | null}>;
  updateUser: (input: {password: string}) => Promise<{data: {user: RecoveryUser | null}; error: {code?: string} | null}>;
  signOut: (input: {scope: 'global' | 'local'}) => Promise<{error: {code?: string} | null}>;
};

type RecoveryUser = {
  id?: string;
  email?: string | null;
  is_anonymous?: boolean;
  email_confirmed_at?: string | null;
  recovery_sent_at?: string | null;
};

export type RecoveryCallback = {
  access_token: string;
  refresh_token: string;
  claims: {sub: string; iat: number; exp: number};
};

function decodeJwtPayload(token: string): Record<string, unknown> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part || !/^[\w-]+$/.test(part))) throw Error('invalid_callback');
  const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const binary = typeof globalThis.atob === 'function'
    ? globalThis.atob(padded)
    : Buffer.from(parts[1], 'base64url').toString('binary');
  return JSON.parse(binary) as Record<string, unknown>;
}

export function parseCallback(search: string, hash: string, now = Date.now()): RecoveryCallback {
  if (!search && !hash) throw Error('missing_callback');
  if (search.length > 16000 || hash.length > 16000) throw Error('invalid_callback');
  for (const part of [search, hash]) {
    const errorParams = new URLSearchParams(part.slice(1));
    if (errorParams.has('error') || errorParams.has('error_code')) {
      throw Error(errorParams.getAll('error_code').length === 1 && errorParams.get('error_code') === 'otp_expired'
        ? 'provider_expired'
        : 'provider_rejected');
    }
  }
  if (search || !hash) throw Error('invalid_callback');
  const params = new URLSearchParams(hash.slice(1));
  const allowed = ['access_token', 'refresh_token', 'type', 'token_type', 'expires_in', 'expires_at', 'sb'];
  if ((params.has('sb') && params.get('sb') !== '')
    || [...params.keys()].some((key) => !allowed.includes(key) || params.getAll(key).length !== 1)
    || params.get('type') !== 'recovery'
    || params.get('token_type') !== 'bearer') throw Error('invalid_callback');
  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (!access_token || !refresh_token || !/^[\w-]{6,2048}$/.test(refresh_token)) throw Error('invalid_callback');
  const claims = decodeJwtPayload(access_token);
  const exp = claims.exp;
  const iat = claims.iat;
  const amr = claims.amr;
  if (claims.iss !== `${AUTH_URL}/auth/v1`
    || claims.aud !== 'authenticated'
    || typeof claims.sub !== 'string'
    || !claims.sub
    || typeof exp !== 'number'
    || !Number.isFinite(exp)
    || exp * 1000 <= now
    || typeof iat !== 'number'
    || !Number.isFinite(iat)
    || iat * 1000 > now + 30000
    || !Array.isArray(amr)
    || !amr.some((entry) => entry && typeof entry === 'object' && (entry as {method?: unknown}).method === 'otp'
      && Number.isFinite((entry as {timestamp?: unknown}).timestamp as number)
      && Math.abs(((entry as {timestamp: number}).timestamp) - iat) <= 60)
    || amr.some((entry) => entry && typeof entry === 'object' && (entry as {method?: unknown}).method === 'password')) {
    throw Error('not_recovery');
  }
  return {access_token, refresh_token, claims: {sub: claims.sub, iat, exp}};
}

export function createImplicitRecovery(auth: RecoveryAuth) {
  let owner: {id: string; email: string} | null = null;
  let busy = false;
  let spent = false;
  const checked = (user: RecoveryUser | null | undefined) => Boolean(
    user
    && user.id === owner?.id
    && user.email === owner?.email
    && !user.is_anonymous
    && Boolean(user.email_confirmed_at),
  );
  return {
    async open(callback: RecoveryCallback) {
      if (owner || spent) throw Error('spent');
      try {
        const session = await auth.setSession({access_token: callback.access_token, refresh_token: callback.refresh_token});
        if (session.error) throw session.error;
        const current = await auth.getUser(callback.access_token);
        if (current.error) throw current.error;
        const user = current.data.user;
        const sent = Date.parse(user?.recovery_sent_at || '');
        if (!user || user.id !== callback.claims.sub || user.is_anonymous || !user.email_confirmed_at || !user.email
          || !Number.isFinite(sent) || sent > callback.claims.iat * 1000 + 30000 || callback.claims.iat * 1000 - sent > 3600000) {
          throw Error('owner');
        }
        owner = {id: user.id, email: user.email};
        const fresh = await auth.refreshSession();
        if (fresh.error || !fresh.data.session || !checked(fresh.data.user)) throw Error('revoked');
        return {email: owner.email};
      } catch {
        spent = true;
        owner = null;
        await auth.signOut({scope: 'local'}).catch(() => {});
        throw Error('unavailable');
      }
    },
    async save(password: string, confirmation: string) {
      if (busy || spent || !owner) return {state: 'unavailable' as const};
      if (password.length < 8 || password.length > 128 || password !== confirmation) return {state: 'invalid_password' as const};
      busy = true;
      let updated = false;
      let issued = false;
      try {
        const current = await auth.getUser();
        if (current.error || !checked(current.data.user)) throw Error('owner');
        issued = true;
        spent = true;
        const result = await auth.updateUser({password});
        if (result.error) {
          if (result.error.code === 'weak_password' || result.error.code === 'same_password') {
            spent = false;
            return {state: result.error.code};
          }
          throw result.error;
        }
        if (!checked(result.data.user)) throw Error('update_unconfirmed');
        updated = true;
        const signedOut = await auth.signOut({scope: 'global'});
        if (signedOut.error) return {state: 'updated_cleanup_unconfirmed' as const};
        return {state: 'updated' as const};
      } catch {
        return {state: updated ? 'updated_cleanup_unconfirmed' as const : issued ? 'update_unconfirmed' as const : 'unavailable' as const};
      } finally {
        busy = false;
        if (spent) {
          owner = null;
          await auth.signOut({scope: 'local'}).catch(() => {});
        }
      }
    },
  };
}
