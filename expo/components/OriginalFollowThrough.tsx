import React,{useEffect,useRef,useState} from 'react';
import {AppState,Text,TextInput,View} from 'react-native';
import {PrimaryButton} from './ui';
import {T} from '@/constants/theme';
import type {createNormalResults,BenefitListing,BenefitRecovery,OriginalBenefit} from '@/lib/normalResults';
type Service=NonNullable<ReturnType<typeof createNormalResults>>;
/** Read-only original content. No practice-store write, billing grant or model call. */
export function OriginalBenefitPresentation({result}:{result:OriginalBenefit}){
 const section=(heading:string,value:unknown)=>typeof value==='string'?<View key={heading} style={{gap:6}}><Text style={T.title}>{heading}</Text><Text style={T.body}>{value}</Text></View>:null;
 return <View style={{gap:16}}>
  <Text style={T.title}>Your original Follow-Through</Text>
  {result.mode==='safety'?<View style={{gap:12}}>{section('Safety and support',result.note)}{Array.isArray(result.resources)?result.resources.filter((v):v is string=>typeof v==='string').map((resource,index)=><Text key={index} style={T.body}>{resource}</Text>):null}</View>:<>
  {section('Outcome',result.outcome)}
  {section('Strategy',result.strategy)}
  {section('Likely reaction',result.likely_reaction)}
  {Array.isArray(result.response_options)?<View style={{gap:12}}><Text style={T.title}>Response options</Text>{result.response_options.map((option:any,index:number)=><View key={index} style={{gap:6}}>{typeof option?.label==='string'?<Text style={T.title}>{option.label}</Text>:null}{typeof option?.move==='string'?<Text style={T.body}>{option.move}</Text>:null}{typeof option?.text==='string'?<Text style={T.body}>{option.text}</Text>:null}</View>)}</View>:null}
  {section('Close the loop',result.close_the_loop)}
  {section('Follow-up text',result.follow_up_text)}
  </>}
  <Text>This is your unchanged saved output. It does not grant a subscription or complete a lesson.</Text>
 </View>;
}
export function OriginalFollowThrough({service,autoDiscover=false}:{service:Service;autoDiscover?:boolean}){
 const [listing,setListing]=useState<BenefitListing|null>(null),[result,setResult]=useState<OriginalBenefit|null>(null),[status,setStatus]=useState('idle');
 const [recovery,setRecovery]=useState<BenefitRecovery|null>(null);
 const [receipt,setReceipt]=useState('');
 const live=useRef(0),pending=useRef<AbortController|null>(null);
 useEffect(()=>{
  const clear=()=>{++live.current;pending.current?.abort();pending.current=null;setListing(null);setResult(null);setRecovery(null);setReceipt('');setStatus('idle');};
  const subscription=AppState.addEventListener('change',clear);
  return ()=>{++live.current;pending.current?.abort();subscription.remove();};
 },[service]);
 const run=async(operation:(signal:AbortSignal)=>Promise<void>,failure='unavailable')=>{
  if(pending.current)return;
  const control=new AbortController(),generation=++live.current;pending.current=control;setStatus('loading');
  try{await operation(control.signal);if(generation===live.current)setStatus('ready');}
  catch(error){if(generation===live.current)setStatus(error instanceof Error&&error.message==='Recovery conflict'?'recovery-conflict':failure);}
  finally{if(generation===live.current)pending.current=null;}
 };
 const discover=()=>run(async signal=>{const generation=live.current;setResult(null);const value=await service.discoverBenefit(signal);if(generation===live.current){setListing(value);setRecovery(value.recovery);}});
 useEffect(()=>{
  let active=true;
  // Defer beyond mount/StrictMode cleanup; never dispatch for a discarded owner.
  if(autoDiscover)void Promise.resolve().then(()=>{if(active)void discover();});
  return ()=>{active=false;};
 },[service,autoDiscover]);
 const recover=(action:'request'|'status',receiptReference?:string)=>run(async signal=>{const generation=live.current;const value=await service.recoverBenefit(action,signal,receiptReference);if(generation===live.current){setRecovery(value);setReceipt('');}},action==='request'?'recovery-uncertain':'unavailable');
 const restore=(id:string)=>run(async signal=>{const generation=live.current;setResult(null);const value=await service.restoreBenefit(id,signal);if(generation===live.current)setResult(value);});
 return <View style={{gap:12}}>
  <Text style={T.title}>Original Follow-Through</Text>
  <Text>Your original one-time benefit is separate from monthly practice. Find an existing saved output without paying again or generating another one.</Text>
  <PrimaryButton label="Find my original Follow-Through" disabled={status==='loading'} onPress={()=>{void discover();}}/>
  {status==='loading'?<Text>Checking this account’s original benefit…</Text>:null}
  {status==='recovery-uncertain'?<Text>Your recovery request may already be recorded. Check its status before trying again.</Text>:null}
  {status==='recovery-conflict'?<Text>A different receipt reference is already recorded. It has not been replaced. Check recovery status.</Text>:null}
  {status==='unavailable'?<Text>We couldn’t verify your original benefit. Check again without buying it again. Your existing content has not been replaced.</Text>:null}
  {listing?.items.map(item=><View key={item.id} style={{gap:8}}><Text>Original Follow-Through · {item.createdAt}</Text>{item.status==='saved'?<PrimaryButton label="Open saved Follow-Through" disabled={status==='loading'} onPress={()=>{void restore(item.id);}}/>:<Text>The original output is not available here. Don’t buy the same benefit again. Opening saved content never reruns generation.</Text>}</View>)}
  {listing&&!listing.items.length?<Text>No original Follow-Through is linked to this account. This does not establish that you never purchased it. Don’t buy the same benefit again.</Text>:null}
  {listing?.hasMore?<Text>Showing the newest 100 original benefits. Older content may require recovery.</Text>:null}
  {result?<OriginalBenefitPresentation result={result}/>:null}
  <Text>If an original purchase or output is missing, record a recovery request instead of paying for the same benefit again.</Text>
  <PrimaryButton label="Request original benefit recovery" disabled={status==='loading'||recovery?.status==='review_needed'} onPress={()=>{void recover('request');}}/>
  <PrimaryButton label="Check original recovery status" disabled={status==='loading'} onPress={()=>{void recover('status');}}/>
  <Text>A receipt reference is only a locator, not proof of purchase or account ownership.</Text>
  <TextInput accessibilityLabel="Optional checkout receipt reference" placeholder="Optional cs_… receipt reference" value={receipt} onChangeText={setReceipt} editable={status!=='loading'} autoCapitalize="none" autoCorrect={false} maxLength={199} style={T.body}/>
  <PrimaryButton label="Send receipt reference for review" disabled={status==='loading'||!/^cs_[A-Za-z0-9_]{1,196}$/.test(receipt)} onPress={()=>{void recover('request',receipt);}}/>
  {recovery?.status==='review_needed'?<><Text>Recovery needs review</Text><Text>Independent purchase ownership and original-content proof are required.</Text><Text>This is not purchase approval or a promise that the original content can be recovered.</Text><Text>An independent review must verify buyer control and retained original content. A receipt reference helps locate records but cannot attach a purchase by itself. Missing proof or original content remains unresolved. Don’t buy the same benefit again.</Text></>:recovery?.status==='restored'?<Text>Recovery has an existing original output. Find and open the saved Follow-Through; this does not grant monthly practice.</Text>:recovery?.status==='not_requested'?<Text>No recovery request is recorded for this account. This is not proof that you never purchased.</Text>:null}
 </View>;
}
