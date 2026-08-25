import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Flag, Pause, Play } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StepList, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T } from "@/constants/theme";
import { isModuleId } from "@/constants/modules";
import { interruptedPresentation } from "@/lib/paidProduct";
import { useStore } from "@/providers/store";

export default function InterruptedScreen() {
  const params = useLocalSearchParams<{ moduleId: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePracticeSession } = useStore();
  const moduleId = isModuleId(params.moduleId) ? params.moduleId : null;
  const run = moduleId ? Object.values(activePracticeSession?.pilotRuns ?? {}).find((candidate) => candidate.moduleId === moduleId && candidate.state !== "complete") : undefined;

  if (!moduleId || !run) return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>There isn’t a saved module checkpoint here.</Text><PrimaryButton label="Back to Today" onPress={() => router.replace("/(tabs)")} containerStyle={styles.missing} /></View>;
  const checkpoint = interruptedPresentation(run);

  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Saved checkpoint" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 42 }]} showsVerticalScrollIndicator={false}>
    <Reveal><StatusPill label="Interrupted · safely saved" tone="amber" /><Text style={styles.title}>{checkpoint.title} is waiting where you left it.</Text><Text style={styles.intro}>Continuing restores the exact activity. Approved transcripts and completed steps stay in place.</Text></Reveal>
    <Reveal index={1}><ProductCard accent style={styles.checkpointCard}><View style={styles.icon}><Pause size={22} color={C.purple} fill={C.purple} /></View><View style={styles.checkpointCopy}><SectionLabel tone={C.purple}>Where you stopped</SectionLabel><Text style={styles.checkpointTitle}>{checkpoint.stoppedAt}</Text><Text style={styles.checkpointMeta}>{checkpoint.activity[0]?.toUpperCase()}{checkpoint.activity.slice(1)} is the active activity.</Text></View></ProductCard></Reveal>
    <Reveal index={2} style={styles.section}><View style={styles.sectionHead}><Check size={18} color={C.sage} /><SectionLabel tone={C.sage}>Completed</SectionLabel></View>{checkpoint.completed.length > 0 ? <StepList items={checkpoint.completed} completed /> : <Text style={styles.empty}>No earlier activity in this module is marked complete yet.</Text>}</Reveal>
    <Reveal index={3} style={styles.section}><View style={styles.sectionHead}><Flag size={18} color={C.dim} /><SectionLabel>Still ahead</SectionLabel></View>{checkpoint.remains.length > 0 ? <StepList items={checkpoint.remains} /> : <Text style={styles.empty}>Only this saved step remains.</Text>}</Reveal>
    <Reveal index={4}><View style={styles.next}><Play size={18} color={C.purple} /><Text style={styles.nextText}>When you continue, BYSI opens {checkpoint.stoppedAt.toLowerCase()}—not the beginning of the module.</Text></View><PrimaryButton label={checkpoint.continueLabel} onPress={() => router.replace(`/module/${run.practiceId ?? moduleId}`)} containerStyle={styles.action} /></Reveal>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { paddingHorizontal: GUTTER, alignItems: "center", justifyContent: "center" }, missing: { width: "100%", marginTop: 22 }, scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display, marginTop: 14 }, intro: { ...T.support, marginTop: 12 },
  checkpointCard: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 14 }, icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, checkpointCopy: { flex: 1 }, checkpointTitle: { ...T.title, marginTop: 5 }, checkpointMeta: { ...T.caption, marginTop: 4 },
  section: { marginTop: 28, gap: 12 }, sectionHead: { flexDirection: "row", alignItems: "center", gap: 8 }, empty: { ...T.support, color: C.dim }, next: { marginTop: 30, paddingTop: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, flexDirection: "row", gap: 10, alignItems: "flex-start" }, nextText: { ...T.support, color: C.text, flex: 1 }, action: { marginTop: 20 },
});
