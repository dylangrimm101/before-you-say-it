// Local integration only: actual mobile transport, routes, proof checks and SQL.
// Only Auth, external providers and microphone bytes are synthetic.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createNormalFreeSession} from '../lib/normalFreeSession';
import {createGuestVisit} from '../lib/guestVisit';

export async function recordExchangeBackend(){
  const backend=process.env.BYSI_GUEST_BACKEND;
  assert.ok(backend?.startsWith('/'),'Pinned local backend required');
  const load=(p:string)=>import(pathToFileURL(backend+'/'+p).href);
  const {createGuestFixture,guestOwner}=await load('tests/fixtures/guest-visit.mjs');
  const {createFreeRoute}=await load('server/native-free/routes.mjs');
  const {fixture}=await load('tests/fixtures/generation-output.mjs');
  const db=await createGuestFixture({freshSessions:true});
  const random=()=>randomBytes(32).toString('hex');
  const visit=createGuestVisit({now:Date.now,random});visit.activate(guestOwner);
  const user={id:guestOwner,is_anonymous:true};const disk=new Map<string,string>();
  const runtime={origin:'https://beforeyousayit.app',key:'c'.repeat(64),spendLimitCents:1000,
    providerCosts:Object.fromEntries(['transcribe_opener','transcribe_reply','pushback','close','tts_pushback','tts_close','result'].map(k=>[k,1])),
    verifyOwner:async(h:string)=>h==='Bearer synthetic'?guestOwner:null,
    rpc:(o:string,b:unknown)=>db.call(b,'bysi_native_free_v2',o),guestRpc:(o:string,b:unknown)=>db.call(b,'bysi_native_guest_visit',o)};
  const route=createFreeRoute({getRuntime:()=>runtime});
  let audio:{text:string;role:string;turn:string}|null=null;
  let transcriptions=0;const responses:{operation:string;status:number;code?:string}[]=[];
  let injectedMismatch=false;
  let closeProviderCalls=0;
  let firstContract:Record<string,unknown>|null=null;
  const previousFetch=globalThis.fetch;
  process.env.ANTHROPIC_API_KEY='synthetic';process.env.OPENAI_API_KEY='synthetic';process.env.ELEVENLABS_API_KEY='synthetic';
  globalThis.fetch=(async(url:unknown,init:RequestInit)=>{
    const address=String(url);
    if(address==='https://api.openai.com/v1/audio/transcriptions')return Response.json({text:++transcriptions===1?'Synthetic spoken opener, let us choose a task.':'Synthetic spoken reply, which one comes first?'});
    if(address.startsWith('https://api.elevenlabs.io/v1/text-to-speech/'))return new Response(new Uint8Array([73,68,51,1,2,3]),{headers:{'content-type':'audio/mpeg'}});
    assert.equal(address,'https://api.anthropic.com/v1/messages','Live network forbidden');
    const payload=JSON.parse(JSON.parse(String(init.body)).messages[0].content);
    if(payload.turn==='close'){
      closeProviderCalls++;
      if(process.argv.includes('provider-failure')&&closeProviderCalls===1)return Response.json({error:{type:'overloaded_error'}},{status:503});
    }
    const output=payload.turn?{mode:'turn',turn:payload.turn,role:'hope',text:payload.turn==='pushback'?'I still have my own tasks to finish. Which priority should wait?':'I already feel this is a one-sided problem. I am stretched with the client plan, but not now; I am not promising a whole system.',safety:null}:fixture();
    if(process.argv.includes('provider-failure')&&payload.turn==='close')output.text='You make it sound like every chore falls on you, but I do plenty around here without being asked.';
    if(!payload.turn){
      output.pressure_moment.ask_quote=payload.transcript.user_turn_1;
      output.pressure_moment.pushback_quote=payload.transcript.counterpart_pushback;
      output.pressure_moment.response_quote=payload.transcript.user_turn_2;
    }
    return Response.json({id:'synthetic',model:'synthetic',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(output)}]});
  }) as typeof fetch;
  const transport=createNormalFreeSession({origin:runtime.origin,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',guestVisit:visit,
    auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
    random,hash:async s=>createHash('sha256').update(s).digest('hex'),storage:{getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{disk.set(k,v);}},
    fetch:async(url,init)=>{
      const op=url.split('/').at(-1)!;
      let wire=init;
      if(op==='generate'&&typeof init.body==='string'){
        const sent=JSON.parse(init.body);
        if(sent.turn==='pushback')firstContract=structuredClone(sent.contract);
        if(firstContract&&(sent.turn==='close'||sent.type==='free_rehearsal_result')){
          const changed=Object.keys({...firstContract,...sent.contract}).filter(k=>JSON.stringify(firstContract![k])!==JSON.stringify(sent.contract[k]));
          if(!process.argv.includes('expect-context-rejection'))assert.deepEqual(changed,[],'proof-bound contract fields changed between turns');
        }
      }
      if(process.argv.includes('blocked-check')&&injectedMismatch&&op==='session'&&typeof init.body==='string'){
        const body=JSON.parse(init.body);
        if(body.recover===true){body.contract={...body.contract,scenario:'Synthetic conflicting context'};wire={...init,body:JSON.stringify(body)};}
      }
      if(process.argv.includes('mismatch')&&!injectedMismatch&&op==='generate'&&typeof init.body==='string'){
        const body=JSON.parse(init.body);
        if(body.turn==='close'){
          injectedMismatch=true;
          if(process.argv.includes('expired-proof')){
            // Mutates only the isolated in-memory SQL fixture, never hosted data.
            await db.db.query("update bysi_native_free.session set state=jsonb_set(state,'{proof,expires}','0'::jsonb) where id=$1::uuid",[new Headers(init.headers).get('x-bysi-session')]);
          }else{
            body.contract={...body.contract,scenario:body.contract.scenario+' Synthetic mismatch.'};
            wire={...init,body:JSON.stringify(body)};
          }
        }
      }
      const response=await route(op,new Request(url,wire));
      const body=response.headers.get('content-type')?.includes('json')?await response.clone().json():null;
      responses.push({operation:op,status:response.status,...(body?.code?{code:body.code}:{})});
      if(op==='generate'&&response.ok&&body?.mode==='turn')audio={text:body.text,role:body.role,turn:body.turn};
      return response;
    }});
  return {request:transport.request,responses,get closeProviderCalls(){return closeProviderCalls;},get transcriptionCount(){return transcriptions;},
    async recording(turn:string){const form=new FormData();form.append('turn',turn);form.append('audio',new Blob([new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0])],{type:'audio/mp4'}),'synthetic.m4a');const r=await transport.request('transcribe',form);assert.equal(r.status,200);return (await r.json()).text;},
    async play(text:string){assert.ok(audio);assert.equal(text,audio.text);const r=await transport.request('tts',{text,role:audio.role});assert.equal(r.status,200);await r.arrayBuffer();},
    async close(){transport.dispose();globalThis.fetch=previousFetch;await db.close();}
  };
}
