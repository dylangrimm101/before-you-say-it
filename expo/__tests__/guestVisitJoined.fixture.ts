// Network-denied integration: real mobile transport -> real route -> real SQL.
// No route/RPC responses are stubbed. Only Auth and external providers are doubles.
import assert from 'node:assert/strict';
import {createHash,randomBytes} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {createNormalFreeSession} from '../lib/normalFreeSession';
import {createGuestVisit} from '../lib/guestVisit';
import {canRetryGuestVisit} from '../lib/guestVisitMessage';
const backend=process.env.BYSI_GUEST_BACKEND;
assert.ok(backend?.startsWith('/'),'BYSI_GUEST_BACKEND must name the hash-pinned local candidate');
const load=(path:string)=>import(pathToFileURL(backend+'/'+path).href);
const {createGuestFixture,guestOwner}=await load('tests/fixtures/guest-visit.mjs');
const {createFreeRoute}=await load('server/native-free/routes.mjs');
const {fixture,input}=await load('tests/fixtures/generation-output.mjs');
const freshSessions=process.env.BYSI_FRESH_SESSIONS==='1';
const f=await createGuestFixture({freshSessions}),originalFetch=globalThis.fetch;
const random=()=>randomBytes(32).toString('hex'),visit=createGuestVisit({now:Date.now,random});visit.activate(guestOwner);
const user={id:guestOwner,is_anonymous:true},disk=new Map<string,string>(),requests:any[]=[],providerCalls:string[]=[];
process.env.ANTHROPIC_API_KEY='synthetic';process.env.OPENAI_API_KEY='synthetic';process.env.ELEVENLABS_API_KEY='synthetic';
const runtime={origin:'https://beforeyousayit.app',key:'c'.repeat(64),spendLimitCents:1000,providerCosts:Object.fromEntries(['transcribe_opener','transcribe_reply','pushback','close','tts_pushback','tts_close','result'].map(k=>[k,1])),
 verifyOwner:async(header:string)=>header==='Bearer synthetic'?guestOwner:null,
 rpc:(owner:string,body:any)=>f.call(body,'bysi_native_free_v2',owner),guestRpc:(owner:string,body:any)=>f.call(body,'bysi_native_guest_visit',owner)};
const route=createFreeRoute({getRuntime:()=>runtime});
globalThis.fetch=(async(url:any,init:any)=>{
 const address=String(url);providerCalls.push(address);
 if(address==='https://api.openai.com/v1/audio/transcriptions')return Response.json({text:'Synthetic raw transcription to be edited before submission.'});
 if(address.startsWith('https://api.elevenlabs.io/v1/text-to-speech/'))return new Response(new Uint8Array([73,68,51,1,2,3]),{headers:{'content-type':'audio/mpeg'}});
 assert.equal(address,'https://api.anthropic.com/v1/messages','unexpected external request forbidden');
 const payload=JSON.parse(JSON.parse(init.body).messages[0].content);
 const output=payload.turn?{mode:'turn',turn:payload.turn,role:'hope',text:payload.turn==='pushback'?input.transcript.counterpart_pushback:'I am already stretched with the client work. Which priority should wait?',safety:null}:fixture();
 return Response.json({id:'synthetic-'+providerCalls.length,model:'synthetic',stop_reason:'end_turn',usage:{input_tokens:1,output_tokens:1},content:[{type:'text',text:JSON.stringify(output)}]});
}) as typeof fetch;
let dropResult=false;
const transport=createNormalFreeSession({origin:runtime.origin,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',
 auth:{getSession:async()=>({data:{session:{user,access_token:'synthetic'}},error:null}),getUser:async()=>({data:{user},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},guestVisit:visit,
 random,hash:async s=>createHash('sha256').update(s).digest('hex'),storage:{getItem:async k=>disk.get(k)??null,setItem:async(k,v)=>{disk.set(k,v);}},
 fetch:async(url,init)=>{const op=url.split('/').at(-1)!;requests.push({op,visit:new Headers(init.headers).get('x-bysi-guest-visit')});
  const response=await route(op==='recover'?'session':op,new Request(url,init));
  if(dropResult&&op==='generate'&&typeof init.body==='string'&&JSON.parse(init.body).type==='free_rehearsal_result'){dropResult=false;assert.equal(response.status,200);throw Error('synthetic lost result acknowledgment');}
  return response;}});
async function json(op:any,body:any){const response=await transport.request(op,body);assert.equal(response.status,200,await response.clone().text());return response.json();}
async function recording(turn:string){const form=new FormData();form.append('turn',turn);form.append('audio',new Blob([new Uint8Array([0,0,0,24,102,116,121,112,77,52,65,32,0,0,0,0])],{type:'audio/mp4'}),'synthetic.m4a');assert.ok((await json('transcribe',form)).text.includes('raw transcription'));}
async function journey(){
 const start=await json('recover',{});assert.equal(start.status,'start');
 await recording('opener');
 const first=await json('generate',{type:'rehearsal_turn',turn:'pushback',contract:input.contract,transcript:{user_turn_1:input.transcript.user_turn_1}});
 const play1=await transport.request('tts',{text:first.text,role:first.role});assert.equal(play1.status,200);assert.equal((await play1.arrayBuffer()).byteLength,6);
 assert.equal((await json('recover',{contract:input.contract,transcript:{user_turn_1:input.transcript.user_turn_1,counterpart_pushback:first.text}})).status,'resume');
 await recording('reply');
 const second=await json('generate',{type:'rehearsal_turn',turn:'close',contract:input.contract,transcript:{...input.transcript,counterpart_pushback:first.text}});
 assert.equal((await transport.request('tts',{text:second.text,role:second.role})).status,200);
 await assert.rejects(transport.request('tts',{text:second.text+' changed',role:second.role}),/approved counterpart/,'authorization must remain exact');
 const approved={type:'free_rehearsal_result',contract:input.contract,transcript:{...input.transcript,counterpart_close:second.text}};
 dropResult=true;await assert.rejects(transport.request('generate',approved),/lost result/);
 const before=providerCalls.length;assert.equal((await json('generate',approved)).mode,'result');assert.equal(providerCalls.length,before,'uncertain final acknowledgment replays without a second provider dispatch');
 const recovered=await transport.request('recover',{});assert.equal(recovered.status,409);assert.equal((await recovered.json()).code,'visit_complete');assert.equal(canRetryGuestVisit('visit_complete'),false);
 return start.sessionId;
}
try{
 if(freshSessions){
  const legacy=await f.call({action:'issue',nonce:'f'.repeat(64)},'bysi_native_free_v2');
  for(const seed of ['1','2'])await f.db.query("insert into bysi_native_free.operation(session_id,id,kind,digest,status) values($1,$2,'transcribe_opener',$3,'failed')",[legacy.sessionId,seed.repeat(64),'d'.repeat(64)]);
  await f.db.exec('insert into bysi_native_free.spend_day(spend_date,spent_cents) values(current_date,5)');
 }
 const first=await journey(),firstVisit=visit.current(guestOwner);
 assert.equal((await json('endVisit',{})).status,'ended');visit.end();
 const second=await journey();assert.notEqual(second,first);assert.notEqual(visit.current(guestOwner),firstVisit);
 assert.equal((await f.db.query('select count(*)::int n from bysi_native_free.operation')).rows[0].n,14+(freshSessions?2:0),'two complete journeys plus unchanged historical attempts');
 assert.equal((await f.db.query('select sum(spent_cents)::int n from bysi_native_free.spend_day')).rows[0].n,14+(freshSessions?5:0),'replays do not spend twice; prior spend stays recorded');
 assert.ok([...disk.values()].every(v=>!v.includes(input.transcript.user_turn_1)&&!v.includes(input.transcript.counterpart_pushback)),'journal remains content-free');
 assert.ok(requests.every(r=>/^[a-f0-9]{64}$/.test(r.visit)));
 console.log('PASS joined guest transport → real routes → SQL: two recordings, approved edits, both Hope/TTS points, result replay, explicit new visit, second journey, exact text authorization and retained spend');
}finally{transport.dispose();globalThis.fetch=originalFetch;await f.close();}
