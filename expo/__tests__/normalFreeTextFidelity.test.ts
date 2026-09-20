import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {nativeResponseText} from '../lib/nativeResponseText';

test('native UTF-8 decoder preserves Unicode and rejects malformed bytes',()=>{
  for(const text of ['', 'ASCII', 'I’ve helped—too.', 'Café ☕ 中文 👋', '\uFEFFboundary']){
    expect(nativeResponseText(new TextEncoder().encode(text).buffer)).toBe(text);
  }
  for(const bytes of [[0xc0,0xaf],[0xe2,0x80],[0xed,0xa0,0x80],[0xff]]){
    expect(()=>nativeResponseText(new Uint8Array(bytes).buffer)).toThrow('Invalid UTF-8');
  }
});

for (const variant of ['quoted', 'whitespace', 'native-utf8']) test(`native free text fidelity: ${variant} (client invariant, not deployed output evidence)`, () => {
  const result = spawnSync(process.execPath, ['--no-env-file', `${import.meta.dir}/normalFreeTextFidelity.fixture.ts`, variant], {
    env: process.env, encoding: 'utf8', timeout: 30_000,
  });
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 35_000);
