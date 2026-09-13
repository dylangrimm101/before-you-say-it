type FileHost=Pick<typeof import('expo-file-system/legacy'),'cacheDirectory'|'makeDirectoryAsync'|'writeAsStringAsync'|'getInfoAsync'|'deleteAsync'|'readDirectoryAsync'|'EncodingType'>;
const epochs=new Map<string,number>();const queues=new Map<string,Promise<unknown>>();
const quarantinedOwners=new Set<string>();
export function quarantineOwnerVoiceCache(owner:string){quarantinedOwners.add(owner);}
export function createOwnerVoiceCache(fs:FileHost){
 const root=()=>{if(!fs.cacheDirectory)throw new Error('Voice cache unavailable');return fs.cacheDirectory+'rehearsal-voice/';};
 const directory=(owner:string)=>root()+'owners/'+encodeURIComponent(owner)+'/';
 const run=<T>(owner:string,fn:()=>Promise<T>)=>{const key=directory(owner);const promise=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(fn);queues.set(key,promise);void promise.finally(()=>{if(queues.get(key)===promise)queues.delete(key);}).catch(()=>{});return promise;};
 return {
  lease(owner:string){
   if(quarantinedOwners.has(owner))throw new Error('Voice owner deleted');
   if(!owner)throw new Error('Voice owner required');const key=directory(owner),epoch=epochs.get(key)??0;
   return {write:(name:string,base64:string)=>run(owner,async()=>{
    if(quarantinedOwners.has(owner)||epoch!==(epochs.get(key)??0))throw new Error('Voice owner changed');
    if(!/^[a-zA-Z0-9_.-]+$/.test(name))throw new Error('Invalid voice filename');
    await fs.makeDirectoryAsync(key,{intermediates:true});const uri=key+name;
    await fs.writeAsStringAsync(uri,base64,{encoding:fs.EncodingType.Base64});
    if(quarantinedOwners.has(owner)||epoch!==(epochs.get(key)??0)){await fs.deleteAsync(uri,{idempotent:true});throw new Error('Voice owner changed');}
    return uri;
   })};
  },
  async erase(owner:string){
   const key=directory(owner);epochs.set(key,(epochs.get(key)??0)+1);
   await run(owner,async()=>{
    // Remove only proven owner bytes first. Ambiguous historical files must not
    // strand known A audio, authorize deleting B, or count as verified cleanup.
    if((await fs.getInfoAsync(key)).exists)await fs.deleteAsync(key,{idempotent:true});
    if((await fs.getInfoAsync(key)).exists)throw new Error('Voice cleanup not confirmed');
    if((await fs.getInfoAsync(root())).exists){const entries=await fs.readDirectoryAsync(root());if(entries.some(name=>name!=='owners'))throw new Error('Unattributed historical voice cache requires scoped cleanup');}
   });
  },
 };
}
