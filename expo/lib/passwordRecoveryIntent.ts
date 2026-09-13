const RESET_PATH = '/reset-password';
const WEB_HOSTS = new Set(['beforeyousayit.app', 'www.beforeyousayit.app']);
const APP_SCHEMES = new Set(['beforeyousayit:', 'bysi:']);
let captured: string | null = null;

function asUrl(input: string): URL | null {
  try {
    if (input.startsWith('/')) return new URL(input, 'https://beforeyousayit.app');
    return new URL(input);
  } catch {
    return null;
  }
}

function recoveryPathname(url: URL): string {
  if (url.protocol === 'https:' && WEB_HOSTS.has(url.hostname.toLowerCase())) {
    return decodeURIComponent(url.pathname).replace(/\/+$/u, '') || '/';
  }
  if (APP_SCHEMES.has(url.protocol)) {
    const hostSegment = url.hostname ? `/${url.hostname}` : '';
    return decodeURIComponent(`${hostSegment}${url.pathname}`).replace(/\/+$/u, '') || '/';
  }
  if (url.pathname) return decodeURIComponent(url.pathname).replace(/\/+$/u, '') || '/';
  return '/';
}

/** Keep recovery credentials out of the router path. Capture them once, then strip. */
export function noteRecoveryIntent(input: string): void {
  const url = asUrl(input.trim());
  if (!url) return;
  let pathname: string;
  try {
    pathname = recoveryPathname(url);
  } catch {
    return;
  }
  if (pathname !== RESET_PATH) return;
  if (!url.search && !url.hash) return;
  captured = url.toString();
}

export function takeCapturedRecoveryUrl(): string | null {
  const value = captured;
  captured = null;
  return value;
}

export function callbackPartsFromUrl(input: string): {search: string; hash: string} | null {
  const url = asUrl(input.trim());
  if (!url) return null;
  return {search: url.search, hash: url.hash};
}
