import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, FlaskConical, HelpCircle, LogIn, Mic2, RefreshCw, ShieldCheck, Trash2 } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { providerLabel, subscriptionSnapshot } from "@/lib/commerce";
import { PRO_ENTITLEMENT, useCustomerInfo, useRestorePurchases } from "@/lib/purchases";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entitlement, devProEnabled, reset } = useStore();
  const customer = useCustomerInfo();
  const restore = useRestorePurchases();
  const [message, setMessage] = useState<string>("");
  const subscription = useMemo(() => subscriptionSnapshot(customer.data, PRO_ENTITLEMENT), [customer.data]);
  const providerIsVerified = Boolean(subscription && subscription.provider !== "unknown");

  const restorePurchase = async (): Promise<void> => {
    if (restore.isPending) return;
    setMessage("Checking your store account…");
    try { const found = await restore.mutateAsync(); setMessage(found ? "Restore succeeded. Pro is active." : "Restore completed. No active Pro entitlement was found."); }
    catch (error) { safeLog("[settings] restore failed", errorShape(error)); setMessage("Restore failed. Check your connection and try again."); }
  };

  const manage = async (): Promise<void> => {
    if (!subscription || subscription.provider === "unknown") { setMessage("Subscription management is unavailable because the purchase provider could not be verified. Check the store account used to purchase, or restore first."); return; }
    if (subscription.provider === "stripe") { setMessage("This native build cannot verify a Stripe management destination. Continue from the web account that purchased instead."); return; }
    if (!subscription.managementURL) { setMessage(`A verified ${providerLabel(subscription.provider)} management destination is unavailable. Review subscriptions manually in that store account.`); return; }
    await Linking.openURL(subscription.managementURL);
  };

  const confirmReset = (): void => {
    const perform = (): void => {
      setMessage("Resetting data…");
      void reset()
        .then(() => router.replace("/entry"))
        .catch((error) => {
          safeLog("[settings] reset failed", errorShape(error));
          setMessage("Reset could not be verified. Your data was not reported as cleared; try again.");
        });
    };
    if (Platform.OS === "web") { if (globalThis.confirm?.("Reset all BYSI data on this device?")) perform(); return; }
    Alert.alert("Reset all data?", "This removes local profile, practice history, transcripts, saved scenarios, account session, generated audio, and progress from this device. It does not cancel a store subscription.", [{ text: "Cancel", style: "cancel" }, { text: "Reset all data", style: "destructive", onPress: perform }]);
  };

  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Settings" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
    <Reveal><Text style={styles.title}>Your practice, access, and privacy.</Text><Text style={styles.intro}>Only settings with working behavior are shown here.</Text></Reveal>
    <Reveal index={1}><ProductCard accent style={styles.subscriptionHero}><View style={styles.heroIcon}><CreditCard size={22} color={entitlement === "pro" ? C.sage : C.purple} /></View><View style={styles.heroCopy}><SectionLabel tone={entitlement === "pro" ? C.sage : C.dim}>Subscription</SectionLabel><Text style={styles.heroTitle}>{__DEV__ && devProEnabled ? "QA access is active" : entitlement === "pro" ? "Pro is active" : "No active subscription"}</Text><Text style={styles.heroDetail}>{__DEV__ && devProEnabled ? "Local override · no store entitlement created" : subscription ? `${providerLabel(subscription.provider)}${subscription.willRenew === false ? " · does not renew" : ""}` : "Provider not verified"}</Text></View><StatusPill label={__DEV__ && devProEnabled ? "QA only" : providerIsVerified ? "Verified provider" : "Unavailable"} tone={__DEV__ && devProEnabled ? "amber" : providerIsVerified ? "green" : "neutral"} /></ProductCard></Reveal>
    <Reveal index={2} style={styles.section}><SectionLabel>Access</SectionLabel><SettingsGroup><SettingsRow icon={<RefreshCw size={18} color={C.purple} />} title={restore.isPending ? "Restoring…" : "Restore purchases"} detail="Check this App Store or Google Play account" onPress={() => void restorePurchase()} disabled={restore.isPending} /><SettingsRow icon={<CreditCard size={18} color={C.purple} />} title="Billing and cancellation" detail={providerIsVerified ? `Manage with ${providerLabel(subscription?.provider ?? "unknown")}` : "Available only when the provider is verified"} onPress={() => void manage()} last /></SettingsGroup>{message ? <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View> : null}</Reveal>
    <Reveal index={3} style={styles.section}><SectionLabel>Device journey</SectionLabel><SettingsGroup><SettingsRow icon={<LogIn size={18} color={C.purple} />} title="Web continuation" detail="Not signed in · this journey is stored locally" onPress={() => router.push("/continue-from-web")} /><SettingsRow icon={<Mic2 size={18} color={C.purple} />} title="Microphone access" detail="Review permission in device Settings" onPress={() => void Linking.openSettings()} last /></SettingsGroup></Reveal>
    {__DEV__ ? <Reveal index={4} style={styles.section}><SectionLabel>Internal testing</SectionLabel><SettingsGroup><SettingsRow icon={<FlaskConical size={18} color={C.purple} />} title="QA access lab" detail="Switch unpaid access, review modules, and preview the paywall" onPress={() => router.push("/qa-access")} last /></SettingsGroup></Reveal> : null}
    <Reveal index={5} style={styles.section}><SectionLabel>Privacy & data</SectionLabel><SettingsGroup><SettingsRow icon={<ShieldCheck size={18} color={C.purple} />} title="Privacy & details" detail="Storage, providers, retention, and deletion" onPress={() => router.push("/privacy")} /><SettingsRow icon={<Trash2 size={18} color={C.clay} />} title="Reset all data" detail="Remove BYSI data stored on this device" onPress={confirmReset} destructive last /></SettingsGroup><Text style={styles.resetNote}>Resetting local data does not cancel a subscription. Use verified provider management for billing changes.</Text></Reveal>
    <Reveal index={6} style={styles.section}><SectionLabel>Support</SectionLabel><SettingsGroup><SettingsRow icon={<HelpCircle size={18} color={C.purple} />} title="Contact support" detail="Email the BYSI team" onPress={() => void Linking.openURL("mailto:support@beforeyousayit.app")} last /></SettingsGroup><View style={styles.version}><Text style={styles.versionName}>BEFORE YOU SAY IT</Text><Text style={styles.versionValue}>Version {Constants.expoConfig?.version ?? "unavailable"}</Text></View></Reveal>
  </ScrollView></View>;
}

function SettingsGroup({ children }: { children: React.ReactNode }) { return <View style={styles.group}>{children}</View>; }
function SettingsRow({ icon, title, detail, onPress, disabled = false, destructive = false, last = false }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void; disabled?: boolean; destructive?: boolean; last?: boolean }) { return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={`${title}. ${detail}`}><View style={[styles.row, last && styles.rowLast]}><View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>{icon}</View><View style={styles.rowCopy}><Text style={[styles.rowTitle, destructive && styles.rowTitleDanger]}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><ChevronRight size={18} color={C.dim} /></View></PressCard>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER, paddingTop: 16 }, title: { ...T.display }, intro: { ...T.support, marginTop: 9 }, subscriptionHero: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 12 }, heroIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, heroCopy: { flex: 1 }, heroTitle: { ...T.title, fontSize: 18, marginTop: 4 }, heroDetail: { ...T.caption, marginTop: 3 },
  section: { marginTop: 28, gap: 10 }, group: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.68)", borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, overflow: "hidden" }, row: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, rowLast: { borderBottomWidth: 0 }, rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, rowIconDanger: { backgroundColor: C.claySoft }, rowCopy: { flex: 1 }, rowTitle: { ...T.support, fontFamily: font.semi, color: C.text }, rowTitleDanger: { color: C.clay }, rowDetail: { ...T.caption, marginTop: 3 }, message: { borderRadius: 16, backgroundColor: C.purpleSoft, padding: 14 }, messageText: { ...T.caption, color: C.purple }, resetNote: { ...T.caption, paddingHorizontal: 4 }, version: { alignItems: "center", marginTop: 28 }, versionName: { fontFamily: font.semi, fontSize: 10, letterSpacing: 1.5, color: C.dim }, versionValue: { ...T.caption, marginTop: 5 },
});
