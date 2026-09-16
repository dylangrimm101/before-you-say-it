import {test,expect} from 'bun:test';
import {createNormalFreeSession} from '../lib/normalFreeSession';
for(const stage of ['owner-getUser','logout-getSession','logout-getUser'])test(`free first request rejects ${stage} before local journal or server dispatch`,async()=>{
 let event:Function=()=>{},calls=0,writes=0;
 const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:true};
 const auth={getSession:async()=>{if(stage==='logout-getSession')event('SIGNED_OUT',null);return {data:{session:{access_token:'synthetic',user}},error:null}},getUser:async()=>{if(stage==='owner-getUser')event('SIGNED_IN',{user:{id:'22222222-2222-4222-8222-222222222222'}});if(stage==='logout-getUser')event('SIGNED_OUT',null);return {data:{user},error:null}},onAuthStateChange:(cb:Function)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const client=createNormalFreeSession({auth,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',storage:{getItem:async()=>null,setItem:async()=>{writes++}},random:()=> 'a'.repeat(64),hash:async()=> 'b'.repeat(64),fetch:async()=>{calls++;return Response.json({status:'start',generation:0})}});
 try{await expect(client.request('recover',{})).rejects.toThrow(/changed|aborted/i);expect(calls).toBe(0);expect(writes).toBe(0)}finally{client.dispose()}
});
