import React,{useEffect,useRef,useState} from 'react';
import {Text,TextInput,View} from 'react-native';
import {PrimaryButton} from '@/components/ui';
import {C,radius} from '@/constants/theme';
import {getRecovery,deleteAccountIdentity,checkAccountDeletionStatus,cleanupDeletedAccountOwner,accountDeletionAvailable} from '@/lib/accountLifecycleRuntime';
import type {createAccountRecovery} from '@/lib/accountRecovery';
import type {AccountDeletionBilling} from '@/lib/accountDeletion';
type Result={success:boolean;message:string;status?:string;ownerId?:string};
const inputStyle={minHeight:52,borderWidth:1,borderColor:C.line,backgroundColor:C.onAccent,paddingHorizontal:15,paddingVertical:12,marginVertical:8,borderRadius:radius.md,color:C.text,fontSize:16};
export function AccountRecoveryControls({email,recovery}:{email:string;recovery?:ReturnType<typeof createAccountRecovery>|null}){
 const [message,setMessage]=useState('');const [pending,setPending]=useState(false);const busy=useRef(false);
 const run=async()=>{
  if(busy.current)return;busy.current=true;setPending(true);
  try{const flow=recovery===undefined?getRecovery():recovery;
   if(!flow){setMessage('Recovery is unavailable in this build.');return;}
   const result=await flow.request(email);setMessage(result.message);
  }catch{setMessage('Recovery was not confirmed. Check your connection and retry later.');}
  finally{busy.current=false;setPending(false);}
 };
 return <View><Text style={{color:C.textSoft}}>Forgot your password? Request an email, then tap Reset password in the newest email. Choose your new password on the Before You Say It website and return here to sign in. This does not sign you into the app or attach guest practice.</Text>
 <PrimaryButton label="Request recovery email" disabled={pending} onPress={run}/>
 {message?<Text accessibilityLiveRegion="polite">{message}</Text>:null}</View>;
}
export function AccountDeletionControls({ownerId,ownerEmail,billing={kind:'unknown'},clearLocal,available=accountDeletionAvailable,deleteIdentity=deleteAccountIdentity,checkStatus=checkAccountDeletionStatus,clearSignal=0,onCancel}:{ownerId:string;ownerEmail?:string|null;billing?:AccountDeletionBilling;clearLocal:(owner:string)=>Promise<void>;available?:boolean;deleteIdentity?:(owner:string,password:string,billing:AccountDeletionBilling,signal?:AbortSignal)=>Promise<Result>;checkStatus?:(owner:string)=>Promise<Result>;clearSignal?:number;onCancel?:()=>void}){
 const [password,setPassword]=useState('');const [message,setMessage]=useState('');const [lastStatus,setLastStatus]=useState<string|null>(null);const [pending,setPending]=useState(false);const busy=useRef(false);const mounted=useRef(true);const owner=useRef(ownerId);owner.current=ownerId;const submission=useRef<AbortController|null>(null);
 useEffect(()=>{submission.current?.abort();setPassword('');setMessage('');setLastStatus(null);},[ownerId]);
 useEffect(()=>{submission.current?.abort();setPassword('');},[clearSignal]);
 useEffect(()=>{mounted.current=true;return ()=>{mounted.current=false;submission.current?.abort();};},[]);
 const run=async()=>{
  if(busy.current || !available || !password)return;busy.current=true;setPending(true);const expected=ownerId;
  try{submission.current=new AbortController();let result=await deleteIdentity(expected,password,billing,submission.current.signal);
   if(!mounted.current || owner.current!==expected)return;
   if(result.status==='uncertain'){const recovered=await checkStatus(expected);if(!mounted.current || owner.current!==expected)return;if(recovered.status)result=recovered;}
   setMessage(result.message);setLastStatus(result.status??'uncertain');
   if(result.success && result.status==='complete'){try{await clearLocal(expected);}catch{if(mounted.current)setMessage('Your account has been deleted. Some data may still be on this device. Use Clear remaining device data to retry local cleanup.');}}
  }catch{if(mounted.current)setMessage('Deletion was not confirmed. Do not assume the account or its data was erased. Contact support before retrying.');}
  finally{if(mounted.current){setPassword('');setPending(false);}busy.current=false;}
 };
 const check=async()=>{
  if(busy.current || !checkStatus)return;busy.current=true;setPending(true);const expected=ownerId;
  try{const result=await checkStatus(expected);if(!mounted.current || owner.current!==expected)return;setMessage(result.message);if(result.status)setLastStatus(result.status);if(result.success && result.status==='complete'){try{await clearLocal(expected);}catch{if(mounted.current)setMessage('Your account has been deleted. Some data may still be on this device. Use Clear remaining device data to retry local cleanup.');}}}
  catch{if(mounted.current)setMessage('Deletion status could not be checked. Try again later.');}
  finally{if(mounted.current)setPending(false);busy.current=false;}
 };
 const appleWarning=billing.kind==='unknown' || (billing.kind==='apple' && billing.will_renew!==false);
 const accepted=Boolean(lastStatus && !['uncertain','rejected','unavailable'].includes(lastStatus));
 const [showRecovery,setShowRecovery]=useState(false);
 return <View><Text>Delete your account?</Text><Text>This will permanently delete your BYSI account, saved results, conversation text, coaching and progress. You will not be able to recover them.</Text><Text>You will lose access through this account, including any remaining paid access. Deleting your account does not cancel an Apple subscription or request a refund.</Text>
 {ownerEmail?<Text>Signed in as {ownerEmail}</Text>:null}
 {appleWarning?<Text>{billing.kind==='apple' && billing.will_renew===true?'Your Apple subscription will keep renewing unless you cancel it in Apple subscriptions.':'We could not check your subscription status. Deleting your account will not cancel any Apple subscription.'}</Text>:billing.kind==='apple' && billing.will_renew===false?<Text>Your subscription won’t renew{billing.expiration_date?` · access ends ${billing.expiration_date}`:''}. Deleting now ends access through this account.</Text>:billing.kind==='web'?<Text>Deleting your account does not refund your web purchase.</Text>:null}
 {!available?<Text>Account deletion is not enabled on the server for this build. No deletion request can be submitted here yet. Contact support@beforeyousayit.app for help; an email is not confirmation of deletion.</Text>:<>{!accepted?<><Text>Confirm it&apos;s you</Text><Text>Enter your BYSI password to delete this account.</Text><TextInput style={inputStyle} accessibilityLabel="BYSI password for account deletion" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" autoCapitalize="none" autoCorrect={false} editable={!pending}/><PrimaryButton label={appleWarning?'Delete account anyway':'Delete account'} tone="#B42318" disabled={pending||!password} onPress={run}/><PrimaryButton label="Forgot password?" disabled={pending} onPress={()=>{setPassword('');setShowRecovery(true);}}/>{showRecovery && ownerEmail?<AccountRecoveryControls email={ownerEmail}/>:null}<PrimaryButton label="Cancel" disabled={pending} onPress={()=>{setPassword('');setShowRecovery(false);onCancel?.();}}/></>:null}<PrimaryButton label={lastStatus==='complete'?'Clear remaining device data':'Check deletion status'} disabled={pending} onPress={check}/></>}
 {message?<Text accessibilityRole="alert">{message}</Text>:null}</View>;
}
export function AccountDeletionStatusControls({available=accountDeletionAvailable,checkStatus=checkAccountDeletionStatus,clearLocal=cleanupDeletedAccountOwner}:{available?:boolean;checkStatus?:()=>Promise<Result>;clearLocal?:(owner:string)=>Promise<void>}){
 const [message,setMessage]=useState('');const [pending,setPending]=useState(false);const busy=useRef(false);const mounted=useRef(true);
 useEffect(()=>()=>{mounted.current=false;},[]);
 const check=async()=>{if(busy.current || !available || !checkStatus)return;busy.current=true;setPending(true);try{const result=await checkStatus();if(result.success && result.status==='complete' && result.ownerId){try{await clearLocal(result.ownerId);}catch{if(mounted.current)setMessage('Your account has been deleted. Some data may still be on this device. Use this status check again to retry local cleanup.');return;}}if(mounted.current)setMessage(result.message);}catch{if(mounted.current)setMessage('Deletion status could not be checked. Try again later.');}finally{if(mounted.current)setPending(false);busy.current=false;}};
 return <View><Text>Already requested deletion?</Text><Text>You can check this device&apos;s saved deletion receipt without signing in.</Text>{available?<PrimaryButton label="Check deletion status" disabled={pending} onPress={check}/>:<Text>Account deletion status is unavailable in this build.</Text>}{message?<Text accessibilityRole="alert">{message}</Text>:null}</View>;
}
