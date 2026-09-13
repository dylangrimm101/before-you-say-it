import {test,expect} from 'bun:test';
import {createMigratingSecureSessionStorage} from '../lib/secureSessionStorage';
test('silent native delete failure cannot erase ownership metadata and claim success',async()=>{
 const values=new Map<string,string>();let silent=false;
 const secure={getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{values.set(k,v);},removeItem:async(k:string)=>{if(!silent||!k.startsWith('silent.g.'))values.delete(k);}};
 const storage=createMigratingSecureSessionStorage({secure,legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},namespaceForKey:async()=> 'silent',generation:()=> 'g'});
 await storage.setItem('current',JSON.stringify({source:'A',current:'private'}));silent=true;
 await expect(storage.removeOwnedItem('current','A')).rejects.toThrow();expect(values.has('silent.manifest')).toBe(true);
 silent=false;expect(await storage.removeOwnedItem('current','A')).toBe(true);expect(values.size).toBe(0);
});
function fixture(){
 const values=new Map<string,string>();let generation=0;let blocked='';
 const secure={getItem:async(k:string)=>values.get(k)??null,setItem:async(k:string,v:string)=>{if(new TextEncoder().encode(v).length>1800)throw Error('quota');values.set(k,v);},removeItem:async(k:string)=>{if(k===blocked)throw Error('disk');values.delete(k);}};
 const storage=createMigratingSecureSessionStorage({secure,legacy:{getItem:async()=>null,setItem:async()=>{},removeItem:async()=>{}},namespaceForKey:async()=> 'proof',generation:()=>`g${++generation}`});
 return {storage,values,block:(k:string)=>blocked=k};
}
test('owner erasure deletes actual chunk contract and preserves foreign proof',async()=>{
 const {storage,values}=fixture();await storage.setItem('current',JSON.stringify({source:'B',current:'x'.repeat(6000)}));
 const before=[...values];expect(await storage.removeOwnedItem('current','A')).toBe(false);expect([...values]).toEqual(before);
 await storage.setItem('current',JSON.stringify({source:'guest',target:'A',current:'x'.repeat(6000)}));
 expect(await storage.removeOwnedItem('current','A')).toBe(true);expect(values.size).toBe(0);
});
test('partial deletion retains owner authority for retry despite missing chunks',async()=>{
 const {storage,values,block}=fixture();await storage.setItem('current',JSON.stringify({source:'A',current:'x'.repeat(6000)}));
 const chunk=[...values.keys()].filter(k=>!k.endsWith('manifest')).at(-1)!;block(chunk);
 await expect(storage.removeOwnedItem('current','A')).rejects.toThrow();
 await expect(storage.removeOwnedItem('current','B')).rejects.toThrow();
 await expect(storage.setItem('current',JSON.stringify({source:'B'}))).rejects.toThrow();
 await expect(storage.getItem('current')).rejects.toThrow();
 block('');expect(await storage.removeOwnedItem('current','A')).toBe(true);expect(values.size).toBe(0);
});
test('missing chunks cannot masquerade as absent owner data',async()=>{
 const {storage,values}=fixture();await storage.setItem('current',JSON.stringify({source:'A',current:'x'.repeat(6000)}));
 values.delete([...values.keys()].find(k=>!k.endsWith('manifest'))!);
 await expect(storage.removeOwnedItem('current','A')).rejects.toThrow();expect(values.size).toBeGreaterThan(0);
});
