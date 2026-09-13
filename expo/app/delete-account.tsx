import { useFocusEffect, useRouter } from "expo-router";
import { CreditCard } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountDeletionControls, AccountDeletionStatusControls } from "@/components/AccountLifecycleControls";
import { PaidHeader } from "@/components/PaidProductUI";
import { Backdrop, GhostButton } from "@/components/ui";
import { C, GUTTER, T, font } from "@/constants/theme";
import { PRO_ENTITLEMENT, useCustomerInfo } from "@/lib/purchases";
import { providerLabel, subscriptionSnapshot } from "@/lib/commerce";
import { cleanupDeletedAccountOwner } from "@/lib/accountLifecycleRuntime";
import { finishDeletedOwnerLocally } from "@/lib/deletedOwnerCleanup";
import type { AccountDeletionBilling } from "@/lib/accountDeletion";
import { useAuth } from "@/providers/auth";

const APPLE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

function deletionBilling(subscription: ReturnType<typeof subscriptionSnapshot>): AccountDeletionBilling {
  if (!subscription) return { kind: "unknown", store: "unknown" };
  if (subscription.provider === "apple") return { kind: "apple", store: "app_store", product_id: "byis_pro_monthly_5", will_renew: subscription.willRenew, expiration_date: subscription.expirationDate };
  if (subscription.provider === "stripe") return { kind: "web", provider: "stripe" };
  return { kind: "unknown", store: subscription.provider };
}

export default function DeleteAccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout, logoutDeletedOwner } = useAuth();
  const currentOwner=useRef(user?.id??null);currentOwner.current=user?.id??null;
  const customer = useCustomerInfo();
  const refreshSubscription=customer.refetch;
  const [notice, setNotice] = useState("");
  const [clearSignal, setClearSignal] = useState(0);
  const subscription = useMemo(() => subscriptionSnapshot(customer.data, PRO_ENTITLEMENT), [customer.data]);
  const billing = useMemo(() => deletionBilling(subscription), [subscription]);
  const subscriptionText = subscription
    ? `${providerLabel(subscription.provider)}${subscription.willRenew === false ? " · will not renew" : " · status verified from this device"}`
    : "Subscription status unavailable";

  useFocusEffect(useCallback(() => { void refreshSubscription?.(); return () => setClearSignal((value) => value + 1); }, [refreshSubscription]));
  useEffect(() => {
    const subscription = AppState.addEventListener("change", state => { if (state === "active") void refreshSubscription?.(); });
    return () => subscription.remove();
  }, [refreshSubscription]);

  if (!user) return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Delete account" onBack={() => router.back()} /></View><View style={styles.empty}><Text style={styles.body}>Sign in before requesting account deletion.</Text><AccountDeletionStatusControls clearLocal={async(owner)=>{await cleanupDeletedAccountOwner(owner);const result=await logoutDeletedOwner(owner);if(!result.success)throw new Error('Sign out not confirmed');}} /></View></View>;

  const openAppleSubscriptions = async () => {
    try { await Linking.openURL(APPLE_SUBSCRIPTIONS_URL); }
    catch { setNotice("We could not open Apple subscriptions. Open subscriptions from your App Store account settings."); }
  };

  return <View style={styles.root}>
    <Backdrop />
    <View style={{ paddingTop: insets.top }}><PaidHeader title="Delete account" onBack={() => router.back()} /></View>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]} showsVerticalScrollIndicator={false}>
      <View style={styles.subscriptionRow}>
        <View style={styles.icon}><CreditCard size={18} color={C.purple} /></View>
        <View style={styles.copy}><Text style={styles.kicker}>BILLING</Text><Text style={styles.body}>{subscriptionText}</Text></View>
      </View>
      {billing.kind === "apple" || billing.kind === "unknown" ? <GhostButton label="Manage Apple subscription" onPress={openAppleSubscriptions} /> : null}
      {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
      <AccountDeletionControls ownerId={user.id} ownerEmail={user.email} onCancel={()=>router.back()} billing={billing} clearSignal={clearSignal} clearLocal={(owner) => finishDeletedOwnerLocally(owner,cleanupDeletedAccountOwner,()=>currentOwner.current,logout)} />
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18, gap: 16 },
  empty: { padding: GUTTER },
  subscriptionRow: { minHeight: 64, flexDirection: "row", alignItems: "center", gap: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  copy: { flex: 1 },
  kicker: { fontFamily: font.bold, fontSize: 10, color: C.dim },
  body: { ...T.body },
  notice: { ...T.caption, color: C.purple },
});
