import { test, expect } from 'bun:test';
import { createOwnerPracticeStorage } from '../lib/ownerPracticeStorage';

test('owner namespaces quarantine legacy and survive cold start without cross-owner records', async () => {
  const values = new Map([['cc.sessions.v2', 'legacy private'], ['unrelated', 'preserve']]);
  const raw = { getItem: async (k:string) => values.get(k) ?? null, setItem: async (k:string,v:string) => { values.set(k,v); }, removeItem: async (k:string) => { values.delete(k); }, getAllKeys: async () => [...values.keys()] };
  const a = createOwnerPracticeStorage(raw, 'project:A');
  expect(await a.getItem('cc.sessions.v2')).toBeNull();
  await a.setItem('cc.sessions.v2', 'A history');
  a.invalidate();
  const b = createOwnerPracticeStorage(raw, 'project:B');
  expect(await b.getItem('cc.sessions.v2')).toBeNull();
  await expect(a.setItem('cc.sessions.v2', 'late A')).rejects.toThrow('Account changed');
  expect(await createOwnerPracticeStorage(raw, 'project:A').getItem('cc.sessions.v2')).toBe('A history');
  expect(values.get('cc.sessions.v2')).toBe('legacy private');
  expect(values.get('unrelated')).toBe('preserve');
});

test('in-flight old-owner write drains before cold-start reads; queued stale writes fail', async () => {
  const values = new Map<string,string>();
  let release!:()=>void;
  const wait = new Promise<void>(r => { release=r; });
  let started!:()=>void;
  const entered = new Promise<void>(r=>{started=r;});
  const raw = { getItem: async(k:string)=>values.get(k)??null, setItem: async(k:string,v:string)=>{started();await wait;values.set(k,v);}, removeItem:async(k:string)=>{values.delete(k);},getAllKeys:async()=>[...values.keys()] };
  const a=createOwnerPracticeStorage(raw,'A');
  const pending=a.setItem('cc.activeScenarioRun.v1','A');
  await entered;a.invalidate();
  const cold=createOwnerPracticeStorage(raw,'A');
  const read=cold.getItem('cc.activeScenarioRun.v1');
  release();
  await expect(pending).rejects.toThrow('Account changed');
  expect(await read).toBe('A');
  expect(await createOwnerPracticeStorage(raw,'B').getItem('cc.activeScenarioRun.v1')).toBeNull();
});
