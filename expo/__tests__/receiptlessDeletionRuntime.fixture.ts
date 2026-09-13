import {expect,test,mock} from 'bun:test';
import {randomUUID,createHash} from 'node:crypto';

const secureDisk=new Map<string,string>();
const service='beforeyousayit.supabase';
const environment={url:'https://spvksnddzyvycfoefrcf.supabase.co',key:'synthetic-public',keychainService:service,staging:false};
let silentWrites=false;
let silentRemoves=false;
const keyOf=(key:string,options?:{keychainService?:string})=>{
 if(!/^[A-Za-z0-9._-]+$/.test(key))throw new Error('Invalid native SecureStore key');
 return `${options?.keychainService??'default'}:${key}`;
};

mock.module('expo-secure-store',()=>({
 isAvailableAsync:async()=>true,
 AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:4,
 getItemAsync:async(key:string,options?:{keychainService?:string})=>secureDisk.get(keyOf(key,options))??null,
 setItemAsync:async(key:string,value:string,options?:{keychainService?:string})=>{
  if(silentWrites)return;
  secureDisk.set(keyOf(key,options),value);
 },
 deleteItemAsync:async(key:string,options?:{keychainService?:string})=>{if(silentRemoves)return;secureDisk.delete(keyOf(key,options));},
}));
mock.module('expo-crypto',()=>({CryptoDigestAlgorithm:{SHA256:'SHA256'},randomUUID,digestStringAsync:async(_:string,value:string)=>createHash('sha256').update(value).digest('hex')}));
mock.module('@react-native-async-storage/async-storage',()=>({default:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{},getAllKeys:async()=>[],multiRemove:async()=>{}}}));
mock.module('@/lib/supabase',()=>({supabase:null,authEnvironment:environment,isAuthConfigured:false}));
mock.module('react-native',()=>({Platform:{OS:'ios'}}));
mock.module('@/lib/baselineAudio',()=>({baselineFileName:(id:string)=>`${id.replace(/[^a-zA-Z0-9_-]/g,'')||'session'}.m4a`,listBaselineAudioFileNamesStrict:async()=>[],deleteBaselineAudioStrict:async()=>{}}));
mock.module('expo-file-system/legacy',()=>({cacheDirectory:'cache/'}));

const hex=(value:string)=>value.repeat(64).slice(0,64);

test('native valid keys and one verified chunked snapshot retain capabilities and tombstones across restart',async()=>{
 secureDisk.clear();
 const runtime=await import('../lib/accountLifecycleRuntime');
 const journal=runtime.createRuntimeDeletionJournal();
 await Promise.all(['owner-A','owner-B'].map(ownerId=>journal.capabilityStore.save({ownerId,secret:hex('a'),digest:hex('b'),registered:true})));
 expect(await journal.capabilityStore.listRegisteredOwners()).toEqual(['owner-A','owner-B']);
 await journal.mark('owner-A','deleted');await journal.complete('owner-A');
 const restart=runtime.createRuntimeDeletionJournal();
 expect(await restart.records()).toContainEqual({ownerId:'owner-A',status:'deleted',phase:'complete'});
 expect(restart.blocked('owner-A')).toBe(true);
 expect(await restart.capabilityStore.listRegisteredOwners()).toEqual(['owner-B']);
 expect([...secureDisk.keys()].every(key=>!key.includes('%'))).toBe(true);
 expect([...secureDisk.keys()].some(key=>key.includes('journal'))).toBe(true);
});

test('missing committed journal chunk cannot be interpreted as no deleted owners',async()=>{
 secureDisk.clear();
 const runtime=await import('../lib/accountLifecycleRuntime');const journal=runtime.createRuntimeDeletionJournal();
 await journal.mark('owner-A','deleted');
 const chunk=[...secureDisk.keys()].find(key=>key.includes('journal')&&key.endsWith('.0'))!;
 secureDisk.delete(chunk);
 await expect(runtime.createRuntimeDeletionJournal().records()).rejects.toThrow();
});
test('silent native writes reject physically; old snapshot remains discoverable and retry completes',async()=>{
 secureDisk.clear();
 const runtime=await import('../lib/accountLifecycleRuntime');const journal=runtime.createRuntimeDeletionJournal();
 await journal.capabilityStore.save({ownerId:'owner-A',secret:hex('a'),digest:hex('b'),registered:true});
 silentWrites=true;
 try{await expect(journal.mark('owner-A','deleted')).rejects.toThrow();}finally{silentWrites=false;}
 expect(journal.blocked('owner-A')).toBe(true);
 expect(await runtime.createRuntimeDeletionJournal().capabilityStore.listRegisteredOwners()).toEqual(['owner-A']);
 await journal.mark('owner-A','deleted');await journal.complete('owner-A');
 expect(await runtime.createRuntimeDeletionJournal().records()).toEqual([{ownerId:'owner-A',status:'deleted',phase:'complete'}]);
});
test('exact Auth origin and keychain tuples cannot read another environment journal',async()=>{
 secureDisk.clear();
 const runtime=await import('../lib/accountLifecycleRuntime');await runtime.createRuntimeDeletionJournal().mark('owner-A','deleted');
 const original={...environment};
 try{
  environment.url+='/';expect(await runtime.createRuntimeDeletionJournal().records()).toEqual([]);
  environment.url=original.url;environment.keychainService+='-other';expect(await runtime.createRuntimeDeletionJournal().records()).toEqual([]);
 }finally{Object.assign(environment,original);}
 expect(await runtime.createRuntimeDeletionJournal().records()).toEqual([{ownerId:'owner-A',status:'deleted',phase:'pending'}]);
});
test('retired capability chunks must be physically erased before completion is accepted',async()=>{
 secureDisk.clear();const runtime=await import('../lib/accountLifecycleRuntime');const journal=runtime.createRuntimeDeletionJournal();
 await journal.capabilityStore.save({ownerId:'owner-A',secret:hex('a'),digest:hex('b'),registered:true});
 silentRemoves=true;
 try{await expect(journal.mark('owner-A','deleted')).rejects.toThrow();}finally{silentRemoves=false;}
 await journal.mark('owner-A','deleted');await journal.complete('owner-A');
 expect([...secureDisk.values()].join('')).not.toContain(hex('a'));
 expect((await runtime.createRuntimeDeletionJournal().records())[0].phase).toBe('complete');
});
