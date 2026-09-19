import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createNormalFreeSession} from '../lib/normalFreeSession';
import {startNormalFreeConversation} from '../lib/normalFreeConversation';
// Use the locked Response implementation installed by React Native, not Bun's
// richer global. Keep the synthetic HTTP server's Response separate.
const ServerResponse=globalThis.Response;
const {Response:NativeResponse}=await import('whatwg-fetch');
assert.equal(typeof (NativeResponse as any).json,'undefined');
globalThis.Response=NativeResponse as typeof Response;
const user={id:'11111111-1111-4111-8111-111111111111',is_anonymous:true};
const disk=new Map<string,string>();const sent:any[]=[];
const client=createNormalFreeSession({origin:'https://beforeyousayit.app',authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',
 auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
 storage:{getItem:async key=>disk.get(key)??null,setItem:async(key,value)=>{disk.set(key,value);}},
 random:()=> 'a'.repeat(64),hash:async value=>createHash('sha256').update(value).digest('hex'),
 guestVisit:{current:()=> 'b'.repeat(64),subscribe:()=>()=>{}},
 fetch:async(_url,init)=>{const body=JSON.parse(String(init.body));sent.push(body);return ServerResponse.json({code:'ok',status:'started',sessionId:user.id,generation:1,canStart:process.argv.includes('allowed')});},
});
try{
 if(process.argv.includes('allowed')){
  const end=await client.request('endVisit',{});assert.deepEqual(await end.json(),{status:'not_started'});assert.equal(sent.length,0);
  const restart=await client.request('restart',{});assert.equal(restart.status,409);assert.deepEqual(await restart.json(),{code:'visit_ended'});
 }else{
  const recovery=await startNormalFreeConversation(client.request);assert.equal(recovery.status,'visit_limit');
  const generated=await client.request('generate',{type:'rehearsal_turn',turn:'pushback',contract:{},transcript:{}});
  assert.equal(generated.status,429);assert.deepEqual(await generated.json(),{code:'visit_limit'});
 }
 assert.deepEqual(sent,[{visit:'begin'}],'local refusal must not issue, restart, or generate more work');
 console.log('PASS locked React Native Response: guest local results and refusal preserve protocol');
}finally{client.dispose();globalThis.Response=ServerResponse;}
