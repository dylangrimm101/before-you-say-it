import {DeviceGuestConflict, sameApprovedSource, watchDeviceGuestSource, type OwnerPracticeStorage, type OwnerStorageHost} from './ownerPracticeStorage';
import type {AsyncKeyValueStore} from './secureSessionStorage';

const SLOT = 'cc.activePracticeSession.v1';
const JOURNAL = 'current';
const TTL = 24 * 60 * 60 * 1000;
interface Proof {
  version: 1; nonce: string; created: number; expires: number; source: string; id: string;
  state: 'new' | 'approved' | 'consented' | 'issued' | 'committed';
  current: string; pending?: string; approved?: string; consent?: string;
  email?: string; target?: string; receipt?: string; receiptDigest?: string; digest: string;
}
export interface DeviceGuestOptions {
  host: OwnerStorageHost; secure: AsyncKeyValueStore;
  nonce(): string | Promise<string>; digest(raw: string): Promise<string>; now(): number;
}
/** The secure store, not AsyncStorage IDs, is the authority for NEW local content.
 * No authenticated provider, server ownership, or payment authority is implied. */
export function createDurableGuestContinuation(options: DeviceGuestOptions) {
  let proof: Proof | null = null;
  let source: OwnerPracticeStorage | null = null;
  let destination: OwnerPracticeStorage | null = null;
  let stopped = false, busy = false;
  let activeNonce: string | null = null;
  let epoch = 0;
  let consentCancelled = false;
  let unwatch = () => {};
  let unwatchTarget = () => {};
  let writes: Promise<unknown> = Promise.resolve();
  const serialize = <T>(work: () => Promise<T>): Promise<T> => {
    const result = writes.catch(() => {}).then(work); writes = result; return result;
  };
  const live = () => { if (stopped) throw new Error('Continuation unavailable'); };
  const save = (next: Proof | null) => serialize(async () => {
    if (next && (stopped || next.nonce !== activeNonce)) throw new Error('Continuation changed');
    if (next && consentCancelled && ['consented','issued'].includes(next.state)) throw new Error('Consent cancelled');
    const raw = JSON.stringify(next);
    await options.secure.setItem(JOURNAL, raw);
    if (await options.secure.getItem(JOURNAL) !== raw) throw new Error('Device handoff not confirmed');
    proof = next;
  });
  async function load() {
    const revision=epoch;
    await writes;
    const raw = await options.secure.getItem(JOURNAL);
    if (!raw || raw === 'null') return null;
    const p = JSON.parse(raw) as Proof;
    if (p.version !== 1 || typeof p.nonce !== 'string' || !p.nonce || typeof p.source !== 'string'
      || typeof p.id !== 'string' || typeof p.current !== 'string' || !Number.isFinite(p.created)
      || p.expires !== p.created + TTL || options.now() < p.created || options.now() >= p.expires
      || !['new','approved','consented','issued','committed'].includes(p.state)
      || p.digest !== await options.digest(JSON.stringify([p.version,p.nonce,p.created,p.source,p.id,p.current]))) {
      await save(null); return null;
    }
    live(); if (revision !== epoch) throw new Error('Continuation changed');
    activeNonce=p.nonce; proof = p; return p;
  }
  async function persist(p: Proof) {
    live(); if (p.nonce !== activeNonce) throw new Error('Continuation changed');
    p = {...p, digest: await options.digest(JSON.stringify([p.version,p.nonce,p.created,p.source,p.id,p.current]))};
    await save(p); live(); return p;
  }
  async function sourceRaw(p: Proof) {
    if (options.now() < p.created || options.now() >= p.expires) throw new Error('Device handoff expired');
    // Exact named source only. No history scan, fallback key, or guessed ID lookup.
    const raw = await options.host.getItem(`bysi.owner.v1:${encodeURIComponent(p.source)}:${SLOT}`);
    if (!raw || (raw !== p.current && raw !== p.pending)) throw new Error('Device rehearsal changed or deleted');
    if (JSON.parse(raw).id !== p.id) throw new Error('Device rehearsal changed');
    return raw;
  }
  function observe(lease: OwnerPracticeStorage) {
    unwatch();
    unwatch = watchDeviceGuestSource(lease, async (next, previous) => {
      live(); const p = proof;
      if (!p) return;
      if (!next || !previous || (previous !== p.current && previous !== p.pending)
        || JSON.parse(next).id !== p.id
        || (p.approved && !sameApprovedSource(JSON.parse(p.approved), JSON.parse(next)))) {
        await api.invalidate(); return;
      }
      if (p.state === 'consented' || p.state === 'issued' || p.state === 'committed') {
        if (next !== previous) await api.invalidate();
        return;
      }
      // The producer already durably journaled this exact before/after pair.
      // Rewriting it adds a second failure boundary before saving the assessment.
      if (p.state === 'approved' && p.current === previous && p.pending === next) return;
      // Write-ahead pair: cold recovery accepts only exact before/after bytes.
      await persist({...p, current: previous, pending: next});
    });
  }
  async function settle(target: OwnerPracticeStorage, p: Proof) {
    if (!p.receipt || p.target !== target.owner) throw new Error('Account changed');
    const receipt = await target.deviceReceipt(p.receipt);
    if (!receipt || (p.state !== 'committed' && (receipt.sourceSnapshot !== p.consent || receipt.value !== p.consent))) throw new Error('Save outcome uncertain; no write was retried');
    if (!receipt.sourceSnapshot || await options.digest(receipt.sourceSnapshot) !== p.receiptDigest) throw new Error('Receipt snapshot changed');
    // Remove private copies from the secure journal after exact receipt readback.
    await persist({...p,state:'committed',current:'',pending:undefined,approved:undefined,consent:undefined});
    return receipt.value;
  }
  function observeTarget(target: OwnerPracticeStorage) {
    unwatchTarget();
    unwatchTarget=watchDeviceGuestSource(target,async next=>{
      if (!next || JSON.parse(next).id !== proof?.id) await api.invalidate();
    });
  }
  const api = {
    durable: true,
    async begin(lease: OwnerPracticeStorage, id: string) {
      live(); if (!lease.isActive() || !id) throw new Error('Guest run unavailable');
      const revision=++epoch;
      const raw = await lease.getItem(SLOT);
      if (!raw || JSON.parse(raw).id !== id || JSON.parse(raw).sharedResult || JSON.parse(raw).attemptOne) throw new Error('New guest creation required');
      const created = options.now(); const nonce=await options.nonce();
      live(); if (revision !== epoch || !lease.isActive()) throw new Error('Guest run changed');
      activeNonce=nonce;
      await persist({version:1,nonce:activeNonce,created,expires:created+TTL,source:lease.owner,id,state:'new',current:raw,digest:''});
      source=lease;destination=null;observe(lease);
    },
    async restore(lease: OwnerPracticeStorage) {
      live(); const p = await load();
      if (!p || p.source !== lease.owner || p.target || !lease.isActive()) return false;
      const raw = await sourceRaw(p);
      await persist({...p,current:raw,pending:undefined});source=lease;observe(lease);return true;
    },
    async seal(lease: OwnerPracticeStorage, id: string) {
      live();const p=proof;
      if (!p || p.state !== 'new' || source !== lease || p.id !== id) return;
      const raw=await sourceRaw(p);
      await persist({...p,state:'approved',current:raw,pending:undefined,approved:raw});
    },
    async stageApproval(lease: OwnerPracticeStorage, id: string, raw: string) {
      live();const p=proof;
      if (!p || source !== lease || p.id !== id || p.state !== 'new') return;
      if (!lease.isActive() || JSON.parse(raw).id !== id) throw new Error('Guest result changed');
      const previous=await sourceRaw(p);
      await persist({...p,state:'approved',current:previous,pending:raw,approved:raw});
    },
    async prepare(lease: OwnerPracticeStorage, email: string) {
      live(); const p=proof;
      consentCancelled=false;
      if (!p?.approved || source !== lease || p.target || !email || !lease.isActive()) throw new Error('Current rehearsal unavailable');
      const raw=await sourceRaw(p);
      if (!sameApprovedSource(JSON.parse(p.approved),JSON.parse(raw))) throw new Error('Current rehearsal changed');
      await persist({...p,state:'consented',current:raw,pending:undefined,consent:raw,email});
    },
    bind(lease: OwnerPracticeStorage, target: OwnerPracticeStorage) {
      if (source === lease && proof?.state === 'consented' && target.isActive()) {destination=target;observeTarget(target);}
    },
    pending(lease: OwnerPracticeStorage) {return Boolean(!stopped && proof?.approved && source === lease && !proof.target && !destination && lease.isActive() && sameApprovedSource(JSON.parse(proof.approved),JSON.parse(proof.pending ?? proof.current)));},
    available(target: OwnerPracticeStorage) {return Boolean(!stopped && !busy && proof?.state === 'consented' && destination === target && target.isActive());},
    async claim(target: OwnerPracticeStorage): Promise<string> {
      live(); if (busy || destination !== target || !target.isActive()) throw new Error('Continuation unavailable');
      const p=proof;
      if (!p?.consent || p.state !== 'consented' || (p.target && p.target !== target.owner)) throw new Error('Continuation unavailable');
      busy=true;
      try {
        if (await sourceRaw(p) !== p.consent) throw new Error('Consent checkpoint changed');
        const receipt=await options.digest(JSON.stringify([p.version,p.nonce,p.created,p.source,p.id,p.consent,target.owner]));
        const pinned={...p,target:target.owner,receipt,receiptDigest:await options.digest(p.consent)};
        await persist(pinned);
        await target.commitDeviceGuest(p.consent,receipt,()=>!stopped && destination===target,async()=>{await persist({...pinned,state:'issued'});});
        return await settle(target,proof!);
      } catch (error) {
        if (error instanceof DeviceGuestConflict) await api.invalidate();
        throw error;
      } finally {busy=false;}
    },
    async resumeVerified(target: OwnerPracticeStorage, email: string): Promise<string | null> {
      live();const p=await load();
      if (!p || !p.email || p.email !== email || (p.target && p.target !== target.owner) || !target.isActive()) return null;
      destination=target;observeTarget(target);
      if (p.state === 'issued' || p.state === 'committed') return settle(target,p);
      if (p.state !== 'consented') return null;
      return api.claim(target);
    },
    async acknowledge(target: OwnerPracticeStorage, id: string) {
      live(); const p=proof;
      if (!p) return;
      if (p.state !== 'committed' || p.target !== target.owner || p.id !== id || !target.isActive()) throw new Error('Presentation owner changed');
      const receipt=await target.deviceReceipt(p.receipt!);
      if (!receipt?.sourceSnapshot || await options.digest(receipt.sourceSnapshot) !== p.receiptDigest || !target.isActive()) throw new Error('Presentation receipt changed');
      // New visit-scoped sources are temporary explicit-consent handoff copies.
      // Legacy sources and registered-account records are never removed here.
      if (/:visit:[a-f0-9]{64}$/.test(p.source)) await options.host.removeItem(`bysi.owner.v1:${encodeURIComponent(p.source)}:${SLOT}`);
      await api.invalidate(); // retire only the handoff journal, never the owner record
    },
    async cancelConsent() {
      consentCancelled=true;
      const p=proof;
      if (p?.approved && !p.target && p.state !== 'issued') await persist({...p,state:'approved',consent:undefined,email:undefined});
      else await api.invalidate();
    },
    invalidate() {
      const retired=proof;
      ++epoch;activeNonce=null;source=null;destination=null;proof=null;unwatch();unwatchTarget();
      return save(null).then(async()=>{
        // Only a proof already created/verified by this controller can name a
        // temporary visit copy. Never scan or delete legacy/account namespaces.
        if(retired&&/:visit:[a-f0-9]{64}$/.test(retired.source))await options.host.removeItem(`bysi.owner.v1:${encodeURIComponent(retired.source)}:${SLOT}`);
      });
    },
    dispose() {++epoch;activeNonce=null;stopped=true;source=null;destination=null;unwatch();unwatchTarget();},
  };
  return api;
}
