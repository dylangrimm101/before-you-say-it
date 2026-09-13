import {test,expect} from 'bun:test';
import {createOwnerVoiceCache,quarantineOwnerVoiceCache} from '../lib/ownerVoiceCache';
test('targeted generated audio erase preserves B and rejects late A writes',async()=>{
 const files=new Map<string,string>();const fs:any={cacheDirectory:'cache/',EncodingType:{Base64:'base64'},makeDirectoryAsync:async()=>{},writeAsStringAsync:async(k:string,v:string)=>{files.set(k,v);},getInfoAsync:async(k:string)=>({exists:[...files.keys()].some(f=>f===k||f.startsWith(k))}),deleteAsync:async(k:string)=>{for(const f of files.keys())if(f===k||f.startsWith(k))files.delete(f);},readDirectoryAsync:async()=>[]};
 const cache=createOwnerVoiceCache(fs);const a=cache.lease('A'),b=cache.lease('B');
 await a.write('one.wav','YQ==');const foreign=await b.write('one.wav','Yg==');await cache.erase('A');
 expect(files.has(foreign)).toBe(true);await expect(a.write('late.wav','YQ==')).rejects.toThrow();
});
test('unattributed historical audio is a visible cleanup blocker, not broad erasure permission',async()=>{
 const fs:any={cacheDirectory:'cache/',getInfoAsync:async(key:string)=>({exists:key==='cache/rehearsal-voice/'}),readDirectoryAsync:async()=>['legacy.wav'],deleteAsync:async()=>{throw Error('must not delete unknown owner');}};
 await expect(createOwnerVoiceCache(fs).erase('A')).rejects.toThrow('Unattributed');
});
test('confirmed deletion synchronously rejects both captured and new voice leases before secure cleanup',async()=>{
 const files=new Map<string,string>();
 const fs:any={cacheDirectory:'quarantine-cache/',EncodingType:{Base64:'base64'},makeDirectoryAsync:async()=>{},writeAsStringAsync:async(key:string,value:string)=>{files.set(key,value);}};
 const cache=createOwnerVoiceCache(fs),captured=cache.lease('quarantined-owner'),foreign=cache.lease('unaffected-owner');
 quarantineOwnerVoiceCache('quarantined-owner');
 await expect(captured.write('late.wav','YQ==')).rejects.toThrow();
 expect(()=>cache.lease('quarantined-owner')).toThrow();
 const result=await foreign.write('kept.wav','Yg==');expect(files.has(result)).toBe(true);
});
