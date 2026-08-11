import { useRouter } from "expo-router";
import { ArrowRight, BookOpen, Check, ChevronRight, Circle, Settings, Sparkles, Target } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, HeroSurface, PressCard, Reveal } from "@/components/ui";
import { CURRICULUM_MODULES, curriculumModule, type CurriculumModule, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { useStore } from "@/providers/store";
import type { PilotModuleState } from "@/types/pilotCurriculum";

const PRACTICE_STEPS: readonly { key: string; label: string; states: readonly PilotModuleState[] }[] = [
  { key: "lesson", label: "Lesson", states: ["module_preview", "hope_lesson"] },
  { key: "exercise", label: "Exercise", states: ["quiz", "quiz_feedback", "preset_scenario"] },
  { key: "rehearsal", label: "Spoken rehearsal", states: ["ready_for_attempt", "listening_attempt", "confirm_attempt_transcript", "adam_response", "ready_for_response", "listening_response", "confirm_response_transcript"] },
  { key: "retry", label: "Focused retry", states: ["hope_coaching", "day3_note_check", "day3_neutral_retry", "ready_for_retry", "listening_retry", "confirm_retry_transcript", "play_adam_after_opener_retry"] },
  { key: "review", label: "Review", states: ["attempt_comparison", "transfer_cue", "complete"] },
];

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { modularDoneIds, access, activePracticeSession, pilotProgress } = useStore();
  const recommendedId: ModuleId = activePracticeSession?.sharedResult?.first_focus?.recommended_module_id ?? activePracticeSession?.recommendation?.moduleId ?? "get_to_the_point";
  const recommended = curriculumModule(recommendedId) ?? CURRICULUM_MODULES[0];
  const activeRun = activePracticeSession?.pilotRuns[recommendedId];
  const currentState: PilotModuleState = activeRun?.state ?? (activePracticeSession?.nextState === "complete" ? "complete" : "module_preview");
  const currentStepIndex = Math.max(0, PRACTICE_STEPS.findIndex((step) => step.states.includes(currentState)));
  const completedCount = modularDoneIds.size;
  const isNewBuyer = access.entitlement === "pro" && pilotProgress.length === 0;

  const nextModules = useMemo<CurriculumModule[]>(() => CURRICULUM_MODULES.filter((module) => module.id !== recommendedId).slice(0, 3), [recommendedId]);

  const openRecommended = useCallback((): void => {
    if (access.entitlement !== "pro") {
      router.push({ pathname: "/paywall", params: { gate: "program", moduleId: recommendedId } });
      return;
    }
    router.push({ pathname: "/module/[day]", params: { day: recommendedId } });
  }, [access.entitlement, recommendedId, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View><Eyebrow color={C.dim}>Today</Eyebrow><Text style={styles.title}>{isNewBuyer ? "Your first practice starts here." : activeRun && currentState !== "complete" ? "Pick up where you left off." : "Practice the move you need next."}</Text></View><PressCard onPress={() => router.push("/settings")} style={styles.settingsButton} accessibilityLabel="Settings"><Settings size={20} color={C.textSoft} /></PressCard></View>

        <Reveal index={1}>
          <PressCard onPress={openRecommended} accessibilityLabel={`Open recommended practice ${recommended.name}`}>
            <HeroSurface style={styles.hero}>
              <View style={styles.heroTop}><Sparkles size={18} color={C.onAccent} /><Text style={styles.heroEyebrow}>{isNewBuyer ? "FIRST PERSONALIZED PRACTICE" : "RECOMMENDED START"}</Text></View>
              <Text style={styles.heroTitle}>{recommended.name}</Text>
              <Text style={styles.heroBody}>{activePracticeSession?.sharedResult?.first_focus?.first_focus_label ?? activePracticeSession?.recommendation?.immediateAction ?? "A focused practice chosen from your current path."} Your rehearsal selected this starting point from what you approved.</Text>
              <View style={styles.heroAction}><Text style={styles.heroActionText}>{access.entitlement === "pro" ? activeRun ? "Continue practice" : "Start practice" : "See my practice path"}</Text><ArrowRight size={18} color={C.text} /></View>
            </HeroSurface>
          </PressCard>
        </Reveal>

        <Reveal index={2}>
          <View style={styles.why}><Target size={18} color={C.purple} /><View style={styles.whyCopy}><Text style={styles.whyLabel}>WHY THIS PRACTICE</Text><Text style={styles.whyText}>It follows the first focus from your approved rehearsal—not a generic daily assignment.</Text></View></View>
        </Reveal>

        <Reveal index={3}>
          <GlassCard style={styles.sequence}>
            <View style={styles.sectionHead}><Text style={styles.sectionLabel}>TODAY’S BOUNDED SEQUENCE</Text><Text style={styles.sectionMeta}>{Math.min(currentStepIndex + 1, PRACTICE_STEPS.length)} of {PRACTICE_STEPS.length}</Text></View>
            {PRACTICE_STEPS.map((step, index) => {
              const done = currentState === "complete" || index < currentStepIndex;
              const active = currentState !== "complete" && index === currentStepIndex;
              return <View key={step.key} style={styles.stepRow}>{done ? <View style={styles.doneIcon}><Check size={12} color={C.onAccent} strokeWidth={3} /></View> : active ? <View style={styles.activeIcon}><Circle size={12} color={C.purple} fill={C.purple} /></View> : <Circle size={22} color={C.track} />}<Text style={[styles.stepText, active && styles.stepActive, done && styles.stepDone]}>{step.label}</Text>{active ? <Text style={styles.now}>NOW</Text> : null}</View>;
            })}
          </GlassCard>
        </Reveal>

        <Reveal index={4}>
          <View style={styles.progressLine}><BookOpen size={17} color={C.sage} /><Text style={styles.progressText}>{completedCount === 0 ? "No paid practices completed yet. Nothing locks when you miss a day." : `${completedCount} of ${CURRICULUM_MODULES.length} module practices completed. Nothing locks when you miss a day.`}</Text></View>
        </Reveal>

        {completedCount > 0 ? <Reveal index={5}><Text style={styles.browseLabel}>CONTINUE EXPLORING</Text><View style={styles.nextList}>{nextModules.map((module) => <PressCard key={module.id} onPress={() => router.push({ pathname: "/module/[day]", params: { day: module.id } })} accessibilityLabel={`Open ${module.name}`}><View style={styles.moduleRow}><View style={styles.moduleNumber}><Text style={styles.moduleNumberText}>{module.number}</Text></View><Text style={styles.moduleName}>{module.name}</Text><ChevronRight size={18} color={C.dim} /></View></PressCard>)}</View></Reveal> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER }, header: { flexDirection: "row", alignItems: "flex-start", gap: 12 }, title: { ...T.display, marginTop: 8, flex: 1 }, settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.surface, alignItems: "center", justifyContent: "center" },
  hero: { marginTop: 26 }, heroTop: { flexDirection: "row", alignItems: "center", gap: 8 }, heroEyebrow: { ...eyebrow, color: "rgba(255,255,255,0.76)" }, heroTitle: { fontFamily: font.semi, fontSize: 29, lineHeight: 35, color: C.onAccent, marginTop: 18 }, heroBody: { ...T.support, color: "rgba(255,255,255,0.82)", marginTop: 10 }, heroAction: { minHeight: 52, borderRadius: radius.pill, backgroundColor: C.onAccent, marginTop: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, heroActionText: { fontFamily: font.semi, fontSize: 15, color: C.text },
  why: { flexDirection: "row", gap: 12, marginTop: 24, paddingHorizontal: 4 }, whyCopy: { flex: 1 }, whyLabel: { ...eyebrow, color: C.purple }, whyText: { ...T.caption, color: C.text, marginTop: 5 }, sequence: { marginTop: 24, padding: 20 }, sectionHead: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }, sectionLabel: { ...eyebrow, color: C.dim }, sectionMeta: { ...T.caption, fontFamily: font.semi, color: C.purple }, stepRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line }, doneIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.sage, alignItems: "center", justifyContent: "center" }, activeIcon: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, stepText: { ...T.support, flex: 1, color: C.dim }, stepActive: { color: C.text, fontFamily: font.semi }, stepDone: { color: C.sage }, now: { ...eyebrow, color: C.purple },
  progressLine: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, paddingHorizontal: 4 }, progressText: { ...T.caption, color: C.textSoft }, browseLabel: { ...eyebrow, color: C.dim, marginTop: 32, marginBottom: 10 }, nextList: { gap: 9 }, moduleRow: { minHeight: 76, borderRadius: radius.md, backgroundColor: C.surface, borderWidth: 1, borderColor: C.glassEdge, padding: 13, flexDirection: "row", alignItems: "center", gap: 12 }, moduleNumber: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, moduleNumberText: { fontFamily: font.semi, color: C.purple }, moduleName: { ...T.support, fontFamily: font.semi, color: C.text, flex: 1 },
});
