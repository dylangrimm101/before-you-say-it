import type {OwnerStorageHost} from './ownerPracticeStorage';

export const GUEST_VISIT_BACKGROUND_MS = 30 * 60 * 1000;

/** Conversation lifetime, NOT authentication or an allowance. Never persisted. */
export function createGuestVisit(options: {now(): number; random(): string}) {
  let owner: string | null = null, id: string | null = null;
  let awayAt: number | null = null, holds = 0, expirationDeferred = false;
  const listeners = new Set<() => void>();
  const rotate = () => {
    id = owner ? options.random() : null;
    awayAt = null; expirationDeferred = false;
    for (const listener of listeners) listener();
  };
  return {
    activate(next: string | null) { if (next !== owner) { owner=next;rotate(); } return id; },
    current(expectedOwner: string) { return expectedOwner === owner ? id : null; },
    end() { if (owner) rotate(); },
    subscribe(listener: () => void) { listeners.add(listener);return () => { listeners.delete(listener); }; },
    appState(state: string) {
      // Permission sheets / Control Center are 'inactive', not a new visit.
      if (state === 'background' && awayAt === null) awayAt=options.now();
      if (state !== 'active' || awayAt === null) return;
      const elapsed=options.now()-awayAt;awayAt=null;
      if (elapsed < 0 || elapsed >= GUEST_VISIT_BACKGROUND_MS) {
        if (holds) expirationDeferred=true; else rotate();
      }
    },
    hold() {
      holds++;let released=false;
      return () => { if(released)return;released=true;holds--;if(!holds && expirationDeferred)rotate(); };
    },
  };
}

/** Same interface/serialization as durable storage, with no filesystem backend. */
export function createMemoryPracticeHost(): OwnerStorageHost {
  const values=new Map<string,string>();
  return {
    getItem:async key=>values.get(key)??null,
    setItem:async(key,value)=>{values.set(key,value);},
    removeItem:async key=>{values.delete(key);},
    getAllKeys:async()=>[...values.keys()],
  };
}
