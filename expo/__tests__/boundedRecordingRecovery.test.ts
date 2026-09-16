import {test,expect} from 'bun:test';
import {applyRecovery,recoveryMessage,reservationRecoveryMessage,mayRequestRestart} from '../lib/phaseRecovery';
import {createNormalFreeSession} from '../lib/normalFreeSession';
test('recording limit restores approved words read-only and gives truthful terminal copy',()=>{
 const state={status:'recording_limit',phase:'pushback',sessionId:'synthetic',generation:0,audio:{text:'Approved counterpart',role:'hope',turn:'pushback'},checkpoint:{transcript:{user_turn_1:'Approved opener',counterpart_pushback:'Approved counterpart'}}};
 const restored=applyRecovery(state,[]);
 expect(restored.ready).toBe(false);expect(restored.turns.map(t=>t.text)).toEqual(['Approved opener','Approved counterpart']);
 expect(mayRequestRestart(state)).toBe(false);
 expect(recoveryMessage('recording_limit')).toContain('recording limit');
 expect(recoveryMessage('recording_limit')).not.toContain('Check again');
 expect(reservationRecoveryMessage('recording_limit')).toBe(recoveryMessage('recording_limit'));
 expect(reservationRecoveryMessage('spend_limit')).toContain('temporarily unavailable');
});
test('normal session retains journal at recording limit without issuance or provider retry',async()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:true};
 const stored=JSON.stringify({nonce:'a'.repeat(64),sessionId:'22222222-2222-4222-8222-222222222222',generation:0,operations:{}});let value=stored;
 const calls:string[]=[];
 const client=createNormalFreeSession({origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})} as any,storage:{getItem:async()=>value,setItem:async(_k,v)=>{value=v;}},random:()=> 'b'.repeat(64),hash:async()=> 'c'.repeat(64),fetch:async(url,init)=>{calls.push(url);return Response.json(JSON.parse(String(init.body)).recover?{status:'recording_limit',sessionId:'22222222-2222-4222-8222-222222222222',generation:0}:{code:'recording_limit'},{status:200});}});
 try{expect((await (await client.request('recover',{})).json()).status).toBe('recording_limit');expect(calls).toHaveLength(1);expect(JSON.parse(value).sessionId).toBe(JSON.parse(stored).sessionId);}finally{client.dispose();}
});
