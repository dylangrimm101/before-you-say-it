import {test,expect} from 'bun:test';
import {createNativeBilling} from '../lib/nativeBilling';
function fixture(eventInsideGetter=false){
 let listener:Function=()=>{},calls=0;
 const user={id:'owner-a',is_anonymous:false,email_confirmed_at:'2026-01-01'};
 const session={access_token:'synthetic',user};
 const auth={getSession:async()=>{if(eventInsideGetter)listener('SIGNED_IN',session);return {data:{session},error:null}},getUser:async()=>({data:{user},error:null}),onAuthStateChange:(cb:Function)=>{listener=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const billing=createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:async()=>{calls++;return Response.json({allowed:true})}})!;
 return {billing,calls:()=>calls};
}
test('SIGNED_IN inside getSession preserves initial binding and same-owner repeat',async()=>{
 const f=fixture(true);try{expect(await f.billing.access()).toBe(true);expect(await f.billing.access()).toBe(true);expect(f.calls()).toBe(2)}finally{f.billing.dispose()}
});
test('actual native billing reads successful bytes without optional Hermes AbortSignal method',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(AbortSignal.prototype,'throwIfAborted')!;
 Object.defineProperty(AbortSignal.prototype,'throwIfAborted',{configurable:true,value:undefined});
 const f=fixture();
 try{expect(await f.billing.access()).toBe(true);expect(f.calls()).toBe(1)}finally{f.billing.dispose();Object.defineProperty(AbortSignal.prototype,'throwIfAborted',descriptor)}
});
