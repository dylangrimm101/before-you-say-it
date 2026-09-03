import { useRouter } from "expo-router";
import { Check, ChevronRight, LockKeyhole } from "lucide-react-native";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { approvedLessonDeck } from "@/constants/approvedLessons";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { LAUNCH_CURRICULUM_MODULES, LAUNCH_DECK_IDS, nextLaunchDeck, type LaunchLessonId } from "@/lib/launchCurriculum";
import { useStore } from "@/providers/store";

export default function PathScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { convertedLessonProgress, moduleCloseProgress, entitlement } = useStore();
  const nextId = useMemo(() => nextLaunchDeck(convertedLessonProgress, moduleCloseProgress), [convertedLessonProgress, moduleCloseProgress]);
  const nextIndex = nextId ? LAUNCH_DECK_IDS.indexOf(nextId) : LAUNCH_DECK_IDS.length;
  const completedIds = useMemo(() => new Set<string>([
    ...convertedLessonProgress.map((entry) => entry.lessonId),
    ...moduleCloseProgress.map((entry) => entry.lessonId),
  ]), [convertedLessonProgress, moduleCloseProgress]);

  const open = (lessonId: LaunchLessonId, index: number): void => {
    if (entitlement !== "pro") {
      router.push({ pathname: "/paywall", params: { gate: "program", moduleId: lessonId.startsWith("m1-") ? "get_to_the_point" : "make_a_clear_ask" } });
      return;
    }
    if (index > nextIndex) return;
    router.push({ pathname: "/approved-lesson/[lessonId]", params: { lessonId } });
  };

  return <View style={styles.root}><Backdrop /><View style={{ paddingTop: insets.top }}><PaidHeader title="Your path" onBack={() => router.back()} /></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 42 }]} showsVerticalScrollIndicator={false}>
    <Reveal><Text style={styles.title}>Two modules. Ten lessons.</Text><Text style={styles.intro}>Work through five approved lessons, then close the module. Your completion is saved on this device.</Text></Reveal>
    {LAUNCH_CURRICULUM_MODULES.map((module, moduleIndex) => {
      const moduleComplete = completedIds.has(`m${module.module}-close`);
      return <Reveal key={module.module} index={moduleIndex + 1} style={styles.module}>
        <View style={styles.moduleHeading}><View><SectionLabel>Module {module.module}</SectionLabel><Text style={styles.moduleTitle}>{module.title}</Text></View>{moduleComplete ? <StatusPill label="Completed" tone="green" /> : null}</View>
        <View style={styles.rows}>{module.deckIds.map((lessonId) => {
          const deck = approvedLessonDeck(lessonId)!;
          const index = LAUNCH_DECK_IDS.indexOf(lessonId);
          const completed = completedIds.has(lessonId);
          const current = lessonId === nextId;
          const future = index > nextIndex;
          const locked = entitlement !== "pro" || future;
          const label = completed ? "Completed" : current ? "Current" : future ? "Up next" : "Available";
          return <PressCard key={lessonId} onPress={() => open(lessonId, index)} accessibilityLabel={`${deck.shortName}. ${label}`}>
            <View style={[styles.row, current && styles.rowCurrent]}>
              <View style={[styles.marker, completed && styles.markerDone]}>{completed ? <Check size={12} color={C.onAccent} strokeWidth={3} /> : locked ? <LockKeyhole size={13} color={C.dim} /> : <Text style={styles.number}>{deck.lesson === "close" ? "✓" : deck.lesson}</Text>}</View>
              <View style={styles.rowCopy}><Text style={[styles.rowTitle, locked && !current && styles.rowTitleLocked]}>{deck.shortName}</Text><View style={styles.statusLine}><StatusPill label={label} tone={completed ? "green" : current ? "purple" : "neutral"} /></View></View>
              <ChevronRight size={18} color={locked && !current ? C.dim : C.purple} />
            </View>
          </PressCard>;
        })}</View>
      </Reveal>;
    })}
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 14 },
  title: { ...T.display },
  intro: { ...T.support, marginTop: 12 },
  module: { marginTop: 28, gap: 12 },
  moduleHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  moduleTitle: { ...T.title, marginTop: 5 },
  rows: { gap: 8 },
  row: { minHeight: 74, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.66)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  rowCurrent: { borderColor: "rgba(81,40,136,0.30)", backgroundColor: "rgba(255,255,255,0.84)" },
  marker: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  markerDone: { backgroundColor: C.purple, borderColor: C.purple },
  number: { fontFamily: font.semi, fontSize: 11, color: C.dim },
  rowCopy: { flex: 1 },
  rowTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  rowTitleLocked: { color: C.dim },
  statusLine: { marginTop: 7 },
});
