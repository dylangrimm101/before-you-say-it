import React, {useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/providers/auth';
import * as purchases from '@/lib/purchases';
import {PrimaryButton} from '@/components/ui';
/** Normal rollout only. Web-owner durable billing has no reviewed production
 * adapter here: a claimed web purchase blocks offers, never grants access. */
export function NativeBillingGate({children,guestPreview,renderStatus=content=>content,onContinue,onLogin,directOffer=false}:{children?:React.ReactNode;guestPreview?:React.ReactNode;renderStatus?:(content:React.ReactNode)=>React.ReactNode;onContinue:()=>void;onLogin:()=>void;directOffer?:boolean}) {
 const {user,normalResults}=useAuth();const access=purchases.useNativeServerAccess();const restore=purchases.useRestorePurchases();const client=useQueryClient();
 const key=['native','known-web-buyer',user?.id];
 const web=useQuery<boolean>({queryKey:key,queryFn:async()=>false,enabled:false});
 const [offerOwner,setOfferOwner]=useState<string|null>(null);
 const [original,setOriginal]=useState<'idle'|'checking'|'verified'|'pending'|'missing'|'unavailable'>('idle');
 const originalRun=useRef(0);
 useEffect(()=>{setOfferOwner(null);setOriginal('idle');originalRun.current++;},[user?.id]);
 const newBuyer=offerOwner===user?.id;
 const verifyOriginal=()=>{
  const owner=user?.id;if(!owner||!normalResults){setOriginal('unavailable');return;}
  const run=++originalRun.current;setOriginal('checking');
  void normalResults.discoverBenefit().then(listing=>{
   if(originalRun.current!==run||user?.id!==owner)return;
   const saved=listing.items.some(item=>item.status==='saved'&&(item.source==='original_purchase'||item.source==='reviewed_original'))||listing.recovery.status==='restored';
   const pending=listing.items.some(item=>item.status==='checkout_pending'||item.status==='delivery_pending'||item.status==='recovery_required')||listing.recovery.status==='review_needed';
   setOriginal(saved?'verified':pending?'pending':'missing');
  }).catch(()=>{if(originalRun.current===run&&user?.id===owner)setOriginal('unavailable');});
 };
 if(!user)return guestPreview ?? renderStatus(<View><Text>Log in to verify purchases before viewing an Apple offer.</Text><PrimaryButton label="Log in to verify access" onPress={onLogin}/></View>);
 // Purchase-warning memory is not authority and cannot veto independent paid access.
 if(access.data===true&&!access.isError&&!access.isPending)return renderStatus(<View><Text>Your current access is verified.</Text><PrimaryButton label="Continue to practice" onPress={onContinue}/></View>);
 if(web.data)return renderStatus(<View><Text>Your existing web purchase needs account migration verification. This service cannot currently verify web billing. Do not subscribe again in Apple. Your existing purchase is unchanged. Its account ownership and overlapping benefits still need verification; contact support for recovery.</Text><PrimaryButton label="Recheck access" onPress={()=>void access.refetch()}/></View>);
 if(access.isPending||(access.data===undefined&&!access.isError))return renderStatus(<View><Text>Verifying current subscription access…</Text></View>);
 if(access.isError)return renderStatus(<View><Text>Billing verification is unavailable. Existing purchases are unchanged. Retry rather than buying again.</Text><PrimaryButton label="Retry access verification" onPress={()=>void access.refetch()}/></View>);
 if(newBuyer||directOffer)return children;
 return renderStatus(<View>
  <Text>Already subscribed? Restore an Apple purchase or identify a web purchase before viewing another offer. Older purchases may require recovery; a restore or SDK login does not itself grant access.</Text>
  <Text>The one-time Follow-Through plan keeps its original terms. It is not a subscription. It must be verified by the server before this app treats it as an existing original benefit. The ordinary subscription offer is for additional practice access, not a replacement or repurchase of that plan.</Text>
  <PrimaryButton label="I bought the one-time Follow-Through plan" disabled={original==='checking'} onPress={verifyOriginal}/>
  {original==='checking'?<Text>Verifying original Follow-Through purchase…</Text>:null}
  {original==='verified'?<View><Text>Original Follow-Through is verified for this account. It does not grant monthly practice access.</Text><PrimaryButton label="View monthly practice offer" onPress={()=>setOfferOwner(user.id)}/></View>:null}
  {original==='pending'?<Text>Original Follow-Through recovery is pending for this account. It is not verified as a completed purchase yet.</Text>:null}
  {original==='missing'?<Text>No original Follow-Through purchase was verified for this account.</Text>:null}
  {original==='unavailable'?<Text>Original Follow-Through verification is unavailable. Do not rely on self-report as ownership proof.</Text>:null}
  <PrimaryButton label="I already subscribed on the web" onPress={()=>client.setQueryData(key,true)}/>
  <PrimaryButton label="Restore existing Apple purchase" disabled={restore.isPending} onPress={()=>void restore.mutateAsync().catch(()=>{})}/>
  <PrimaryButton label="Recheck access" onPress={()=>void access.refetch()}/>
  {restore.isError?<Text>{restore.error.message}</Text>:null}
  {restore.isSuccess&&!restore.data?<Text>Your purchase is not server-verified yet. Allow time for billing delivery, then recheck. Do not repurchase; contact support if recovery remains unavailable.</Text>:null}
  <PrimaryButton label="I have not subscribed — view Apple offer" onPress={()=>setOfferOwner(user.id)}/>
 </View>);
}
