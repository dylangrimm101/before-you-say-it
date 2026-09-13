import { test, expect } from 'bun:test';
import { AUTH_URL, parseCallback, createImplicitRecovery } from '../lib/passwordRecoveryCallback';
import { noteRecoveryIntent, takeCapturedRecoveryUrl } from '../lib/passwordRecoveryIntent';
import { validatedNativeIntentPath } from '../lib/nativeIntent';

const now = Date.now();
const iat = Math.floor(now / 1000);
const token = Buffer.from('{"alg":"ES256"}').toString('base64url') + '.' + Buffer.from(JSON.stringify({
  iss: AUTH_URL + '/auth/v1',
  sub: 'fixture-owner',
  aud: 'authenticated',
  iat,
  exp: iat + 3600,
  amr: [{ method: 'otp', timestamp: iat }],
})).toString('base64url') + '.synthetic_signature';
const fragment = () => new URLSearchParams({
  access_token: token,
  refresh_token: 'synthetic_refresh',
  type: 'recovery',
  token_type: 'bearer',
  expires_in: '3600',
  expires_at: String(iat + 3600),
  sb: '',
});

test('Auth v2.196.0 empty sb marker reaches native callback parser', () => {
  expect(parseCallback('', '#' + fragment(), now).access_token).toBe(token);
});

test('legacy implicit callback without sb remains supported', () => {
  const params = fragment();
  params.delete('sb');
  expect(parseCallback('', '#' + params, now).access_token).toBe(token);
});

test('closed categories distinguish missing, expired, rejected and malformed callbacks', () => {
  expect(() => parseCallback('', '', now)).toThrow('missing_callback');
  expect(() => parseCallback('', '#error=access_denied&error_code=otp_expired&error_description=PRIVATE_UNTRUSTED&sb=', now)).toThrow('provider_expired');
  expect(() => parseCallback('?error=access_denied&error_code=unexpected_failure', '', now)).toThrow('provider_rejected');
  expect(() => parseCallback('', '#type=signup&sb=', now)).toThrow('invalid_callback');
});

test('native intent keeps recovery screens and captures reset credentials without routing tokens', () => {
  takeCapturedRecoveryUrl();
  expect(validatedNativeIntentPath('/forgot-password')).toBe('/forgot-password');
  expect(validatedNativeIntentPath('https://beforeyousayit.app/reset-password')).toBe('/reset-password');
  expect(validatedNativeIntentPath('beforeyousayit://reset-password#' + fragment())).toBe('/reset-password');
  const captured = takeCapturedRecoveryUrl();
  expect(captured).toContain('access_token=');
  expect(validatedNativeIntentPath('https://evil.example/reset-password')).toBe('/');
});

test('implicit recovery updates password on isolated session then globally signs out', async () => {
  const calls: string[] = [];
  const user = { id: 'fixture-owner', email: 'a@example.invalid', is_anonymous: false, email_confirmed_at: '2026-01-01', recovery_sent_at: new Date(iat * 1000).toISOString() };
  const auth = {
    setSession: async () => { calls.push('set'); return { error: null }; },
    getUser: async () => ({ data: { user }, error: null }),
    refreshSession: async () => ({ data: { session: { access_token: 'fresh' }, user }, error: null }),
    updateUser: async (input: { password: string }) => { calls.push(input.password); return { data: { user }, error: null }; },
    signOut: async (input: { scope: string }) => { calls.push(input.scope); return { error: null }; },
  };
  const flow = createImplicitRecovery(auth);
  const opened = await flow.open(parseCallback('', '#' + fragment(), now));
  expect(opened.email).toBe('a@example.invalid');
  expect(await flow.save('new-password', 'new-password')).toEqual({ state: 'updated' });
  expect(calls).toEqual(['set', 'new-password', 'global', 'local']);
});

test('recovery intent capture is one-shot and ignores forgot-password query', () => {
  noteRecoveryIntent('https://beforeyousayit.app/forgot-password?email=a@example.invalid');
  expect(takeCapturedRecoveryUrl()).toBe(null);
  noteRecoveryIntent('https://beforeyousayit.app/reset-password#' + fragment());
  expect(takeCapturedRecoveryUrl()?.includes('reset-password')).toBe(true);
  expect(takeCapturedRecoveryUrl()).toBe(null);
});
