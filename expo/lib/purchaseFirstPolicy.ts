import {useQuery} from '@tanstack/react-query';
import {withRequestDeadline} from './requestDeadline';
export const purchaseFirstEnabled=process.env.EXPO_PUBLIC_PURCHASE_FIRST==='claim-v1';
export async function checkPurchaseFirstPolicy():Promise<boolean>{
 if(!purchaseFirstEnabled||process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN!=='https://beforeyousayit.app')return false;
 try{return await withRequestDeadline(async signal=>{
  const response=await fetch('https://beforeyousayit.app/api/native/purchase-policy',{signal,redirect:'error',credentials:'omit',cache:'no-store'});
  if(!response.ok||response.redirected)return false;
  const text=await response.text();if(text.length>1024)return false;
  const policy=JSON.parse(text);
  const audience=process.env.EXPO_PUBLIC_PURCHASE_FIRST_AUDIENCE==='sandbox'?'sandbox':'production';
  return policy.purchaseFirstVersion===1&&policy.purchaseFirstAudience===audience;
 },8000);}catch{return false;}
}
export function usePurchaseFirstPolicy(){return useQuery({queryKey:['purchase-first','policy'],queryFn:checkPurchaseFirstPolicy,enabled:purchaseFirstEnabled,retry:false,staleTime:0});}
