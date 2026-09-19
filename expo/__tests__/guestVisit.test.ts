import {expect, test} from 'bun:test';
import {createGuestVisit, GUEST_VISIT_BACKGROUND_MS, createMemoryPracticeHost} from '../lib/guestVisit';

test('same guest keeps a visit across refresh and brief backgrounding; 30 minutes expires it', () => {
  let now=0, sequence=0, changes=0;
  const visit=createGuestVisit({now:()=>now,random:()=>String(++sequence).padStart(64,'0')});
  visit.subscribe(()=>changes++);
  const first=visit.activate('guest');
  expect(visit.activate('guest')).toBe(first);
  visit.appState('inactive'); now=10; visit.appState('active');
  expect(visit.current('guest')).toBe(first);
  visit.appState('background');now+=GUEST_VISIT_BACKGROUND_MS-1;visit.appState('active');
  expect(visit.current('guest')).toBe(first);
  visit.appState('background');now+=GUEST_VISIT_BACKGROUND_MS;visit.appState('active');
  expect(visit.current('guest')).not.toBe(first);
  expect(changes).toBe(2);
});

test('explicit account handoff defers visit expiration until completion/cancellation', () => {
  let now=0,n=0;
  const visit=createGuestVisit({now:()=>now,random:()=>String(++n).padStart(64,'0')});
  const first=visit.activate('guest');const release=visit.hold();
  visit.appState('background');now+=GUEST_VISIT_BACKGROUND_MS+1;visit.appState('active');
  expect(visit.current('guest')).toBe(first);
  release();expect(visit.current('guest')).not.toBe(first);
});

test('new process, explicit leave and different owner do not restore a previous visit', () => {
  let n=0;const options={now:()=>0,random:()=>String(++n).padStart(64,'0')};
  const visit=createGuestVisit(options),first=visit.activate('a');
  visit.end();expect(visit.current('a')).not.toBe(first);
  expect(visit.current('b')).toBeNull();
  const second=visit.activate('b');expect(second).not.toBe(first);
  expect(createGuestVisit(options).activate('b')).not.toBe(second);
  visit.activate(null);expect(visit.current('b')).toBeNull();
});

test('guest practice host is memory-only, isolated and supports normal owner storage operations', async () => {
  const host=createMemoryPracticeHost(),other=createMemoryPracticeHost();
  await host.setItem('content','private synthetic text');
  expect(await host.getItem('content')).toBe('private synthetic text');
  expect(await other.getItem('content')).toBeNull();
  expect(await host.getAllKeys()).toEqual(['content']);
  await host.removeItem('content');expect(await host.getItem('content')).toBeNull();
});
