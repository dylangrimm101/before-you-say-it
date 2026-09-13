import React,{useEffect,useRef,useState} from 'react';
import {AppState,ScrollView,Text,View} from 'react-native';
import {useRouter} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useAuth} from '@/providers/auth';
import {useStore} from '@/providers/store';
import {PrivateWebResultPresentation} from '@/components/PrivateWebResultPresentation';
import {PrimaryButton} from '@/components/ui';
import {OriginalFollowThrough} from '@/components/OriginalFollowThrough';
import {AccountLogout} from '@/components/AccountLogout';
import {useNativeServerAccess} from '@/lib/purchases';
import {nativeBilling} from '@/lib/nativeBillingRuntime';
import {nextLaunchDeck} from '@/lib/launchCurriculum';
import {C,T,GUTTER} from '@/constants/theme';
import type {createNormalResults} from '@/lib/normalResults';
type Service=NonNullable<ReturnType<typeof createNormalResults>>;
type Saved=Awaited<ReturnType<Service['latest']>>;
export default function SavedResult(){
 const {user,normalResults,isLoggingOut,practiceOwner}=useAuth();const router=useRouter();
 const insets=useSafeAreaInsets();
 return <ScrollView style={{backgroundColor:C.bg}} contentContainerStyle={{paddingHorizontal:GUTTER,paddingTop:insets.top+24,paddingBottom:insets.bottom+24,gap:20}}>
  <Text style={T.title}>Your saved result</Text>
  {isLoggingOut?<Text>Signing out…</Text>:!user?<PrimaryButton label="Log in" onPress={()=>router.replace('/continue-from-web')}/>:!normalResults?<Text>Saved result service is not configured for this build.</Text>:<Controls key={practiceOwner?.key??user.id} service={normalResults}/>}
  <AccountLogout/>
  <PrimaryButton label="Back to today" onPress={()=>router.replace('/(tabs)')}/>
 </ScrollView>;
}
function Controls({service}:{service:Service}){
 const [saved,setSaved]=useState<Saved>(null),[status,setStatus]=useState('loading'),[revision,setRevision]=useState(0);
 const live=useRef(0);const router=useRouter();
 const {hydrated,convertedLessonProgress,moduleCloseProgress}=useStore();
 const access=useNativeServerAccess();
 const admitted=access.data===true&&!access.isPending&&!access.isFetching&&!access.isError;
 const next=nextLaunchDeck(convertedLessonProgress,moduleCloseProgress);
 useEffect(()=>{
  const generation=++live.current,control=new AbortController();let expiry:ReturnType<typeof setTimeout>;
  setSaved(null);setStatus('loading');
  void service.latest(control.signal).then(record=>{
   if(generation!==live.current)return;
   setSaved(record);setStatus(record?'ready':'empty');
   if(record)expiry=setTimeout(()=>{setSaved(null);setStatus('expired');},Math.max(0,Date.parse(record.expiresAt)-Date.now()));
  }).catch(()=>{if(generation===live.current){setSaved(null);setStatus('unavailable');}});
  const subscription=AppState.addEventListener('change',state=>{
   ++live.current;control.abort();service.invalidate();setSaved(null);setStatus('idle');
   if(state==='active')setRevision(v=>v+1);
  });
  return ()=>{++live.current;control.abort();clearTimeout(expiry);subscription.remove();};
 },[service,revision]);
 const continuePractice=async()=>{
  if(!hydrated||!next||!admitted||!nativeBilling)return;
  const generation=live.current;
  try{if(await nativeBilling.access()&&generation===live.current)router.replace({pathname:'/approved-lesson/[lessonId]',params:{lessonId:next}});else await access.refetch();}
  catch{await access.refetch();}
 };
 return <View style={{gap:16}}>
  {status==='loading'?<Text>Finding your account’s saved result…</Text>:null}
  {status==='empty'?<Text style={T.body}>We couldn’t find a saved result linked to this account. This doesn’t tell us whether you purchased a plan. Your existing result has not been replaced. Don’t buy the same plan again.</Text>:null}
  {['unavailable','expired'].includes(status)?<Text style={T.body}>We couldn’t open your saved result. You can check again without generating a new result. Don’t buy the same plan again.</Text>:null}
  {saved?<><PrivateWebResultPresentation record={saved.privateResult} Container={View} Text={Text}/><Text>The saved recommendation is unchanged. It does not grant subscription access or mark practice complete.</Text></>:null}
  <OriginalFollowThrough service={service}/>
  <PrimaryButton label="Find my latest saved result" onPress={()=>setRevision(v=>v+1)}/>
  {next&&admitted?<PrimaryButton label="Continue to next practice" disabled={!hydrated} onPress={()=>{void continuePractice();}}/>:next?<><Text>Lessons and practice use the same ordinary subscription rules for every account. Your saved content remains available independently.</Text><PrimaryButton label="Review monthly subscription" onPress={()=>router.push('/paywall')}/></>:<Text>You’ve reached the end of the current launch curriculum.</Text>}
 </View>;
}
