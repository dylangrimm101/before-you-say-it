import { mock } from 'bun:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { createNormalFreeSession } from '../lib/normalFreeSession';
import { speechTextFor } from '../lib/rehearsal';
import { normalFreeRecoveryTranscript } from '../lib/normalFreeRecoveryPayload';
import type { Scenario, Turn } from '../types/convo';

process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN = 'https://beforeyousayit.app';
delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
// Quotes survive the pinned server normalizer and quality gate. Display formatting
// strips them, but the server's audio authorization and exchange proof do not.
const whitespace = process.argv[2] === 'whitespace';
const nativeUtf8 = process.argv[2] === 'native-utf8';
const WireResponse = Response;
// Use the locked React Native fetch implementation, not Bun's UTF-8-aware
// Response, at the client reconstruction boundary. Network bytes stay synthetic.
if (nativeUtf8) globalThis.Response = require('whatwg-fetch').Response;
const received=(response:Response):Response=>nativeUtf8?{
  status:response.status,ok:response.ok,redirected:false,
  headers:new (require('whatwg-fetch').Headers)(Array.from(response.headers.entries())),
  arrayBuffer:()=>response.arrayBuffer(),
} as Response:response;
// This extra variant tests the client's exact-text invariant at its response
// boundary. The pinned producer normalizes whitespace; no deployed output claim.
const approved = nativeUtf8 ? '"I’m already helping—let’s agree on a task."' : whitespace ? '  The client added those.\nEveryone\tis stretched right now.  ' : '"The client added those. Everyone is stretched right now."';
const close = nativeUtf8 ? '"It goes both ways—I’ve helped too. Café ☕."' : whitespace ? '\tThe client  still expects the original deadline.\n' : '"The client still expects the original deadline."';
const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true };
const auth = { getSession: async () => ({ data: { session: { access_token: 'synthetic', user } }, error: null }),
  getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) };
const storage = new Map<string, string>();
const sent: { operation: string; body: any }[] = [];
let audio = { text: approved, role: 'hope', turn: 'pushback' };
const client = createNormalFreeSession({ auth, origin: process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN,
  authUrl: 'https://spvksnddzyvycfoefrcf.supabase.co', random: () => randomBytes(32).toString('hex'), hash: async s => createHash('sha256').update(s).digest('hex'),
  storage: { getItem: async k => storage.get(k) ?? null, setItem: async (k, v) => { storage.set(k, v); } },
  fetch: async (url, init) => {
    const operation = url.split('/').at(-1)!;
    const body = JSON.parse(String(init.body));
    sent.push({ operation, body });
    if (operation === 'session') return received(WireResponse.json({ sessionId: user.id, generation: 0, phase: 'start' }));
    if (operation === 'generate') {
      if (body.type === 'free_rehearsal_result') return received(WireResponse.json({ code: 'failed' }, { status: 503 }));
      audio = { text: body.turn === 'close' ? close : approved, role: 'hope', turn: body.turn };
      return received(WireResponse.json({ mode: 'turn', ...audio }));
    }
    assert.equal(operation, 'tts');
    assert.deepEqual(body, audio, 'Pinned backend contract: exact text, role and turn');
    return received(new WireResponse(Uint8Array.from([73, 68, 51, 4, 0, 255]), { headers: { 'content-type': 'audio/mpeg' } }));
  },
});
let plays = 0;
mock.module('react-native', () => ({ Platform: { OS: 'ios' } }));
mock.module('../lib/supabase', () => ({ supabase: { auth }, authEnvironment: { url: 'https://spvksnddzyvycfoefrcf.supabase.co' } }));
mock.module('../lib/normalFreeRuntime', () => ({ requestNormalFree: client.request }));
mock.module('expo-crypto',()=>({getRandomBytes:randomBytes}));
const {guestVisit}=await import('../lib/guestVisitRuntime');
guestVisit.activate(user.id);
mock.module('expo-file-system/legacy', () => ({ cacheDirectory: 'file:///synthetic/', EncodingType: { Base64: 'base64' }, makeDirectoryAsync: async () => {}, writeAsStringAsync: async () => {}, getInfoAsync: async () => ({ exists: false }), deleteAsync: async () => {}, readDirectoryAsync: async () => [] }));
mock.module('expo-audio', () => ({ setAudioModeAsync: async () => {}, createAudioPlayer: () => ({ isLoaded: true, currentStatus: { isLoaded: true }, volume: 1, muted: false, addListener: () => ({ remove() {} }), play() { plays++; }, pause() {}, remove() {} }) }));
const { nextCounterpartTurn, generateDebrief } = await import('../lib/ai');
const { speak, resetSpeech } = await import('../lib/voice');
const scenario: Scenario = { id: 'fixture', category: 'work', title: 'Priorities', counterpart: 'Hope', situation: 'The client added a deadline.', persona: 'woman-hope', goal: 'Agree on priorities', opensWith: 'user', openingLine: '', minutes: 5 };
const turns: Turn[] = [{ id: 'u1', role: 'user', text: 'Can we agree on one priority?' }];
const first = await nextCounterpartTurn(scenario, 'steady', turns);
assert.equal(first.reply, approved);
assert.notEqual(speechTextFor(first.reply, 'Hope'), approved, 'Exercise the original display-formatting mismatch');
let dispatches = sent.length;
await assert.rejects(client.request('tts', { text: speechTextFor(first.reply, 'Hope'), role: 'hope' }), /Only approved/);
await assert.rejects(client.request('tts', { text: approved, role: 'adam' }), /Only approved/);
assert.equal(sent.length, dispatches, 'Altered text and wrong role must fail before dispatch');
assert.equal(await speak(first.reply, 'woman-hope'), 'played');
await resetSpeech();
turns.push({ id: 'h1', role: 'them', text: first.reply }, { id: 'u2', role: 'user', text: 'Which task can wait until Friday?' });
const second = await nextCounterpartTurn(scenario, 'steady', turns);
const closeRequest = sent.filter(s => s.operation === 'generate').at(-1)!.body;
assert.equal(closeRequest.transcript.counterpart_pushback, approved, 'Close proof must retain the approved pushback');
assert.equal(second.reply, close);
assert.equal(await speak(second.reply, 'woman-hope'), 'played');
await resetSpeech();
turns.push({ id: 'h2', role: 'them', text: second.reply });
const recovered = normalFreeRecoveryTranscript(turns, scenario);
assert.equal(recovered.counterpart_pushback, approved);
assert.equal(recovered.counterpart_close, close);
await assert.rejects(generateDebrief(scenario, 'steady', turns));
const resultRequest = sent.filter(s => s.operation === 'generate').at(-1)!.body;
assert.deepEqual(resultRequest.transcript, recovered, 'Result and recovery must use the same exact approved exchange');
dispatches = sent.length;
await assert.rejects(client.request('tts', { text: approved, role: 'hope' }), /Only approved/);
assert.equal(sent.length, dispatches, 'An earlier turn cannot replace the latest authorized audio');
assert.equal(plays, 2);
client.dispose();
console.log('PASS exact pushback/close TTS, wrong-text/role/stale-turn rejection, exact result and recovery payloads. Modeled backend and native player only.');
