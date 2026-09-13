import {test,expect} from 'bun:test';
import {createReceiptlessDeletionJournal,createReceiptlessDeletionCoordinator} from '../lib/receiptlessDeletionJournal';

const capability=(ownerId:string)=>({ownerId,secret:'a'.repeat(64),digest:'b'.repeat(64),registered:true});
function device(){
 let raw:string|null=null;let fail=false;
 const storage={getItem:async()=>raw,setItem:async(_key:string,value:string)=>{if(fail)throw Error('locked');raw=value;},removeItem:async()=>{raw=null;}};
 return {journal:()=>createReceiptlessDeletionJournal(async()=>storage),fail:(value:boolean)=>{fail=value;},raw:()=>raw};
}
test('quarantine precedes failed pending write; retry persists tombstone and discards capability',async()=>{
 const disk=device();const journal=disk.journal();await journal.capabilityStore.save(capability('A'));
 const events:string[]=[];disk.fail(true);
 const coordinator=createReceiptlessDeletionCoordinator({journal,check:async()=>({deleted:true,ownerId:'A',status:'deleted'}),enroll:async()=>{},quarantine:()=>events.push('quarantine'),cleanup:async()=>{events.push('cleanup');},logout:async()=>({success:true}),notice:()=>{}});
 await coordinator.check(null);expect(events).toEqual(['quarantine']);expect(journal.blocked('A')).toBe(true);
 disk.fail(false);await coordinator.check(null);expect(events).toContain('cleanup');
 expect(await disk.journal().records()).toEqual([{ownerId:'A',status:'deleted',phase:'complete'}]);
 expect(disk.raw()).not.toContain('secret');coordinator.dispose();
});
test('restart resumes partial erase without session; completed journal never repeats erase',async()=>{
 const disk=device();const first=disk.journal();await first.mark('A','deleted');
 let cleanups=0;let logouts=0;
 const coordinator=createReceiptlessDeletionCoordinator({journal:disk.journal(),check:async()=>{throw Error('no status needed');},enroll:async()=>{},quarantine:()=>{},cleanup:async()=>{cleanups++;},logout:async()=>{logouts++;return {success:true};},notice:()=>{}});
 await Promise.all([coordinator.check(null),coordinator.check(null)]);await coordinator.check(null);
 expect(cleanups).toBe(1);expect(logouts).toBe(2);coordinator.dispose();
});
test('wrong owner and unknown contact cannot quarantine; isolated devices never share blocked memory',async()=>{
 const first=device().journal(),second=device().journal();await first.mark('A','deleted');await second.capabilityStore.save(capability('A'));
 let quarantines=0;
 const coordinator=createReceiptlessDeletionCoordinator({journal:second,check:async()=>({deleted:true,ownerId:'B',status:'deleted'}),enroll:async()=>{},quarantine:()=>{quarantines++;},cleanup:async()=>{},logout:async()=>({success:true}),notice:()=>{}});
 await coordinator.check(null);expect(quarantines).toBe(0);expect(second.blocked('A')).toBe(false);coordinator.dispose();
});
test('late confirmed A response cleans A even after current owner changes to B',async()=>{
 const journal=device().journal();await journal.capabilityStore.save(capability('A'));
 let resolve!:(value:any)=>void;let current='A';const erased:string[]=[];const signedOut:string[]=[];
 const coordinator=createReceiptlessDeletionCoordinator({journal,check:()=>new Promise(done=>{resolve=done;}),enroll:async()=>{},quarantine:()=>{},cleanup:async(owner)=>{erased.push(owner);},logout:async(owner)=>{if(current===owner)signedOut.push(owner);return {success:true};},notice:()=>{}});
 const pending=coordinator.check('A');while(!resolve)await Promise.resolve();current='B';resolve({deleted:true,ownerId:'A',status:'deleted'});await pending;
 expect(erased).toEqual(['A']);expect(signedOut).toEqual([]);coordinator.dispose();
});
test('enrollment response-save interruption does not lose discovery after revoked auth',async()=>{
 const journal=device().journal();await journal.capabilityStore.save({...capability('A'),registered:false});
 let erased=false;
 const coordinator=createReceiptlessDeletionCoordinator({journal,check:async()=>({deleted:true,ownerId:'A',status:'deleted'}),enroll:async()=>{},quarantine:()=>{},cleanup:async()=>{erased=true;},logout:async()=>({success:true}),notice:()=>{}});
 await coordinator.check(null);expect(erased).toBe(true);coordinator.dispose();
});
test('repeated initialization during cleanup does not invalidate the cleanup lease again',async()=>{
 const journal=device().journal();await journal.mark('A','deleted');let quarantines=0;let release!:()=>void;
 const coordinator=createReceiptlessDeletionCoordinator({journal,check:async()=>({deleted:false}),enroll:async()=>{},quarantine:()=>{quarantines++;},cleanup:()=>new Promise<void>(resolve=>{release=resolve;}),logout:async()=>({success:true}),notice:()=>{}});
 const flight=coordinator.check(null);while(!release)await Promise.resolve();
 await coordinator.initialize();release();await flight;expect(quarantines).toBe(1);coordinator.dispose();
});
