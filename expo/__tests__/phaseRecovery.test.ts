import {test,expect} from 'bun:test';
import * as recovery from '../lib/phaseRecovery';
import {createNormalFreeSession} from '../lib/normalFreeSession';
test('owner change during recovery publishes neither journal nor old audio',async()=>{
 const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:true};let event:any;let resolve:any;let writes=0;
 const client=createNormalFreeSession({origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:(cb:any)=>{event=cb;return {data:{subscription:{unsubscribe(){}}}};}} as any,random:()=>'a'.repeat(64),hash:async s=>s,storage:{getItem:async()=>null,setItem:async()=>{writes++;}},fetch:async()=>new Promise<Response>(r=>{resolve=r;})});
 try{
 const response=client.request('recover',{});const denial=response.then(()=>null,error=>error);
 for(let i=0;i<30&&!resolve;i++)await new Promise(r=>setTimeout(r,0));expect(resolve).toBeDefined();event('SIGNED_OUT',null);
 resolve(Response.json({status:'resume',generation:0,sessionId:user.id,audio:{text:'Old owner content',turn:'pushback',role:'hope'}}));expect(await denial).toBeInstanceOf(Error);expect(writes).toBe(0);
 }finally{client.dispose();}
});
test('reservation codes retain distinct recovery actions',()=>{
 expect(recovery.reservationRecoveryMessage('phase')).toContain('does not match');
 expect(recovery.reservationRecoveryMessage('pending')).toContain('still being checked');
 expect(recovery.reservationRecoveryMessage('conflict')).toContain('changed elsewhere');
 expect(recovery.reservationRecoveryMessage('made_up')).toBeNull();
});
test('recovered pushback appends once; mismatched local conversation never enables opener',()=>{
 const first={id:'u',role:'user',text:'Approved opener'};
 const state={status:'resume',phase:'pushback',audio:{text:'Approved Hope',role:'hope',turn:'pushback'},sessionId:'s',generation:0};
 const restored=recovery.applyRecovery(state,[first] as any);expect(restored.ready).toBe(true);expect(restored.turns.map((t:any)=>t.role)).toEqual(['user','them']);
 expect(recovery.applyRecovery(state,restored.turns).turns).toEqual(restored.turns);
 expect(recovery.applyRecovery({status:'context_mismatch'},[]).ready).toBe(false);
 expect(recovery.applyRecovery({status:'proof_expired'},restored.turns).ready).toBe(false);
 expect(recovery.applyRecovery({status:'start',generation:1,used:false},[first] as any).ready).toBe(false);
 expect(recovery.applyRecovery(state,[...restored.turns,{id:'bad',role:'them',text:'wrong role'}]).ready).toBe(false);
});

test('server checkpoint reconstructs lost approved conversation without local transcript history',()=>{
 const state={
  status:'resume',
  phase:'close',
  sessionId:'s',
  generation:0,
  audio:{text:'Which priority should wait?',role:'hope',turn:'close'},
  checkpoint:{
   revision:1,
   phase:'close',
   contract:{scenario:'approved'},
   transcript:{
    user_turn_1:'Can we choose one task?',
    counterpart_pushback:'Everything matters.',
    user_turn_2:'Which one comes first?',
    counterpart_close:'Which priority should wait?'
   },
   provenance:{source:'server_generation'}
  }
 };
 const restored=recovery.applyRecovery(state as any,[]);
 expect(restored.ready).toBe(true);
 expect(restored.turns.map((turn:any)=>[turn.role,turn.text])).toEqual([
  ['user','Can we choose one task?'],
  ['them','Everything matters.'],
  ['user','Which one comes first?'],
  ['them','Which priority should wait?']
 ]);
 expect(restored.audio).toEqual(state.audio);
});
