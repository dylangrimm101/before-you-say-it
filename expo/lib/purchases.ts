import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";

import { nativeBilling, normalBillingEnabled } from '@/lib/nativeBillingRuntime';
import * as ReactNative from 'react-native';
import { useEffect } from 'react';
import { hasActiveEntitlement } from "@/lib/commerce";
import { createPurchasesIdentityBoundary } from "@/lib/purchasesIdentity";
import { errorShape, safeLog } from "@/lib/redact";
import { syncTrialReminder } from './trialReminder';
import {checkPurchaseFirstPolicy,purchaseFirstEnabled} from './purchaseFirstPolicy';
import {purchasePending} from './purchaseFirstPending';

export const PRO_ENTITLEMENT = "pro";

/** The slice of the RevenueCat SDK this app actually uses. */
type PurchasesModule = {
  configure: (options: { apiKey: string }) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  checkTrialOrIntroductoryPriceEligibility: (ids: string[]) => Promise<Record<string, { status: number }>>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
  logIn: (appUserID: string) => Promise<{ customerInfo: CustomerInfo; created: boolean }>;
  logOut: () => Promise<CustomerInfo>;
  isAnonymous: () => Promise<boolean>;
  getAppUserID: () => Promise<string>;
};

/**
 * Expo Go does not bundle the RevenueCat native module, so touching the SDK
 * there tears down the whole app at launch. Detect that sandbox up front and
 * run without billing instead of crashing.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getRCToken(): string | undefined {
  if (Platform.OS === "web") {
    return process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  }
  return Platform.select({
    ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
    android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
    default: process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY,
  });
}

function loadSdk(): PurchasesModule | null {
  if (isExpoGo) {
    safeLog("[purchases] Expo Go detected — billing disabled for this session");
    return null;
  }
  try {
    // Required lazily: a static import would evaluate the native binding on
    // platforms where it does not exist.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-purchases") as
      | PurchasesModule
      | { default: PurchasesModule };
    return "default" in mod ? mod.default : mod;
  } catch (e) {
    safeLog("[purchases] native module unavailable", errorShape(e));
    return null;
  }
}

const apiKey = getRCToken();
// Browser previews cannot complete App Store or Play Store purchases. Avoid
// configuring RevenueCat there: its telemetry retries blocked requests and
// turns an unavailable analytics endpoint into runtime error overlays.
const isBillingPlatformSupported = Platform.OS !== "web";
const sdk = apiKey && isBillingPlatformSupported ? loadSdk() : null;

if (!apiKey) {
  safeLog("[purchases] missing RevenueCat API key — paywall disabled");
} else if (!isBillingPlatformSupported) {
  safeLog("[purchases] browser preview detected — billing disabled for this session");
}

let configured = false;
if (sdk && apiKey) {
  try {
    sdk.configure({ apiKey });
    configured = true;
  } catch (e) {
    safeLog("[purchases] configure failed — paywall disabled", errorShape(e));
  }
}

/**
 * True when billing can actually run. False in Expo Go, when the native module
 * is missing, or when no API key is set. The paywall degrades to its
 * "plans aren't available" state rather than failing.
 */
export const purchasesAvailable: boolean = configured;

function requireSdk(): PurchasesModule {
  if (!sdk || !configured) {
    throw new Error("Purchases are unavailable in this build.");
  }
  return sdk;
}

export function hasPro(info: CustomerInfo | null | undefined): boolean {
  return hasActiveEntitlement(info, PRO_ENTITLEMENT);
}

let migrationRequired = false;
const purchasesIdentity = createPurchasesIdentityBoundary<CustomerInfo>(async (userId) => {
  const claimAnonymous=userId?.startsWith('claim-anonymous:')===true;
  const normalizedUserId = claimAnonymous?userId!.slice('claim-anonymous:'.length):userId?.trim() ?? "";
  if (!sdk || !configured) return null;
  try {
    if (!normalizedUserId) {
      // Preserve anonymous purchases; never identify a disposable Supabase guest ID.
      if (await sdk.isAnonymous()) return await sdk.getCustomerInfo();
      return await sdk.logOut();
    }
    const boundId = nativeBilling ? await nativeBilling.identify() : normalizedUserId;
    if (nativeBilling && normalizedUserId !== "restore-existing-purchase" && await sdk.getAppUserID() !== boundId && hasPro(await sdk.getCustomerInfo()) && !(claimAnonymous&&await sdk.isAnonymous())) {
      // Preserve the old account/guest identity until an explicit restore action.
      migrationRequired = true;
      return null;
    }
    migrationRequired = false;
    const result = await sdk.logIn(boundId);
    return result.customerInfo;
  } catch (error) {
    safeLog("[purchases] account association failed", errorShape(error));
    return null;
  }
});

/** Null selects the SDK's anonymous identity, not a Supabase guest ID. */
export function identifyPurchasesUser(userId: string | null): Promise<CustomerInfo | null> {
  // Keep an existing OS reminder while identity refresh is pending or offline.
  // Only a verified customer snapshot (or explicit account reset) can replace it.
  if(!userId)nativeBilling?.suspend();
  return purchasesIdentity.sync(userId).then(info => {
    if (info) void syncTrialReminder(info);
    return info;
  });
}

/** Clears any authenticated RevenueCat app-user identity during data reset. */
export async function clearPurchasesIdentity(): Promise<void> {
  void syncTrialReminder(null);
  nativeBilling?.suspend();
  if (!sdk || !configured) return;
  const info = await purchasesIdentity.sync(null);
  if (!info) throw new Error("Purchases identity reset could not be verified.");
}

export function useCustomerInfo() {
  const query = useQuery<CustomerInfo | null>({
    queryKey: ["rc", "customerInfo"],
    queryFn: async () => {
      const info = await purchasesIdentity.runVerified(() => requireSdk().getCustomerInfo());
      void syncTrialReminder(info);
      return info;
    },
    enabled: purchasesAvailable,
    staleTime: 60_000,
  });
  const refetch = query.refetch;
  useEffect(() => {
    const sub = ReactNative.AppState?.addEventListener('change', state => {
      if (state === 'active' && purchasesAvailable) void refetch();
    });
    return () => sub?.remove();
  }, [refetch]);
  return query;
}

export async function trialEligibility(productId: string): Promise<number> {
  if (Platform.OS !== 'ios' || !purchasesAvailable) return 0;
  try {
    const result = await purchasesIdentity.runVerified(() => requireSdk().checkTrialOrIntroductoryPriceEligibility([productId]));
    return result[productId]?.status ?? 0;
  } catch { return 0; }
}

/** True when the user has the active "pro" entitlement. */
export function useIsPro(): boolean {
  const { data } = useCustomerInfo();
  const access = useNativeServerAccess();
  return normalBillingEnabled ? access.data === true && !access.isError && !access.isPending : hasPro(data);
}

export function useNativeServerAccess(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery<boolean>({queryKey:['native','access'],queryFn:async()=>{
    if(await nativeBilling!.access())return true;
    // A successful SDK login can link an anonymous receipt without producing a
    // new purchase webhook. Finish the existing server-owned claim protocol on
    // this already verified identity; never restore, reidentify or buy here.
    if(migrationRequired)throw Error('An existing purchase needs account recovery. Restore purchases in Account settings; do not buy again.');
    return purchasesIdentity.runVerified(async()=>{
      const info=await requireSdk().getCustomerInfo();
      if(!hasPro(info))return false;
      if(purchaseFirstEnabled&&await checkPurchaseFirstPolicy()){
        const response=await nativeBilling!.request('claim');
        const body=await response.json();
        if(response.ok&&body.allowed===true)return true;
      }
      // SDK evidence prevents another offer, but only the server may admit.
      throw Error('Your Apple purchase is awaiting account verification. Retry or restore in Account settings; do not buy again.');
    });
  },enabled:!!nativeBilling && enabled,retry:false,staleTime:0,refetchInterval:15000});
  useEffect(()=>{
    if(!nativeBilling)return;
    const sub=ReactNative.AppState?.addEventListener('change',next=>{
      nativeBilling?.invalidate();
      // Unknown is not confirmed absence of a subscription. Do not send a
      // returning subscriber to checkout while foreground verification runs.
      if(next==='active')void queryClient.resetQueries({queryKey:['native','access']});
    });return ()=>sub?.remove();
  },[queryClient]);
  return query;
}

export function useOfferings() {
  return useQuery<PurchasesOfferings>({
    queryKey: ["rc", "offerings"],
    queryFn: () => requireSdk().getOfferings(),
    enabled: purchasesAvailable,
    staleTime: 5 * 60_000,
  });
}

export type PurchaseOutcome = { status: "purchased" | "cancelled" | "pending" | "entitlement_delayed" };

/** Purchase a package. Cancel and pending states resolve (not reject). */
export function usePurchasePackage() {
  const queryClient = useQueryClient();
  return useMutation<PurchaseOutcome, Error, PurchasesPackage>({
    mutationFn: async (pkg: PurchasesPackage) => {
      try {
        if (normalBillingEnabled && pkg.product.identifier !== 'byis_pro_monthly_5') throw Error('Unsupported subscription');
        if (migrationRequired) throw Error('An existing Apple purchase needs recovery. Choose Restore purchases; do not buy again.');
        if (nativeBilling && await nativeBilling.access()) return {status:'purchased' as const};
        const { customerInfo } = await purchasesIdentity.runVerified(async () => {
          if(nativeBilling && hasPro(await requireSdk().getCustomerInfo()))throw Error('An Apple purchase is awaiting server verification. Retry access or restore; do not buy again.');
          return requireSdk().purchasePackage(pkg);
        });
        queryClient.setQueryData(["rc", "customerInfo"], customerInfo);
        void syncTrialReminder(customerInfo);
        const allowed = nativeBilling ? await nativeBilling.access() : hasPro(customerInfo);
        if(nativeBilling)queryClient.setQueryData(['native','access'],allowed);
        return { status: allowed ? "purchased" as const : "entitlement_delayed" as const };
      } catch (e) {
        const err = e as { userCancelled?: boolean; code?: string };
        if (err.userCancelled) return { status: "cancelled" as const };
        if (err.code === "20" || err.code === "PAYMENT_PENDING") {
          return { status: "pending" as const };
        }
        throw e;
      }
    },
  });
}

export function useRestorePurchases() {
  const queryClient = useQueryClient();
  return useMutation<boolean, Error, void>({
    mutationFn: async () => {
      if (nativeBilling && migrationRequired) {
        // Explicit user-requested restore only. SDK aliasing is not Auth proof;
        // server admission still requires a trusted event and fresh reconciliation.
        const ready = await purchasesIdentity.sync('restore-existing-purchase');
        if(!ready)throw Error('Purchase identity recovery unavailable; retry restore, not purchase.');
      }
      const info = await purchasesIdentity.runVerified(() => requireSdk().restorePurchases());
      queryClient.setQueryData(["rc", "customerInfo"], info);
      void syncTrialReminder(info);
      let allowed = nativeBilling ? await nativeBilling.access() : hasPro(info);
      // Restore is also the recovery entry point after leaving onboarding. The
      // server, never the restored SDK snapshot, decides whether linking is safe.
      if(nativeBilling && !allowed && hasPro(info) && purchaseFirstEnabled && await checkPurchaseFirstPolicy()) {
        const response=await nativeBilling.request('claim');
        const body=await response.json();
        if(!response.ok||typeof body.allowed!=='boolean')throw Error('Purchase linking is unavailable. Retry restore; do not repurchase.');
        allowed=body.allowed;
      }
      if(nativeBilling)queryClient.setQueryData(['native','access'],allowed);
      return allowed;
    },
  });
}

/** Apple confirmation before signup is not lesson admission. Never resets an SDK identity. */
export function usePreAccountPurchase(){
 const client=useQueryClient();
 return useMutation<{status:'account_required'|'cancelled'|'pending'},Error,{kind:'buy'|'restore'|'recover';pkg?:PurchasesPackage}>({mutationFn:async({kind,pkg})=>{
  if(!await checkPurchaseFirstPolicy())throw Error('Purchase setup is unavailable. No purchase was started.');
  try{
   const info=await purchasesIdentity.runVerified(async()=>{
    const sdk=requireSdk();if(!await sdk.isAnonymous())throw Error('Sign into your existing account to recover this purchase.');
    const id=await sdk.getAppUserID();
    const current=await sdk.getCustomerInfo();if(hasPro(current)){await purchasePending.clear(id);return current;}
    if(kind==='restore'){const restored=await sdk.restorePurchases();if(hasPro(restored))await purchasePending.clear(id);return restored;}
    if(!pkg||pkg.product.identifier!=='byis_pro_monthly_5')throw Error('Unsupported subscription');
    if(kind==='recover'){
      // Explicit Apple-mediated recovery, not automatic retry or proof of no charge.
      // First recover any active subscription. Never retry known deferred payment.
      const restored=await sdk.restorePurchases();
      if(hasPro(restored)){await purchasePending.clear(id);return restored;}
      if(await purchasePending.deferred(id))return restored;
    }else if(await purchasePending.read(id))throw Error('A prior purchase is unconfirmed. Recheck or restore; do not purchase again.');
    await purchasePending.mark(id);
    try{const purchased=(await sdk.purchasePackage(pkg)).customerInfo;if(hasPro(purchased))await purchasePending.clear(id);return purchased;}
    catch(e){
      const error=e as {userCancelled?:boolean;code?:string};
      if(error.code==='20'||error.code==='PAYMENT_PENDING')await purchasePending.markDeferred(id);
      // Only definitive cancellation/rejection clears uncertainty. Network,
      // store, receipt and pending errors may follow a successful transaction.
      if(kind!=='recover'&&(error.userCancelled||['1','3','4','5'].includes(String(error.code))))await purchasePending.clear(id);
      throw e;
    }
   });
   client.setQueryData(['rc','customerInfo'],info);
   return {status:hasPro(info)?'account_required':'pending'};
  }catch(e){const err=e as {userCancelled?:boolean;code?:string};if(err.userCancelled)return {status:'cancelled'};if(err.code==='20'||err.code==='PAYMENT_PENDING')return {status:'pending'};throw e;}
 }});
}

/** Explicit account-return/recovery. Server accepts no client purchase evidence. */
export function useClaimPreAccountPurchase(){
 const client=useQueryClient();
 return useMutation<'linked'|'pending'|'no_purchase',Error,string>({mutationFn:async owner=>{
  if(!nativeBilling||!owner||!await checkPurchaseFirstPolicy())throw Error('Purchase linking is unavailable. Do not repurchase.');
  const info=await purchasesIdentity.sync(`claim-anonymous:${owner}`);
  if(!info)throw Error('Purchase identity needs recovery. Sign into the original account or restore.');
  client.setQueryData(['rc','customerInfo'],info);
  if(!hasPro(info))return 'no_purchase';
  const response=await nativeBilling.request('claim');const body=await response.json();
  if(!response.ok||typeof body.allowed!=='boolean')throw Error('Purchase linking is unavailable. Do not repurchase.');
  client.setQueryData(['native','access'],body.allowed);
  return body.allowed?'linked':'pending';
 }});
}
