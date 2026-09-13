import {test,expect} from 'bun:test';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {createDurableGuestContinuation} from '../lib/durableGuestContinuation';
import {createMigratingSecureSessionStorage} from '../lib/secureSessionStorage';
import {createOwnerPracticeStorage} from '../lib/ownerPracticeStorage';
import {normalizePracticeSession} from '../lib/practiceSession';
const slot='cc.activePracticeSession.v1';
// Seed from actual mounted producer, not a hand-written approximate result.
function producerSnapshot(){
 const dir=mkdtempSync(join(tmpdir(),'bysi-size-review-'));
 try{
  const file=join(dir,'fixture.json');
  const r=spawnSync(process.execPath,['__tests__/appFirstNavigation.fixture.ts'],{cwd:new URL('..',import.meta.url),encoding:'utf8',timeout:30000,env:{...process.env,BYSI_DURABLE_GUEST:'1',BYSI_CURRENT_GUEST_CONTINUATION:'1',BYSI_GUEST_DENIAL:'nullable',BYSI_GUEST_RESTART_FILE:file,BYSI_GUEST_STOP_STAGE:'result-after'}});
  expect(r.status).toBe(73);
  const saved=JSON.parse(readFileSync(file,'utf8'));
  return JSON.parse(saved.disk.find(([k]:string[])=>k.includes('synthetic-guest')&&k.endsWith(slot))[1]);
 }finally{rmSync(dir,{recursive:true,force:true});}
}
test('bounded native chunks carry large valid exact results; oversized consent keeps saved assessment',async()=>{
 const seed=producerSnapshot();
 const measurements=[];
 for(const repetitions of [2000,5000,32000]){
  const record=structuredClone(seed);
  record.sharedResult.pressure_moment.observation='Observed synthetic example. 🧭 '.repeat(repetitions);
  expect(normalizePracticeSession(record)?.sharedResult).toEqual(record.sharedResult);
  expect(record.sharedResult.starting_index.index_value).toBe(null);
  expect(record.sharedResult.signals[0].score).toBe(12.75);
  const disk=new Map<string,string>(),secureDisk=new Map<string,string>();let maxValue=0,writes=0;
  const kv=(m:Map<string,string>)=>({getItem:async(k:string)=>m.get(k)??null,setItem:async(k:string,v:string)=>{m.set(k,v);},removeItem:async(k:string)=>{m.delete(k);}});
  const host={...kv(disk),getAllKeys:async()=>[...disk.keys()]};
  const native={...kv(secureDisk),setItem:async(k:string,v:string)=>{const n=Buffer.byteLength(v);maxValue=Math.max(n,maxValue);if(n>2048)throw Error('native value limit');writes++;secureDisk.set(k,v);}};
  const secure=createMigratingSecureSessionStorage({secure:native,legacy:{getItem:async()=>null,setItem:async()=>{throw Error('plaintext forbidden');},removeItem:async()=>{}},namespaceForKey:async()=>randomNamespace,generation:()=>randomUUID().replaceAll('-','')});
  const randomNamespace=randomUUID();
  const options={host,secure,nonce:randomUUID,digest:async(s:string)=>createHash('sha256').update(s).digest('hex'),now:()=>1000};
  let c=createDurableGuestContinuation(options);const guest=createOwnerPracticeStorage(host,'guest');
  const initial=JSON.stringify({id:record.id,schemaVersion:6});await guest.setItem(slot,initial);await c.begin(guest,record.id);
  const raw=JSON.stringify(record);
  if(repetitions===2000){
   await c.stageApproval(guest,record.id,raw);await guest.setItem(slot,raw);await c.seal(guest,record.id);
   await c.prepare(guest,'a@invalid');c.dispose();guest.invalidate();
   c=createDurableGuestContinuation(options);const owner=createOwnerPracticeStorage(host,'A');
   expect(await c.resumeVerified(owner,'a@invalid')).toBe(raw);expect(await owner.getItem(slot)).toBe(raw);
   expect(JSON.parse((await owner.getItem(slot))!).sharedResult).toEqual(record.sharedResult);
  }else{
   // Completed data predates the optional consent write. A size failure cannot erase it.
   // Write directly to the host to reproduce a crash-completed source without invoking another checkpoint.
   if(repetitions===5000){await c.stageApproval(guest,record.id,raw);await guest.setItem(slot,raw);}
   else {
    await expect(c.stageApproval(guest,record.id,raw)).rejects.toThrow('supported size');
    // Existing source-only bytes confer no authority after oversize refusal.
    await host.setItem('bysi.owner.v1:guest:'+slot,raw);
   }
   await expect(c.prepare(guest,'a@invalid')).rejects.toThrow();
   expect(await guest.getItem(slot)).toBe(raw);
   const owner=createOwnerPracticeStorage(host,'A');expect(await owner.getItem(slot)).toBe(null);
  }
  expect(maxValue).toBeLessThanOrEqual(1800);
  expect([...disk.values()].some(v=>v.includes('"nonce"'))).toBe(false);
  measurements.push({sourceBytes:Buffer.byteLength(raw),maxSecureValueBytes:maxValue,secureWrites:writes,outcome:repetitions===2000?'exact cold owner claim':'visible refusal; source retained'});
  c.dispose();guest.invalidate();
 }
 console.log('STORAGE_LIMIT_REVIEW',JSON.stringify(measurements));
});
