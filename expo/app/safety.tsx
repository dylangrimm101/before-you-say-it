import { useLocalSearchParams, useRouter } from "expo-router";
import { ExternalLink, Phone, ShieldCheck } from "lucide-react-native";
import React, { useCallback } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, GlassCard, PrimaryButton, PressCard } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { cancelConversionBuild } from "@/lib/conversionBuild";
import { cancelPendingResult } from "@/lib/freeJourney";
import { resetSpeech } from "@/lib/voice";
import { useStore } from "@/providers/store";

export default function SafetyScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ returnTo?: string; sessionId?: string }>();
  const { activePracticeSession, saveActivePracticeSession } = useStore();

  const leaveGeneration = useCallback(async (): Promise<void> => {
    if (params.sessionId) cancelConversionBuild(params.sessionId);
    await resetSpeech().catch(() => {});
    if (params.sessionId && activePracticeSession?.id === params.sessionId) {
      await saveActivePracticeSession(cancelPendingResult(activePracticeSession));
    }
  }, [activePracticeSession, params.sessionId, saveActivePracticeSession]);

  const returnSafely = useCallback(async (): Promise<void> => {
    await leaveGeneration();
    if (params.returnTo === "generating" && activePracticeSession) {
      router.replace({ pathname: "/rehearse/[id]", params: { id: activePracticeSession.scenarioId, difficulty: "steady", reaction: activePracticeSession.expectedReaction, entry: "onboarding", persona: activePracticeSession.persona, practiceSessionId: activePracticeSession.id } });
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/onboarding");
  }, [activePracticeSession, leaveGeneration, params.returnTo, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 28, paddingBottom: insets.bottom + 36 }]}>
        <View style={styles.icon}><ShieldCheck size={28} color={C.purple} /></View>
        <Text style={styles.eyebrow}>SAFETY RESOURCES</Text>
        <Text style={styles.title}>You do not have to rehearse this right now.</Text>
        <Text style={styles.lede}>If speaking up could put you at risk, prioritize real-world support and a safer plan. BYSI is practice, not a crisis service.</Text>

        <GlassCard style={styles.scope} raised={false}>
          <Text style={styles.scopeTitle}>United States resources only</Text>
          <Text style={styles.scopeBody}>The numbers below are verified for the US. This app does not fabricate or guess regional resources.</Text>
        </GlassCard>

        <Resource title="Immediate danger" detail="Call 911" phone="911" />
        <Resource title="Suicide & Crisis Lifeline" detail="Call or text 988" phone="988" />
        <Resource title="National Domestic Violence Hotline" detail="Call 1-800-799-SAFE (7233)" phone="18007997233" />
        <PressCard onPress={() => Linking.openURL("https://www.thehotline.org").catch(() => {})} accessibilityLabel="Open the National Domestic Violence Hotline website">
          <View style={styles.webRow}><ExternalLink size={18} color={C.purple} /><Text style={styles.webText}>Visit thehotline.org</Text></View>
        </PressCard>

        <PrimaryButton label="Return safely" onPress={() => void returnSafely()} style={styles.returnButton} />
        <Text style={styles.note}>Your safety choice is not stored or sent to analytics.</Text>
      </ScrollView>
    </View>
  );
}

function Resource({ title, detail, phone }: { title: string; detail: string; phone: string }) {
  return <PressCard onPress={() => Linking.openURL(`tel:${phone}`).catch(() => {})} accessibilityLabel={`${title}. ${detail}`}><View style={styles.resource}><View style={styles.phone}><Phone size={18} color={C.onAccent} /></View><View style={styles.copy}><Text style={styles.resourceTitle}>{title}</Text><Text style={styles.resourceDetail}>{detail}</Text></View></View></PressCard>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER, gap: 14 },
  icon: { width: 54, height: 54, borderRadius: 27, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  eyebrow: { ...eyebrow, color: C.purple }, title: { ...T.display }, lede: { ...T.body, color: C.textSoft, marginBottom: 6 },
  scope: { padding: 16, borderRadius: radius.md, borderColor: `${C.amber}55` }, scopeTitle: { ...T.support, fontFamily: font.semi, color: C.text }, scopeBody: { ...T.caption, marginTop: 5 },
  resource: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 14, padding: 15, backgroundColor: C.surfaceHigh, borderRadius: radius.md, borderWidth: 1, borderColor: C.line }, phone: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" }, copy: { flex: 1 }, resourceTitle: { ...T.support, fontFamily: font.semi, color: C.text }, resourceDetail: { ...T.caption, color: C.purple, marginTop: 3 },
  webRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }, webText: { ...T.support, color: C.purple, fontFamily: font.semi }, returnButton: { marginTop: 14 }, note: { ...T.caption, textAlign: "center" },
});
