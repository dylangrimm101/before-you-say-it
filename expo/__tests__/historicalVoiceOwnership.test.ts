import {test,expect} from 'bun:test';
import {mkdtemp,readFile,writeFile,mkdir,readdir,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createOwnerVoiceCache} from '../lib/ownerVoiceCache';

test('historical ambiguity preserves unknown bytes but does not strand attributable deleted-owner audio; retry survives reopen and B writes',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'bysi-historical-voice-'));
 let failErase=true;
 const fs:any={cacheDirectory:dir+'/',EncodingType:{Base64:'base64'},
  makeDirectoryAsync:(p:string)=>mkdir(p,{recursive:true}),writeAsStringAsync:(p:string,v:string)=>writeFile(p,v),
  getInfoAsync:async(p:string)=>({exists:await stat(p).then(()=>true,()=>false)}),readDirectoryAsync:readdir,
  deleteAsync:async(p:string)=>{if(failErase)throw Error('interrupted erase');await rm(p,{recursive:true,force:true});}};
 try {
  const first=createOwnerVoiceCache(fs),a=first.lease('historical-A'),b=first.lease('historical-B');
  const aPath=await a.write('a.wav','synthetic A'),bPath=await b.write('b.wav','synthetic B');
  const unknown=join(dir,'rehearsal-voice','unknown.wav');await writeFile(unknown,'unattributed synthetic bytes');
  await expect(first.erase('historical-A')).rejects.toThrow('interrupted erase');
  expect(await readFile(aPath,'utf8')).toBe('synthetic A');
  failErase=false;
  // Recreate the adapter from durable disk, with B as the active writer.
  const reopened=createOwnerVoiceCache(fs);
  await expect(reopened.erase('historical-A')).rejects.toThrow('Unattributed');
  expect((await fs.getInfoAsync(aPath)).exists).toBe(false);
  expect(await readFile(bPath,'utf8')).toBe('synthetic B');
  expect(await readFile(unknown,'utf8')).toBe('unattributed synthetic bytes');
  await b.write('still-active.wav','synthetic B remains active');
  await expect(a.write('late.wav','stale A')).rejects.toThrow();
  await expect(createOwnerVoiceCache(fs).erase('historical-A')).rejects.toThrow('Unattributed');
  expect(await readFile(unknown,'utf8')).toBe('unattributed synthetic bytes');
 }finally{await rm(dir,{recursive:true,force:true});}
});
