import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {mkdirSync,mkdtempSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
/** Local executable review proof, NOT genuine human buyer/processor/archive evidence.
 * Mounted consumer uses the service-role SQL adapter. Private operator below uses
 * the same real PGlite DB as a synthetic DB-owner executor, not a hosted role. */
export async function reviewSyntheticOriginal({web,db,owner,requestId,result}:{web:string;db:any;owner:string;requestId:string;result:any}){
 const {createRecoveryOperator,signReview}=await import(web+'/server/follow-through/recovery-operator.mjs');
 const directory=mkdtempSync(new URL('../../../evidence/operator-',import.meta.url).pathname);mkdirSync(join(directory,'objects'));
 const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
 const keys=generateKeyPairSync('ed25519');
 const artifact=JSON.stringify(result),artifactSha256=hash(artifact);
 writeFileSync(join(directory,'objects',artifactSha256+'.json'),artifact);
 writeFileSync(join(directory,'review-public.pem'),keys.publicKey.export({type:'spki',format:'pem'}));
 const common={version:1,requestId,ownerId:owner,checkoutId:'cs_untrusted_locator',reviewedAt:new Date().toISOString()};
 for(const [name,kind,method] of [['buyer','buyer_control','independent_payment_instrument_control'],['original','original_content','independently_retained_delivery_artifact']]){
  const evidence='SYNTHETIC '+kind+' current reviewer notes. Not genuine ownership or retained historical provenance.';
  const evidenceSha256=hash(evidence);writeFileSync(join(directory,'objects',evidenceSha256+'.evidence'),evidence);
  const payload={...common,kind,method,evidenceSha256,evidenceReference:'synthetic-native-joined-'+name,...(name==='original'?{artifactSha256,originalCreatedAt:'2026-09-01T00:00:00.000Z'}:{})};
  writeFileSync(join(directory,requestId+'.'+name+'.json'),JSON.stringify(signReview(payload,keys.privateKey)));
 }
 // A's erasure implementation is separately owned. Explicit test-only SQL
 // suppression seam is durable/readable, not a client or paid-admission boolean.
 await db.exec("create schema native_benefit_fixture; create table native_benefit_fixture.suppressed_source(checkout_id text primary key); create function public.bysi_follow_through_source_denied(text,text) returns boolean language sql as 'select exists(select 1 from native_benefit_fixture.suppressed_source where checkout_id=$1)'");
 const observations:string[]=[];
 const operator=createRecoveryOperator({database:db,evidenceDirectory:directory,reviewPublicKey:keys.publicKey,priceId:'price_fixture',livemode:false,stripe:async(path:string)=>{
  observations.push(path);
  return {id:'cs_untrusted_locator',mode:'payment',payment_status:'paid',livemode:false,line_items:{has_more:false,data:[{price:{id:'price_fixture'},quantity:1}]},payment_intent:{id:'pi_historical_native',status:'succeeded',latest_charge:{id:'ch_historical_native',payment_intent:'pi_historical_native',livemode:false,paid:true,captured:true,currency:'usd',amount:999,amount_captured:999}}};
 }});
 const applied=await operator.apply(requestId);
 assert.deepEqual(applied,{ok:true,status:'restored',id:requestId});
 assert.deepEqual(observations,['/checkout/sessions/cs_untrusted_locator?expand[]=line_items&expand[]=payment_intent.latest_charge']);
 const rows=(await db.query('select result,owner_id from bysi_follow_through.recovered_original where id=$1',[requestId])).rows;
 assert.equal(rows.length,1);assert.equal(rows[0].owner_id,owner);assert.deepEqual(rows[0].result,result);
 console.log('PASS executable private adjudicator: current synthetic signed buyer/archive review + synthetic Stripe GET -> real immutable SQL; distinct historical source; NOT genuine provenance or A erasure acceptance');
 return {directory,observations};
}
