import { expect, test } from "bun:test";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { createFreeRoute } from "../../server/server/native-free/routes.mjs";
import { prepareHostedCapture } from "../../server/server/native-free/provenance.mjs";
import { renewalProof } from "../../server/server/native-free/recovery.mjs";
import { fixture as resultFixture, input as generationInput } from "../../server/tests/fixtures/generation-output.mjs";
import { createNormalFreeSession } from "../lib/normalFreeSession";
import { startNormalFreeConversation } from "../lib/normalFreeConversation";

const { PGlite } = createRequire(new URL("../../test-deps/package.json", import.meta.url))("@electric-sql/pglite");

const owner = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const guest = "33333333-3333-4333-8333-333333333333";
const key = "a".repeat(64);
const origin = "https://beforeyousayit.app";
const authOrigin = "https://spvksnddzyvycfoefrcf.supabase.co";
const hex = () => randomBytes(32).toString("hex");
const providerCosts = Object.fromEntries(["pushback", "close", "result", "tts_pushback", "tts_close", "transcribe_opener", "transcribe_reply"].map((kind) => [kind, 1]));

async function setup() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create role bysi_native_service;
    create schema auth;
    create table auth.users(id uuid primary key,email_confirmed_at timestamptz,is_anonymous boolean default false,deleted_at timestamptz);
    create function public.bysi_owner_lifecycle_denied(id uuid) returns boolean language sql security definer set search_path=pg_catalog as $$ select exists(select 1 from auth.users where users.id=$1 and deleted_at is not null) $$;`);
  await db.exec(readFileSync(new URL("../../server/server/native-free/schema.sql", import.meta.url), "utf8"));
  await db.exec(readFileSync(new URL("../../server/server/normal-results/schema.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users(id,email_confirmed_at,is_anonymous) values($1,now(),false),($2,now(),false),($3,null,true)", [owner, other, guest]);
  const rpc = async (id: string, input: Record<string, unknown>) => (await db.query("select public.bysi_native_free($1::uuid,$2::jsonb) value", [id, input])).rows[0].value;
  const route = createFreeRoute({ getRuntime: () => ({
    origin,
    key,
    verifyOwner: async () => owner,
    spendLimitCents: 10000,
    providerCosts,
    rpc: async (id: string, input: Record<string, unknown>) => rpc(id, input),
  }) });
  const data = new Map<string, string>();
  const calls: Array<{ operation: string; body: unknown }> = [];
  const user = { id: owner, is_anonymous: false, email_confirmed_at: "2026-01-01T00:00:00.000Z" };
  const client = createNormalFreeSession({
    origin,
    authUrl: authOrigin,
    auth: {
      getSession: async () => ({ data: { session: { access_token: "synthetic", user } }, error: null }),
      getUser: async () => ({ data: { user }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    } as any,
    storage: { getItem: async (k) => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } },
    random: hex,
    hash: async (value) => createHash("sha256").update(value).digest("hex"),
    fetch: async (url, init) => {
      const operation = String(url).split("/").at(-1)!;
      calls.push({ operation, body: init?.body instanceof FormData ? "form" : JSON.parse(String(init?.body)) });
      return route(operation, new Request(String(url), init));
    },
  });
  return { db, rpc, client, data, calls, close: async () => { client.dispose(); await db.close(); } };
}

function installGenerationProvider() {
  const previous = globalThis.fetch;
  const previousKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "synthetic-provider";
  let providerCalls = 0;
  globalThis.fetch = (async (_url: unknown, init: RequestInit) => {
    providerCalls++;
    const request = JSON.parse(String(init.body));
    const prompt = JSON.parse(request.messages[0].content);
    if (request.max_tokens === 1600) {
      const result = resultFixture();
      result.outputVersion = "bysi-free-rehearsal-result-v1-2026-08-12";
      return Response.json({ id: "msg_result", model: "synthetic", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify(result) }] });
    }
    const close = prompt.turn === "close";
    return Response.json({ id: "msg_turn_" + providerCalls, model: "synthetic", stop_reason: "end_turn", usage: { input_tokens: 1, output_tokens: 1 }, content: [{ type: "text", text: JSON.stringify({
      mode: "turn",
      outputVersion: "bysi-rehearsal-turn-v1-2026-08-12",
      turn: close ? "close" : "pushback",
      role: "hope",
      text: close ? "Which priority should wait?" : "Everything matters.",
      safety: null,
    }) }] });
  }) as typeof fetch;
  return { calls: () => providerCalls, restore: () => { globalThis.fetch = previous; if (previousKey === undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY = previousKey; } };
}

async function pushbackViaNative(client: ReturnType<typeof createNormalFreeSession>) {
  const response = await client.request("generate", {
    type: "rehearsal_turn",
    turn: "pushback",
    contract: generationInput.contract,
    transcript: { user_turn_1: generationInput.transcript.user_turn_1 },
  });
  expect(response.status).toBe(200);
  return response.json();
}

test("R2 native expired return renews before refusal and continues through close and result", async () => {
  const x = await setup();
  const provider = installGenerationProvider();
  try {
    await pushbackViaNative(x.client);
    await x.db.query("update bysi_native_free.session set expires=clock_timestamp()-interval '1 second', state=jsonb_set(state,'{proof,expires}','0'::jsonb) where owner_id=$1", [owner]);

    const recovered = await startNormalFreeConversation(x.client.request);
    expect(recovered.status).toBe("resume");
    expect(recovered.phase).toBe("pushback");
    expect(recovered.checkpoint?.transcript?.counterpart_pushback).toBe("Everything matters.");

    const close = await x.client.request("generate", {
      type: "rehearsal_turn",
      turn: "close",
      contract: recovered.checkpoint!.contract,
      transcript: { ...recovered.checkpoint!.transcript, user_turn_2: generationInput.transcript.user_turn_2 },
    });
    expect(close.status).toBe(200);
    const closeBody = await close.json();
    expect(closeBody.text).toBe("Which priority should wait?");

    const result = await x.client.request("generate", {
      type: "free_rehearsal_result",
      contract: recovered.checkpoint!.contract,
      transcript: { ...recovered.checkpoint!.transcript, user_turn_2: generationInput.transcript.user_turn_2, counterpart_close: closeBody.text },
    });
    expect(result.status).toBe(200);
    expect((await result.json()).mode).toBe("result");
    expect(provider.calls()).toBe(3);
  } finally {
    provider.restore();
    await x.close();
  }
});

test("R1 stale proof renewal cannot overwrite a newer committed phase", async () => {
  const x = await setup();
  const provider = installGenerationProvider();
  try {
    await pushbackViaNative(x.client);
    await x.db.query("update bysi_native_free.session set state=jsonb_set(state,'{proof,expires}','0'::jsonb) where owner_id=$1", [owner]);
    const old = await x.rpc(owner, { action: "inspect" });
    const renewal = renewalProof(old, {}, key);
    expect(renewal).not.toBeNull();
    expect((await x.rpc(owner, { action: "renewProof", sessionId: old.sessionId, generation: old.generation, ...renewal! })).code).toBe("ok");

    const refreshed = await x.rpc(owner, { action: "inspect" });
    const state = refreshed.state;
    await prepareHostedCapture({
      type: "rehearsal_turn",
      turn: "close",
      contract: refreshed.state.checkpoint.contract,
      transcript: { ...refreshed.state.checkpoint.transcript, user_turn_2: generationInput.transcript.user_turn_2 },
    }, state, key).finish({ mode: "turn", text: "Which priority should wait?", role: "hope", turn: "close", outputVersion: "bysi-rehearsal-turn-v1-2026-08-12", safety: null }, {});
    state.audio = { text: "Which priority should wait?", role: "hope", turn: "close" };
    const args = { sessionId: old.sessionId, operationId: hex(), digest: hex(), kind: "close" };
    const reserved = await x.rpc(owner, { ...args, action: "reserve", costCents: 1, spendLimitCents: 10000 });
    expect(reserved.code).toBe("reserved");
    expect((await x.rpc(owner, { ...args, action: "finish", lease: reserved.lease, phase: "close", state, response: { status: 200, type: "application/json", body: "e30=" } })).code).toBe("ok");

    expect((await x.rpc(owner, { action: "renewProof", sessionId: old.sessionId, generation: old.generation, ...renewal! })).code).toBe("conflict");
    const current = await x.rpc(owner, { action: "inspect" });
    expect(current.phase).toBe("close");
    expect(current.state.proof.phase).toBe("approved");
    expect(current.state.checkpoint.revision).toBeGreaterThan(old.state.checkpoint.revision);
  } finally {
    provider.restore();
    await x.close();
  }
});

test("R2 terminal native journal is retired before a new opener dispatch", async () => {
  const x = await setup();
  const provider = installGenerationProvider();
  try {
    await pushbackViaNative(x.client);
    const keyName = "normal-free-v1." + owner;
    const journal = JSON.parse(x.data.get(keyName)!);
    await x.db.query("update bysi_native_free.session set phase='result' where id=$1", [journal.sessionId]);

    const started = await startNormalFreeConversation(x.client.request);
    expect(started.status).toBe("new");
    const response = await x.client.request("generate", {
      type: "rehearsal_turn",
      turn: "pushback",
      contract: generationInput.contract,
      transcript: { user_turn_1: "A new approved opener." },
    });
    expect(response.status).toBe(200);
    expect(JSON.parse(x.data.get(keyName)!).sessionId).not.toBe(journal.sessionId);
  } finally {
    provider.restore();
    await x.close();
  }
});

test("R4 failed voice capacity renews ordinary practice without erasing old spend", async () => {
  const x = await setup();
  const provider = installGenerationProvider();
  try {
    await pushbackViaNative(x.client);
    const keyName = "normal-free-v1." + owner;
    const oldJournal = JSON.parse(x.data.get(keyName)!);
    for (let i = 0; i < 2; i++) {
      const args = { sessionId: oldJournal.sessionId, operationId: hex(), digest: hex(), kind: "tts_pushback" };
      const reserved = await x.rpc(owner, { ...args, action: "reserve", costCents: 1, spendLimitCents: 10000 });
      expect(reserved.code).toBe("reserved");
      expect((await x.rpc(owner, { ...args, action: "fail", lease: reserved.lease })).code).toBe("ok");
    }
    const started = await startNormalFreeConversation(x.client.request);
    expect(started.status).toBe("start");
    expect(started.used).toBe(false);
    const newJournal = JSON.parse(x.data.get(keyName)!);
    expect(newJournal.sessionId).not.toBe(oldJournal.sessionId);
    expect((await x.db.query("select count(*)::int n from bysi_native_free.operation where session_id=$1", [oldJournal.sessionId])).rows[0].n).toBe(3);
    expect((await x.db.query("select coalesce(sum(spent_cents),0)::int n from bysi_native_free.spend_day")).rows[0].n).toBe(3);
  } finally {
    provider.restore();
    await x.close();
  }
});

test("R6 same UUID guest upgrade survives guest expiry purge and stale claim retry", async () => {
  const x = await setup();
  try {
    await x.db.query("update auth.users set is_anonymous=true,email_confirmed_at=null where id=$1", [owner]);
    const issued = await x.rpc(owner, { action: "issue", nonce: hex() });
    await x.db.query("update bysi_native_free.session set phase='close' where id=$1", [issued.sessionId]);
    const args = { sessionId: issued.sessionId, operationId: hex(), digest: hex(), kind: "result" };
    const reserved = await x.rpc(owner, { ...args, action: "reserve", costCents: 1, spendLimitCents: 10000 });
    expect(reserved.code).toBe("reserved");
    expect((await x.rpc(owner, { ...args, action: "finish", lease: reserved.lease, phase: "result", state: { record: { provenance: { generated_at: "2026-01-01T00:00:00.000Z" }, private: "SYNTHETIC" } }, response: { status: 200, type: "application/json", body: "e30=" } })).code).toBe("ok");
    await x.db.query("update auth.users set is_anonymous=false,email_confirmed_at=now() where id=$1", [owner]);

    expect((await x.db.query("select public.bysi_normal_saved_result($1::uuid,$2::uuid) value", [owner, issued.sessionId])).rows[0].value.privateResult.private).toBe("SYNTHETIC");
    await x.db.query("update bysi_native_free.result set guest_expires=clock_timestamp()-interval '1 second' where session_id=$1", [issued.sessionId]);
    expect((await x.db.query("select bysi_native_free.purge_expired() n")).rows[0].n).toBe(0);
    expect((await x.db.query("select public.bysi_normal_saved_result($1::uuid,$2::uuid) value", [owner, issued.sessionId])).rows[0].value.privateResult.private).toBe("SYNTHETIC");
    expect((await x.db.query("select public.bysi_normal_saved_result_claim($1::uuid,$2::uuid,$3::uuid) value", [owner, owner, issued.sessionId])).rows[0].value.code).toBe("invalid");
  } finally {
    await x.close();
  }
});

test("R6 same UUID late upgrade cannot revive expired guest content", async () => {
  const x = await setup();
  try {
    const makeExpiredGuest = async () => {
      await x.db.query("update auth.users set is_anonymous=true,email_confirmed_at=null where id=$1", [owner]);
      const issued = await x.rpc(owner, { action: "issue", nonce: hex() });
      await x.db.query("update bysi_native_free.session set phase='close' where id=$1", [issued.sessionId]);
      const args = { sessionId: issued.sessionId, operationId: hex(), digest: hex(), kind: "result" };
      const reserved = await x.rpc(owner, { ...args, action: "reserve", costCents: 1, spendLimitCents: 10000 });
      expect(reserved.code).toBe("reserved");
      expect((await x.rpc(owner, { ...args, action: "finish", lease: reserved.lease, phase: "result", state: { record: { provenance: { generated_at: "2026-01-01T00:00:00.000Z" }, private: "EXPIRED" } }, response: { status: 200, type: "application/json", body: "e30=" } })).code).toBe("ok");
      await x.db.query("update bysi_native_free.result set guest_expires=clock_timestamp()-interval '1 second' where session_id=$1", [issued.sessionId]);
      await x.db.query("update auth.users set is_anonymous=false,email_confirmed_at=clock_timestamp() where id=$1", [owner]);
      return issued.sessionId;
    };

    const readFirst = await makeExpiredGuest();
    expect((await x.db.query("select public.bysi_normal_saved_result($1::uuid,$2::uuid) value", [owner, readFirst])).rows[0].value).toBeNull();
    expect((await x.db.query("select bysi_native_free.purge_expired() n")).rows[0].n).toBeGreaterThan(0);
    expect((await x.db.query("select record from bysi_native_free.result where session_id=$1", [readFirst])).rows[0].record).toBeNull();

    const purgeFirst = await makeExpiredGuest();
    expect((await x.db.query("select bysi_native_free.purge_expired() n")).rows[0].n).toBeGreaterThan(0);
    expect((await x.db.query("select public.bysi_normal_saved_result($1::uuid,$2::uuid) value", [owner, purgeFirst])).rows[0].value).toBeNull();
    expect((await x.db.query("select record from bysi_native_free.result where session_id=$1", [purgeFirst])).rows[0].record).toBeNull();
  } finally {
    await x.close();
  }
});

test("R5 and R8 owner erasure and pending delete-one suppress late private writes while preserving foreign rows", async () => {
  const x = await setup();
  try {
    const pending = await x.rpc(owner, { action: "issue", nonce: hex() });
    await x.db.query("update bysi_native_free.session set phase='close', state=$2::jsonb where id=$1", [pending.sessionId, { checkpoint: { transcript: { user_turn_1: "private" } }, audio: { text: "private", role: "hope", turn: "close" } }]);
    const args = { sessionId: pending.sessionId, operationId: hex(), digest: hex(), kind: "result" };
    const reserved = await x.rpc(owner, { ...args, action: "reserve", costCents: 1, spendLimitCents: 10000 });
    expect(reserved.code).toBe("reserved");
    expect((await x.db.query("select public.bysi_normal_saved_result_delete($1::uuid,$2::uuid) ok", [owner, pending.sessionId])).rows[0].ok).toBe(true);
    expect((await x.rpc(owner, { ...args, action: "finish", lease: reserved.lease, phase: "result", state: { record: { private: "LATE" } }, response: { body: "LATE" } })).code).toBe("unauthorized");

    const foreign = await x.rpc(other, { action: "issue", nonce: hex() });
    await x.db.query("insert into bysi_native_free.result(owner_id,session_id,record) values($1,$2,$3::jsonb)", [other, foreign.sessionId, { private: "FOREIGN", provenance: { generated_at: "2026-01-01T00:00:00.000Z" } }]);
    const ownedSaved = (await x.db.query("insert into bysi_native_free.session(owner_id,nonce,phase) values($1,$2,'result') returning id", [owner, hex()])).rows[0].id;
    await x.db.query("insert into bysi_native_free.result(owner_id,session_id,record) values($1,$2,$3::jsonb)", [owner, ownedSaved, { private: "OWNED", provenance: { generated_at: "2026-01-01T00:00:00.000Z" } }]);
    const erased = (await x.db.query("select public.bysi_normal_owner_private_erasure($1::uuid) value", [owner])).rows[0].value;
    expect(erased.code).toBe("ok");
    expect((await x.db.query("select count(*)::int n from bysi_native_free.result where owner_id=$1 and record is not null", [owner])).rows[0].n).toBe(0);
    expect((await x.db.query("select record->>'private' private from bysi_native_free.result where owner_id=$1", [other])).rows[0].private).toBe("FOREIGN");
    expect((await x.db.query("select public.bysi_normal_saved_result_claim($1::uuid,$2::uuid,$3::uuid) value", [owner, other, pending.sessionId])).rows[0].value.code).toBe("not_found");
  } finally {
    await x.close();
  }
});

test("R8 unfinished delete retires the tombstoned session and permits ordinary new practice", async () => {
  const x = await setup();
  const provider = installGenerationProvider();
  try {
    await pushbackViaNative(x.client);
    const keyName = "normal-free-v1." + owner;
    const oldJournal = JSON.parse(x.data.get(keyName)!);

    expect((await x.db.query("select public.bysi_normal_saved_result_delete($1::uuid,$2::uuid) ok", [owner, oldJournal.sessionId])).rows[0].ok).toBe(true);
    const started = await startNormalFreeConversation(x.client.request);
    expect(started.status).toBe("new");

    const response = await x.client.request("generate", {
      type: "rehearsal_turn",
      turn: "pushback",
      contract: generationInput.contract,
      transcript: { user_turn_1: "A new approved opener." },
    });
    expect(response.status).toBe(200);
    const newJournal = JSON.parse(x.data.get(keyName)!);
    expect(newJournal.sessionId).not.toBe(oldJournal.sessionId);
  } finally {
    provider.restore();
    await x.close();
  }
});

test("R7 result history paginates beyond twenty and delete-all accepts counts above one hundred", async () => {
  const x = await setup();
  try {
    await x.db.query(`with s as (
      insert into bysi_native_free.session(owner_id,nonce,phase)
      select $1,$2,'result' from generate_series(1,121) returning id
    ), o as (
      insert into bysi_native_free.operation(session_id,id,kind,digest,status)
      select id, lpad((row_number() over ())::text,64,'a'), 'result', $2, 'complete' from s
    )
    insert into bysi_native_free.result(owner_id,session_id,record,captured_at)
    select $1,id,jsonb_build_object('private',id::text,'provenance',jsonb_build_object('generated_at',(clock_timestamp()-(row_number() over ()||' seconds')::interval)::text)),clock_timestamp()-(row_number() over ()||' seconds')::interval from s`, [owner, "a".repeat(64)]);
    const first = (await x.db.query("select public.bysi_normal_saved_results($1::uuid,$2::int,$3::text) value", [owner, 20, null])).rows[0].value;
    expect(first.items.length).toBe(20);
    expect(first.nextCursor).toBeString();
    const second = (await x.db.query("select public.bysi_normal_saved_results($1::uuid,$2::int,$3::text) value", [owner, 20, first.nextCursor])).rows[0].value;
    expect(second.items.length).toBe(20);
    expect(new Set([...first.items, ...second.items].map((row: any) => row.sessionId)).size).toBe(40);
    expect((await x.db.query("select public.bysi_normal_saved_result_delete_all($1::uuid) n", [owner])).rows[0].n).toBe(121);
  } finally {
    await x.close();
  }
});
