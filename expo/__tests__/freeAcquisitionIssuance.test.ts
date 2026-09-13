import {test,expect} from 'bun:test';
import {harness,pushback} from './freeAcquisitionHarness.fixture';

test('unsupported operation cannot allocate a session or touch secure storage',async()=>{
 const h=harness(),client=h.create();
 await expect(client.request({...pushback,lesson_constraints:{}})).rejects.toThrow('Invalid acquisition operation');
 expect(h.requests).toHaveLength(0);expect(h.secure.size).toBe(0);
 client.dispose();
});

test('approved scene and transcript are snapshotted before asynchronous Auth',async()=>{
 const h=harness(),client=h.create();const payload=structuredClone(pushback);
 const pending=client.request(payload);payload.contract.scenario='A different scene';payload.transcript.user_turn_1='Replaced after submit';
 expect((await pending).status).toBe(200);
 const sent=await h.requests.find(r=>r.url.endsWith('/generate'))!.json();
 expect(sent.contract).toEqual(pushback.contract);expect(sent.transcript).toEqual(pushback.transcript);
 client.dispose();
});

test('failed capability persistence retains issuance intent and blocks renewed spending',async()=>{
 const h=harness(),save=h.options.storage.setItem;let writes=0;
 h.options.storage.setItem=async(k,v)=>{writes++;if(v.startsWith('bysi_signup='))throw Error('Synthetic capability commit failure');await save(k,v);};
 let client=h.create();await expect(client.request(pushback)).rejects.toThrow();client.dispose();client=h.create();
 await expect(client.request(pushback)).rejects.toThrow('recovery required');
 expect(h.requests).toHaveLength(1);expect(h.outputs).toHaveLength(0);expect(writes).toBe(2);client.dispose();
});

test('failed intent persistence prevents even session allocation',async()=>{
 const h=harness();h.options.storage.setItem=async()=>{throw Error('Synthetic storage unavailable');};const client=h.create();
 await expect(client.request(pushback)).rejects.toThrow();expect(h.requests).toHaveLength(0);client.dispose();
});

test('known persisted capability still resumes after session response loss',async()=>{
 const h=harness();let client=h.create();await client.request(pushback);client.dispose();const saved=[...h.secure.values()];
 const send=h.options.fetch;h.options.fetch=async()=>{throw Error('Synthetic offline');};client=h.create();
 await expect(client.request(pushback)).rejects.toThrow();client.dispose();expect([...h.secure.values()]).toEqual(saved);
 h.options.fetch=send;client=h.create();expect((await client.request(pushback)).status).toBe(200);expect(h.rows.size).toBe(1);client.dispose();
});

test('uncertain session issuance cannot mint another quota identity after restart',async()=>{
 const h=harness();const send=h.options.fetch;let sessionCalls=0;
 h.options.fetch=async(url,init)=>{
  const response=await send(url,init);
  if(String(url).endsWith('/session')){sessionCalls++;throw Error('Synthetic response loss after server commit');}
  return response;
 };
 let client=h.create();
 await expect(client.request(pushback)).rejects.toThrow();
 client.dispose();client=h.create();
 await expect(client.request(pushback)).rejects.toThrow();
 expect(sessionCalls).toBe(1);expect(h.rows.size).toBe(1);expect(h.outputs).toHaveLength(0);
 client.dispose();
});
