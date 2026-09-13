import {test,expect} from 'bun:test';
import {createReceiptlessDeletionJournal,createReceiptlessDeletionCoordinator} from '../lib/receiptlessDeletionJournal';
test('server deleting remains visibly pending after local cleanup and cold recovery; capability survives for later verified completion',async()=>{
 const data=new Map<string,string>();const storage={getItem:async(k:string)=>data.get(k)??null,setItem:async(k:string,v:string)=>{data.set(k,v);},removeItem:async(k:string)=>{data.delete(k);}};
 let remote:'deleting'|'deleted'='deleting',notice='',cleanups=0;
 const build=()=>{const journal=createReceiptlessDeletionJournal(async()=>storage);return {journal,coordinator:createReceiptlessDeletionCoordinator({journal,enroll:async()=>{},check:async(owner)=>({deleted:remote==='deleted',ownerId:owner,status:remote}),quarantine:()=>{},cleanup:async()=>{cleanups++;},logout:async()=>({success:true}),notice:value=>{notice=value;}})};};
 let runtime=build();await runtime.journal.capabilityStore.save({ownerId:'A',secret:'a'.repeat(64),digest:'b'.repeat(64),registered:true});await runtime.coordinator.check('A');
 expect(notice).toContain('pending');expect(notice).not.toContain('has been deleted');expect((await runtime.journal.records())[0].capability).toBeDefined();
 runtime.coordinator.dispose();runtime=build();await runtime.coordinator.initialize();expect(notice).toContain('pending');expect(notice).not.toContain('has been deleted');
 remote='deleted';await runtime.coordinator.check(null);expect(notice).toContain('has been deleted');expect(cleanups).toBe(1);expect((await runtime.journal.records())[0].status).toBe('deleted');
});
