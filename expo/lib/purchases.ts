import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { Platform } from "react-native";
import type {
  CustomerInfo,
  PurchasesOfferings,
  PurchasesPackage,
} from "react-native-purchases";

import { hasActiveEntitlement } from "@/lib/commerce";
import { errorShape, safeLog } from "@/lib/redact";

export const PRO_ENTITLEMENT = "pro";

/** The slice of the RevenueCat SDK this app actually uses. */
type PurchasesModule = {
  configure: (options: { apiKey: string }) => void;
  getCustomerInfo: () => Promise<CustomerInfo>;
  getOfferings: () => Promise<PurchasesOfferings>;
  purchasePackage: (pkg: PurchasesPackage) => Promise<{ customerInfo: CustomerInfo }>;
  restorePurchases: () => Promise<CustomerInfo>;
};

/**
 * Expo Go does not bundle the RevenueCat native module, so touching the SDK
 * there tears down the whole app at launch. Detect that sandbox up front and
 * run without billing instead of crashing.
 */
const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

function getRCToken(): string | undefined {
  if (__DEV__ || Platform.OS === "web") {
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
const sdk = apiKey ? loadSdk() : null;

if (!apiKey) {
  safeLog("[purchases] missing RevenueCat API key — paywall disabled");
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

export function hasPro(info: CustomerInfo | undefined): boolean {
  return hasActiveEntitlement(info, PRO_ENTITLEMENT);
}

export function useCustomerInfo() {
  return useQuery<CustomerInfo>({
    queryKey: ["rc", "customerInfo"],
    queryFn: () => requireSdk().getCustomerInfo(),
    enabled: purchasesAvailable,
    staleTime: 60_000,
  });
}

/** True when the user has the active "pro" entitlement. */
export function useIsPro(): boolean {
  const { data } = useCustomerInfo();
  return hasPro(data);
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
        const { customerInfo } = await requireSdk().purchasePackage(pkg);
        queryClient.setQueryData(["rc", "customerInfo"], customerInfo);
        return { status: hasPro(customerInfo) ? "purchased" as const : "entitlement_delayed" as const };
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
      const info = await requireSdk().restorePurchases();
      queryClient.setQueryData(["rc", "customerInfo"], info);
      return hasPro(info);
    },
  });
}
