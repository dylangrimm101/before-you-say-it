import { useRouter } from "expo-router";
import { Check, Minus, ShieldCheck } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel } from "@/components/PaidProductUI";
import { Backdrop, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font } from "@/constants/theme";
import { PROGRESS_SIGNAL_LABELS, PROGRESS_SIGNAL_ORDER } from "@/lib/progressEvidence";

export default function HowItWorksScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="How it works" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}>
    <Reveal><Text style={styles.title}>What the Index is—and isn’t.</Text><Text style={styles.intro}>A concise read of approved communication behavior from scored practices.</Text></Reveal>
    <Reveal index={1}><ProductCard accent style={styles.hero}><View style={styles.indexBadge}><Text style={styles.indexText}>0–100</Text></View><View style={styles.heroCopy}><SectionLabel tone={C.purple}>Communication Index</SectionLabel><Text style={styles.heroText}>A coaching indicator built from observable moves in the words you approved.</Text></View></ProductCard></Reveal>
    <Reveal index={2} style={styles.section}><SectionLabel>Six signals</SectionLabel><View style={styles.signalGrid}>{PROGRESS_SIGNAL_ORDER.map((key) => <View key={key} style={styles.signal}><Check size={13} color={C.purple} strokeWidth={2.6} /><Text style={styles.signalText}>{PROGRESS_SIGNAL_LABELS[key]}</Text></View>)}</View></Reveal>
    <Reveal index={3}><ProductCard style={styles.rules}><Rule title="Observed only" body="Only a signal with approved evidence contributes. Unobserved signals are not treated as zero." /><Rule title="Movement stays honest" body="A later scored practice can leave the Index flat or move it down. Completing an activity does not raise it." /><Rule title="Approval comes first" body="You review and approve transcript text before BYSI analyzes that turn." /></ProductCard></Reveal>
    <Reveal index={4}><ProductCard style={styles.notCard}><SectionLabel>What it is not</SectionLabel><Text style={styles.notText}>Not a scientific, clinical, or validated psychometric score. Not a personality read. Not a measure of confidence, empathy, counterpart agreement, or real-world outcome.</Text></ProductCard></Reveal>
    <Reveal index={5}><View style={styles.privacy}><ShieldCheck size={20} color={C.sage} /><View style={styles.privacyCopy}><Text style={styles.privacyTitle}>Privacy boundary</Text><Text style={styles.privacyText}>Only confirmed text is analyzed. Raw audio and unapproved transcript text do not become Index evidence. Some evidence text may later be removed while its approved reference remains.</Text></View></View><PrimaryButton label="Back to Progress" onPress={() => router.replace("/(tabs)/progress")} containerStyle={styles.action} /></Reveal>
  </ScrollView></View>;
}

function Rule({ title, body }: { title: string; body: string }) { return <View style={styles.rule}><View style={styles.ruleMark}><Minus size={12} color={C.purple} /></View><View style={styles.ruleCopy}><Text style={styles.ruleTitle}>{title}</Text><Text style={styles.ruleBody}>{body}</Text></View></View>; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display }, intro: { ...T.support, marginTop: 10 }, hero: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 16 }, indexBadge: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: "rgba(81,40,136,0.24)", alignItems: "center", justifyContent: "center" }, indexText: { fontFamily: font.bold, fontSize: 20, color: C.purple }, heroCopy: { flex: 1 }, heroText: { ...T.support, color: C.text, marginTop: 7 }, section: { marginTop: 28, gap: 12 }, signalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, signal: { width: "48%", minHeight: 44, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.64)", borderWidth: 1, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 }, signalText: { fontFamily: font.medium, fontSize: 13, color: C.text }, rules: { marginTop: 24, gap: 0 }, rule: { flexDirection: "row", gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, ruleMark: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, ruleCopy: { flex: 1 }, ruleTitle: { ...T.support, fontFamily: font.semi, color: C.text }, ruleBody: { ...T.caption, marginTop: 3 }, notCard: { marginTop: 18 }, notText: { ...T.support, color: C.text }, privacy: { marginTop: 26, flexDirection: "row", gap: 12 }, privacyCopy: { flex: 1 }, privacyTitle: { ...T.support, fontFamily: font.semi, color: C.text }, privacyText: { ...T.caption, marginTop: 4 }, action: { marginTop: 22 },
});
