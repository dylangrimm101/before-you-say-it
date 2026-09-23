import {createCurrentGuestContinuation, createOwnerPracticeStorage, watchDeviceGuestSource, type OwnerPracticeStorage, type OwnerStorageHost} from './ownerPracticeStorage';
import type {createGuestContinuationRuntime} from './guestContinuationRuntime';

type Durable = ReturnType<typeof createGuestContinuationRuntime>;
const SLOT='cc.activePracticeSession.v1';

/** No durable conversation proof until explicit save consent. The existing
 * creation -> producer approval -> consent -> verified receipt protocol remains
 * the authority for account handoff; visits never hydrate from disk. */
export function consentOnlyGuestContinuation(durable: Durable, host: OwnerStorageHost): Durable {
  const memory=createCurrentGuestContinuation();
  let source: OwnerPracticeStorage | null=null, shadow: OwnerPracticeStorage | null=null;
  let id='', initial='', durablePrepared=false, epoch=0;
  let handoffKey: string | null=null, unwatch=()=>{};
  const cleanup=async()=>{
    unwatch();shadow?.invalidate();shadow=null;
    const key=handoffKey;handoffKey=null;
    if(key)await host.removeItem(key);
  };
  return {
    ...durable,
    async begin(lease,nextId) {
      const revision=++epoch;
      const raw=await lease.getItem(SLOT);
      if(revision!==epoch||!lease.isActive()||!raw||JSON.parse(raw).id!==nextId||JSON.parse(raw).sharedResult||JSON.parse(raw).attemptOne)throw Error('New guest creation required');
      source=lease;id=nextId;initial=raw;durablePrepared=false;memory.begin(lease,nextId);
    },
    async stageApproval() { /* Sealed in memory after the result commit. */ },
    async seal(lease,nextId) {await memory.seal(lease,nextId);},
    async restore() {return false;},
    pending:lease=>durablePrepared?durable.pending(shadow??lease):memory.pending(lease),
    async prepare(lease,email) {
      const revision=epoch;
      const current=()=>{if(revision!==epoch||source!==lease||!lease.isActive())throw Error('Current visit changed');};
      current();await memory.prepare(lease);current();
      const raw=await lease.getItem(SLOT);current();
      if(!raw||JSON.parse(raw).id!==id)throw Error('Current visit changed');
      if(!durable.durable){await durable.begin(lease,id);await durable.seal(lease,id);await durable.prepare(lease,email);current();durablePrepared=true;return;}
      // Replay witnessed creation/approval into one consent-only source, without
      // weakening durable.begin's requirement for a genuinely new creation.
      handoffKey=`bysi.owner.v1:${encodeURIComponent(lease.owner)}:${SLOT}`;
      shadow=createOwnerPracticeStorage(host,lease.owner);
      const saved=shadow;
      try {
        await saved.setItem(SLOT,initial);current();
        await durable.begin(saved,id);current();
        await durable.stageApproval(saved,id,raw);current();
        await saved.setItem(SLOT,raw);current();
        await durable.seal(saved,id);current();
        await durable.prepare(saved,email);current();
        unwatch=watchDeviceGuestSource(lease,async(next,previous)=>{
          if(next!==raw||previous!==raw){++epoch;await durable.invalidate();await cleanup();durablePrepared=false;}
        });
        durablePrepared=true;
      } catch(error){await durable.invalidate();await cleanup();throw error;}
    },
    bind:(lease,target)=>{if(source===lease)durable.bind(shadow??lease,target);},
    async cancelConsent(){++epoch;await durable.invalidate();await cleanup();durablePrepared=false;},
    async invalidate(){++epoch;memory.invalidate();source=null;id='';initial='';durablePrepared=false;await durable.invalidate();await cleanup();},
    async acknowledge(target,nextId){await durable.acknowledge(target,nextId);await cleanup();},
    dispose(){++epoch;unwatch();shadow?.invalidate();memory.invalidate();durable.dispose();},
  };
}
