import {test,expect} from 'bun:test';
import {finishDeletedOwnerLocally} from '../lib/deletedOwnerCleanup';
test('late A cleanup may erase A but never log out B',async()=>{
 let owner='A',resolve:any,logouts=0;
 const pending=finishDeletedOwnerLocally('A',async()=>{await new Promise(r=>resolve=r);},()=>owner,async()=>{logouts++;return {success:true};});
 owner='B';resolve();await pending;expect(logouts).toBe(0);
});
test('same owner completion requires acknowledged SDK logout',async()=>{
 await expect(finishDeletedOwnerLocally('A',async()=>{},()=> 'A',async()=>({success:false}))).rejects.toThrow();
});
