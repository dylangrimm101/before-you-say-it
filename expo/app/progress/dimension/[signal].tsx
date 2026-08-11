import { useLocalSearchParams, useRouter } from "expo-router";
import { Circle, Quote, Target } from "lucide-react-native";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, Meter, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font } from "@/constants/theme";
import { dimensionEvidencePresentation, isSharedSignalKey } from "@/lib/paidProduct";
import { useStore } from "@/providers/store";

export default function DimensionDetailScreen() {
  const params = useLocalSearchParams<{ signal: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePracticeSession } = useStore();
  const key = isSharedSignalKey(params.signal) ? params.signal : "clarity";
  const evidenceText = useMemo(() => {
    const values = new Map<string, string>();
    activePracticeSession?.freeRehearsalTurns?.forEach((turn) => values.set(turn.id, turn.text));
    Object.values(activePracticeSession?.pilotRuns ?? {}).forEach((run) => {
      [run.attempt, run.responseAttempt, run.retryAttempt].forEach((attempt) => { if (attempt) values.set(attempt.id, attempt.transcript); });
    });
    return values;
  }, [activePracticeSession]);
  const detail = useMemo(() => dimensionEvidencePresentation(key, activePracticeSession?.sharedResult, evidenceText), [activePracticeSession?.sharedResult, evidenceText, key]);
  const isObserved = detail.value !== null;

  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Dimension" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
    <Reveal><StatusPill label={isObserved ? "Observed in approved practice" : "Not observed yet"} tone={isObserved ? "purple" : "neutral"} /><Text style={styles.title}>{detail.label}</Text><Text style={styles.meaning}>{detail.meaning}</Text></Reveal>
    <Reveal index={1}><ProductCard accent style={styles.valueCard}><View style={styles.valueRow}><Text style={styles.value}>{detail.value ?? "—"}</Text>{detail.value !== null ? <Text style={styles.outOf}>/ 100</Text> : null}<View style={styles.practiceCount}><Text style={styles.countValue}>{detail.practiceCount}</Text><Text style={styles.countLabel}>OBSERVED PRACTICE{detail.practiceCount === 1 ? "" : "S"}</Text></View></View>{detail.value !== null ? <Meter value={detail.value} tone={C.purple} /> : <View style={styles.unobservedTrack} />}<Text style={styles.valueNote}>{isObserved ? "This value comes from approved evidence in the available scored result." : "This signal does not contribute to the Index until an approved practice puts it under pressure."}</Text></ProductCard></Reveal>
    <Reveal index={2} style={styles.section}><SectionLabel>Supporting evidence</SectionLabel>{detail.evidenceTexts.length > 0 ? detail.evidenceTexts.map((text, index) => <ProductCard key={`${text}-${index}`} style={styles.quoteCard}><Quote size={17} color={C.purple} /><Text style={styles.quote}>“{text}”</Text><Text style={styles.evidenceMeta}>Approved transcript evidence</Text></ProductCard>) : <View style={styles.emptyEvidence}><Circle size={18} color={C.dim} /><View style={styles.emptyCopy}><Text style={styles.emptyTitle}>{isObserved ? "Evidence text is no longer stored" : "No approved evidence yet"}</Text><Text style={styles.emptyBody}>{isObserved ? `${detail.evidenceTurnIds.length} approved evidence reference${detail.evidenceTurnIds.length === 1 ? " is" : "s are"} retained without transcript text.` : `BYSI has not observed ${detail.label} in an approved scored practice.`}</Text></View></View>}</Reveal>
    <Reveal index={3}><ProductCard style={styles.focusCard}><Target size={19} color={C.purple} /><View style={styles.focusCopy}><SectionLabel tone={C.purple}>Current focus</SectionLabel><Text style={styles.focusText}>{detail.currentFocus ?? "No evidence-backed focus is available yet."}</Text></View></ProductCard><PrimaryButton label="Back to Progress" onPress={() => router.replace("/(tabs)/progress")} containerStyle={styles.action} /></Reveal>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display, fontSize: 34, lineHeight: 40, marginTop: 13 }, meaning: { ...T.body, color: C.textSoft, marginTop: 10 }, valueCard: { marginTop: 24 }, valueRow: { flexDirection: "row", alignItems: "flex-end", gap: 7 }, value: { fontFamily: font.bold, fontSize: 48, lineHeight: 52, color: C.purple }, outOf: { ...T.support, paddingBottom: 6 }, practiceCount: { marginLeft: "auto", alignItems: "flex-end", paddingBottom: 4 }, countValue: { fontFamily: font.semi, fontSize: 20, color: C.text }, countLabel: { fontFamily: font.semi, fontSize: 9, letterSpacing: 1, color: C.dim, marginTop: 2 }, unobservedTrack: { height: 6, borderRadius: 3, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong }, valueNote: { ...T.caption },
  section: { marginTop: 28, gap: 10 }, quoteCard: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" }, quote: { ...T.body, flex: 1 }, evidenceMeta: { ...T.caption, width: "100%", marginLeft: 27 }, emptyEvidence: { minHeight: 100, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong, borderRadius: 20, padding: 18, flexDirection: "row", gap: 12, alignItems: "flex-start" }, emptyCopy: { flex: 1 }, emptyTitle: { ...T.support, fontFamily: font.semi, color: C.text }, emptyBody: { ...T.caption, marginTop: 4 }, focusCard: { marginTop: 28, flexDirection: "row", alignItems: "flex-start" }, focusCopy: { flex: 1 }, focusText: { ...T.support, color: C.text, marginTop: 6 }, action: { marginTop: 18 },
});
