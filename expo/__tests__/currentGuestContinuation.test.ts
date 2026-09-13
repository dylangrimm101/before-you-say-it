import { test, expect } from 'bun:test';
import * as boundary from '../lib/ownerPracticeStorage';

const slot = 'cc.activePracticeSession.v1';
function fixture() {
  const disk = new Map<string, string>();
  const host = { getItem: async (k: string) => disk.get(k) ?? null, setItem: async (k: string, v: string) => { disk.set(k, v); }, removeItem: async (k: string) => { disk.delete(k); }, getAllKeys: async () => [...disk.keys()] };
  return { disk, host };
}
test('ordinary malformed active bytes still reach the existing hydration validator', async () => {
  const {host,disk}=fixture();
  const owner=boundary.createOwnerPracticeStorage(host,'A');
  disk.set('bysi.owner.v1:A:'+slot,'not-json');
  expect(await owner.getItem(slot)).toBe('not-json');
});
test('deleting a sealed guest run revokes eligibility rather than resurrecting deleted private content', async () => {
  const {host} = fixture();
  const guest = boundary.createOwnerPracticeStorage(host, 'guest');
  const owner = boundary.createOwnerPracticeStorage(host, 'A');
  const transfer = boundary.createCurrentGuestContinuation();
  transfer.begin(guest, 'run');
  await guest.setItem(slot, JSON.stringify({id:'run', sharedResult:{overall:null}}));
  await transfer.seal(guest, 'run');
  await guest.removeItem(slot);
  transfer.bind(guest, owner);
  expect(transfer.available(owner)).toBe(false);
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(await owner.getItem(slot)).toBe(null);
});
test('new current-run manifest transfers the exact sealed local snapshot once to its bound lease', async () => {
  expect(typeof boundary.createCurrentGuestContinuation).toBe('function');
  const { host } = fixture();
  const guest = boundary.createOwnerPracticeStorage(host, 'guest');
  const owner = boundary.createOwnerPracticeStorage(host, 'verified-A');
  const transfer = boundary.createCurrentGuestContinuation();
  const raw = JSON.stringify({ id: 'new-run', sharedResult: { overall: null, score: 12.75, provider: { id: 'exact-provider' } }, attemptOne: { transcript: 'exact approved' } });
  transfer.begin(guest, 'new-run');
  await guest.setItem(slot, raw);
  await transfer.seal(guest, 'new-run');
  transfer.bind(guest, owner);
  expect(transfer.available(owner)).toBe(true);
  const claimed = await transfer.claim(owner);
  expect(claimed).toBe(raw);
  expect(await owner.getItem(slot)).toBe(raw);
  expect(await guest.getItem(slot)).toBe(raw);
  expect(transfer.available(owner)).toBe(false);
  await expect(transfer.claim(owner)).rejects.toThrow();
});

async function sealed() {
  const f = fixture();
  const guest = boundary.createOwnerPracticeStorage(f.host, 'guest');
  const owner = boundary.createOwnerPracticeStorage(f.host, 'A');
  const other = boundary.createOwnerPracticeStorage(f.host, 'B');
  const transfer = boundary.createCurrentGuestContinuation();
  const snapshot = JSON.stringify({id:'run', sharedResult:{overall:null,score:12.75}, attemptOne:{id:'attempt', transcript:'unchanged'}});
  transfer.begin(guest, 'run'); await guest.setItem(slot, snapshot); await transfer.seal(guest, 'run');
  return {...f, guest, owner, other, transfer, snapshot};
}
test('wrong destination does not consume the correctly bound claim', async () => {
  const {transfer,guest,owner,other,snapshot}=await sealed();
  transfer.bind(guest,owner);
  await expect(transfer.claim(other)).rejects.toThrow();
  expect(await other.getItem(slot)).toBe(null);
  expect(await transfer.claim(owner)).toBe(snapshot);
});
test('simultaneous claims reserve once and commit receipt/source/active in one key', async () => {
  const {transfer,guest,owner,disk,snapshot}=await sealed();
  transfer.bind(guest,owner);
  const results=await Promise.allSettled([transfer.claim(owner),transfer.claim(owner)]);
  expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected']);
  const destination=[...disk].filter(([k])=>k.includes(':A:'));
  expect(destination.length).toBe(1);
  const committed=JSON.parse(destination[0][1]);
  expect(committed.value).toBe(snapshot);expect(committed.sourceSnapshot).toBe(snapshot);
});
test('an existing durable account slot refuses without changing either source or destination', async () => {
  const {transfer,guest,owner,snapshot}=await sealed();
  await owner.setItem(slot,JSON.stringify({id:'account-run'})); transfer.bind(guest,owner);
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(await owner.getItem(slot)).toBe(JSON.stringify({id:'account-run'}));
  expect(await guest.getItem(slot)).toBe(snapshot);
  expect(transfer.available(owner)).toBe(false);
});
test('consent readback rejects bypassed source edits instead of blessing them with an earlier approval', async () => {
  const {transfer,guest,host}=await sealed();
  await host.setItem('bysi.owner.v1:guest:'+slot,JSON.stringify({id:'run',sharedResult:{overall:99},attemptOne:{transcript:'forged'}}));
  await expect(transfer.prepare(guest)).rejects.toThrow();
});
test('consent readback rejects non-string checkpoints rather than coercing an array', async () => {
  const {transfer,guest,host,snapshot}=await sealed();
  await host.setItem('bysi.owner.v1:guest:'+slot,JSON.stringify({...JSON.parse(snapshot),freeJourneyCheckpoint:['complete']}));
  await expect(transfer.prepare(guest)).rejects.toThrow();
});
test('process reconstruction and saved IDs cannot mint eligibility', async () => {
  const {guest,owner}=await sealed();
  const restored=boundary.createCurrentGuestContinuation();
  await restored.seal(guest,'run'); restored.bind(guest,owner);
  expect(restored.available(owner)).toBe(false);
  await expect(restored.claim(owner)).rejects.toThrow();
});
test('new guest creation supersedes an older manifest', async () => {
  const {transfer,guest,owner}=await sealed();
  transfer.begin(guest,'new-run'); transfer.bind(guest,owner);
  expect(transfer.available(owner)).toBe(false);
});
test('source result mutation invalidates eligibility; checkpoint-only writes preserve the sealed original', async () => {
  const {transfer,guest,owner,snapshot}=await sealed();
  await guest.setItem(slot,JSON.stringify({...JSON.parse(snapshot),postRehearsalState:'pay1'}));
  expect(transfer.pending(guest)).toBe(true);
  await guest.setItem(slot,JSON.stringify({...JSON.parse(snapshot),sharedResult:{overall:99}}));
  transfer.bind(guest,owner); expect(transfer.available(owner)).toBe(false);
});
test('revoked destination and invalidated controller reject queued stale claims', async () => {
  const {transfer,guest,owner,other}=await sealed();
  transfer.bind(guest,owner);const claim=transfer.claim(owner);
  owner.invalidate();transfer.invalidate();
  await expect(claim).rejects.toThrow();
  expect(await other.getItem(slot)).toBe(null);
});
test('future owner writes cannot mutate the receipt snapshot and privacy deletion removes the backup', async () => {
  const {transfer,guest,owner,disk,snapshot}=await sealed();
  transfer.bind(guest,owner);await transfer.claim(owner);
  await owner.setItem(slot,JSON.stringify({...JSON.parse(snapshot),updatedAt:3}));
  const physical=()=>JSON.parse([...disk].find(([k])=>k.includes(':A:'))![1]);
  expect(physical().sourceSnapshot).toBe(snapshot);
  await owner.forgetContinuationSnapshot();expect(physical().sourceSnapshot).toBe(null);
  await owner.removeItem(slot);expect(await owner.getItem(slot)).toBe(null);
  await expect(transfer.claim(owner)).rejects.toThrow();
});
test('a replacement run cannot inherit the previous continuation receipt or source claim', async () => {
  const {transfer,guest,owner}=await sealed();
  transfer.bind(guest,owner);await transfer.claim(owner);
  await owner.setItem(slot,JSON.stringify({id:'different-run'}));
  expect(await owner.localContinuation()).toBe(false);
});
test('uncertain disk failure consumes capability, never retries or publishes success', async () => {
  const {transfer,guest,owner,host,snapshot}=await sealed();
  transfer.bind(guest,owner);const original=host.setItem;
  host.setItem=async(k,v)=>{await original(k,v);throw Error('synthetic lost acknowledgement');};
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(transfer.available(owner)).toBe(false);
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(await owner.getItem(slot)).toBe(snapshot,'original-owner committed content, not claimed rollback');
});
test('a read failure before the commit permits same-owner retry without replaying a write', async () => {
  const {transfer,guest,owner,host,snapshot}=await sealed();
  transfer.bind(guest,owner);const original=host.getItem;
  let fail=true;
  host.getItem=async(k)=>{if(fail&&k.includes(':A:')){fail=false;throw Error('synthetic temporary read failure');}return original(k);};
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(transfer.available(owner)).toBe(true);
  expect(await transfer.claim(owner)).toBe(snapshot);
});
test('identity change during uncancellable disk write rejects publication; only pinned owner can cold-read', async () => {
  const {transfer,guest,owner,other,host,snapshot}=await sealed();
  transfer.bind(guest,owner);const original=host.setItem;
  host.setItem=async(k,v)=>{owner.invalidate();transfer.invalidate();await original(k,v);};
  await expect(transfer.claim(owner)).rejects.toThrow();
  expect(await other.getItem(slot)).toBe(null);
  const cold=boundary.createOwnerPracticeStorage(host,'A');
  expect(await cold.getItem(slot)).toBe(snapshot);
  expect(transfer.available(cold)).toBe(false);
});
