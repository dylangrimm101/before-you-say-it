import {test,expect} from 'bun:test';
import {speechBytesToBase64} from '../lib/nativeSpeechBytes';
import {spawnSync} from 'node:child_process';
test('native speech encoding preserves every byte and padding without Blob or Buffer in production',()=>{
 for(const length of [1,2,3,4,255,256,257,16383,16384,16385,2*1024*1024]){
  const bytes=Uint8Array.from({length},(_,i)=>(i*137+19)%256);
  expect(speechBytesToBase64(bytes)).toBe(Buffer.from(bytes).toString('base64'));
 }
 expect(()=>speechBytesToBase64(new Uint8Array())).toThrow('empty');
 expect(()=>speechBytesToBase64(new Uint8Array(2*1024*1024+1))).toThrow('too large');
});
test('mounted native speech preserves audio into owner cache and reaches the player',()=>{
 const r=spawnSync(process.execPath,['__tests__/nativeSpeechBytes.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8'});
 expect(r.status,r.stdout+r.stderr).toBe(0);
});
