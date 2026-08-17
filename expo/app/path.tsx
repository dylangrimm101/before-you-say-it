import { useRouter } from "expo-router";
import { Check, ChevronRight, LockKeyhole, Pause, Sparkles } from "lucide-react-native";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { DEFAULT_CURRICULUM_VISIBILITY } from "@/lib/modularCurriculum";
import { pathPresentation, type PathModulePresentation } from "@/lib/paidProduct";
import { useStore } from "@/providers/store";

export default function PathScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePracticeSession, modularDoneIds, entitlement, devProEnabled } = useStore();
  const path = useMemo(() => pathPresentation(activePracticeSession, modularDoneIds, entitlement === "pro"), [activePracticeSession, entitlement, modularDoneIds]);
  const blocks = useMemo(() => Array.from(new Set(path.map((item) => item.module.block))), [path]);
  const recommended = path.find((item) => item.status === "recommended" || item.status === "current" || item.status === "interrupted");

  const open = (item: PathModulePresentation): void => {
    if (item.status === "locked") {
      router.push({ pathname: "/paywall", params: { gate: "program", moduleId: item.module.id } });
      return;
    }
    if (item.status === "interrupted") {
      router.push({ pathname: "/interrupted/[moduleId]", params: { moduleId: item.module.id } });
      return;
    }
    router.push(item.destination);
  };

  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Your path" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 42 }]} showsVerticalScrollIndicator={false}>
    <Reveal>{__DEV__ && devProEnabled ? <StatusPill label="QA unlocked · no store entitlement" tone="amber" /> : null}<Text style={[styles.title, __DEV__ && devProEnabled && styles.titleAfterStatus]}>Four blocks. Eight real modules.</Text><Text style={styles.intro}>Your first focus recommends where to begin. Available modules stay visible, and your saved checkpoint stays exactly where you left it.</Text></Reveal>
    {recommended ? <Reveal index={1}><ProductCard accent style={styles.reason}><SectionLabel tone={C.purple}>Why this start</SectionLabel><Text style={styles.reasonTitle}>{recommended.module.name}</Text><Text style={styles.reasonBody}>{activePracticeSession?.sharedResult?.first_focus?.first_focus_label ?? "Continue the module already in progress."}</Text></ProductCard></Reveal> : null}
    {blocks.map((block, blockIndex) => { const modules = path.filter((item) => item.module.block === block); return <Reveal key={block} index={blockIndex + 2} style={styles.block}><SectionLabel>{modules[0]?.module.blockName}</SectionLabel><View style={styles.rows}>{modules.map((item) => <PressCard key={item.module.id} onPress={() => open(item)} accessibilityLabel={`${item.module.name}. ${item.status}`}><View style={[styles.row, (item.status === "recommended" || item.status === "current" || item.status === "interrupted") && styles.rowCurrent]}><View style={[styles.marker, item.status === "completed" && styles.markerDone]}>{item.status === "completed" ? <Check size={12} color={C.onAccent} strokeWidth={3} /> : item.status === "locked" ? <LockKeyhole size={13} color={C.dim} /> : item.status === "interrupted" ? <Pause size={12} color={C.purple} fill={C.purple} /> : item.status === "recommended" ? <Sparkles size={13} color={C.purple} /> : <Text style={styles.number}>{item.module.number}</Text>}</View><View style={styles.rowCopy}><Text style={[styles.rowTitle, item.status === "locked" && styles.rowTitleLocked]}>{item.module.name}</Text><View style={styles.statusLine}><StatusPill label={statusLabel(item.status, __DEV__ && devProEnabled)} tone={item.status === "completed" ? "green" : item.status === "interrupted" ? "amber" : item.status === "recommended" || item.status === "current" ? "purple" : "neutral"} /></View></View><ChevronRight size={18} color={item.status === "locked" ? C.dim : C.purple} /></View></PressCard>)}</View></Reveal>; })}
  </ScrollView></View>;
}

function statusLabel(status: PathModulePresentation["status"], isQaUnlocked: boolean): string {
  const reviewPrefix = isQaUnlocked ? "QA unlocked · " : DEFAULT_CURRICULUM_VISIBILITY === "internal_review" ? "Internal review · " : "";
  if (status === "recommended") return `${reviewPrefix}Recommended start`;
  if (status === "current") return `${reviewPrefix}Current module`;
  if (status === "completed") return `${reviewPrefix}Completed`;
  if (status === "interrupted") return `${reviewPrefix}Continue checkpoint`;
  if (status === "locked") return "Requires Pro";
  return `${reviewPrefix}Available`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER, paddingTop: 14 }, title: { ...T.display }, titleAfterStatus: { marginTop: 14 }, intro: { ...T.support, marginTop: 12 },
  reason: { marginTop: 24 }, reasonTitle: { ...T.title }, reasonBody: { ...T.support }, block: { marginTop: 28, gap: 10 }, rows: { gap: 8 },
  row: { minHeight: 78, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.66)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 }, rowCurrent: { borderColor: "rgba(81,40,136,0.30)", backgroundColor: "rgba(255,255,255,0.84)" },
  marker: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" }, markerDone: { backgroundColor: C.purple, borderColor: C.purple }, number: { fontFamily: font.semi, fontSize: 11, color: C.dim }, rowCopy: { flex: 1 }, rowTitle: { ...T.support, fontFamily: font.semi, color: C.text }, rowTitleLocked: { color: C.dim }, statusLine: { marginTop: 7 },
});
