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

export const PRO_ENTITLEMENT = "pro";

/** The slice of the RevenueCat SDK this app actually uses. */
type PurchasesModule = {
  configure: (options: { apiKey: string }) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
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
  const normalizedUserId = userId?.trim() ?? "";
  if (!sdk || !configured) return null;
  try {
    if (!normalizedUserId) {
      // Preserve anonymous purchases; never identify a disposable Supabase guest ID.
      if (await sdk.isAnonymous()) return await sdk.getCustomerInfo();
      return await sdk.logOut();
    }
    const boundId = nativeBilling ? await nativeBilling.identify() : normalizedUserId;
    if (nativeBilling && normalizedUserId !== "restore-existing-purchase" && await sdk.getAppUserID() !== boundId && hasPro(await sdk.getCustomerInfo())) {
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
  if(!userId)nativeBilling?.suspend();
  return purchasesIdentity.sync(userId);
}

/** Clears any authenticated RevenueCat app-user identity during data reset. */
export async function clearPurchasesIdentity(): Promise<void> {
  nativeBilling?.suspend();
  if (!sdk || !configured) return;
  const info = await purchasesIdentity.sync(null);
  if (!info) throw new Error("Purchases identity reset could not be verified.");
}

export function useCustomerInfo() {
  return useQuery<CustomerInfo | null>({
    queryKey: ["rc", "customerInfo"],
    queryFn: () => purchasesIdentity.runVerified(() => requireSdk().getCustomerInfo()),
    enabled: purchasesAvailable,
    staleTime: 60_000,
  });
}

/** True when the user has the active "pro" entitlement. */
export function useIsPro(): boolean {
  const { data } = useCustomerInfo();
  const access = useNativeServerAccess();
  return normalBillingEnabled ? access.data === true && !access.isError && !access.isPending && !access.isFetching : hasPro(data);
}

export function useNativeServerAccess() {
  const queryClient = useQueryClient();
  const query = useQuery<boolean>({queryKey:['native','access'],queryFn:()=>nativeBilling!.access(),enabled:!!nativeBilling,retry:false,staleTime:0,refetchInterval:15000});
  useEffect(()=>{
    if(!nativeBilling)return;
    const sub=ReactNative.AppState?.addEventListener('change',next=>{
      queryClient.setQueryData(['native','access'],false);
      nativeBilling?.invalidate();
      if(next==='active')void queryClient.invalidateQueries({queryKey:['native','access']});
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
      const allowed = nativeBilling ? await nativeBilling.access() : hasPro(info);
      if(nativeBilling)queryClient.setQueryData(['native','access'],allowed);
      return allowed;
    },
  });
}
