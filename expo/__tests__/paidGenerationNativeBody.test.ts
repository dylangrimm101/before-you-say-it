import {test,expect} from 'bun:test';
import {createPaidGenerationTransport,PAID_STAGING_ENDPOINT} from '../lib/paidGeneration';
function setup(body:()=>Promise<ArrayBuffer>,headers:Record<string,string>={}){
 const owner='11111111-1111-4111-8111-111111111111';let listener:(event:string,session:null)=>void=()=>{};
 const auth={async getSession(){return {data:{session:{access_token:'synthetic.token.only',user:{id:owner}}},error:null}},async getUser(){return {data:{user:{id:owner,is_anonymous:false,email_confirmed_at:'2026-01-01'}},error:null}},onAuthStateChange(cb:typeof listener){listener=cb;return {data:{subscription:{unsubscribe(){}}}}}};
 const transport=createPaidGenerationTransport({developmentBuild:true,staging:true,authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co',endpoint:PAID_STAGING_ENDPOINT,auth,fetch:async()=>({status:200,headers:new Headers(headers),body:undefined,arrayBuffer:body} as Response)})!;
 return {transport,logout:()=>listener('SIGNED_OUT',null)};
}
const bytes=(text:string)=>new TextEncoder().encode(text).buffer;
test('native non-streaming paid generation preserves exact JSON body and headers',async()=>{
 const text=JSON.stringify({mode:'turn',text:'Synthetic native output'});const x=setup(async()=>bytes(text),{'content-type':'application/json'});
 try{const response=await x.transport.request({});expect(await response.text()).toBe(text);expect(response.headers.get('content-type')).toBe('application/json');}finally{x.transport.dispose();}
});
test('native non-streaming paid generation rejects oversized buffered output',async()=>{
 const x=setup(async()=>new ArrayBuffer(131073));try{await expect(x.transport.request({})).rejects.toThrow('Practice response too large');}finally{x.transport.dispose();}
});
test('native non-streaming paid generation rejects logout during body read',async()=>{
 const x=setup(async()=>{x.logout();return bytes('{}');});try{await expect(x.transport.request({})).rejects.toThrow();}finally{x.transport.dispose();}
});
test('native non-streaming paid generation deadline includes stalled body read',async()=>{
 const x=setup(async()=>new Promise<ArrayBuffer>(()=>{}));try{await expect(x.transport.request({},5)).rejects.toThrow();}finally{x.transport.dispose();}
});
