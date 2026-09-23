import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnswerButton, AnswerFirstOnboarding, type Confirmation } from '@/components/AnswerFirstOnboarding';
import { NativeBillingGate } from '@/components/NativeBillingGate';
import { Backdrop } from '@/components/ui';
import { C, T } from '@/constants/theme';
import { useAuth } from '@/providers/auth';
import { hasPro, trialEligibility, useCustomerInfo, useIsPro, useNativeServerAccess, useOfferings, usePurchasePackage, useRestorePurchases, usePreAccountPurchase, useClaimPreAccountPurchase } from '@/lib/purchases';
import {purchaseFirstEnabled,usePurchaseFirstPolicy} from '@/lib/purchaseFirstPolicy';
import { storeProductSnapshot } from '@/lib/commerce';
import { normalBillingEnabled } from '@/lib/nativeBillingRuntime';
import { answersComplete, type Answers, type AnswerScreen } from '@/lib/answerFirst';
import { claimAnswerFirst, readAnswerFirst, writeAnswerFirst } from '@/lib/answerFirstStorage';
import { isSevenDayTrial, trialReminderDate } from '@/lib/trialOffer';
import { enableTrialReminder, syncTrialReminder } from '@/lib/trialReminder';

export default function AnswerOnboardingRoute() {
  const router=useRouter();
  const params=useLocalSearchParams<{source?:string}>();
  const {user}=useAuth();
  const owner=user?.id;
  const offerings=useOfferings();const purchase=usePurchasePackage();const restore=useRestorePurchases();
  const preAccount=usePreAccountPurchase();const linkPurchase=useClaimPreAccountPurchase();const policy=usePurchaseFirstPolicy();
  const customer=useCustomerInfo();const server=useNativeServerAccess();const pro=useIsPro();
  const access=!!user&&pro;
  const [answers,setAnswers]=useState<Answers|null>(null);
  const [loadAttempt,setLoadAttempt]=useState(0);
  const [confirmation,setConfirmation]=useState<Confirmation>('ready');
  const [eligibility,setEligibility]=useState<number|undefined>(undefined);
  const [error,setError]=useState('');
  const [reminder,setReminder]=useState('');
  const [billingGate,setBillingGate]=useState(false);
  const [resumeScreen,setResumeScreen]=useState<AnswerScreen|null>(null);
  const operation=useRef(false);
  const reminderOwner=useRef<string|null>(null);
  const insets=useSafeAreaInsets();
  const plan=offerings.data?.current?.monthly;
  const eligibilityProduct=plan?.product;
  const terms=storeProductSnapshot(plan?.product);
  const available=!!plan&&plan.product.identifier==='byis_pro_monthly_5'&&terms?.periodLabel==='1 month'&&!offerings.isError&&(!purchaseFirstEnabled||policy.data===true);
  const accountRequired=purchaseFirstEnabled&&!user&&hasPro(customer.data);
  const trial=available&&isSevenDayTrial(plan?.product,eligibility);
  useEffect(()=>{
    let current=true;setEligibility(undefined);
    if(eligibilityProduct)void trialEligibility(eligibilityProduct.identifier).then(v=>{if(current)setEligibility(v);}).catch(()=>{if(current)setEligibility(0);});
    return()=>{current=false;};
  },[eligibilityProduct,user?.id]);
  useEffect(()=>{
    let current=true;setAnswers(null);setError('');
    const load=owner&&params.source==='account-return'?claimAnswerFirst(owner):readAnswerFirst(owner);
    void load.then(a=>{if(current)setAnswers(a);}).catch(()=>{if(current)setError('We couldn’t read your saved starting focus. Retry without clearing your data.');});
    return()=>{current=false;};
  },[owner,params.source,loadAttempt]);
  useEffect(()=>{
    if(!access||!customer.data||trialReminderDate(customer.data,Date.now())===null||reminderOwner.current===user?.id)return;
    reminderOwner.current=user?.id??null;
    let current=true;
    void (async()=>{
      // Permission is requested only after verified purchase/restore, never P09b.
      const info=customer.data;
      if(!info||!hasPro(info)||trialReminderDate(info,Date.now())===null)return;
      const consent=await enableTrialReminder();
      const status=consent==='enabled'?await syncTrialReminder(info):consent;
      if(current)setReminder(status==='scheduled'?'Your reminder is scheduled on this device for 2 days before your trial ends.':'No two-day trial reminder was scheduled. Check the renewal date in Apple Settings. You can still practice.');
    })();return()=>{current=false;};
  },[access,customer.data,user?.id]);
  const save=async(a:Answers)=>{await writeAnswerFirst(a,user?.id);setAnswers(a);};
  const account=async(mode:'signup'|'login',a:Answers)=>{
    if(mode==='login'){
      if(user){router.replace({pathname:'/answer-onboarding',params:{source:'account-login'}});return;}
      router.push({pathname:'/continue-from-web',params:{mode,returnTo:'account-existing'}});return;
    }
    await writeAnswerFirst(a,user?.id);
    if(user){router.replace({pathname:'/answer-onboarding',params:{source:'resume'}});return;}
    router.push({pathname:'/continue-from-web',params:{mode,returnTo:'answer-first',...(purchaseFirstEnabled?{purchaseFirst:'1'}:{})}});
  };
  const transact=async(kind:'buy'|'restore'|'recover')=>{
    if(operation.current||(!user&&!purchaseFirstEnabled))return;
    if(kind!=='restore'&&(!available||!plan))return;
    if(kind==='recover'&&user)return;
    operation.current=true;setError('');setConfirmation('pending');
    try {
      if(!user&&purchaseFirstEnabled){
        const result=await preAccount.mutateAsync({kind,pkg:plan??undefined});
        setConfirmation(result.status==='account_required'?'confirmed':result.status);
      }else if(kind==='restore'){
        const granted=await restore.mutateAsync();setConfirmation(granted?'confirmed':'pending');
        if(!granted)setError('Your purchase is not verified yet. Recheck access; do not repurchase.');
      }else{
        const result=await purchase.mutateAsync(plan!);
        setConfirmation(result.status==='purchased'?'confirmed':result.status==='cancelled'?'cancelled':'pending');
      }
    }catch{setConfirmation('failed');setError('Purchase verification was unavailable. Recheck access or restore before trying again.');}
    finally{operation.current=false;setBillingGate(false);}
  };
  const link=async()=>{
    if(!owner||operation.current)return;
    operation.current=true;setError('');setConfirmation('pending');
    try{const result=await linkPurchase.mutateAsync(owner);setConfirmation(result==='linked'?'confirmed':result==='no_purchase'?'ready':'pending');if(result==='no_purchase')setResumeScreen('offer');else if(result==='pending')setError('Your purchase is not linked yet. Recheck or restore; do not buy again.');}
    catch{setConfirmation('failed');setError('We couldn’t link your purchase. Your Apple purchase is unchanged. Recheck or restore; do not buy again.');}
    finally{operation.current=false;}
  };
  const linkRef=useRef(link);linkRef.current=link;
  const linkedReturn=useRef<string|null>(null);
  useEffect(()=>{
    if(!purchaseFirstEnabled||!owner||params.source!=='account-return'||linkedReturn.current===owner)return;
    linkedReturn.current=owner;void linkRef.current();
  },[owner,params.source]);
  const check=()=>{void offerings.refetch?.();void policy.refetch();if(purchaseFirstEnabled&&owner)void link();else{void customer.refetch();void server.refetch();}};
  if(!answers)return <View style={[styles.status,{paddingTop:insets.top+24}]}><Backdrop/>{error?<><Text style={T.body}>{error}</Text><AnswerButton label="Retry loading" onPress={()=>setLoadAttempt(attempt=>attempt+1)}/></>:<ActivityIndicator color={C.purple}/>}</View>;
  // Account access is independent of local questionnaire preferences. A reinstall
  // or ordinary login must not send an authenticated owner back to guest welcome.
  if(user&&!resumeScreen&&(params.source==='account-login'||!params.source||!answersComplete(answers)))return <View style={[styles.status,{paddingTop:insets.top+24,paddingBottom:insets.bottom+24}]}><Backdrop/>
    <Text style={T.body}>Welcome back. You’re signed in.</Text>
    <Text style={T.body}>{access?'Your access is verified. Continue to your lessons and progress.':'Restore your existing Apple purchase or recheck access. You don’t need to repeat onboarding to restore.'}</Text>
    {!!error&&<Text style={T.body} accessibilityRole="alert">{error}</Text>}
    {access&&<AnswerButton label="Continue to Home" onPress={()=>router.replace('/(tabs)')}/>}
    <AnswerButton label="Restore purchases" onPress={()=>void transact('restore')}/>
    <AnswerButton label="Recheck access" onPress={check}/>
    {!access&&<AnswerButton secondary label="Review subscription" onPress={()=>setResumeScreen('offer')}/>}
  </View>;
  if(billingGate&&normalBillingEnabled)return <View style={[styles.status,{paddingTop:insets.top+24,paddingBottom:insets.bottom+24}]}><Backdrop/><AnswerButton label="Back to offer" secondary onPress={()=>{setResumeScreen('offer');setBillingGate(false);}}/><NativeBillingGate onLogin={()=>void account('login',answers)} onContinue={()=>{setResumeScreen('setup');setBillingGate(false);setConfirmation('confirmed');}}><Text style={T.body}>Your account is ready. Review and confirm the store terms next.</Text><AnswerButton label={trial?'Confirm free trial with Apple':'Confirm subscription with Apple'} disabled={operation.current} onPress={()=>void transact('buy')}/></NativeBillingGate></View>;
  return <AnswerFirstOnboarding key={`${user?.id??'visitor'}-${params.source??'start'}`} initialAnswers={answers}
    initialScreen={resumeScreen??(accountRequired&&answersComplete(answers)?'account':params.source==='account-return'||params.source==='resume'?access&&answersComplete(answers)?'setup':answersComplete(answers)?purchaseFirstEnabled&&params.source==='account-return'?'confirm':'offer':'welcome':'welcome')}
    purchaseFirst={purchaseFirstEnabled} accountRequired={accountRequired}
    authenticated={!!user} access={access} confirmation={confirmation} error={error} reminder={reminder}
    offer={{available:available&&eligibility!==undefined,loading:offerings.isLoading||!!plan&&eligibility===undefined,trial,renewal:terms?.priceString?`${terms.priceString} ${terms.periodLabel==='1 month'?'monthly':`every ${terms.periodLabel}`}`:'the verified store price'}}
    onSave={save} onAccount={account} onBuy={async()=>{if(!user&&purchaseFirstEnabled){await transact('buy');}else if(normalBillingEnabled){setResumeScreen('confirm');setBillingGate(true);}else await transact('buy');}}
    onRestore={()=>transact('restore')} onCheckAccess={check}
    onRecoverPurchase={()=>transact('recover')}
    onPractice={a=>{
      if(!access||operation.current)return;
      if(!answersComplete(a)){router.replace('/(tabs)');return;}
      operation.current=true;
      void save(a).then(()=>router.push('/first-practice'))
        .catch(()=>setError('We couldn’t preserve your focus. Please try again.'))
        .finally(()=>{operation.current=false;});
    }}
    onLessons={()=>{if(access)router.replace('/first-practice');}}
    onPrivacy={()=>router.push('/privacy')} onTerms={()=>void Linking.openURL('https://www.apple.com/legal/internet-services/itunes/dev/stdeula/')}/>
}
const styles=StyleSheet.create({status:{flex:1,paddingHorizontal:22,justifyContent:'center',gap:20,backgroundColor:C.bg}});
