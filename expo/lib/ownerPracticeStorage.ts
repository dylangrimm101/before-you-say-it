import { serializeStoreOperation, type StoreStorage } from './storePersistence';

export interface OwnerStorageHost extends StoreStorage { getAllKeys(): Promise<readonly string[]> }
const ACTIVE = 'cc.activePracticeSession.v1';
class PrecommitReadFailure extends Error {}
export class DeviceGuestConflict extends Error {}
interface LocalEnvelope {
  localGuestContinuation: 1;
  owner: string;
  /** Immutable original bytes, never authenticated provider/server authority. */
  sourceSnapshot: string | null;
  value: string;
  deviceReceipt?: string;
}
function envelope(raw: string | null, owner: string): LocalEnvelope | null {
  if (!raw) return null;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object' || !('localGuestContinuation' in parsed)) return null;
  if (parsed.localGuestContinuation !== 1 || parsed.owner !== owner || typeof parsed.value !== 'string'
    || (parsed.sourceSnapshot !== null && typeof parsed.sourceSnapshot !== 'string')) throw new Error('Invalid local continuation');
  return parsed;
}
/** Only funnel progress may advance after approval. Every other source field,
 * including unknown provider metadata, must still equal the sealed producer. */
export function sameApprovedSource(sealed: Record<string, unknown>, next: Record<string, unknown> | null): boolean {
  if (!next) return false;
  const mutable = new Set(['updatedAt', 'freeJourneyCheckpoint', 'postRehearsalState']);
  const keys = new Set([...Object.keys(sealed), ...Object.keys(next)]);
  if ([...keys].some(field => !mutable.has(field) && JSON.stringify(next[field]) !== JSON.stringify(sealed[field]))) return false;
  if (next.updatedAt !== undefined && (typeof next.updatedAt !== 'number' || !Number.isFinite(next.updatedAt)
    || (typeof sealed.updatedAt === 'number' && next.updatedAt < sealed.updatedAt))) return false;
  if (next.freeJourneyCheckpoint !== undefined && (typeof next.freeJourneyCheckpoint !== 'string' || !['pressure_moment', 'rewrite', 'practice_shift', 'starting_index', 'complete'].includes(next.freeJourneyCheckpoint))) return false;
  if (next.postRehearsalState !== undefined && (typeof next.postRehearsalState !== 'string' || !['pressure', 'rewrite', 'shift', 'pay1', 'pay2', 'pay3'].includes(next.postRehearsalState))) return false;
  return true;
}
const sourceChanges = new WeakMap<object, (raw: string | null) => void>();
const deviceChanges = new WeakMap<object, (next: string | null, previous: string | null) => Promise<void>>();
const ownerLeases = new Map<string, Set<{invalidate(): void}>>();
export function invalidateOwnerPracticeLeases(owner: string) {
  const leases = ownerLeases.get(owner);
  if (!leases) return;
  for (const lease of [...leases]) lease.invalidate();
  ownerLeases.delete(owner);
}
export function watchDeviceGuestSource(lease: object, callback: (next: string | null, previous: string | null) => Promise<void>) {
  deviceChanges.set(lease, callback);
  return () => { if (deviceChanges.get(lease) === callback) deviceChanges.delete(lease); };
}
const claims = new WeakMap<object, (snapshot: string, valid: () => boolean) => Promise<void>>();
/** Immutable owner namespace. All leases share a host queue. Historical guest
 * bytes are never scanned for capabilities or guessed into another account. */
export function createOwnerPracticeStorage(host: OwnerStorageHost, owner: string) {
  if (!owner) throw new Error('Practice owner required');
  const prefix = `bysi.owner.v1:${encodeURIComponent(owner)}:`;
  let active = true;
  const check = () => { if (!active) throw new Error('Account changed'); };
  const key = (value: string) => {
    if (!value.startsWith('cc.')) throw new Error('Non-practice storage key');
    return prefix + value;
  };
  const run = <T>(operation: () => Promise<T>) => serializeStoreOperation(host, async () => {
    check(); const value = await operation(); check(); return value;
  });
  const lease = {
    owner,
    isActive: () => active,
    invalidate: () => { active = false; },
    getItem: (k: string) => run(async () => {
      const raw = await host.getItem(key(k));
      return k === ACTIVE ? envelope(raw, owner)?.value ?? raw : raw;
    }),
    setItem: (k: string, value: string) => run(async () => {
      const previousRaw = k === ACTIVE ? await host.getItem(key(k)) : null;
      const previous = k === ACTIVE ? envelope(previousRaw, owner) : null;
      if (k === ACTIVE) await deviceChanges.get(lease)?.(value, previous?.value ?? previousRaw);
      check();
      if (k === ACTIVE) sourceChanges.get(lease)?.(value);
      const sameRun = previous && JSON.parse(previous.value).id === JSON.parse(value).id;
      await host.setItem(key(k), sameRun ? JSON.stringify({ ...previous, value }) : value);
    }),
    removeItem: (k: string) => run(async () => {
      if (k === ACTIVE) await deviceChanges.get(lease)?.(null, null);
      if (k === ACTIVE) sourceChanges.get(lease)?.(null);
      return host.removeItem(key(k));
    }),
    getAllKeys: () => run(async () => (await host.getAllKeys()).filter(k => k.startsWith(prefix)).map(k => k.slice(prefix.length))),
    multiRemove: (keys: readonly string[]) => run(async () => { for (const k of keys) { check(); if (k === ACTIVE) await deviceChanges.get(lease)?.(null, null); if (k === ACTIVE) sourceChanges.get(lease)?.(null); await host.removeItem(key(k)); } }),
    localContinuation: () => run(async () => Boolean(envelope(await host.getItem(key(ACTIVE)), owner))),
    deviceReceipt: (receipt: string) => run(async () => {
      const saved = envelope(await host.getItem(key(ACTIVE)), owner);
      return saved?.deviceReceipt === receipt && saved.sourceSnapshot !== null ? saved : null;
    }),
    commitDeviceGuest: (snapshot: string, receipt: string, valid: () => boolean, issue: () => Promise<void>) => run(async () => {
      if (!valid()) throw new Error('Account changed');
      const previous = await host.getItem(key(ACTIVE));
      if (previous !== null) throw new DeviceGuestConflict('Account has practice');
      check();
      await issue(); // durable owner pin / issued marker BEFORE native write
      check();
      if (!valid()) throw new Error('Account changed');
      await host.setItem(key(ACTIVE), JSON.stringify({localGuestContinuation: 1, owner, sourceSnapshot: snapshot, value: snapshot, deviceReceipt: receipt} satisfies LocalEnvelope));
      check();
      if (!valid()) throw new Error('Account changed');
      const saved = envelope(await host.getItem(key(ACTIVE)), owner);
      if (saved?.deviceReceipt !== receipt || saved.sourceSnapshot !== snapshot || saved.value !== snapshot) throw new Error('Continuation commit unverified');
    }),
    // Privacy revocation deletes the immutable backup, never rewrites its content.
    forgetContinuationSnapshot: () => run(async () => {
      await deviceChanges.get(lease)?.(null, null);
      const previous = envelope(await host.getItem(key(ACTIVE)), owner);
      check();
      if (previous) await host.setItem(key(ACTIVE), JSON.stringify({ ...previous, sourceSnapshot: null }));
    }),
  };
  const leases = ownerLeases.get(owner) ?? new Set<{invalidate(): void}>();
  leases.add(lease);
  ownerLeases.set(owner, leases);
  claims.set(lease, (snapshot, valid) => run(async () => {
    if (!valid()) throw new Error('Continuation unavailable');
    let previous: string | null;
    try { previous = await host.getItem(key(ACTIVE)); }
    catch { throw new PrecommitReadFailure('Saved practice could not be read; no write attempted'); }
    if (previous !== null) throw new Error('Account has practice');
    check();
    if (!valid()) throw new Error('Account changed');
    // One key is the commit point: source snapshot, receipt and active value cannot
    // be split by a crash. Never assert rollback of an uncancellable native write.
    await host.setItem(key(ACTIVE), JSON.stringify({ localGuestContinuation: 1, owner, sourceSnapshot: snapshot, value: snapshot } satisfies LocalEnvelope));
    check();
    if (!valid()) throw new Error('Account changed');
    const saved = envelope(await host.getItem(key(ACTIVE)), owner);
    if (saved?.value !== snapshot || saved.sourceSnapshot !== snapshot) throw new Error('Continuation commit unverified');
  }));
  return lease;
}
export type OwnerPracticeStorage = ReturnType<typeof createOwnerPracticeStorage>;

/** Ephemeral same-process manifest. Only the instrumented creation/result path
 * invokes begin/seal. Persisted IDs, Auth restoration and cold-start reads cannot
 * recreate it. This transfers local content, NOT server ownership/paid access. */
export function createCurrentGuestContinuation() {
  type Manifest = { source: OwnerPracticeStorage; id: string; snapshot?: string; consentSnapshot?: string; destination?: OwnerPracticeStorage; consumed: boolean };
  let current: Manifest | null = null;
  return {
    begin(source: OwnerPracticeStorage, id: string) {
      if (!source.isActive() || !id) throw new Error('Guest run unavailable');
      current = { source, id, consumed: false };
    },
    async seal(source: OwnerPracticeStorage, id: string) {
      const manifest = current;
      if (!manifest || manifest.source !== source || manifest.id !== id || manifest.snapshot || manifest.consumed) return;
      const raw = await source.getItem(ACTIVE);
      if (!raw || JSON.parse(raw).id !== id || current !== manifest || !source.isActive()) throw new Error('Guest run changed');
      manifest.snapshot = raw;
      const sealed = JSON.parse(raw);
      sourceChanges.set(source, (nextRaw) => {
        if (current !== manifest || manifest.destination) return;
        const next = nextRaw ? JSON.parse(nextRaw) : null;
        if (!sameApprovedSource(sealed, next)) current = null;
      });
    },
    async prepare(source: OwnerPracticeStorage) {
      const manifest = current;
      if (!manifest?.snapshot || manifest.source !== source || manifest.destination || manifest.consumed) throw new Error("Current rehearsal unavailable");
      const raw = await source.getItem(ACTIVE);
      if (!raw || current !== manifest || !source.isActive() || !sameApprovedSource(JSON.parse(manifest.snapshot), JSON.parse(raw))) {
        current = null;
        throw new Error("Current rehearsal changed");
      }
      manifest.consentSnapshot = raw; // exact checkpoint at the consent-bearing login action
    },
    bind(source: OwnerPracticeStorage, destination: OwnerPracticeStorage) {
      if (!current || current.source !== source || !current.snapshot || current.destination || current.consumed || !destination.isActive()) { current = null; return; }
      current.destination = destination;
    },
    pending(source: OwnerPracticeStorage) {
      return Boolean(current?.source === source && current.snapshot && !current.destination && !current.consumed && source.isActive());
    },
    available(destination: OwnerPracticeStorage) {
      return Boolean(current?.snapshot && current.destination === destination && !current.consumed && destination.isActive());
    },
    invalidate() { current = null; },
    async claim(destination: OwnerPracticeStorage): Promise<string> {
      const manifest = current;
      if (!manifest?.snapshot || manifest.destination !== destination || manifest.consumed || !destination.isActive()) throw new Error('Continuation unavailable');
      manifest.consumed = true; // Synchronous reservation: failure is uncertain, never replayed.
      const snapshot = manifest.consentSnapshot ?? manifest.snapshot;
      try { await claims.get(destination)!(snapshot, () => current === manifest && destination.isActive()); }
      catch (error) {
        if (error instanceof PrecommitReadFailure && current === manifest && destination.isActive()) manifest.consumed = false;
        throw error;
      }
      return snapshot;
    },
  };
}
