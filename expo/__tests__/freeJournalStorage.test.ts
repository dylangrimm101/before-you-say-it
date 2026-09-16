import {test,expect} from 'bun:test';import {randomBytes} from 'node:crypto';
import {encodeFreeJournal,decodeFreeJournal} from '../lib/freeJournalStorage';
test('two cumulative generations retain all operation identities in one bounded SecureStore value',()=>{
 const hex=()=>randomBytes(32).toString('hex');const operations:any={};
 for(const generation of [0,1])for(const kind of ['pushback','close','result','tts_pushback','tts_close','transcribe_opener','transcribe_reply'])operations[(generation?generation+':':'')+kind]={id:hex(),digest:hex()};
 const raw=JSON.stringify({nonce:hex(),sessionId:'11111111-1111-4111-8111-111111111111',generation:1,restart:{id:hex(),generation:0},operations,audio:{digest:hex(),turn:'close',role:'hope'}});
 expect(raw.length).toBeGreaterThan(2048);const encoded=encodeFreeJournal(raw);expect(encoded.length).toBeLessThanOrEqual(2048);expect(decodeFreeJournal(encoded)).toBe(raw);
 expect(decodeFreeJournal('{"legacy":true}')).toBe('{"legacy":true}');expect(()=>decodeFreeJournal('deflate-v1.!!!')).toThrow();
});
