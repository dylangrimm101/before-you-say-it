import { useRouter } from "expo-router";
import { Check, ChevronRight, LockKeyhole, PenLine, Sparkles } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal } from "@/components/ui";
import { CATEGORIES, SCENARIOS } from "@/constants/scenarios";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { scenarioInteraction } from "@/lib/nativeCommerce";
import { recommendScenario } from "@/lib/scenarioRecommendation";
import { useStore } from "@/providers/store";
import type { CategoryId, Scenario } from "@/types/convo";

export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, customScenarios, completed, access, activePracticeSession } = useStore();
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

  const openCustom = (): void => { if (isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push("/custom"); };
  const openScenario = (scenario: Scenario): void => { const interaction = scenarioInteraction(isLocked, scenario.id); if (interaction.isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push(interaction.destination as `/scenario/${string}`); };
  const continueConversation = (): void => { if (!activePracticeSession) return; if (isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }); else router.push(`/scenario/${activePracticeSession.scenarioId}`); };

  return <View style={styles.root}><Backdrop /><ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 22, paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
    <Reveal><Text style={styles.title}>Scenarios</Text><Text style={styles.intro}>Practice the conversation before it happens. Filter by the relationship around it.</Text></Reveal>
    {activePracticeSession?.sharedResult ? <Reveal index={1}><PressCard onPress={continueConversation} accessibilityLabel={savedConversationLabel}><ProductCard accent style={styles.continueCard}><Sparkles size={20} color={C.purple} /><View style={styles.continueCopy}><SectionLabel tone={C.purple}>{savedConversationLabel}</SectionLabel><Text style={styles.continueTitle}>{activePracticeSession.scenarioTitle ?? activePracticeSession.topic}</Text><Text style={styles.continueCounterpart}>{activePracticeSession.counterpartDisplayLabel ?? activePracticeSession.counterpart}</Text></View><ChevronRight size={20} color={C.purple} /></ProductCard></PressCard></Reveal> : null}
    <Reveal index={2} style={styles.filtersSection}><SectionLabel>Relationship or context</SectionLabel><ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>{CATEGORIES.map((item) => { const selected = item.id === active; return <PressCard key={item.id} onPress={() => setActive(item.id)} accessibilityLabel={`Show ${item.label} scenarios`}><View style={[styles.filter, selected && styles.filterSelected]}><Text style={[styles.filterLabel, selected && styles.filterLabelSelected]}>{item.label}</Text></View></PressCard>; })}</ScrollView></Reveal>
    {recommended ? <Reveal index={3} style={styles.recommendedSection}><SectionLabel>{recommendation.match.startsWith("focus") ? "Recommended for your current focus" : `Recommended in ${category?.label ?? "this context"}`}</SectionLabel><PressCard onPress={() => openScenario(recommended)} accessibilityLabel={`Open recommended scenario ${recommended.title}`}><ProductCard accent style={styles.recommended}><View style={styles.recommendedTop}><StatusPill label={focus ?? "Practice your current focus"} tone="purple" />{isLocked ? <StatusPill label="Pro" /> : <StatusPill label="Available" tone="green" />}</View><Text style={styles.recommendedTitle}>{recommended.title}</Text><Text style={styles.recommendedCounterpart}>{recommended.counterpart}</Text><Text style={styles.recommendedGoal}>{recommended.goal}</Text><Text style={styles.recommendedWhy}>{recommendation.reason}</Text></ProductCard></PressCard></Reveal> : null}
    <Reveal index={4} style={styles.browseHeading}><View style={styles.browseCopy}><SectionLabel>Browse {category?.label ?? "scenarios"}</SectionLabel><Text style={styles.categoryBlurb}>{category?.blurb}</Text></View><Text style={styles.count}>{list.length}</Text></Reveal>
    <View style={styles.list}>{list.map((scenario, index) => { const done = doneIds.has(scenario.id); const featured = scenario.id === recommended?.id; return <Reveal key={scenario.id} index={5 + index}>{featured ? null : <PressCard onPress={() => openScenario(scenario)} accessibilityLabel={`${scenario.title}. ${isLocked ? "Locked" : "Available"}`}><View style={styles.scenarioRow}><View style={styles.rowCopy}><Text style={styles.rowTitle}>{scenario.title}</Text><Text style={styles.counterpart}>{scenario.counterpart}</Text><Text style={styles.goal} numberOfLines={2}>{scenario.goal}</Text><View style={styles.rowMeta}>{scenario.isCustom ? <StatusPill label="Your scenario" tone="purple" /> : <StatusPill label={category?.label ?? scenario.category} />}{isLocked ? <View style={styles.state}><LockKeyhole size={12} color={C.dim} /><Text style={styles.stateText}>LOCKED</Text></View> : done ? <View style={styles.state}><Check size={12} color={C.sage} /><Text style={[styles.stateText, { color: C.sage }]}>PRACTICED</Text></View> : <Text style={[styles.stateText, { color: C.purple }]}>AVAILABLE</Text>}</View></View><ChevronRight size={19} color={isLocked ? C.dim : C.purple} /></View></PressCard>}</Reveal>; })}</View>
    <Reveal index={10}><PressCard onPress={openCustom} accessibilityLabel="Build a scenario from your situation"><View style={styles.custom}><View style={styles.customIcon}><PenLine size={18} color={C.purple} /></View><View style={styles.customCopy}><Text style={styles.customTitle}>Build from your situation</Text><Text style={styles.customDetail}>Describe a real conversation in your own words.</Text></View>{isLocked ? <LockKeyhole size={17} color={C.dim} /> : <ChevronRight size={18} color={C.purple} />}</View></PressCard></Reveal>
  </ScrollView></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, scroll: { paddingHorizontal: GUTTER }, title: { fontFamily: font.bold, fontSize: 31, lineHeight: 36, color: C.text }, intro: { ...T.support, marginTop: 9, maxWidth: 340 }, continueCard: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 12 }, continueCopy: { flex: 1 }, continueTitle: { ...T.support, fontFamily: font.semi, color: C.text, marginTop: 5 }, continueCounterpart: { ...T.caption, color: C.purple, marginTop: 3 },
  filtersSection: { marginTop: 26, gap: 10 }, filters: { marginHorizontal: -GUTTER }, filterContent: { paddingHorizontal: GUTTER, gap: 8 }, filter: { minHeight: 44, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.66)", paddingHorizontal: 17, alignItems: "center", justifyContent: "center" }, filterSelected: { backgroundColor: C.purple, borderColor: C.purple, ...shadow.hero }, filterLabel: { fontFamily: font.semi, fontSize: 13, color: C.textSoft }, filterLabelSelected: { color: C.onAccent },
  recommendedSection: { marginTop: 26, gap: 10 }, recommended: { gap: 10 }, recommendedTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, recommendedTitle: { ...T.title }, recommendedCounterpart: { ...T.caption, color: C.purple }, recommendedGoal: { ...T.support, color: C.text }, recommendedWhy: { ...T.caption, paddingTop: 9, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  browseHeading: { marginTop: 28, marginBottom: 12, flexDirection: "row", alignItems: "flex-end" }, browseCopy: { flex: 1 }, categoryBlurb: { ...T.caption, marginTop: 5 }, count: { fontFamily: font.semi, fontSize: 13, color: C.purple }, list: { gap: 9 }, scenarioRow: { minHeight: 136, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.66)", borderWidth: 1, borderColor: C.line, padding: 16, flexDirection: "row", alignItems: "center", gap: 10 }, rowCopy: { flex: 1 }, rowTitle: { ...T.title, fontSize: 17, lineHeight: 22 }, counterpart: { ...T.caption, color: C.purple, marginTop: 5 }, goal: { ...T.support, fontSize: 14, lineHeight: 20, marginTop: 8 }, rowMeta: { marginTop: 12, flexDirection: "row", alignItems: "center", gap: 10 }, state: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }, stateText: { fontFamily: font.semi, fontSize: 9, letterSpacing: 1, color: C.dim },
  custom: { minHeight: 78, marginTop: 20, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: C.line, flexDirection: "row", alignItems: "center", gap: 12 }, customIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, customCopy: { flex: 1 }, customTitle: { ...T.support, fontFamily: font.semi, color: C.text }, customDetail: { ...T.caption, marginTop: 3 },
});
