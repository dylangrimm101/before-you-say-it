import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { ChevronRight, CreditCard, Database, FileText, FlaskConical, HelpCircle, Mic2, RefreshCw, ShieldCheck, Trash2, UserRound } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { providerLabel, subscriptionSnapshot } from "@/lib/commerce";
import { PRO_ENTITLEMENT, useCustomerInfo, useRestorePurchases } from "@/lib/purchases";
import { errorShape, safeLog } from "@/lib/redact";
import { useAuth } from "@/providers/auth";
import { useStore } from "@/providers/store";

const STORE_TERMS = Platform.select({
  ios: { title: "Apple standard EULA", detail: "Review Apple’s standard license terms for this app", url: "https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" },
  android: { title: "Google Play terms", detail: "Review the terms for your Google Play account", url: "https://play.google.com/about/play-terms/" },
  default: null,
});
const SUPPORT_URL = "mailto:support@beforeyousayit.app?subject=BYSI%20help%20or%20feedback";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { entitlement, devProEnabled, reset } = useStore();
  const { user, isAuthLoading, isAuthConfigured } = useAuth();
  const customer = useCustomerInfo();
  const restore = useRestorePurchases();
  const [message, setMessage] = useState<string>("");
  const subscription = useMemo(() => subscriptionSnapshot(customer.data, PRO_ENTITLEMENT), [customer.data]);
  const accountTitle = isAuthLoading ? "Checking account…" : user ? "Account" : isAuthConfigured ? "Sign in" : "On this device";
  const accountDetail = isAuthLoading
    ? "Checking your account"
    : user
      ? `Signed in as ${user.email ?? "your web account"}`
      : isAuthConfigured
        ? "Connect the web account you already use"
        : "Your progress is stored on this device";
  const subscriptionTitle = __DEV__ && devProEnabled ? "Developer access" : entitlement === "pro" ? "BYSI Pro" : "Free access";
  const subscriptionDetail = __DEV__ && devProEnabled
    ? "Testing access is active on this device"
    : subscription
      ? `${providerLabel(subscription.provider)}${subscription.willRenew === false ? " · Ends after the current period" : " · Subscription active"}`
      : entitlement === "pro"
        ? "Subscription active"
        : "Your free practice remains available";

  const restorePurchase = async (): Promise<void> => {
    if (restore.isPending) return;
    setMessage("Checking your store account…");
    try {
      const found = await restore.mutateAsync();
      setMessage(found ? "Restore complete. BYSI Pro is active." : "No active BYSI Pro subscription was found for this store account.");
    } catch (error) {
      safeLog("[settings] restore failed", errorShape(error));
      setMessage("We couldn’t restore purchases. Check your connection and try again.");
    }
  };

  const manage = async (): Promise<void> => {
    if (!subscription || subscription.provider === "unknown") {
      setMessage("Subscription management isn’t available from this device yet. Try Restore purchases first.");
      return;
    }
    if (subscription.provider === "stripe") {
      setMessage("Manage this subscription from the web account where you purchased it.");
      return;
    }
    if (!subscription.managementURL) {
      setMessage("We couldn’t open subscription management. Review subscriptions in your App Store or Google Play account.");
      return;
    }
    try {
      await Linking.openURL(subscription.managementURL);
    } catch (error) {
      safeLog("[settings] subscription management failed", errorShape(error));
      setMessage("We couldn’t open subscription management. Review subscriptions directly in your App Store or Google Play account.");
    }
  };

  const confirmReset = (): void => {
    const perform = (): void => {
      setMessage("Deleting data from this device…");
      void reset()
        .then(() => router.replace("/entry"))
        .catch((error) => {
          safeLog("[settings] reset failed", errorShape(error));
          setMessage("Deletion may be incomplete. Some data may already be gone; try again to finish.");
        });
    };
    const title = "Delete data on this device?";
    const body = "This removes your local profile, practice history, saved scenarios, account session, generated audio, and progress. It does not delete your web account or cancel a subscription.";
    if (Platform.OS === "web") {
      if (globalThis.confirm?.(`${title}\n\n${body}`)) perform();
      return;
    }
    Alert.alert(title, body, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete device data", style: "destructive", onPress: perform },
    ]);
  };

  return <View style={styles.root}>
    <Backdrop />
    <View style={{ paddingTop: insets.top }}><PaidHeader title="Settings" onBack={() => router.back()} /></View>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
      <Reveal>
        <PressCard onPress={() => void manage()} accessibilityLabel={`Manage subscription. ${subscriptionTitle}`}>
          <ProductCard accent style={styles.subscriptionHero}>
            <View style={styles.heroIcon}><CreditCard size={22} color={entitlement === "pro" ? C.sage : C.purple} /></View>
            <View style={styles.heroCopy}><Text style={styles.heroEyebrow}>SUBSCRIPTION</Text><Text style={styles.heroTitle}>{subscriptionTitle}</Text><Text style={styles.heroDetail}>{subscriptionDetail}</Text></View>
            <View style={styles.manageAction}><Text style={styles.manageText}>Manage</Text><ChevronRight size={16} color={C.purple} /></View>
          </ProductCard>
        </PressCard>
        <SettingsRow icon={<RefreshCw size={18} color={C.purple} />} title={restore.isPending ? "Restoring…" : "Restore purchases"} detail="Check this App Store or Google Play account" onPress={() => void restorePurchase()} disabled={restore.isPending} compact />
        {message ? <View style={styles.message}><Text accessibilityLiveRegion="polite" style={styles.messageText}>{message}</Text></View> : null}
      </Reveal>

      <Reveal index={1} style={styles.section}><SectionLabel>Account</SectionLabel><SettingsGroup>
        <SettingsRow icon={<UserRound size={18} color={C.purple} />} title={accountTitle} detail={accountDetail} onPress={!user && isAuthConfigured && !isAuthLoading ? () => router.push("/continue-from-web") : undefined} last />
      </SettingsGroup></Reveal>

      <Reveal index={2} style={styles.section}><SectionLabel>Practice & permissions</SectionLabel><SettingsGroup>
        <SettingsRow icon={<Mic2 size={18} color={C.purple} />} title="Microphone" detail="Manage microphone permission in device settings" trailingText="Device settings" onPress={() => void Linking.openSettings()} last />
      </SettingsGroup></Reveal>

      <Reveal index={3} style={styles.section}><SectionLabel>Privacy & data</SectionLabel><SettingsGroup>
        <SettingsRow icon={<ShieldCheck size={18} color={C.purple} />} title="Privacy & data" detail="See what is stored, shared, retained, and deleted" onPress={() => router.push("/privacy")} />
        <SettingsRow icon={<Database size={18} color={C.purple} />} title="Rehearsal data" detail="Raw audio is deleted after transcription. Approved lesson text may remain only while your active journey needs it" />
        <SettingsRow icon={<Trash2 size={18} color={C.clay} />} title="Delete data on this device" detail="Remove local practice, progress, and account data" onPress={confirmReset} destructive last />
      </SettingsGroup></Reveal>

      <Reveal index={4} style={styles.section}><SectionLabel>Help & legal</SectionLabel><SettingsGroup>
        <SettingsRow icon={<HelpCircle size={18} color={C.purple} />} title="Help & feedback" detail="Report a problem or tell us what you think" onPress={() => void Linking.openURL(SUPPORT_URL)} />
        {STORE_TERMS ? <SettingsRow icon={<FileText size={18} color={C.purple} />} title={STORE_TERMS.title} detail={STORE_TERMS.detail} onPress={() => void Linking.openURL(STORE_TERMS.url)} /> : null}
        <SettingsRow icon={<ShieldCheck size={18} color={C.purple} />} title="Privacy Policy" detail="Review BYSI’s privacy commitments" onPress={() => router.push("/privacy")} last />
      </SettingsGroup></Reveal>

      {__DEV__ ? <Reveal index={5} style={styles.section}><SectionLabel>Internal testing</SectionLabel><SettingsGroup>
        <SettingsRow icon={<FlaskConical size={18} color={C.purple} />} title="QA access lab" detail="Review access states and approved lesson builds" onPress={() => router.push("/qa-access")} last />
      </SettingsGroup></Reveal> : null}

      <View style={styles.version}><Text style={styles.versionName}>BEFORE YOU SAY IT</Text><Text style={styles.versionValue}>Version {Constants.expoConfig?.version ?? "unavailable"}</Text></View>
    </ScrollView>
  </View>;
}

function SettingsGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

function SettingsRow({ icon, title, detail, onPress, disabled = false, destructive = false, last = false, compact = false, trailingText }: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  onPress?: () => void;
  disabled?: boolean;
  destructive?: boolean;
  last?: boolean;
  compact?: boolean;
  trailingText?: string;
}) {
  const content = <View style={[styles.row, compact && styles.rowCompact, last && styles.rowLast]}>
    <View style={[styles.rowIcon, destructive && styles.rowIconDanger]}>{icon}</View>
    <View style={styles.rowCopy}><Text style={[styles.rowTitle, destructive && styles.rowTitleDanger]}>{title}</Text><Text style={styles.rowDetail}>{detail}</Text></View>
    {trailingText ? <Text style={styles.trailingText}>{trailingText}</Text> : null}
    {onPress ? <ChevronRight size={18} color={destructive ? C.clay : C.dim} /> : null}
  </View>;
  if (!onPress) return content;
  return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={`${title}. ${detail}`}>{content}</PressCard>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 14 },
  subscriptionHero: { minHeight: 112, flexDirection: "row", alignItems: "center", gap: 12, ...shadow.layer },
  heroIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  heroCopy: { flex: 1 }, heroEyebrow: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.3, color: C.dim }, heroTitle: { ...T.title, fontSize: 20, marginTop: 4 }, heroDetail: { ...T.caption, marginTop: 4 },
  manageAction: { flexDirection: "row", alignItems: "center", gap: 2 }, manageText: { fontFamily: font.semi, fontSize: 12, color: C.purple },
  section: { marginTop: 28, gap: 10 },
  group: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, overflow: "hidden" },
  row: { minHeight: 78, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, rowCompact: { minHeight: 68, marginTop: 8, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, paddingHorizontal: 14, backgroundColor: "rgba(255,255,255,0.62)" }, rowLast: { borderBottomWidth: 0 },
  rowIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, rowIconDanger: { backgroundColor: C.claySoft },
  rowCopy: { flex: 1 }, rowTitle: { ...T.support, fontFamily: font.semi, color: C.text }, rowTitleDanger: { color: C.clay }, rowDetail: { ...T.caption, marginTop: 3 }, trailingText: { fontFamily: font.medium, fontSize: 11, color: C.dim, maxWidth: 78, textAlign: "right" },
  message: { borderRadius: 16, backgroundColor: C.purpleSoft, padding: 14, marginTop: 8 }, messageText: { ...T.caption, color: C.purple },
  version: { alignItems: "center", marginTop: 34 }, versionName: { fontFamily: font.semi, fontSize: 10, letterSpacing: 1.5, color: C.dim }, versionValue: { ...T.caption, marginTop: 5 },
});
