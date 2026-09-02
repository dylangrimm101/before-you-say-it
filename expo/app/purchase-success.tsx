import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, RefreshCw, Sparkles } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, GhostButton, PrimaryButton, Reveal, StateDock } from "@/components/ui";
import { curriculumModule, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { nextLaunchDeck } from "@/lib/launchCurriculum";
import { purchasedContinuity } from "@/lib/nativeCommerce";
import { useCustomerInfo, useIsPro } from "@/lib/purchases";
import { useStore } from "@/providers/store";

export default function PurchaseSuccess() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gate?: string }>();
  const insets = useSafeAreaInsets();
  const { activePracticeSession, convertedLessonProgress, moduleCloseProgress, sessions, pilotProgress } = useStore();
  const nextDeck = nextLaunchDeck(convertedLessonProgress, moduleCloseProgress);
  const isPro = useIsPro();
  const customer = useCustomerInfo();
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
        <Reveal><View style={styles.check}><Check size={27} color={C.onAccent} strokeWidth={2.8} /></View><Eyebrow color={C.sage} style={styles.confirmed}>Subscription active · Purchased</Eyebrow><Text style={styles.title}>{continuity.hasPersonalizedStart ? "Your first practice is ready." : "One short starting step comes next."}</Text><Text style={styles.body}>{continuity.hasPersonalizedStart ? "Your free rehearsal result, Starting Index, and first focus carried over. Nothing to redo." : "Your purchase is active and your completed free work is preserved. We need one evidence-backed focus before choosing a paid module."}</Text></Reveal>
        <Reveal index={1}>
          <GlassCard style={styles.continuity}>
            <Text style={styles.cardLabel}>YOUR CARRIED-OVER START</Text>
            <View style={styles.indexRow}><Text style={styles.indexValue}>{continuity.indexValue ?? "—"}</Text><View style={styles.indexCopy}><Text style={styles.indexLabel}>PARTIAL INDEX</Text><Text style={styles.indexMeta}>{continuity.indexValue !== null ? `${continuity.observedCount} of 6 signals observed` : "Insufficient evidence for an Index"}</Text></View></View>
            <View style={styles.rule} />
            <View style={styles.focusRow}><Sparkles size={18} color={C.purple} /><View style={styles.focusCopy}><Text style={styles.focusLabel}>FIRST FOCUS · Recommended starting module</Text><Text style={styles.focusValue}>{continuity.firstFocusLabel ?? "Your first focus is not available yet."}</Text></View></View>
          </GlassCard>
        </Reveal>
        <Reveal index={2}><View style={styles.truth}><Text style={styles.truthTitle}>{continuity.hasPersonalizedStart ? "Your free result is preserved" : "No repurchase needed"}</Text><Text style={styles.truthBody}>{continuity.hasPersonalizedStart ? "Paid-practice history begins now. No practice record was fabricated by purchase." : "Return to your existing result for the missing focus step. You will not be asked to buy again or repeat approved free work."}</Text></View></Reveal>
      </ScrollView>
      <StateDock bottomInset={insets.bottom}><PrimaryButton label={continuity.hasPersonalizedStart ? "Start my first practice" : "Complete my starting step"} disabled={params.gate !== "another-rehearsal" && !nextDeck && !continuity.recoveryDestination} onPress={openNextStep} /><Text style={styles.moduleNote}>{nextDeck ? `Continues with ${nextDeck.replace(/-/g, " ").toUpperCase()}` : module ? `Recommended focus: ${module.name}` : "Uses your preserved result to establish an evidence-backed first focus."}</Text></StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { padding: GUTTER, alignItems: "center", justifyContent: "center" }, content: { paddingHorizontal: GUTTER },
  check: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }, confirmed: { marginTop: 22 },
  title: { ...T.display, marginTop: 10 }, body: { ...T.body, color: C.textSoft, marginTop: 14 }, centerBody: { ...T.body, color: C.textSoft, textAlign: "center", marginTop: 14 }, fullButton: { width: "100%", marginTop: 26 }, secondary: { width: "100%", marginTop: 10 },
  continuity: { padding: 22, borderRadius: radius.lg, marginTop: 30 }, cardLabel: { ...eyebrow, color: C.dim }, indexRow: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 18 }, indexValue: { fontFamily: font.semi, fontSize: 48, lineHeight: 54, color: C.purple }, indexCopy: { flex: 1 }, indexLabel: { ...eyebrow, color: C.purple }, indexMeta: { ...T.caption, marginTop: 5 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 20 },
  focusRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" }, focusCopy: { flex: 1 }, focusLabel: { ...eyebrow, color: C.purple }, focusValue: { ...T.title, fontSize: 18, lineHeight: 24, marginTop: 5 },
  truth: { marginTop: 18, paddingHorizontal: 4 }, truthTitle: { ...T.support, fontFamily: font.semi, color: C.text }, truthBody: { ...T.caption, marginTop: 4 }, moduleNote: { ...T.caption, textAlign: "center", marginTop: 8 },
});
