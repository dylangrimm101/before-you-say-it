import {test,expect} from 'bun:test';
import {createHash,randomUUID} from 'node:crypto';
import {createOwnerPracticeStorage} from '../lib/ownerPracticeStorage';
import * as durable from '../lib/durableGuestContinuation';
const slot='cc.activePracticeSession.v1';
function fixture(){
 const disk=new Map<string,string>(),secureDisk=new Map<string,string>();
 const kv=(m:Map<string,string>)=>({getItem:async(k:string)=>m.get(k)??null,setItem:async(k:string,v:string)=>{m.set(k,v);},removeItem:async(k:string)=>{m.delete(k);}});
 const host={...kv(disk),getAllKeys:async()=>[...disk.keys()]};const secure=kv(secureDisk);
 let now=1000;
 const options={host,secure,nonce:randomUUID,digest:async(s:string)=>createHash('sha256').update(s).digest('hex'),now:()=>now};
 const fresh=()=>durable.createDurableGuestContinuation(options);
 return {host,secure,disk,secureDisk,fresh,options,expire:()=>{now+=48*3600*1000;}};
}
test('device proof restores new creation and exact nullable result/checkpoint after controller death',async()=>{
 expect(typeof durable.createDurableGuestContinuation).toBe('function');
 const f=fixture();let c=f.fresh();let guest=createOwnerPracticeStorage(f.host,'guest');
 await guest.setItem(slot,JSON.stringify({id:'run',schemaVersion:1}));await c.begin(guest,'run');
 c.dispose();guest.invalidate();c=f.fresh();guest=createOwnerPracticeStorage(f.host,'guest');
 expect(await c.restore(guest)).toBe(true);
 const raw=JSON.stringify({id:'run',schemaVersion:1,sharedResult:{overall:null,score:12.75},freeJourneyCheckpoint:'starting_index'});
 await guest.setItem(slot,raw);await c.seal(guest,'run');c.dispose();guest.invalidate();
 c=f.fresh();guest=createOwnerPracticeStorage(f.host,'guest');expect(await c.restore(guest)).toBe(true);
 await c.prepare(guest,'a@invalid');c.dispose();guest.invalidate();
 c=f.fresh();const owner=createOwnerPracticeStorage(f.host,'A');
 expect(await c.resumeVerified(owner,'a@invalid')).toBe(raw);
 expect(await owner.getItem(slot)).toBe(raw);expect(f.disk.get('bysi.owner.v1:guest:'+slot)).toBe(raw);
 expect(await c.resumeVerified(createOwnerPracticeStorage(f.host,'B'),'b@invalid')).toBe(null);
});

async function approved(){
 const f=fixture();const c=f.fresh();const guest=createOwnerPracticeStorage(f.host,'guest');
 await guest.setItem(slot,JSON.stringify({id:'run'}));await c.begin(guest,'run');
 const raw=JSON.stringify({id:'run',sharedResult:{overall:null,score:12.75},freeJourneyCheckpoint:'starting_index'});
 await guest.setItem(slot,raw);await c.seal(guest,'run');await c.prepare(guest,'a@invalid');
 return {...f,c,guest,raw};
}
test('logout revokes durable proof but permits a genuinely new creation',async()=>{
 const f=await approved();await f.c.invalidate();
 expect(await f.fresh().restore(createOwnerPracticeStorage(f.host,'guest'))).toBe(false);
 await f.guest.setItem(slot,JSON.stringify({id:'new'}));
 await f.c.begin(f.guest,'new');
 expect(await f.fresh().restore(createOwnerPracticeStorage(f.host,'guest'))).toBe(true);
});

test('identity invalidation during async secure owner pin cannot resurrect a journal',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const pending=f.c.claim(owner);await f.c.invalidate();owner.invalidate();
 await expect(pending).rejects.toThrow();
 expect(await f.fresh().restore(createOwnerPracticeStorage(f.host,'guest'))).toBe(false);
 expect(f.secureDisk.get('current')).toBe('null');
});

test('issued write loss recovers only an exact receipt and never issues a second write',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const set=f.host.setItem;let writes=0;
 f.host.setItem=async(k,v)=>{if(k.includes(':A:')){writes++;await set(k,v);throw Error('lost acknowledgement');}await set(k,v);};
 await expect(f.c.claim(owner)).rejects.toThrow();f.c.dispose();
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(f.raw);
 expect(writes).toBe(1);
});
test('issued without receipt remains uncertain across restart, deletion and wrong account',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 let writes=0;const set=f.host.setItem;
 f.host.setItem=async(k,v)=>{if(k.includes(':A:')){writes++;throw Error('unacknowledged');}await set(k,v);};
 await expect(f.c.claim(owner)).rejects.toThrow();f.c.dispose();
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'B'),'a@invalid')).toBe(null);
 await expect(f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).rejects.toThrow('uncertain');
 expect(writes).toBe(1);
});
test('precommit read failure survives restart without retargeting',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const get=f.host.getItem;let fail=true;
 f.host.getItem=async(k)=>{if(k.includes(':A:')&&fail){fail=false;throw Error('precommit read');}return get(k);};
 await expect(f.c.claim(owner)).rejects.toThrow();f.c.dispose();
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'B'),'a@invalid')).toBe(null);
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(f.raw);
});
for(const variant of ['ordinary-json-only','tamper','deletion','expiry','wrong-email','wrong-source'] as const){
 test('cold proof refuses '+variant,async()=>{
  const f=await approved();f.c.dispose();
  if(variant==='ordinary-json-only')f.secureDisk.clear();
  if(variant==='tamper')f.disk.set('bysi.owner.v1:guest:'+slot,JSON.stringify({id:'run',sharedResult:{overall:100}}));
  if(variant==='deletion')f.disk.delete('bysi.owner.v1:guest:'+slot);
  if(variant==='expiry')f.expire();
  const next=f.fresh();const target=createOwnerPracticeStorage(f.host,'A');
  if(variant==='wrong-source')expect(await next.restore(createOwnerPracticeStorage(f.host,'old-guest'))).toBe(false);
  else if(variant==='tamper'||variant==='deletion')await expect(next.resumeVerified(target,'a@invalid')).rejects.toThrow();
  else expect(await next.resumeVerified(target,variant==='wrong-email'?'b@invalid':'a@invalid')).toBe(null);
  expect(await target.getItem(slot)).toBe(null);
 });
}
test('secure write-ahead checkpoint pair recovers before and after native write',async()=>{
 for(const commit of [false,true]){
  const f=fixture();const c=f.fresh();const guest=createOwnerPracticeStorage(f.host,'guest');
  const before=JSON.stringify({id:'run'});await guest.setItem(slot,before);await c.begin(guest,'run');
  const after=JSON.stringify({id:'run',freeJourneyCheckpoint:'starting_index'});const set=f.host.setItem;
  f.host.setItem=async(k,v)=>{if(commit)await set(k,v);throw Error('process stop');};
  await expect(guest.setItem(slot,after)).rejects.toThrow();c.dispose();
  const cold=f.fresh();const lease=createOwnerPracticeStorage(f.host,'guest');
  expect(await cold.restore(lease)).toBe(true);expect(await lease.getItem(slot)).toBe(commit?after:before);
 }
});
test('altered value beside an exact issued receipt is not acknowledged as success',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const set=f.host.setItem;
 f.host.setItem=async(k,v)=>{if(k.includes(':A:')){await set(k,v);throw Error('lost acknowledgement');}await set(k,v);};
 await expect(f.c.claim(owner)).rejects.toThrow();f.c.dispose();
 const key='bysi.owner.v1:A:'+slot;const changed=JSON.parse(f.disk.get(key)!);changed.value=JSON.stringify({id:'forged'});f.disk.set(key,JSON.stringify(changed));
 await expect(f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).rejects.toThrow();
});

test('cancelled consent cannot attach on cold authenticated restoration but can be deliberately consented again',async()=>{
 const f=await approved();expect(typeof f.c.cancelConsent).toBe('function');await f.c.cancelConsent();f.c.dispose();
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(null);
 const c=f.fresh();const guest=createOwnerPracticeStorage(f.host,'guest');expect(await c.restore(guest)).toBe(true);expect(c.pending(guest)).toBe(true);
 await c.prepare(guest,'a@invalid');const owner=createOwnerPracticeStorage(f.host,'A');c.bind(guest,owner);expect(await c.claim(owner)).toBe(f.raw);
});

test('producer stages approval before native result write so death before postwrite seal loses no completed result',async()=>{
 const f=fixture(),c=f.fresh();const guest=createOwnerPracticeStorage(f.host,'guest');
 await guest.setItem(slot,JSON.stringify({id:'run'}));await c.begin(guest,'run');
 const raw=JSON.stringify({id:'run',sharedResult:{overall:null,score:12.75}});
 expect(typeof c.stageApproval).toBe('function');await c.stageApproval(guest,'run',raw);
 await guest.setItem(slot,raw);c.dispose();
 const cold=f.fresh(),lease=createOwnerPracticeStorage(f.host,'guest');await cold.restore(lease);expect(cold.pending(lease)).toBe(true);
 await cold.prepare(lease,'a@invalid');const owner=createOwnerPracticeStorage(f.host,'A');cold.bind(lease,owner);expect(await cold.claim(owner)).toBe(raw);
});
test('producer-staged exact source can commit when the secure device fills immediately after staging',async()=>{
 const f=fixture(),c=f.fresh();const guest=createOwnerPracticeStorage(f.host,'guest');
 await guest.setItem(slot,JSON.stringify({id:'run'}));await c.begin(guest,'run');
 const raw=JSON.stringify({id:'run',sharedResult:{overall:null,score:12.75}});
 await c.stageApproval(guest,'run',raw);
 f.secure.setItem=async()=>{throw Error('device storage became full after stage');};
 await guest.setItem(slot,raw);
 expect(await guest.getItem(slot)).toBe(raw);
 c.dispose();
});

test('privacy deletion after an issued write revokes the secure private backup before owned deletion',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const set=f.host.setItem;f.host.setItem=async(k,v)=>{await set(k,v);if(k.includes(':A:'))throw Error('ack lost');};
 await expect(f.c.claim(owner)).rejects.toThrow();f.host.setItem=set;
 await owner.forgetContinuationSnapshot();expect(f.secureDisk.get('current')).toBe('null');
 f.c.dispose();expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(null);
});

test('committed receipt recovery verifies its immutable snapshot digest, not a copied receipt string',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);await f.c.claim(owner);f.c.dispose();
 const key='bysi.owner.v1:A:'+slot;const v=JSON.parse(f.disk.get(key)!);v.sourceSnapshot='forged';f.disk.set(key,JSON.stringify(v));
 await expect(f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).rejects.toThrow();
});
test('late secure cold read after logout cannot reactivate the old proof',async()=>{
 const f=await approved();f.c.dispose();const get=f.secure.getItem;let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});let started!:()=>void;const seen=new Promise<void>(r=>{started=r;});
 f.secure.getItem=async k=>{const raw=await get(k);started();await gate;return raw;};
 const c=f.fresh();const pending=c.restore(createOwnerPracticeStorage(f.host,'guest'));await seen;
 const invalidated=c.invalidate();release();await invalidated;
 await expect(pending).rejects.toThrow();expect(c.pending(createOwnerPracticeStorage(f.host,'guest'))).toBe(false);
 expect(f.secureDisk.get('current')).toBe('null');
});

test('concurrent guest deletion cancels an in-flight claim rather than resurrecting its old snapshot',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);
 const claim=f.c.claim(owner);await f.guest.removeItem(slot);await expect(claim).rejects.toThrow();
 expect(await owner.getItem(slot)).toBe(null);expect(f.secureDisk.get('current')).toBe('null');
});

test('logout while device randomness is pending cannot create a late transferable run',async()=>{
 const f=fixture();let release!:(v:string)=>void;const nonce=new Promise<string>(r=>{release=r;});let started!:()=>void;const seen=new Promise<void>(r=>{started=r;});
 (f.options as any).nonce=()=>{started();return nonce;};
 const c=f.fresh(),guest=createOwnerPracticeStorage(f.host,'guest');await guest.setItem(slot,JSON.stringify({id:'run'}));
 const beginning=c.begin(guest,'run');await seen;await c.invalidate();guest.invalidate();release(randomUUID());
 await expect(beginning).rejects.toThrow();expect(f.secureDisk.get('current')).toBe('null');
});

test('verified presentation acknowledgement retires startup routing but preserves owned practice',async()=>{
 const f=await approved();const owner=createOwnerPracticeStorage(f.host,'A');f.c.bind(f.guest,owner);await f.c.claim(owner);
 expect(typeof f.c.acknowledge).toBe('function');
 await expect(f.c.acknowledge(createOwnerPracticeStorage(f.host,'B'),'run')).rejects.toThrow();
 await f.c.acknowledge(owner,'run');f.c.dispose();
 expect(await f.fresh().resumeVerified(createOwnerPracticeStorage(f.host,'A'),'a@invalid')).toBe(null);expect(await owner.getItem(slot)).toBe(f.raw);
});
