import { test, expect } from 'bun:test';
import { createAuthBoundPrivateWebBridge } from '../lib/privateWebBridgeCoordinator';
const id='11111111-1111-4111-8111-111111111111';
const user={id:'owner-a',is_anonymous:false,email_confirmed_at:'2026-01-01'};
const tick=()=>new Promise(r=>setTimeout(r,10));
function fixture(discover?:string,fetcher?:any){
 let callback:any;let session:any={access_token:'fixture',user};const calls:any[]=[];
 const auth={getSession:async()=>({data:{session},error:null}),getUser:async()=>({data:{user:session?.user},error:null}),onAuthStateChange:(cb:any)=>{callback=cb;return {data:{subscription:{unsubscribe(){}}}};}};
 const config:any={environment:'test',endpoints:{activate:'http://localhost/a',restore:'http://localhost/r',...(discover?{discover}:{})},auth,fetch:async(url:string,init:any)=>{
  calls.push({url,body:JSON.parse(init.body)});
  if(fetcher)return fetcher(url,init);
  return Response.json(url.endsWith('/d')?{items:[{sessionId:id,capturedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'}],nextCursor:null}:{sessionId:id,privateResult:null,livemode:false});
 }};
 return {config,calls,emit(next:any){session=next;callback('SIGNED_IN',next);}};
}
test('discovery is opt-in; empty is honest; logout and late A cannot restore into B',async()=>{
 const disabled=fixture();const off=createAuthBoundPrivateWebBridge(disabled.config);await tick();expect(disabled.calls).toEqual([]);off.dispose();
 let resolve:any;const slow=new Promise<Response>(r=>{resolve=r;});let discoveries=0;
 const f=fixture('http://localhost/d',async(url:string)=>url.endsWith('/d')?(++discoveries===1?slow:Response.json({items:[],nextCursor:null})):Response.json({sessionId:id,livemode:false,privateResult:null}));
 const bridge=createAuthBoundPrivateWebBridge(f.config);await tick();expect(bridge.getSnapshot().status).toBe('loading');
 f.emit({access_token:'fixture-b',user:{...user,id:'owner-b'}});expect(bridge.getSnapshot().record).toBeNull();await tick();
 expect(bridge.getSnapshot()).toEqual({status:'empty',record:null});
 resolve(Response.json({items:[{sessionId:id,capturedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'}],nextCursor:null}));await tick();
 expect(bridge.getSnapshot()).toEqual({status:'empty',record:null});expect(f.calls.filter(c=>c.url.endsWith('/r'))).toEqual([]);
 f.emit(null);expect(bridge.getSnapshot()).toEqual({status:'idle',record:null});expect(await bridge.discover()).toBe(false);bridge.dispose();
});
test('discovery endpoint validation and malformed/expired/private response fail closed',async()=>{
 const wrong=fixture('https://evil.example/discover');expect(()=>createAuthBoundPrivateWebBridge(wrong.config)).toThrow('configuration');
 for(const page of [{items:[],nextCursor:null,privateText:'not allowed'},{items:[{sessionId:id,capturedAt:'2026-01-01T00:00:00Z',expiresAt:'2000-01-01T00:00:00Z'}],nextCursor:null},{items:[],nextCursor:{sessionId:id,capturedAt:'2026-01-01T00:00:00Z'}}]){
  const f=fixture('http://localhost/d',async()=>Response.json(page));const bridge=createAuthBoundPrivateWebBridge(f.config);await tick();expect(bridge.getSnapshot()).toEqual({status:'unavailable',record:null});expect(f.calls).toHaveLength(1);bridge.dispose();
 }
});
test('logout during ignored-abort discovery clears immediately and cannot start restoration',async()=>{
 let resolve:any;const pending=new Promise<Response>(r=>{resolve=r;});
 const f=fixture('http://localhost/d',()=>pending);const bridge=createAuthBoundPrivateWebBridge(f.config);await tick();
 f.emit(null);expect(bridge.getSnapshot()).toEqual({status:'idle',record:null});
 resolve(Response.json({items:[{sessionId:id,capturedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z'}],nextCursor:null}));await tick();expect(f.calls).toHaveLength(1);expect(bridge.getSnapshot()).toEqual({status:'idle',record:null});bridge.dispose();
});
test('cold start automatically discovers then restores without persisted session ID; restart repeats',async()=>{
 const f=fixture('http://localhost/d');let bridge=createAuthBoundPrivateWebBridge(f.config);await tick();
 expect(bridge.getSnapshot()).toEqual({status:'ready',record:{sessionId:id,privateResult:null}});
 expect(f.calls.map(c=>c.body)).toEqual([{limit:1,cursor:null},{sessionId:id}]);
 bridge.dispose();bridge=createAuthBoundPrivateWebBridge(f.config);await tick();expect(f.calls).toHaveLength(4);bridge.dispose();
});
