import {mock} from 'bun:test';
import assert from 'node:assert/strict';
import React from 'react';
import {readFileSync} from 'node:fs';
import {verifyComponentTestDeps} from '../scripts/component-test-deps';

const {create,act}=await import(verifyComponentTestDeps());
(globalThis as any).IS_REACT_ACT_ENVIRONMENT=true;
const Host=(p:any)=>React.createElement('view',p,p.children);
mock.module('react-native',()=>({View:Host,Text:Host}));
mock.module('@/components/ui',()=>({PrimaryButton:(p:any)=>React.createElement('button',p,p.label)}));

let user:any={id:'11111111-1111-4111-8111-111111111111'};
const web=new URL('../../server/',import.meta.url).pathname;
const {setupContent}=await import(web+'tests/normal-results-proof.mjs');
const {db,contentDatabase}=await setupContent();
try{
 await db.exec(readFileSync(web+'server/follow-through/schema.sql','utf8'));
 await db.exec(readFileSync(web+'server/follow-through/recovery.sql','utf8'));
 const {createFollowThroughAuthority}=await import(web+'server/follow-through/authority.mjs');
 const authority=createFollowThroughAuthority({database:contentDatabase,verifyOwner:async token=>token,stripe:async()=>{throw Error('Synthetic checkout unavailable; no provider request');},priceId:'price_synthetic',livemode:false,origin:'https://beforeyousayit.app'});
 await assert.rejects(authority.checkout(user.id,{operationId:'33333333-3333-4333-8333-333333333333',intent:'fixture',rawMessage:'fixture',negativePattern:'fixture',situationType:'fixture',forecast:{fixture:true}}));
 let lastListing:any;
 const normalResults={discoverBenefit:async()=>{lastListing=await authority.discover(user.id);return lastListing;}};
 mock.module('@/providers/auth',()=>({useAuth:()=>({user,normalResults})}));
 let access:any={data:false,isPending:false,isFetching:false,isError:false,refetch:async()=>{}};
 mock.module('@/lib/purchases',()=>({useNativeServerAccess:()=>access,useRestorePurchases:()=>({isPending:false,mutateAsync:async()=>false})}));
 const {QueryClient,QueryClientProvider}=await import('@tanstack/react-query');
 const {NativeBillingGate}=await import('../components/NativeBillingGate');
 const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
 let offerMounts=0;
 function OrdinaryOffer(){offerMounts++;return <Host>ordinary byis_pro_monthly_5 offer</Host>;}
 const app=()=> <QueryClientProvider client={client}><NativeBillingGate onContinue={()=>{}} onLogin={()=>{}}><OrdinaryOffer/></NativeBillingGate></QueryClientProvider>;
 let root:any;await act(async()=>{root=create(app());});
 const text=()=>JSON.stringify(root.toJSON());
 const button=(label:string)=>root.root.findAllByType('button').find((b:any)=>b.props.label===label);
 await act(async()=>{button('I bought the one-time Follow-Through plan').props.onPress();await new Promise(r=>setTimeout(r,30));});
 assert.equal(lastListing.items.length,1);
 assert.equal(lastListing.items[0].status,'checkout_pending');
 assert.ok(!text().includes('Original Follow-Through is verified for this account.'));
 assert.ok(text().includes('Original Follow-Through recovery is pending for this account.'));
 assert.equal(button('View monthly practice offer'),undefined);
 assert.equal(button('Continue to practice'),undefined);
 assert.equal(offerMounts,0);
 await act(async()=>root.unmount());client.clear();
 console.log('PASS unpaid checkout intent remains recovery inventory, not verified original purchase. Real authority + mounted gate; synthetic checkout failure only.');
}finally{
 await db.close();
}
