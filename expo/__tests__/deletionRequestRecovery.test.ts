import {test,expect} from 'bun:test';
import {requestAccountDeletion,checkAccountDeletionStatus} from '../lib/accountDeletion';
test('signed-out status receipt read is bounded',async()=>{
 const result=await checkAccountDeletionStatus(endpoint,null,{...store,loadLatest:async()=>new Promise(()=>{})},async()=>{throw Error('no dispatch');},{deadlineMs:5});expect(result.success).toBe(false);
});
import {createDeletionHandler} from '../../backend/account-lifecycle/handler';
test('cancelled HTTP request cannot accept after delayed reauthentication',async()=>{
 let resume:any,accepted=0;const controller=new AbortController();
 const handler=createDeletionHandler({enabled:true,verify:async()=>({id:'A',email:'a@example.invalid',confirmed:true}),reauthenticate:async()=>{await new Promise(r=>resume=r);return {owner:'A',token:'fresh'};},accept:async()=>{accepted++;return {code:'ok',ownerId:'A',requestId:'r'};}});
 const pending=handler(new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer synthetic'},body:JSON.stringify({password:'password',receiptDigest:'a'.repeat(64)}),signal:controller.signal}));
 await new Promise(r=>setTimeout(r,1));controller.abort();resume();await pending;expect(accepted).toBe(0);
});
const endpoint='https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete';
const auth:any={getSession:async()=>({data:{session:{user:{id:'A'},access_token:'token'}},error:null}),getUser:async()=>({data:{user:{id:'A'}},error:null})};
test('cancel during identity read never dispatches deletion later',async()=>{
 let resume:any,dispatches=0;const controller=new AbortController();
 const delayed={...auth,getUser:async()=>{await new Promise(r=>resume=r);return {data:{user:{id:'A'}},error:null};}};
 const pending=requestAccountDeletion(delayed,endpoint,'A','password',{kind:'unknown'},store,async()=>{dispatches++;return Response.json({status:'accepted',requestId:'r'});},{signal:controller.signal,deadlineMs:30});
 await new Promise(r=>setTimeout(r,1));controller.abort();resume();
 expect((await pending).success).toBe(false);expect(dispatches).toBe(0);
});
test('stalled request finishes with uncertain status even when fetch ignores abort',async()=>{
 const result=await requestAccountDeletion(auth,endpoint,'A','password',{kind:'unknown'},store,async()=>new Promise(()=>{}),{deadlineMs:5});
 expect(result.status).toBe('uncertain');
});
const store={load:async()=>({ownerId:'A',secret:'a'.repeat(64),digest:'b'.repeat(64)}),save:async()=>{}};
test('lost submit preserves explicit uncertain receipt recovery state',async()=>{
 const result=await requestAccountDeletion(auth,endpoint,'A','password',{kind:'unknown'},store,async()=>{throw Error('lost');});
 expect(result.status).toBe('uncertain');expect(result.ownerId).toBe('A');
});
test('wrong password is not disguised as a network outage',async()=>{
 const result=await requestAccountDeletion(auth,endpoint,'A','password',{kind:'unknown'},store,async()=>Response.json({code:'reauth_required'},{status:403}));
 expect(result.status).toBe('rejected');expect(result.message).toContain('password');
});
