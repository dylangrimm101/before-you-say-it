import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, CreditCard, HelpCircle, LockKeyhole, Mic2, RefreshCw, Scale, ShieldCheck, UserRound } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, Reveal } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { providerLabel, subscriptionSnapshot } from "@/lib/commerce";
import { PRO_ENTITLEMENT, useCustomerInfo, useRestorePurchases } from "@/lib/purchases";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { reminder, setReminder, entitlement } = useStore();
  const customer = useCustomerInfo();
  const restore = useRestorePurchases();
  const [restoreMessage, setRestoreMessage] = useState<string>("");
  const subscription = useMemo(() => subscriptionSnapshot(customer.data, PRO_ENTITLEMENT), [customer.data]);

  const toggleReminder = async (enabled: boolean): Promise<void> => {
    const ok = await setReminder({ enabled, hour: reminder?.hour ?? 18, minute: reminder?.minute ?? 30 });
    if (!ok && Platform.OS !== "web") Alert.alert("Notifications are off", "Allow notifications in device Settings to use reminders.");
  };

  const restorePurchase = async (): Promise<void> => {
    setRestoreMessage("Checking your store account…");
    try {
      const found = await restore.mutateAsync();
      setRestoreMessage(found ? "Restore succeeded. Pro is active." : "Restore completed. No active pro entitlement was found.");
    } catch (error) {
      safeLog("[settings] restore failed", errorShape(error));
      setRestoreMessage("Restore failed. Check your connection and try again.");
    }
  };

  const manage = async (): Promise<void> => {
    if (!subscription?.managementURL || subscription.provider === "unknown") {
      setRestoreMessage("A verified subscription-management destination is not available for this account.");
      return;
    }
    if (subscription.provider === "stripe") {
      setRestoreMessage("Stripe management requires verified web activation and is not available in this native build yet.");
      return;
    }
    await Linking.openURL(subscription.managementURL);
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 50 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><PressCard onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><Text style={styles.backText}>Back</Text></PressCard><Text style={styles.headerTitle}>Settings</Text><View style={styles.back} /></View>

        <Reveal><Eyebrow color={C.dim}>Account</Eyebrow><SettingsRow icon={<UserRound size={18} color={C.purple} />} title="Account status" detail="Not signed in · local device journey" onPress={() => router.push("/continue-from-web")} /><Text style={styles.sectionNote}>Authentication and web activation are not connected in this build. No separate identity is created here.</Text></Reveal>

        <Reveal index={1}><Eyebrow color={C.dim} style={styles.sectionHeading}>Permissions & reminders</Eyebrow><SettingsRow icon={<Mic2 size={18} color={C.purple} />} title="Microphone permission" detail="Open device settings to review access" onPress={() => void Linking.openSettings()} /><View style={styles.toggleRow}><View style={styles.rowIcon}><Bell size={18} color={C.purple} /></View><View style={styles.rowCopy}><Text style={styles.rowTitle}>Practice reminders</Text><Text style={styles.rowDetail}>{reminder?.enabled ? "Enabled at your saved local time" : "Off"}</Text></View><Switch value={reminder?.enabled ?? false} onValueChange={(value) => void toggleReminder(value)} trackColor={{ false: C.track, true: C.purpleLight }} thumbColor={reminder?.enabled ? C.purple : C.dim} accessibilityLabel="Practice reminders" /></View></Reveal>

        <Reveal index={2}><Eyebrow color={C.dim} style={styles.sectionHeading}>Subscription</Eyebrow><View style={styles.statusCard}><CreditCard size={19} color={entitlement === "pro" ? C.sage : C.dim} /><View style={styles.rowCopy}><Text style={styles.rowTitle}>{entitlement === "pro" ? "Pro active" : "No active subscription"}</Text><Text style={styles.rowDetail}>{subscription ? `${providerLabel(subscription.provider)}${subscription.willRenew === false ? " · does not renew" : ""}` : "Provider not verified"}</Text></View></View><SettingsRow icon={<RefreshCw size={18} color={C.purple} />} title={restore.isPending ? "Restoring…" : "Restore purchases"} detail="Check this App Store or Google Play account" onPress={() => void restorePurchase()} /><SettingsRow icon={<CreditCard size={18} color={C.purple} />} title="Billing and cancellation" detail={subscription?.managementURL && subscription.provider !== "unknown" ? `Manage with ${providerLabel(subscription.provider)}` : "Available only when the provider is verified"} onPress={() => void manage()} />{restoreMessage ? <Text style={styles.message}>{restoreMessage}</Text> : null}</Reveal>

        <Reveal index={3}><Eyebrow color={C.dim} style={styles.sectionHeading}>Privacy & legal</Eyebrow><SettingsRow icon={<ShieldCheck size={18} color={C.purple} />} title="Privacy and data details" detail="Storage, providers, deletion, and Reset All Data" onPress={() => router.push("/privacy")} /><SettingsRow icon={<Scale size={18} color={C.purple} />} title="Terms" detail="Apple standard end-user license agreement" onPress={() => void Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} /><SettingsRow icon={<LockKeyhole size={18} color={C.purple} />} title="Privacy" detail="Open BYSI’s in-app privacy and data disclosure" onPress={() => router.push("/privacy")} /></Reveal>

        <Reveal index={4}><Eyebrow color={C.dim} style={styles.sectionHeading}>Support</Eyebrow><SettingsRow icon={<HelpCircle size={18} color={C.purple} />} title="Support" detail="Email the BYSI team" onPress={() => void Linking.openURL("mailto:support@beforeyousayit.app")} /><View style={styles.version}><Text style={styles.versionLabel}>BEFORE YOU SAY IT</Text><Text style={styles.versionValue}>Version {Constants.expoConfig?.version ?? "unavailable"}</Text></View></Reveal>
      </ScrollView>
    </View>
  );
}

function SettingsRow({ icon, title, detail, onPress }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={`${title}. ${detail}`}><View style={styles.row}><View style={styles.rowIcon}>{icon}</View><View style={styles.rowCopy}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View><ChevronRight size={18} color={C.dim} /></View></PressCard>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER }, header: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }, back: { width: 54, height: 44, justifyContent: "center" }, backText: { ...T.support, color: C.purple, fontFamily: font.semi }, headerTitle: { ...T.title, fontSize: 18 }, sectionHeading: { marginTop: 30, marginBottom: 8 }, sectionNote: { ...T.caption, marginTop: 8, paddingHorizontal: 4 },
  row: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, toggleRow: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, rowCopy: { flex: 1 }, rowTitle: { ...T.support, fontFamily: font.semi, color: C.text }, rowDetail: { ...T.caption, marginTop: 3 }, statusCard: { minHeight: 78, padding: 16, borderRadius: radius.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.glassEdge, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 4 }, message: { ...T.caption, color: C.purple, marginTop: 10, paddingHorizontal: 4 }, version: { alignItems: "center", marginTop: 34 }, versionLabel: { ...eyebrow, color: C.dim }, versionValue: { ...T.caption, marginTop: 6 },
});
