import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, RefreshCw, Sparkles } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, GhostButton, PrimaryButton, Reveal, StateDock } from "@/components/ui";
import { curriculumModule, isModuleId, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { purchasedContinuity } from "@/lib/nativeCommerce";
import { useCustomerInfo, useIsPro } from "@/lib/purchases";
import { useStore } from "@/providers/store";

export default function PurchaseSuccess() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ moduleId?: string }>();
  const { activePracticeSession, sessions, pilotProgress } = useStore();
  const isPro = useIsPro();
  const customer = useCustomerInfo();
  const result = activePracticeSession?.sharedResult;
  const continuity = purchasedContinuity(result, sessions.length, pilotProgress.length);
  const requestedModule: ModuleId | null = isModuleId(params.moduleId) ? params.moduleId : null;
  const moduleId: ModuleId | null = continuity.moduleId ?? requestedModule;
  const module = curriculumModule(moduleId);

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
        <Reveal><View style={styles.check}><Check size={27} color={C.onAccent} strokeWidth={2.8} /></View><Eyebrow color={C.sage} style={styles.confirmed}>Subscription active · Purchased</Eyebrow><Text style={styles.title}>Your first practice is ready.</Text><Text style={styles.body}>Your rehearsal, Starting Index, and first focus carried over. Nothing to redo.</Text></Reveal>
        <Reveal index={1}>
          <GlassCard style={styles.continuity}>
            <Text style={styles.cardLabel}>YOUR CARRIED-OVER START</Text>
            <View style={styles.indexRow}><Text style={styles.indexValue}>{continuity.indexValue ?? "—"}</Text><View style={styles.indexCopy}><Text style={styles.indexLabel}>PARTIAL INDEX</Text><Text style={styles.indexMeta}>{continuity.indexValue !== null ? `${continuity.observedCount} of 6 signals observed` : "Insufficient evidence for an Index"}</Text></View></View>
            <View style={styles.rule} />
            <View style={styles.focusRow}><Sparkles size={18} color={C.purple} /><View style={styles.focusCopy}><Text style={styles.focusLabel}>FIRST FOCUS · Recommended starting module</Text><Text style={styles.focusValue}>{continuity.firstFocusLabel ?? "Your first focus is not available yet."}</Text></View></View>
          </GlassCard>
        </Reveal>
        <Reveal index={2}><View style={styles.truth}><Text style={styles.truthTitle}>A clean start</Text><Text style={styles.truthBody}>{continuity.savedHistoryCount} saved rehearsal record{continuity.savedHistoryCount === 1 ? "" : "s"} · {continuity.completedPracticeCount} paid practice{continuity.completedPracticeCount === 1 ? "" : "s"} completed. No history was added by purchase.</Text></View></Reveal>
      </ScrollView>
      <StateDock bottomInset={insets.bottom}><PrimaryButton label="Start my first practice" disabled={!moduleId} onPress={() => moduleId && router.replace({ pathname: "/module/[day]", params: { day: moduleId } })} /><Text style={styles.moduleNote}>{module ? `Begins with ${module.name}` : "Your recommendation needs another look before practice can begin."}</Text></StateDock>
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
