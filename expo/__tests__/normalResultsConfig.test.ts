import {test,expect} from 'bun:test';
import {readFileSync} from 'node:fs';
import {APPROVED_CLIENT_PUBLIC_NAMES} from '../lib/clientEnvGuard';
test('prospective normal result switch survives both exact client guards',()=>{
 expect(APPROVED_CLIENT_PUBLIC_NAMES.has('EXPO_PUBLIC_NATIVE_RESULTS')).toBe(true);
 expect(readFileSync(new URL('../scripts/client-env-preflight.cjs',import.meta.url),'utf8')).toContain('"EXPO_PUBLIC_NATIVE_RESULTS"');
});
