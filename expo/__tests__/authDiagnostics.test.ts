import {test, expect} from 'bun:test';
import {authDiagnostic, routeDiagnostic} from '../lib/authDiagnostics';
test('diagnostics reject arbitrary content and redact unknown routes', () => {
  const saved = console.warn; const lines: string[] = [];
  console.warn = (line: string) => { lines.push(line); };
  try {
    authDiagnostic('login-start');
    authDiagnostic('private-token' as never);
    routeDiagnostic('/private-email?token=secret', true, false);
    expect(lines).toEqual(['[BYSI_AUTH_V1] login-start', '[BYSI_ROUTE_V1] route=other account=true loading=false']);
    console.warn = () => { throw new Error('console unavailable'); };
    expect(() => authDiagnostic('login-finished')).not.toThrow();
    expect(() => routeDiagnostic('entry', false, false)).not.toThrow();
  } finally { console.warn = saved; }
});
