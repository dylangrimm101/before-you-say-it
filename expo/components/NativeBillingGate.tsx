import React, {useState} from 'react';
import {Text,View} from 'react-native';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '@/providers/auth';
import * as purchases from '@/lib/purchases';
import {PrimaryButton} from '@/components/ui';
/** Normal rollout only. Web-owner durable billing has no reviewed production
 * adapter here: a claimed web purchase blocks offers, never grants access. */
export function NativeBillingGate({children,onContinue,onLogin}:{children?:React.ReactNode;onContinue:()=>void;onLogin:()=>void}) {
 const {user}=useAuth();const access=purchases.useNativeServerAccess();const restore=purchases.useRestorePurchases();const client=useQueryClient();
 const key=['native','known-web-buyer',user?.id];
 const web=useQuery<boolean>({queryKey:key,queryFn:async()=>false,enabled:false});
 const [offerOwner,setOfferOwner]=useState<string|null>(null);
 const newBuyer=offerOwner===user?.id;
 if(!user)return <View><Text>Log in to verify purchases before viewing an Apple offer.</Text><PrimaryButton label="Log in to verify access" onPress={onLogin}/></View>;
 // Purchase-warning memory is not authority and cannot veto independent paid access.
 if(access.data===true&&!access.isError&&!access.isPending&&!access.isFetching)return <View><Text>Your current access is verified.</Text><PrimaryButton label="Continue to practice" onPress={onContinue}/></View>;
 if(web.data)return <View><Text>Your existing web purchase needs account migration verification. This service cannot currently verify web billing. Do not subscribe again in Apple. Your existing purchase is unchanged. Its account ownership and overlapping benefits still need verification; contact support for recovery.</Text><PrimaryButton label="Recheck access" onPress={()=>void access.refetch()}/></View>;
 if(access.isPending||access.isFetching)return <View><Text>Verifying current subscription access…</Text></View>;
 if(access.isError)return <View><Text>Billing verification is unavailable. Existing purchases are unchanged. Retry rather than buying again.</Text><PrimaryButton label="Retry access verification" onPress={()=>void access.refetch()}/></View>;
 return <View>
  <Text>Already subscribed? Restore an Apple purchase or identify a web purchase before viewing another offer. Older purchases may require recovery; a restore or SDK login does not itself grant access.</Text>
  <Text>The one-time Follow-Through plan keeps its original terms. It is not a subscription. This choice does not verify purchase ownership. The ordinary subscription offer below is for additional practice access, not a replacement or repurchase of that plan.</Text>
  <PrimaryButton label="I bought the one-time Follow-Through plan" onPress={()=>setOfferOwner(user.id)}/>
  <PrimaryButton label="I already subscribed on the web" onPress={()=>client.setQueryData(key,true)}/>
  <PrimaryButton label="Restore existing Apple purchase" disabled={restore.isPending} onPress={()=>void restore.mutateAsync().catch(()=>{})}/>
  <PrimaryButton label="Recheck access" onPress={()=>void access.refetch()}/>
  {restore.isError?<Text>{restore.error.message}</Text>:null}
  {restore.isSuccess&&!restore.data?<Text>Your purchase is not server-verified yet. Allow time for billing delivery, then recheck. Do not repurchase; contact support if recovery remains unavailable.</Text>:null}
  {!newBuyer?<PrimaryButton label="I have not subscribed — view Apple offer" onPress={()=>setOfferOwner(user.id)}/>:children}
 </View>;
}
