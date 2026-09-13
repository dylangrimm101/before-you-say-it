import type {AsyncKeyValueStore} from './secureSessionStorage';
import type {ReceiptlessDeletionCapability} from './accountDeletion';

export type DeletionRecord={ownerId:string;capability?:ReceiptlessDeletionCapability;status?:'deleting'|'deleted';phase?:'pending'|'complete'};
export function createReceiptlessDeletionJournal(storage:()=>Promise<AsyncKeyValueStore>){
 let queue:Promise<unknown>=Promise.resolve();
 const blocked=new Set<string>();
 const volatile=new Map<string,DeletionRecord>();
 const locked=<Result>(work:()=>Promise<Result>):Promise<Result>=>{
  const next=queue.then(work,work);queue=next.catch(()=>{});return next;
 };
 const read=async():Promise<DeletionRecord[]>=>{
  const raw=await (await storage()).getItem('journal');
  if(raw===null)return [];
  const value=JSON.parse(raw);
  if(value?.version!==1||!Array.isArray(value.records))throw new Error('Invalid deletion journal');
  const owners=new Set<string>();
  for(const record of value.records){
   if(typeof record.ownerId!=='string'||!record.ownerId||owners.has(record.ownerId))throw new Error('Invalid deletion journal owner');
   owners.add(record.ownerId);
   if(record.capability&&(record.capability.ownerId!==record.ownerId||!/^[a-f0-9]{64}$/.test(record.capability.secret)||!/^[a-f0-9]{64}$/.test(record.capability.digest)))throw new Error('Invalid deletion capability');
   if(record.phase!==undefined&&(!['pending','complete'].includes(record.phase)||!['deleting','deleted'].includes(record.status)))throw new Error('Invalid deletion phase');
   if(record.phase)blocked.add(record.ownerId);
  }
  return value.records;
 };
 const update=(owner:string,change:(record:DeletionRecord)=>DeletionRecord)=>locked(async()=>{
  const records=await read();const previous=records.find(record=>record.ownerId===owner)??{ownerId:owner};
  const next=change(previous);const raw=JSON.stringify({version:1,records:[...records.filter(record=>record.ownerId!==owner),next].sort((left,right)=>left.ownerId.localeCompare(right.ownerId))});
  const store=await storage();await store.setItem('journal',raw);
  if(await store.getItem('journal')!==raw)throw new Error('Deletion journal readback failed');
 });
 return {
  blocked:(owner:string|null)=>Boolean(owner&&blocked.has(owner)),
  records:()=>locked(async()=>{const records=await read();return [...records.filter(record=>!volatile.has(record.ownerId)),...volatile.values()];}),
  capabilityStore:{
   load:(owner:string)=>locked(async()=> (await read()).find(record=>record.ownerId===owner)?.capability??null),
   save:(capability:ReceiptlessDeletionCapability)=>update(capability.ownerId,record=>record.phase?record:{...record,capability}),
   listRegisteredOwners:()=>locked(async()=> (await read()).filter(record=>record.capability?.registered&&!record.phase).map(record=>record.ownerId)),
  },
  mark(ownerId:string,status:'deleting'|'deleted'){
   blocked.add(ownerId);volatile.set(ownerId,{ownerId,status,phase:'pending'});
   return update(ownerId,record=>({...record,status,phase:'pending'})).then(()=>{volatile.delete(ownerId);});
  },
  complete:async(owner:string)=>{
   await update(owner,record=>({ownerId:owner,status:record.status,...(record.status==='deleting'?{capability:record.capability}:{}),phase:'pending'}));
   await update(owner,record=>({ownerId:owner,status:record.status,...(record.status==='deleting'?{capability:record.capability}:{}),phase:'complete'}));
  },
 };
}
export type ReceiptlessDeletionJournal=ReturnType<typeof createReceiptlessDeletionJournal>;

export function createReceiptlessDeletionCoordinator(options:{
 journal:ReceiptlessDeletionJournal;
 check:(owner:string)=>Promise<{deleted:boolean;ownerId?:string;status?:string}>;
 enroll:(owner:string)=>Promise<unknown>;
 quarantine:(owner:string)=>void;
 cleanup:(owner:string)=>Promise<void>;
 logout:(owner:string)=>Promise<{success:boolean}>;
 notice:(message:string)=>void;
}){
 let flight:Promise<void>|null=null;let disposed=false;let confirmed=false;
 const quarantined=new Set<string>();
 const quarantine=(owner:string)=>{
  if(quarantined.has(owner))return;
  quarantined.add(owner);options.quarantine(owner);
 };
 const message=(status:DeletionRecord['status'],complete:boolean)=>status==='deleting'
  ? (complete?'Account deletion is pending on the server. Linked account data on this device has been cleared; external erasure is not confirmed. Unowned legacy data is not included.':'Account deletion is pending on the server. Device cleanup is pending; retry with this device unlocked.')
  : (complete?'An account used on this device has been deleted. Its linked account data on this device has been cleared. Unowned legacy data is not included.':'An account used on this device has been deleted. Device cleanup is pending; retry with this device unlocked.');
 const initialize=async()=>{
  const records=await options.journal.records();
  if(disposed)return;
  for(const record of records)if(record.phase){confirmed=true;quarantine(record.ownerId);options.notice(message(record.status,record.phase==='complete'));}
 };
 const run=async(owner:string|null)=>{
  await initialize();if(disposed)return;
  if(owner&&!options.journal.blocked(owner))await options.enroll(owner);
  const records=await options.journal.records();
  if(!records.length)options.notice('No account status proof is saved on this device. A missing or invalid login alone cannot confirm deletion.');
  let unknown=false;
  for(const record of records){
   if(disposed)return;
   if(record.phase==='complete'&&record.status==='deleted'){
    if(!(await options.logout(record.ownerId)).success)throw new Error('Sign out not confirmed');
    continue;
   }
   let status=record.status;
   if(!record.phase||record.status==='deleting'){
    if(!record.capability)continue;
    const notice=await options.check(record.ownerId);if(disposed)return;
    if(notice.ownerId!==record.ownerId||!(notice.status==='deleting'||(notice.deleted&&notice.status==='deleted'))){unknown=true;continue;}
    status=notice.status as 'deleting'|'deleted';
   }
   confirmed=true;quarantine(record.ownerId);
   options.notice(message(status,false));
   await options.journal.mark(record.ownerId,status!);
   if(record.phase!=='complete')await options.cleanup(record.ownerId);
   if(disposed)return;
   if(!(await options.logout(record.ownerId)).success)throw new Error('Sign out not confirmed');
   await options.journal.complete(record.ownerId);
   options.notice(message(status,true));
  }
  if(unknown&&!confirmed)options.notice('Account status is not confirmed deleted. If offline, reconnect and check again.');
 };
 return {
  initialize,
  check(owner:string|null){
   if(disposed)return Promise.resolve();
   if(!flight)flight=Promise.resolve().then(()=>run(owner)).catch(()=>{
    if(!disposed)options.notice(confirmed?'Deletion was requested, but device cleanup could not be confirmed. Check account status to retry.':'Account status could not be confirmed. Check account status to retry.');
   }).finally(()=>{flight=null;});
   return flight;
  },
  dispose(){disposed=true;},
 };
}
