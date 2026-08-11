import { useRouter } from "expo-router";
import { Check, ChevronRight, Circle, Settings, Target, Trash2 } from "lucide-react-native";
import React, { useMemo } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, Meter, PressCard, Reveal, tap } from "@/components/ui";
import { CURRICULUM_MODULES, curriculumModule } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { SHARED_SIGNAL_KEYS, type SharedSignalKey } from "@/types/sharedProduct";
import { useStore } from "@/providers/store";

const SIGNAL_LABELS: Record<SharedSignalKey, string> = { clarity: "Clarity", specificity: "Specificity", steadiness: "Steadiness", listening: "Listening", boundaries: "Boundaries", repair: "Repair" };

export default function ProgressScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completed, pilotProgress, activePracticeSession, deleteSession, modularDoneIds } = useStore();
  const result = activePracticeSession?.sharedResult;
  const startingIndex = result?.starting_index;
  const bySignal = useMemo(() => new Map(result?.signals.map((signal) => [signal.signal_key, signal]) ?? []), [result?.signals]);
  const moduleNames = useMemo(() => CURRICULUM_MODULES.filter((module) => modularDoneIds.has(module.id)).map((module) => module.name), [modularDoneIds]);

  const confirmDelete = (id: string, title: string): void => {
    const remove = (): void => { void deleteSession(id); };
    if (Platform.OS === "web") remove();
    else Alert.alert("Delete this record?", `The saved record for “${title}” will be removed from this device.`, [{ text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: remove }]);
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={styles.headerCopy}><Eyebrow color={C.dim}>Progress</Eyebrow><Text style={styles.title}>{pilotProgress.length === 0 ? "Your starting evidence, kept honest." : "Evidence from the practices you completed."}</Text></View><PressCard onPress={() => router.push("/settings")} style={styles.settingsButton} accessibilityLabel="Settings"><Settings size={20} color={C.textSoft} /></PressCard></View>

        <Reveal index={1}>
          <GlassCard style={styles.indexCard}>
            <View style={styles.indexTop}><View><Text style={styles.cardLabel}>{pilotProgress.length === 0 ? "PARTIAL STARTING INDEX" : "CURRENT EVIDENCE VIEW"}</Text><Text style={styles.indexValue}>{startingIndex?.index_value ?? "—"}</Text></View><View style={styles.coverage}><Text style={styles.coverageValue}>{startingIndex?.observed_count ?? 0}</Text><Text style={styles.coverageLabel}>OF 6 SIGNALS{`\n`}OBSERVED</Text></View></View>
            <Text style={styles.indexNote}>{startingIndex?.index_value === null || !startingIndex ? "There is not enough approved evidence for an Index value yet." : "This value averages observed signals only. Unobserved signals are not treated as zero."}</Text>
          </GlassCard>
        </Reveal>

        <Reveal index={2}>
          <View style={styles.signalSection}><Text style={styles.sectionLabel}>SIGNAL COVERAGE</Text><Text style={styles.deliveryNote}>Delivery isn’t scored because audio isn’t analyzed.</Text>{SHARED_SIGNAL_KEYS.map((key) => { const signal = bySignal.get(key); const observed = signal?.observation_status === "observed" && signal.score !== null; return <View key={key} style={styles.signalRow}><View style={styles.signalHeading}>{observed ? <Check size={14} color={C.sage} strokeWidth={2.8} /> : <Circle size={14} color={C.track} />}<Text style={[styles.signalName, observed && styles.signalObserved]}>{SIGNAL_LABELS[key]}</Text><Text style={styles.signalValue}>{observed ? signal.score : "Not observed"}</Text></View>{observed ? <Meter value={signal.score ?? 0} tone={C.purple} height={5} /> : null}</View>; })}</View>
        </Reveal>

        <Reveal index={3}>
          <View style={styles.focusBlock}><Target size={19} color={C.purple} /><View style={styles.focusCopy}><Text style={styles.cardLabel}>FIRST FOCUS</Text><Text style={styles.focusTitle}>{result?.first_focus?.first_focus_label ?? "No evidence-backed focus yet"}</Text><Text style={styles.focusMeta}>{result?.first_focus ? curriculumModule(result.first_focus.recommended_module_id)?.name : "Complete the free rehearsal to establish a starting focus."}</Text></View></View>
        </Reveal>

        <Reveal index={4}>
          <View style={styles.realProgress}><View style={styles.stat}><Text style={styles.statValue}>{completed.length}</Text><Text style={styles.statLabel}>REAL REHEARSALS</Text></View><View style={styles.statRule} /><View style={styles.stat}><Text style={styles.statValue}>{pilotProgress.length}</Text><Text style={styles.statLabel}>PAID PRACTICES</Text></View></View>
        </Reveal>

        {moduleNames.length > 0 ? <Reveal index={5}><Text style={styles.sectionLabel}>MODULES COMPLETED</Text><View style={styles.moduleList}>{moduleNames.map((name) => <View key={name} style={styles.moduleRow}><Check size={15} color={C.sage} /><Text style={styles.moduleName}>{name}</Text></View>)}</View></Reveal> : null}

        <Reveal index={6}><Text style={styles.sectionLabel}>SAVED REHEARSAL RECORDS</Text>{completed.length === 0 ? <View style={styles.empty}><Text style={styles.emptyTitle}>No completed records yet</Text><Text style={styles.emptyBody}>Progress appears only after a real rehearsal or paid practice is completed.</Text></View> : <View style={styles.history}>{completed.map((session) => { const label = session.title ?? "Your conversation"; return <View key={session.id} style={styles.historyRow}><PressCard onPress={() => router.push(`/debrief/${session.id}`)} containerStyle={styles.historyMain} accessibilityLabel={`Open ${label}`}><View style={styles.historyCopy}><Text style={styles.historyTitle}>{label}</Text><Text style={styles.historyMeta}>{new Date(session.endedAt ?? session.startedAt).toLocaleDateString()}</Text></View></PressCard><PressCard onPress={() => { tap("medium"); confirmDelete(session.id, label); }} style={styles.deleteHit} accessibilityLabel={`Delete ${label}`}><Trash2 size={16} color={C.dim} /></PressCard><ChevronRight size={18} color={C.dim} /></View>; })}</View>}</Reveal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER }, header: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, headerCopy: { flex: 1 }, title: { ...T.display, marginTop: 8 }, settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  indexCard: { marginTop: 26, padding: 22 }, indexTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }, cardLabel: { ...eyebrow, color: C.purple }, indexValue: { fontFamily: font.semi, fontSize: 56, lineHeight: 62, color: C.purple, marginTop: 8 }, coverage: { alignItems: "flex-end" }, coverageValue: { fontFamily: font.semi, fontSize: 28, color: C.text }, coverageLabel: { ...eyebrow, color: C.dim, textAlign: "right", marginTop: 3, lineHeight: 15 }, indexNote: { ...T.caption, marginTop: 14, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  signalSection: { marginTop: 30 }, deliveryNote: { ...T.caption, marginBottom: 8 }, sectionLabel: { ...eyebrow, color: C.dim, marginTop: 30, marginBottom: 10 }, signalRow: { paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, signalHeading: { flexDirection: "row", alignItems: "center", gap: 9, marginBottom: 7 }, signalName: { ...T.support, color: C.dim, flex: 1 }, signalObserved: { color: C.text, fontFamily: font.semi }, signalValue: { ...T.caption, color: C.purple },
  focusBlock: { marginTop: 28, flexDirection: "row", gap: 13, backgroundColor: C.purpleSoft, borderRadius: radius.lg, padding: 19 }, focusCopy: { flex: 1 }, focusTitle: { ...T.title, fontSize: 18, lineHeight: 24, marginTop: 5 }, focusMeta: { ...T.caption, marginTop: 5 }, realProgress: { flexDirection: "row", alignItems: "stretch", marginTop: 24, paddingVertical: 18, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line }, stat: { flex: 1, alignItems: "center" }, statValue: { fontFamily: font.semi, fontSize: 26, color: C.text }, statLabel: { ...eyebrow, color: C.dim, marginTop: 5 }, statRule: { width: StyleSheet.hairlineWidth, backgroundColor: C.line },
  moduleList: { gap: 8 }, moduleRow: { flexDirection: "row", gap: 10, alignItems: "center", minHeight: 44 }, moduleName: { ...T.support, color: C.text }, empty: { padding: 20, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong }, emptyTitle: { ...T.title, fontSize: 18 }, emptyBody: { ...T.caption, marginTop: 6 }, history: { gap: 2 }, historyRow: { minHeight: 68, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line }, historyMain: { flex: 1 }, historyCopy: { paddingVertical: 12 }, historyTitle: { ...T.support, fontFamily: font.semi, color: C.text }, historyMeta: { ...T.caption, marginTop: 3 }, deleteHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
