import {test,expect} from 'bun:test';
import {createHash,randomUUID} from 'node:crypto';
import {createOwnerPracticeStorage} from '../lib/ownerPracticeStorage';
import {createDurableGuestContinuation} from '../lib/durableGuestContinuation';
import {consentOnlyGuestContinuation} from '../lib/consentOnlyGuestContinuation';
import {createMemoryPracticeHost} from '../lib/guestVisit';
const slot='cc.activePracticeSession.v1',guestOwner='synthetic:guest:visit:'+'a'.repeat(64);
async function fixture(){
 const disk=new Map<string,string>(),secureDisk=new Map<string,string>();
 const kv=(m:Map<string,string>)=>({getItem:async(k:string)=>m.get(k)??null,setItem:async(k:string,v:string)=>{m.set(k,v);},removeItem:async(k:string)=>{m.delete(k);}});
 const host={...kv(disk),getAllKeys:async()=>[...disk.keys()]};
 const options={host,secure:kv(secureDisk),nonce:randomUUID,digest:async(s:string)=>createHash('sha256').update(s).digest('hex'),now:()=>1000};
 const fresh=()=>consentOnlyGuestContinuation(createDurableGuestContinuation(options),host);
 const c=fresh(),guest=createOwnerPracticeStorage(createMemoryPracticeHost(),guestOwner);
 await guest.setItem(slot,JSON.stringify({id:'run'}));await c.begin(guest,'run');
 const raw=JSON.stringify({id:'run',attemptOne:{transcript:'synthetic'},sharedResult:{overall:null},freeJourneyCheckpoint:'starting_index'});
 await c.stageApproval(guest,'run',raw);await guest.setItem(slot,raw);await c.seal(guest,'run');
 return {disk,secureDisk,host,c,guest,raw,fresh};
}
test('ordinary visit content never reaches disk or SecureStore',async()=>{
 const f=await fixture();expect(f.disk.size).toBe(0);expect(f.secureDisk.size).toBe(0);expect(f.c.pending(f.guest)).toBe(true);
 f.c.dispose();expect(await f.fresh().restore(createOwnerPracticeStorage(createMemoryPracticeHost(),guestOwner))).toBe(false);
});
test('explicit consent reuses actual durable handoff, including cold receipt recovery',async()=>{
 const f=await fixture();await f.c.prepare(f.guest,'a@invalid');expect(f.disk.size).toBe(1);
 const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);f.guest.invalidate();
 expect(await f.c.claim(owner)).toBe(f.raw);f.c.dispose();
 const cold=f.fresh();expect(await cold.resumeVerified(owner,'a@invalid')).toBe(f.raw);
 await cold.acknowledge(owner,'run');expect(await owner.getItem(slot)).toBe(f.raw);
 expect([...f.disk.keys()].some(k=>k.includes(encodeURIComponent(guestOwner)))).toBe(false);
});
test('cancelled save deletes only the temporary snapshot and can be explicitly retried',async()=>{
 const f=await fixture();await f.host.setItem('legacy-unrelated','retain');
 await f.c.prepare(f.guest,'a@invalid');await f.c.cancelConsent();expect([...f.disk.keys()]).toEqual(['legacy-unrelated']);
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(null);
 await f.c.prepare(f.guest,'a@invalid');const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 expect(await f.c.claim(owner)).toBe(f.raw);
});
test('changed approved content and unrelated accounts cannot claim the consent snapshot',async()=>{
 const f=await fixture();await f.c.prepare(f.guest,'a@invalid');
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'B'),'b@invalid')).toBe(null);
 await f.guest.setItem(slot,JSON.stringify({id:'run',sharedResult:{overall:100}}));
 const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);await expect(f.c.claim(owner)).rejects.toThrow();
 expect(await owner.getItem(slot)).toBe(null);
});
test('account-side privacy deletion also retires the temporary consent source',async()=>{
 const f=await fixture();await f.c.prepare(f.guest,'a@invalid');
 const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);await f.c.claim(owner);
 await owner.forgetContinuationSnapshot();
 expect([...f.disk.keys()].some(k=>k.includes(encodeURIComponent(guestOwner)))).toBe(false);
 expect(f.secureDisk.get('current')).toBe('null');
});
