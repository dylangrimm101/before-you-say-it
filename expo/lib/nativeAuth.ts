import type { Session } from "@supabase/supabase-js";

type AuthResponse = { data: { session: Session | null }; error: unknown };
export type NativeAuthClient = {
  getSession: () => Promise<AuthResponse>;
  signInAnonymously: () => Promise<AuthResponse>;
  getUser?: (jwt: string) => Promise<{ data: { user: { id: string; is_anonymous?: boolean } | null }; error: unknown }>;
  signOut?: () => Promise<unknown>;
};
export type NativeSessionResult = { success: true; session: Session } | { success: false; message: string };

// Deliberately off: see nativeAuth.setup.md. This is a rollout gate, not authorization.
export const NATIVE_ANONYMOUS_AUTH_ENABLED = true;
export const NATIVE_AUTH_UNAVAILABLE = "Private practice setup isn’t available in this build yet. Please try again later or log in to an existing account.";

export type AuthIdentity = { id: string; email?: string; is_anonymous?: boolean };

/** Device-global practice storage cannot safely switch between real accounts. */
export function accountLoginAllowed(current: AuthIdentity | null, email: string): boolean {
  if (!current || current.is_anonymous === true) return true;
  return Boolean(current.email && current.email.trim().toLowerCase() === email.trim().toLowerCase());
}

export function createNativeSessionStarter(auth: NativeAuthClient | null, enabled = NATIVE_ANONYMOUS_AUTH_ENABLED) {
  let pending: Promise<NativeSessionResult> | null = null;
  const run = async (): Promise<NativeSessionResult> => {
    const unavailable: NativeSessionResult = { success: false, message: NATIVE_AUTH_UNAVAILABLE };
    if (!auth) return unavailable;
    try {
      const existing = await auth.getSession();
      if (existing.error) return unavailable;
      const current = existing.data.session;
      if (current?.access_token && current.user?.id) {
        const identity = current.user as { id: string; is_anonymous?: boolean };
        let live = identity;
        if (auth.getUser) {
          const verified = await auth.getUser(current.access_token);
          if (verified.error || !verified.data.user?.id || verified.data.user.id !== current.user.id) {
            live = { id: "", is_anonymous: undefined };
          } else {
            live = verified.data.user;
          }
        }
        if (live.is_anonymous === false) {
          return { success: true, session: current };
        }
        if (live.is_anonymous === true) {
          return { success: true, session: current };
        }
        if (!enabled) return unavailable;
        await auth.signOut?.();
      } else if (!enabled) {
        return unavailable;
      }
      if (!enabled) return unavailable;
      const { data, error } = await auth.signInAnonymously();
      if (error || !data.session?.access_token || !data.session.user?.id) return unavailable;
      return { success: true, session: data.session };
    } catch {
      return unavailable;
    }
  };
  return (): Promise<NativeSessionResult> => {
    if (!pending) pending = run().finally(() => { pending = null; });
    return pending;
  };
}
