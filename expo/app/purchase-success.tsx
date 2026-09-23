import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, RefreshCw } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, GlassCard, GhostButton, PrimaryButton, Reveal, StateDock } from "@/components/ui";
import { curriculumModule, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { nextLaunchDeck } from "@/lib/launchCurriculum";
import { purchasedContinuity } from "@/lib/nativeCommerce";
import { useCustomerInfo, useIsPro } from "@/lib/purchases";
import { syncTrialReminder } from '@/lib/trialReminder';
import type { TrialReminderStatus } from '@/lib/trialOffer';
import { useStore } from "@/providers/store";

export default function PurchaseSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gate?: string }>();
  const insets = useSafeAreaInsets();
  const { activePracticeSession, convertedLessonProgress, moduleCloseProgress, sessions, pilotProgress } = useStore();
  const nextDeck = nextLaunchDeck(convertedLessonProgress, moduleCloseProgress);
  const isPro = useIsPro();
  const customer = useCustomerInfo();
  const [reminder, setReminder] = React.useState<TrialReminderStatus | null>(null);
  React.useEffect(() => {
    let current = true;
    if (isPro && customer.data) void syncTrialReminder(customer.data).then(status => { if (current) setReminder(status); });
    return () => { current = false; };
  }, [isPro, customer.data]);
  const result = activePracticeSession?.sharedResult;
  const continuity = purchasedContinuity(result, sessions.length, pilotProgress.length);
  const moduleId: ModuleId | null = continuity.moduleId;
  const module = curriculumModule(moduleId);
  const openNextStep = (): void => {
    if (params.gate === "another-rehearsal") {
      router.replace({ pathname: "/(tabs)/library", params: { view: "scenarios" } });
      return;
    }
    if (!continuity.hasPersonalizedStart && continuity.recoveryDestination) {
      router.replace(continuity.recoveryDestination as never);
      return;
    }
    if (continuity.hasPersonalizedStart && nextDeck) {
      router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: nextDeck } });
      return;
    }
    if (continuity.recoveryDestination) router.replace(continuity.recoveryDestination as never);
    else router.replace("/(tabs)");
  };

  if (!isPro) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        {customer.isLoading ? <ActivityIndicator color={C.purple} /> : <RefreshCw size={32} color={C.purple} />}
        <Text style={styles.title}>Your entitlement is still being confirmed.</Text>
        <Text style={styles.centerBody}>Purchased opens only after the provider reports active pro access. Nothing has been unlocked optimistically.</Text>
        <PrimaryButton label="Check again" onPress={() => void customer.refetch()} containerStyle={styles.fullButton} />
        <GhostButton label="Back to offer" onPress={() => router.replace("/paywall")} style={styles.secondary} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 42, paddingBottom: insets.bottom + 170 }]} showsVerticalScrollIndicator={false}>
        <Reveal>
          <View style={styles.check}><Check size={32} color={C.onAccent} strokeWidth={2.8} /></View>
          <Text style={styles.title}>You’re in.</Text>
          <Text style={styles.body}>{continuity.hasPersonalizedStart
            ? "Your rehearsal, Starting Index, and first focus are ready. Nothing to redo."
            : "Your subscription is active. Continue to your saved result to finish choosing your first focus."}</Text>
        </Reveal>
        <Reveal index={1}>
          <GlassCard style={styles.continuity}>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Partial Index</Text><Text style={styles.summaryValue}>{continuity.indexValue ?? "Not yet available"}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Signals observed</Text><Text style={styles.summaryValue}>{continuity.observedCount} of 6</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>First focus</Text><Text style={styles.summaryValue}>{continuity.firstFocusLabel ?? "Complete your starting step"}</Text></View>
          </GlassCard>
        </Reveal>
        {reminder === 'scheduled' ? <Text style={styles.body}>Your trial reminder is scheduled on this device for 2 days before your trial ends.</Text> : null}
        {reminder === 'denied' || reminder === 'unavailable' || reminder === 'off' ? <Text style={styles.body}>{reminder === 'unavailable' ? 'We couldn’t confirm a trial reminder on this device.' : 'No trial reminder is enabled on this device.'} You can check your renewal date and cancel in Apple Settings. You can still start practicing.</Text> : null}
      </ScrollView>
      <StateDock bottomInset={insets.bottom}><PrimaryButton label={continuity.hasPersonalizedStart ? "Start my first practice" : "Complete my starting step"} disabled={params.gate !== "another-rehearsal" && !nextDeck && !continuity.recoveryDestination} onPress={openNextStep} /><Text style={styles.moduleNote}>{nextDeck ? `Continues with ${nextDeck.replace(/-/g, " ").toUpperCase()}` : module ? `Recommended focus: ${module.name}` : "Uses your preserved result to establish an evidence-backed first focus."}</Text></StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { padding: GUTTER, alignItems: "center", justifyContent: "center" }, content: { flexGrow: 1, justifyContent: "center", paddingHorizontal: GUTTER },
  check: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }, confirmed: { marginTop: 22 },
  title: { ...T.display, marginTop: 10 }, body: { ...T.body, color: C.textSoft, marginTop: 14 }, centerBody: { ...T.body, color: C.textSoft, textAlign: "center", marginTop: 14 }, fullButton: { width: "100%", marginTop: 26 }, secondary: { width: "100%", marginTop: 10 },
  continuity: { padding: 22, borderRadius: radius.lg, marginTop: 30 }, cardLabel: { ...eyebrow, color: C.dim }, indexRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 18 }, indexValue: { fontFamily: font.semi, fontSize: 48, lineHeight: 54, color: C.purple }, indexCopy: { flex: 1 }, indexLabel: { ...eyebrow, color: C.purple }, indexMeta: { ...T.caption, marginTop: 5 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 20 },
  focusRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, focusCopy: { flex: 1 }, focusLabel: { ...eyebrow, color: C.purple }, focusValue: { ...T.title, fontSize: 18, lineHeight: 24, marginTop: 5 },
  summaryRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", gap: 12, marginVertical: 8 }, summaryLabel: { ...T.body, color: C.textSoft }, summaryValue: { ...T.body, fontFamily: font.semi, color: C.text, flexShrink: 1, textAlign: "right" },
  truth: { marginTop: 18, paddingHorizontal: 4 }, truthTitle: { ...T.support, fontFamily: font.semi, color: C.text }, truthBody: { ...T.caption, marginTop: 4 }, moduleNote: { ...T.caption, textAlign: "center", marginTop: 8 },
});
