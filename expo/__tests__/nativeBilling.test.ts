import {test,expect} from 'bun:test';
const mod=await import('../lib/nativeBilling').catch(()=>({} as any));
test('normal billing verifies bearer, binds only server-issued identity, and invalidates late access on logout',async()=>{
 expect(typeof mod.createNativeBilling).toBe('function');
 let listener:any,session:any={access_token:'synthetic',user:{id:'owner',is_anonymous:false,email_confirmed_at:'2026-01-01'}};
 const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session?.user},error:null}),onAuthStateChange:(fn:any)=>{listener=fn;return {data:{subscription:{unsubscribe(){}}}};}};
 const calls:any[]=[];let release:any;let slow=false;
 const billing=mod.createNativeBilling({enabled:true,authUrl:'https://spvksnddzyvycfoefrcf.supabase.co',origin:'https://beforeyousayit.app',auth,fetch:async(url:any,options:any)=>{calls.push([url,options]);if(slow)await new Promise(r=>release=r);return Response.json(url.endsWith('identify')?{appUserId:'11111111-1111-4111-8111-111111111111'}:{allowed:true});}});
 expect(await billing.identify()).toBe('11111111-1111-4111-8111-111111111111');expect(await billing.access()).toBe(true);
 expect(calls[0][1].headers.Authorization).toBe('Bearer synthetic');expect(calls[0][1].body).toBe('{}');
 slow=true;const pending=billing.access();await new Promise(r=>setTimeout(r,10));session=null;listener('SIGNED_OUT',null);release();await expect(pending).rejects.toThrow();billing.dispose();
 expect(mod.createNativeBilling({enabled:false})).toBe(null);
});
