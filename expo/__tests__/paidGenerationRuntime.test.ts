import {expect,test} from 'bun:test';
import {readFileSync} from 'node:fs';

const read=(p:string)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('TestFlight paid generate uses native billing origin, not anonymous or staging fallback',()=>{
 const runtime=read('lib/paidGenerationRuntime.ts');
 const billing=read('lib/nativeBilling.ts');
 const voice=read('lib/paidVoiceRuntime.ts');
 expect(runtime).toContain("nativeBilling.request('generate'");
 expect(runtime).toContain("throw Error('Isolated paid generation is not configured')");
 expect(billing).toContain("https://beforeyousayit.app");
 expect(billing).toContain("/api/native/");
 expect(billing).toContain("'generate'");
 expect(voice).toContain("nativeBilling.request(operation");
 expect(read('lib/ai.ts')).toContain('requestPaidBysiGeneration(payload)');
 expect(read('eas.json')).not.toContain('EXPO_PUBLIC_GENERATE_ENDPOINT');
 expect(JSON.parse(read('eas.json')).build.testflight.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN).toBe('https://beforeyousayit.app');
});
