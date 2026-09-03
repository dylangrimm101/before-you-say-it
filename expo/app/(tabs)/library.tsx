import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, ChevronRight, LockKeyhole, PenLine, Sparkles } from "lucide-react-native";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { approvedLessonDeck } from "@/constants/approvedLessons";
import { CATEGORIES, SCENARIOS } from "@/constants/scenarios";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { LAUNCH_CURRICULUM_MODULES, LAUNCH_DECK_IDS, nextLaunchDeck, type LaunchLessonId } from "@/lib/launchCurriculum";
import { scenarioInteraction } from "@/lib/nativeCommerce";
import { recommendScenario } from "@/lib/scenarioRecommendation";
import { useStore } from "@/providers/store";
import type { CategoryId, Scenario } from "@/types/convo";

type PracticeView = "lessons" | "scenarios";

export default function Library() {
  const router = useRouter();
  const params = useLocalSearchParams<{ view?: string }>();
  const insets = useSafeAreaInsets();
  const { profile, customScenarios, completed, access, activePracticeSession, convertedLessonProgress, moduleCloseProgress } = useStore();
  const [view, setView] = useState<PracticeView>("lessons");
  const [active, setActive] = useState<CategoryId>(profile?.focus ?? "partner");
  const category = CATEGORIES.find((item) => item.id === active);
  const list = useMemo<Scenario[]>(() => [...customScenarios.filter((scenario) => scenario.category === active), ...SCENARIOS.filter((scenario) => scenario.category === active)], [active, customScenarios]);
  const isLocked = access.entitlement !== "pro" && completed.length > 0;
  const doneIds = useMemo<Set<string>>(() => new Set(completed.map((session) => session.scenarioId)), [completed]);
  const focusResult = activePracticeSession?.sharedResult?.first_focus;
  const recommendation = useMemo(() => recommendScenario(SCENARIOS, focusResult?.recommended_module_id, focusResult?.first_focus_label, active, isLocked), [active, focusResult?.first_focus_label, focusResult?.recommended_module_id, isLocked]);
  const recommended = recommendation.scenario;
  const focus = focusResult?.first_focus_label;
  const savedConversationLabel = activePracticeSession?.scenarioSource === "user_supplied"
    ? "Continue your saved conversation"
    : "Continue saved authored scenario";
  const nextLessonId = useMemo(() => nextLaunchDeck(convertedLessonProgress, moduleCloseProgress), [convertedLessonProgress, moduleCloseProgress]);
  const nextLessonIndex = nextLessonId ? LAUNCH_DECK_IDS.indexOf(nextLessonId) : LAUNCH_DECK_IDS.length;
  const completedLessonIds = useMemo(() => new Set<string>([
    ...convertedLessonProgress.map((entry) => entry.lessonId),
    ...moduleCloseProgress.map((entry) => entry.lessonId),
  ]), [convertedLessonProgress, moduleCloseProgress]);

  useEffect(() => {
    if (params.view === "scenarios") setView("scenarios");
    if (params.view === "lessons") setView("lessons");
  }, [params.view]);

  const openCustom = (): void => { if (isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push("/custom"); };
  const openScenario = (scenario: Scenario): void => { const interaction = scenarioInteraction(isLocked, scenario.id); if (interaction.isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push(interaction.destination as `/scenario/${string}`); };
  const continueConversation = (): void => { if (!activePracticeSession) return; if (isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push(`/scenario/${activePracticeSession.scenarioId}`); };
  const openLesson = (lessonId: LaunchLessonId, index: number): void => {
    if (access.entitlement !== "pro") { router.push({ pathname: "/paywall", params: { gate: "program", moduleId: lessonId.startsWith("m1-") ? "get_to_the_point" : "make_a_clear_ask" } }); return; }
    if (index > nextLessonIndex) return;
    router.push({ pathname: "/approved-lesson/[lessonId]", params: { lessonId } });
  };

  return <View style={styles.root}><Backdrop /><ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
    <Reveal><Text style={styles.title}>Practice</Text><Text style={styles.intro}>Learn the moves in order, or rehearse a conversation you need to have.</Text></Reveal>
    <Reveal index={1} style={styles.viewSwitcher}>
      {(["lessons", "scenarios"] as const).map((option) => <PressCard key={option} onPress={() => { setView(option); router.setParams({ view: option }); }} accessibilityRole="tab" accessibilityState={{ selected: view === option }} accessibilityLabel={`Show ${option}`}><View style={[styles.viewOption, view === option && styles.viewOptionActive]}><Text style={[styles.viewOptionText, view === option && styles.viewOptionTextActive]}>{option === "lessons" ? "Lessons" : "Scenarios"}</Text></View></PressCard>)}
    </Reveal>
    {view === "lessons" ? <>
      <Reveal index={2}><Text style={styles.lessonTitle}>Two modules. Ten lessons.</Text><Text style={styles.lessonIntro}>Start with the current lesson, then keep going at your own pace. Today updates immediately when you finish.</Text></Reveal>
      {LAUNCH_CURRICULUM_MODULES.map((module, moduleIndex) => <Reveal key={module.module} index={moduleIndex + 3} style={styles.lessonModule}>
        <View style={styles.moduleBanner}><View><Text style={styles.moduleEyebrow}>MODULE {module.module}</Text><Text style={styles.moduleTitle}>{module.title}</Text></View><Text style={styles.moduleProgress}>{module.deckIds.filter((id) => !id.endsWith("-close") && completedLessonIds.has(id)).length} of 5</Text></View>
        <View style={styles.journey}>{module.deckIds.map((lessonId, index) => {
          const deck = approvedLessonDeck(lessonId)!;
          const globalIndex = LAUNCH_DECK_IDS.indexOf(lessonId);
          const completedLesson = completedLessonIds.has(lessonId);
          const current = lessonId === nextLessonId;
          const future = globalIndex > nextLessonIndex;
          const locked = access.entitlement !== "pro" || future;
          const isClose = deck.lesson === "close";
          const label = completedLesson ? "Completed" : current ? "Current" : future ? "Up next" : "Available";
          return <View key={lessonId} style={[styles.lessonStep, index % 2 === 0 ? styles.lessonStepLeft : styles.lessonStepRight]}>
            {index < module.deckIds.length - 1 ? <View pointerEvents="none" style={styles.journeyConnector} /> : null}
            <PressCard onPress={() => openLesson(lessonId, globalIndex)} disabled={future && access.entitlement === "pro"} accessibilityLabel={`${deck.shortName}. ${label}`}>
              <View style={[styles.journeyNodeWrap, current && styles.journeyNodeWrapCurrent, isClose && styles.journeyNodeWrapClose]}>
                <View style={[styles.journeyNode, current && styles.journeyNodeCurrent, completedLesson && styles.journeyNodeDone, isClose && styles.journeyNodeClose]}>{completedLesson ? <Check size={18} color={C.onAccent} strokeWidth={3} /> : locked ? <LockKeyhole size={17} color={C.dim} /> : <Text style={[styles.journeyNodeNumber, current && styles.journeyNodeNumberCurrent]}>{isClose ? "✓" : deck.lesson}</Text>}</View>
                <View style={[styles.journeyCopy, index % 2 !== 0 && styles.journeyCopyRight]}><Text style={[styles.journeyTitle, locked && !current && styles.journeyTitleLocked]}>{isClose ? `Close Module ${module.module}` : deck.shortName}</Text><Text style={styles.journeyMove} numberOfLines={2}>{isClose ? "Bring the five moves together" : deck.namedMove}</Text><StatusPill label={label} tone={completedLesson ? "green" : current ? "purple" : "neutral"} /></View>
              </View>
            </PressCard>
          </View>;
        })}</View>
      </Reveal>)}
    </> : <>
      {activePracticeSession?.sharedResult ? <Reveal index={2}><PressCard onPress={continueConversation} accessibilityLabel={savedConversationLabel}><ProductCard accent style={styles.continueCard}><Sparkles size={20} color={C.purple} /><View style={styles.continueCopy}><SectionLabel tone={C.purple}>{savedConversationLabel}</SectionLabel><Text style={styles.continueTitle}>{activePracticeSession.scenarioTitle ?? activePracticeSession.topic}</Text><Text style={styles.continueCounterpart}>{activePracticeSession.counterpartDisplayLabel ?? activePracticeSession.counterpart}</Text></View><ChevronRight size={20} color={C.purple} /></ProductCard></PressCard></Reveal> : null}
      <Reveal index={3} style={styles.filtersSection}><SectionLabel>Relationship or context</SectionLabel><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>{CATEGORIES.map((item) => { const selected = item.id === active; return <PressCard key={item.id} onPress={() => setActive(item.id)} accessibilityLabel={`Show ${item.label} scenarios`}><View style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{item.label}</Text></View></PressCard>; })}</ScrollView></Reveal>
      {recommended ? <Reveal index={4} style={styles.recommendedSection}><SectionLabel>{recommendation.match.startsWith("focus") ? "Recommended for your current focus" : `Recommended in ${category?.label ?? "this context"}`}</SectionLabel><PressCard onPress={() => openScenario(recommended)} accessibilityLabel={`Open recommended scenario ${recommended.title}`}><ProductCard accent style={styles.recommended}><View style={styles.recommendedTop}><StatusPill label={focus ?? "Practice your current focus"} tone="purple" />{isLocked ? <StatusPill label="Pro" /> : <StatusPill label="Available" tone="green" />}</View><Text style={styles.recommendedTitle}>{recommended.title}</Text><Text style={styles.recommendedCounterpart}>{recommended.counterpart}</Text><Text style={styles.recommendedSituation}>{recommended.situation}</Text><Text style={styles.recommendedGoal}>Goal · {recommended.goal}</Text><Text style={styles.recommendedWhy}>{recommendation.reason}</Text></ProductCard></PressCard></Reveal> : null}
      <Reveal index={5} style={styles.browseHeading}><View style={styles.browseCopy}><SectionLabel>Browse {category?.label ?? "scenarios"}</SectionLabel><Text style={styles.categoryBlurb}>{category?.blurb}</Text></View><Text style={styles.count}>{list.length}</Text></Reveal>
      <View style={styles.list}>{list.map((scenario, index) => { const done = doneIds.has(scenario.id); const featured = scenario.id === recommended?.id; return <Reveal key={scenario.id} index={6 + index}>{featured ? null : <PressCard onPress={() => openScenario(scenario)} accessibilityLabel={`${scenario.title}. ${isLocked ? "Locked" : "Available"}`}><View style={styles.scenarioRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{scenario.title}</Text><Text style={styles.counterpart}>{scenario.counterpart}</Text><Text style={styles.goal} numberOfLines={3}>{scenario.situation}</Text><View style={styles.rowMeta}>{scenario.isCustom ? <StatusPill label="Your scenario" tone="purple" /> : <StatusPill label={category?.label ?? scenario.category} />}{isLocked ? <View style={styles.state}><LockKeyhole size={12} color={C.dim} /><Text style={styles.stateText}>LOCKED</Text></View> : done ? <View style={styles.state}><Check size={12} color={C.sage} /><Text style={[styles.stateText, { color: C.sage }]}>PRACTICED</Text></View> : <Text style={[styles.stateText, { color: C.purple }]}>AVAILABLE</Text>}</View></View><ChevronRight size={19} color={isLocked ? C.dim : C.purple} /></View></PressCard>}</Reveal>; })}</View>
      <Reveal index={11}><PressCard onPress={openCustom} accessibilityLabel="Build a scenario from your situation"><View style={styles.custom}><View style={styles.customIcon}><PenLine size={18} color={C.purple} /></View><View style={styles.customCopy}><Text style={styles.customTitle}>Build from your situation</Text><Text style={styles.customDetail}>Describe a real conversation in your own words.</Text></View>{isLocked ? <LockKeyhole size={17} color={C.dim} /> : <ChevronRight size={18} color={C.purple} />}</View></PressCard></Reveal>
    </>}
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER }, title: { fontFamily: font.bold, fontSize: 31, lineHeight: 36, color: C.text }, intro: { ...T.support, marginTop: 9, maxWidth: 340 },
  viewSwitcher: { marginTop: 20, padding: 4, borderRadius: radius.pill, backgroundColor: "rgba(23,26,31,0.06)", flexDirection: "row", gap: 4 },
  viewOption: { minHeight: 44, minWidth: 126, paddingHorizontal: 20, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  viewOptionActive: { backgroundColor: C.purple, ...shadow.hero },
  viewOptionText: { fontFamily: font.semi, fontSize: 14, color: C.textSoft },
  viewOptionTextActive: { color: C.onAccent },
  lessonTitle: { ...T.title, marginTop: 24 }, lessonIntro: { ...T.support, marginTop: 8 },
  lessonModule: { marginTop: 30, gap: 0 },
  moduleBanner: { minHeight: 92, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 17, backgroundColor: C.purple, flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...shadow.hero },
  moduleEyebrow: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.7, color: "rgba(255,255,255,0.68)" }, moduleTitle: { fontFamily: font.bold, fontSize: 23, lineHeight: 28, color: C.onAccent, marginTop: 5 }, moduleProgress: { fontFamily: font.bold, fontSize: 13, color: C.onAccent, paddingHorizontal: 11, paddingVertical: 7, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.14)" },
  journey: { paddingTop: 24, paddingBottom: 10, gap: 6 }, lessonStep: { minHeight: 118, position: "relative", justifyContent: "flex-start" }, lessonStepLeft: { alignItems: "flex-start", paddingLeft: 12 }, lessonStepRight: { alignItems: "flex-end", paddingRight: 12 },
  journeyConnector: { position: "absolute", width: 2, height: 72, left: "50%", bottom: -10, backgroundColor: "rgba(81,40,136,0.18)", borderRadius: 1 },
  journeyNodeWrap: { width: 272, minHeight: 98, borderRadius: 26, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.68)", borderWidth: 1, borderColor: C.line }, journeyNodeWrapCurrent: { backgroundColor: C.onAccent, borderColor: "rgba(81,40,136,0.34)", ...shadow.layer }, journeyNodeWrapClose: { borderStyle: "dashed" },
  journeyNode: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: C.lineStrong, backgroundColor: "#F8F5FB", alignItems: "center", justifyContent: "center" }, journeyNodeCurrent: { width: 66, height: 66, borderRadius: 33, backgroundColor: C.purple, borderColor: C.purple, ...shadow.hero }, journeyNodeDone: { backgroundColor: C.purple, borderColor: C.purple }, journeyNodeClose: { borderRadius: 18 }, journeyNodeNumber: { fontFamily: font.bold, fontSize: 17, color: C.textSoft }, journeyNodeNumberCurrent: { color: C.onAccent },
  journeyCopy: { flex: 1, alignItems: "flex-start", gap: 5 }, journeyCopyRight: { alignItems: "flex-start" }, journeyTitle: { fontFamily: font.bold, fontSize: 16, lineHeight: 20, color: C.text }, journeyTitleLocked: { color: C.dim }, journeyMove: { fontFamily: font.regular, fontSize: 12, lineHeight: 16, color: C.textSoft },
  continueCard: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12 }, continueCopy: { flex: 1 }, continueTitle: { ...T.support, fontFamily: font.semi, color: C.text, marginTop: 5 }, continueCounterpart: { ...T.caption, color: C.purple, marginTop: 3 },
  filtersSection: { marginTop: 26, gap: 10 }, filters: { marginHorizontal: -GUTTER }, filterContent: { paddingHorizontal: GUTTER, gap: 8 }, filter: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.66)", paddingHorizontal: 17, alignItems: "center", justifyContent: "center" }, filterSelected: { backgroundColor: C.purple, borderColor: C.purple, ...shadow.hero }, filterLabel: { fontFamily: font.semi, fontSize: 13, color: C.textSoft }, filterLabelSelected: { color: C.onAccent },
  recommendedSection: { marginTop: 26, gap: 10 }, recommended: { gap: 10 }, recommendedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, recommendedTitle: { ...T.title }, recommendedCounterpart: { ...T.caption, color: C.purple }, recommendedSituation: { ...T.support, color: C.text }, recommendedGoal: { ...T.caption, color: C.textSoft }, recommendedWhy: { ...T.caption, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  browseHeading: { marginTop: 28, marginBottom: 12, flexDirection: "row", alignItems: "flex-end" }, browseCopy: { flex: 1 }, categoryBlurb: { ...T.caption, marginTop: 5 }, count: { fontFamily: font.semi, fontSize: 13, color: C.purple }, list: { gap: 9 }, scenarioRow: { minHeight: 136, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.66)", borderWidth: 1, borderColor: C.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }, rowCopy: { flex: 1 }, rowTitle: { ...T.title, fontSize: 17, lineHeight: 22 }, counterpart: { ...T.caption, color: C.purple, marginTop: 5 }, goal: { ...T.support, fontSize: 14, lineHeight: 20, marginTop: 8 }, rowMeta: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }, state: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }, stateText: { fontFamily: font.semi, fontSize: 9, letterSpacing: 1, color: C.dim },
  custom: { minHeight: 78, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 12 }, customIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, customCopy: { flex: 1 }, customTitle: { ...T.support, fontFamily: font.semi, color: C.text }, customDetail: { ...T.caption, marginTop: 3 },
});
