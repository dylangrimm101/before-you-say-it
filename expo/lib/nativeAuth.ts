import type { Session } from "@supabase/supabase-js";

type AuthResponse = { data: { session: Session | null }; error: unknown };
export type NativeAuthClient = {
  getSession: () => Promise<AuthResponse>;
  signInAnonymously: () => Promise<AuthResponse>;
  getUser?: (jwt: string) => Promise<{ data: { user: { id: string; is_anonymous?: boolean } | null }; error: unknown }>;
  signOut?: () => Promise<unknown>;
};
export type NativeSessionResult = { success: true; session: Session } | { success: false; message: string };
type NativeAuthSnapshot = { revision: number; ownerId: string | null; logoutPending?: boolean; invalidationRevision?: number };
export type NativeAuthLifetime = {
  snapshot: () => NativeAuthSnapshot;
};

// This client rollout gate does not replace server authorization.
export const NATIVE_ANONYMOUS_AUTH_ENABLED = true;
export const NATIVE_AUTH_UNAVAILABLE = "Private practice setup isn’t available in this build yet. Please try again later or log in to an existing account.";

export type AuthIdentity = { id: string; email?: string; is_anonymous?: boolean; email_confirmed_at?: string | null };

/** Same rule the free talking client uses. Get started must not reuse a session talking will reject. */
export function sessionCanTalk(user: { id?: string; is_anonymous?: boolean; email_confirmed_at?: string | null } | null | undefined): boolean {
  if (!user?.id) return false;
  if (user.is_anonymous === true) return true;
  return user.is_anonymous === false && typeof user.email_confirmed_at === "string" && Number.isFinite(Date.parse(user.email_confirmed_at));
}

/** Device-global practice storage cannot safely switch between real accounts. */
export function accountLoginAllowed(current: AuthIdentity | null, email: string): boolean {
  if (!current || current.is_anonymous === true) return true;
  return Boolean(current.email && current.email.trim().toLowerCase() === email.trim().toLowerCase());
}

export function createNativeSessionStarter(auth: NativeAuthClient | null, enabled = NATIVE_ANONYMOUS_AUTH_ENABLED, lifetime?: NativeAuthLifetime) {
  let pending: Promise<NativeSessionResult> | null = null;
  const run = async (): Promise<NativeSessionResult> => {
    let stage = "configuration";
    const unavailable = (reason = "unavailable", error?: unknown): NativeSessionResult => {
      // Only fixed categories reach the screen; never include server messages, tokens or identities.
      const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
      const category = typeof code === "string" && ["anonymous_provider_disabled", "over_request_rate_limit", "over_email_send_rate_limit", "captcha_failed", "bad_jwt", "session_not_found"].includes(code) ? code : reason;
      return { success: false, message: `We couldn’t set up private practice. Please try again or log in to an existing account. Setup code: ${stage}/${category}.` };
    };
    if (!auth) return unavailable();
    const start = lifetime?.snapshot();
    const active = (expectedOwnerId: string | null, baseline = start): boolean => {
      if (!lifetime || !baseline) return true;
      const now = lifetime.snapshot();
      if (now.logoutPending) return false;
      if (typeof now.invalidationRevision === "number"
        && typeof baseline.invalidationRevision === "number"
        && now.invalidationRevision !== baseline.invalidationRevision) return false;
      if (expectedOwnerId === null) return now.ownerId === null && now.revision === baseline.revision;
      return now.ownerId === expectedOwnerId;
    };
    try {
      stage = "session-read";
      const existing = await auth.getSession();
      if (!active(start?.ownerId ?? null)) return unavailable();
      if (existing.error) return unavailable("rejected", existing.error);
      const current = existing.data.session;
      if (current?.access_token && current.user?.id) {
        const identity = current.user as { id: string; is_anonymous?: boolean };
        if (!active(identity.id)) return unavailable();
        let live = identity;
        if (auth.getUser) {
          if (!active(identity.id)) return unavailable();
          stage = "session-verify";
          const verified = await auth.getUser(current.access_token);
          if (!active(identity.id)) return unavailable();
          if (verified.error || !verified.data.user?.id || verified.data.user.id !== current.user.id) {
            live = { id: "", is_anonymous: undefined };
          } else {
            live = verified.data.user;
          }
        }
        if (sessionCanTalk({ ...current.user, ...live })) {
          return { success: true, session: current };
        }
        if (!enabled) return unavailable();
        if (!active(identity.id)) return unavailable();
        stage = "session-clear";
        await auth.signOut?.();
        const afterSignOut = lifetime?.snapshot();
        if (afterSignOut?.logoutPending || (afterSignOut && afterSignOut.ownerId !== null)) return unavailable();
        if (afterSignOut && !active(null, afterSignOut)) return unavailable();
      } else if (!enabled) {
        return unavailable();
      }
      if (!enabled) return unavailable();
      const anonymousStart = lifetime?.snapshot();
      if (anonymousStart && !active(null, anonymousStart)) return unavailable();
      stage = "guest-signin";
      const { data, error } = await auth.signInAnonymously();
      if (error) return unavailable("rejected", error);
      if (!data.session?.access_token || !data.session.user?.id) return unavailable("empty-session");
      stage = "session-owner";
      if (!active(data.session.user.id, anonymousStart)) return unavailable("changed");
      return { success: true, session: data.session };
    } catch (error) {
      return unavailable("exception", error);
    }
  };
  return (): Promise<NativeSessionResult> => {
    if (!pending) pending = run().finally(() => { pending = null; });
    return pending;
  };
}
