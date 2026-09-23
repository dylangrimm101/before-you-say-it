import { expect, test } from 'bun:test';
import { createHash, randomBytes } from 'node:crypto';
import { createNormalFreeSession } from '../lib/normalFreeSession';

const user = { id: '11111111-1111-4111-8111-111111111111', is_anonymous: true };
function fixture(dispatch: (operation: string, init: RequestInit) => Promise<Response>) {
  const data = new Map<string, string>();
  let issues = 0;
  const client = createNormalFreeSession({ origin: 'https://beforeyousayit.app', authUrl: 'https://spvksnddzyvycfoefrcf.supabase.co',
    auth: { getSession: async () => ({ data: { session: { access_token: 'synthetic', user } }, error: null }), getUser: async () => ({ data: { user }, error: null }), onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) },
    random: () => randomBytes(32).toString('hex'), hash: async s => createHash('sha256').update(s).digest('hex'),
    storage: { getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } },
    fetch: async (url, init) => {
      const journal = JSON.parse(data.get('normal-free-v1.' + user.id)!);
      if (url.endsWith('/session')) {
        issues++;
        expect(journal.nonce).toMatch(/^[a-f0-9]{64}$/);
        return Response.json({ sessionId: user.id, generation: 0, phase: 'start' });
      }
      expect(journal.sessionId).toBe(user.id);
      const operationId = (init.headers as Record<string, string>)['x-bysi-operation'];
      expect(Object.values(journal.operations).some((op: any) => op.id === operationId)).toBe(true);
      return dispatch(url.split('/').at(-1)!, init);
    },
  });
  return { client, issues: () => issues };
}

test('lost transcription response reuses the same capture operation; a new capture gets a new operation', async () => {
  const ids: string[] = [];
  const { client, issues } = fixture(async (op, init) => {
    expect(op).toBe('transcribe');
    ids.push((init.headers as Record<string, string>)['x-bysi-operation']);
    if (ids.length === 1) throw Error('Synthetic lost response');
    return Response.json({ text: 'Synthetic recognized words.' });
  });
  try {
    const capture = { turn: 'opener' as const, identity: 'file:///capture-one.m4a' };
    await expect(client.request('transcribe', new FormData(), undefined, capture)).rejects.toThrow('lost response');
    expect((await client.request('transcribe', new FormData(), undefined, capture)).ok).toBe(true);
    expect((await client.request('transcribe', new FormData(), undefined, { ...capture, identity: 'file:///capture-two.m4a' })).ok).toBe(true);
    expect(issues()).toBe(1);
    expect(ids[0]).toBe(ids[1]);
    expect(ids[2]).not.toBe(ids[1]);
  } finally { client.dispose(); }
});

test('an explicit failed operation is not reused as though it were a replayable response', async () => {
  const ids: string[] = [];
  const { client } = fixture(async (_op, init) => {
    ids.push((init.headers as Record<string, string>)['x-bysi-operation']);
    return ids.length === 1 ? Response.json({ code: 'failed' }, { status: 503 }) : Response.json({ text: 'Synthetic words.' });
  });
  try {
    const capture = { turn: 'reply' as const, identity: 'file:///capture.m4a' };
    expect((await client.request('transcribe', new FormData(), undefined, capture)).status).toBe(503);
    expect((await client.request('transcribe', new FormData(), undefined, capture)).ok).toBe(true);
    expect(ids[0]).not.toBe(ids[1]);
  } finally { client.dispose(); }
});

test('session issuance and journal writes precede dispatch; transcription, generation and TTS stay serialized', async () => {
  const order: string[] = [];
  let release!: () => void;
  let started!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const entered = new Promise<void>(resolve => { started = resolve; });
  const text = '"Everyone is stretched right now."';
  const { client, issues } = fixture(async op => {
    order.push(op);
    if (op === 'transcribe') { started(); await waiting; return Response.json({ text: 'Synthetic words.' }); }
    if (op === 'generate') return Response.json({ mode: 'turn', turn: 'pushback', role: 'hope', text });
    return new Response(Uint8Array.from([73, 68, 51]));
  });
  try {
    const transcribe = client.request('transcribe', new FormData(), undefined, { turn: 'opener', identity: 'file:///capture.m4a' });
    const generate = client.request('generate', { type: 'rehearsal_turn', turn: 'pushback', contract: {}, transcript: { user_turn_1: 'Synthetic words.' } });
    const tts = client.request('tts', { role: 'hope', text });
    await entered;
    expect(order).toEqual(['transcribe']);
    release();
    expect((await Promise.all([transcribe, generate, tts])).every(r => r.ok)).toBe(true);
    expect(issues()).toBe(1);
    expect(order).toEqual(['transcribe', 'generate', 'tts']);
  } finally { release(); client.dispose(); }
});
