import {expect,test} from 'bun:test';
import * as nativeDeletion from '../lib/accountDeletion';
import * as service from '../../backend/account-lifecycle/service';
import * as stagingService from '../../backend/account-lifecycle/staging-service';
import {sanitizeClientEnv} from '../lib/clientEnvGuard';
import configure from '../app.config';
import app from '../app.json';
import eas from '../eas.json';

const stagingUrl='https://pqqxaklcburdxjfeolmd.supabase.co';
const stagingEndpoint=`${stagingUrl}/functions/v1/bysi-task1-account-delete`;
const reviewFlag='reviewed-task1-20260910';
const ownerA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ownerB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ownerX='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const emailA='bysi-task1-a-20260910@acceptance.invalid';
const emailB='bysi-task1-b-20260910@acceptance.invalid';

test('staging account deletion endpoint is isolated, exact, and default off',()=>{
 const select=(nativeDeletion as any).reviewedAccountDeletionEndpoint;
 expect(typeof select).toBe('function');
 expect(select({authUrl:stagingUrl,enabled:false,staging:true,buildMode:'staging-account',applicationId:'app.bysi.staging.account',projectId:'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44',reviewFlag})).toBe(null);
 expect(select({authUrl:stagingUrl,enabled:true,staging:true,buildMode:'staging-account',applicationId:'app.bysi.staging.account',projectId:'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44',reviewFlag})).toBe(stagingEndpoint);
 for(const drift of [
  {authUrl:'https://spvksnddzyvycfoefrcf.supabase.co'},
  {authUrl:'https://pqqxaklcburdxjfeolmd.supabase.co/'},
  {staging:false},
  {buildMode:'production'},
  {applicationId:'app.rork.8fc4qwsqaurkxk0pimyvx'},
  {projectId:'1b655360-557d-4dba-ad69-fbf26120e852'},
  {reviewFlag:'reviewed-task1-typo'},
 ]) expect(select({authUrl:stagingUrl,enabled:true,staging:true,buildMode:'staging-account',applicationId:'app.bysi.staging.account',projectId:'b25c7aba-ef9d-4f88-b7c5-4da1678fcf44',reviewFlag,...drift})).toBe(null);
 expect(nativeDeletion.reviewedDeletionEndpoint('https://spvksnddzyvycfoefrcf.supabase.co',true)).toBe('https://spvksnddzyvycfoefrcf.supabase.co/functions/v1/account-delete');
 expect(nativeDeletion.reviewedDeletionEndpoint(stagingUrl,true)).toBe(null);
});

test('staging TestFlight profile is store Release, selects staging Auth, and keeps deletion default off',()=>{
 expect(sanitizeClientEnv(`EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED=${reviewFlag}`).removedNames).toEqual([]);
 expect(sanitizeClientEnv('EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE=1').removedNames).toEqual([]);
 const profile=(eas.build as any)['staging-account-testflight'];
 expect(profile).toMatchObject({
  developmentClient:false,
  distribution:'store',
  environment:'production',
  channel:'staging-account-testflight',
  ios:{simulator:false,buildConfiguration:'Release'},
  env:{EXPO_NO_DOTENV:'1',EXPO_PUBLIC_BYSI_BUILD_MODE:'staging-account',EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE:'1',EXPO_PUBLIC_STAGING_SUPABASE_URL:stagingUrl},
 });
 expect(profile.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED).toBeUndefined();
 const saved={...process.env};
 for(const name of Object.keys(process.env))if(name.startsWith('EXPO_PUBLIC_'))delete process.env[name];
 Object.assign(process.env,{EAS_BUILD_PROFILE:'staging-account-testflight',EXPO_PUBLIC_BYSI_BUILD_MODE:'staging-account',EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE:'1',EXPO_PUBLIC_STAGING_SUPABASE_URL:stagingUrl,EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test'});
 try{
  const cfg=configure({config:app.expo} as any);
  expect(cfg.ios?.bundleIdentifier).toBe('app.bysi.staging.account');
  expect(cfg.extra?.eas?.projectId).toBe('b25c7aba-ef9d-4f88-b7c5-4da1678fcf44');
  expect(cfg.updates).toEqual({enabled:false});
 }finally{
  for(const name of Object.keys(process.env))if(!(name in saved))delete process.env[name];
  Object.assign(process.env,saved);
 }
});

test('staging server composition is exact, fixture-scoped, and manual-worker only',async()=>{
 const env:Record<string,string>={
  SUPABASE_URL:stagingUrl,
  SUPABASE_PUBLISHABLE_KEYS:JSON.stringify({default:'sb_publishable_fixture'}),
  SUPABASE_SECRET_KEYS:JSON.stringify({default:'sb_secret_fixture'}),
  BYSI_ACCOUNT_DELETION_RPC_KEY:'api-rpc-fixture',
  BYSI_TASK1_ACCOUNT_DELETION:'reviewed-task1-20260910',
  BYSI_TASK1_ACCOUNT_DELETION_OWNER_A:ownerA,
  BYSI_TASK1_ACCOUNT_DELETION_OWNER_B:ownerB,
 };
 expect((service as any).deletionConfigFromEnv((name:string)=>env[name]).enabled).toBe(false);
 expect((service as any).createStagingTask1DeletionWorkerFromEnv).toBeUndefined();
 const config=stagingService.stagingTask1DeletionConfigFromEnv((name:string)=>env[name]);
 expect(config).toMatchObject({enabled:true,url:stagingUrl,ownerA,ownerB,emailA,emailB});
 expect(stagingService.stagingTask1DeletionConfigFromEnv((name:string)=>({...env,BYSI_TASK1_ACCOUNT_DELETION:'off'} as any)[name]).enabled).toBe(false);
 expect(stagingService.stagingTask1DeletionConfigFromEnv((name:string)=>({...env,SUPABASE_URL:'https://pqqxaklcburdxjfeolmd.supabase.co/'} as any)[name]).enabled).toBe(false);
 expect(stagingService.stagingTask1DeletionConfigFromEnv((name:string)=>({...env,BYSI_TASK1_ACCOUNT_DELETION_OWNER_A:ownerB} as any)[name]).enabled).toBe(false);
 const calls:any[]=[];
 const handler=stagingService.createStagingTask1DeletionService(config,async(url,init)=>{
  calls.push({url:String(url),method:init?.method,body:init?.body?JSON.parse(String(init.body)):null,auth:new Headers(init?.headers).get('authorization')});
  const path=new URL(String(url)).pathname;
  if(path.endsWith('/token')){
   const body=JSON.parse(String(init?.body));
   if(body.email===emailA)return Response.json({access_token:'fresh-a',user:{id:ownerA}});
   if(body.email===emailB)return Response.json({access_token:'fresh-b',user:{id:ownerB}});
  }
  if(path.endsWith('/rest/v1/rpc/bysi_account_deletion_request'))return Response.json({code:'ok',requestId:'request-a',ownerId:ownerA,status:'accepted'});
  if(path.endsWith('/logout'))return new Response(null,{status:204});
  const token=new Headers(init?.headers).get('authorization')??'';
  if(token.includes('old-b') || token.includes('fresh-b'))return Response.json({id:ownerB,email:emailB,email_confirmed_at:'2026-09-10',is_anonymous:false});
  if(token.includes('old-x'))return Response.json({id:ownerX,email:emailA,email_confirmed_at:'2026-09-10',is_anonymous:false});
  return Response.json({id:ownerA,email:emailA,email_confirmed_at:'2026-09-10',is_anonymous:false});
 });
 const accepted=await handler(new Request(stagingEndpoint,{method:'POST',headers:{Authorization:'Bearer old','Content-Type':'application/json'},body:JSON.stringify({password:'pw',receiptDigest:'a'.repeat(64)})}));
 expect(accepted.status).toBe(202);
 expect(calls.find(c=>c.url.endsWith('/rest/v1/rpc/bysi_account_deletion_request')).auth).toBe('Bearer api-rpc-fixture');
 expect((await handler(new Request(stagingEndpoint,{method:'POST',headers:{Authorization:'Bearer old-b','Content-Type':'application/json'},body:JSON.stringify({password:'pw',receiptDigest:'b'.repeat(64)})}))).status).not.toBe(202);
 expect((await handler(new Request(stagingEndpoint,{method:'POST',headers:{Authorization:'Bearer old-x','Content-Type':'application/json'},body:JSON.stringify({password:'pw',receiptDigest:'c'.repeat(64)})}))).status).toBe(401);
 const authAdminCalls:any[]=[];
 const authAdmin=stagingService.createStagingTask1AuthAdmin(config,{providerCompleted:false},async(url,init)=>{authAdminCalls.push({url:String(url),method:init?.method});return new Response(null,{status:204});});
 await expect(authAdmin.hardDelete(ownerB)).rejects.toThrow();
 await expect(authAdmin.hardDelete(ownerA)).rejects.toThrow(/provider completion/);
 expect(authAdminCalls).toEqual([]);
 expect((service as any).createDeletionWorkerFromEnv((name:string)=>env[name])).toBe(null);
 const worker=stagingService.createStagingTask1DeletionWorkerFromEnv((name:string)=>({...env,BYSI_ACCOUNT_DELETION_WORKER_RPC_KEY:'worker-rpc-fixture'} as any)[name],async()=>Response.json({erased:0}));
 expect(worker?.runOnce).toBeFunction();
 expect(stagingService.createStagingTask1DeletionWorkerFromEnv((name:string)=>({...env,BYSI_TASK1_ACCOUNT_DELETION:'off',BYSI_ACCOUNT_DELETION_WORKER_RPC_KEY:'worker-rpc-fixture'} as any)[name])).toBe(null);
});
