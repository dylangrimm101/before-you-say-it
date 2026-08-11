import { useRouter } from "expo-router";
import { Check, ChevronRight, LockKeyhole, PenLine, Sparkles } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, Reveal } from "@/components/ui";
import { CATEGORIES, SCENARIOS } from "@/constants/scenarios";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { scenarioInteraction } from "@/lib/nativeCommerce";
import { useStore } from "@/providers/store";
import type { CategoryId, Scenario } from "@/types/convo";

export default function Library() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, customScenarios, completed, access, activePracticeSession } = useStore();
  const [active, setActive] = useState<CategoryId>(profile?.focus ?? "partner");

  const category = CATEGORIES.find((item) => item.id === active);
  const list = useMemo<Scenario[]>(() => {
    const authored = SCENARIOS.filter((scenario) => scenario.category === active);
    const personal = customScenarios.filter((scenario) => scenario.category === active);
    return [...personal, ...authored];
  }, [active, customScenarios]);
  const isLocked = access.entitlement !== "pro" && completed.length > 0;
  const openCustom = (): void => {
    if (isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } });
    else router.push("/custom");
  };
  const openScenario = (scenario: Scenario): void => {
    const interaction = scenarioInteraction(isLocked, scenario.id);
    if (interaction.isLocked) router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } });
    else router.push(interaction.destination as `/scenario/${string}`);
  };
  const doneIds = useMemo<Set<string>>(
    () => new Set(completed.map((session) => session.scenarioId)),
    [completed],
  );

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 112 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0} style={styles.header}>
          <Eyebrow>Scenarios</Eyebrow>
          <Text style={styles.display}>Practice the conversation before it happens.</Text>
          <Text style={styles.intro}>
            Filter by the relationship and context that matter, then enter a real briefing before you rehearse.
          </Text>
        </Reveal>

        {activePracticeSession?.sharedResult ? <Reveal index={1}><PressCard onPress={() => isLocked ? router.push({ pathname: "/paywall", params: { gate: "another-rehearsal" } }) : router.push(`/scenario/${activePracticeSession.scenarioId}`)} accessibilityLabel="Continue with my conversation"><View style={styles.continueCard}><Sparkles size={19} color={C.purple} /><View style={styles.buildCopy}><Text style={styles.continueEyebrow}>CONTINUE WITH MY CONVERSATION</Text><Text style={styles.continueTitle}>{activePracticeSession.scenarioTitle ?? activePracticeSession.topic}</Text></View><ChevronRight size={20} color={C.purple} /></View></PressCard></Reveal> : null}

        <Reveal index={1}>
          <PressCard
            onPress={openCustom}
            accessibilityLabel="Build a scenario from your situation"
          >
            <View style={styles.buildCard}>
              <View style={styles.buildIcon}>
                <PenLine size={22} color={C.onAccent} strokeWidth={1.8} />
              </View>
              <View style={styles.buildCopy}>
                <Text style={styles.buildEyebrow}>MAKE IT YOURS</Text>
                <Text style={styles.buildTitle}>Build from your situation</Text>
                <Text style={styles.buildSupport}>Describe the real conversation in your own words.</Text>
              </View>
              <ChevronRight size={22} color="rgba(255,255,255,0.82)" strokeWidth={1.8} />
            </View>
          </PressCard>
        </Reveal>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filters}
          contentContainerStyle={styles.filterContent}
        >
          {CATEGORIES.map((item) => {
            const isSelected = item.id === active;
            return (
              <PressCard
                key={item.id}
                onPress={() => setActive(item.id)}
                accessibilityLabel={`Show ${item.label} scenarios`}
              >
                <View style={[styles.filter, isSelected && styles.filterSelected]}>
                  <Text style={[styles.filterLabel, isSelected && styles.filterLabelSelected]}>
                    {item.label}
                  </Text>
                </View>
              </PressCard>
            );
          })}
        </ScrollView>

        <Reveal index={2} style={styles.sectionHeading}>
          <View style={styles.sectionCopy}>
            <Text style={styles.sectionTitle}>{category?.label ?? "Scenarios"}</Text>
            <Text style={styles.sectionSupport}>{category?.blurb}</Text>
          </View>
          <Text style={styles.count}>{list.length}</Text>
        </Reveal>

        <View style={styles.list}>
          {list.map((scenario, index) => {
            const isDone = doneIds.has(scenario.id);
            return (
              <Reveal key={scenario.id} index={3 + index}>
                <PressCard
                  onPress={() => openScenario(scenario)}
                  accessibilityLabel={`Open ${scenario.title}`}
                >
                  <View style={styles.scenarioCard}>
                    <View style={styles.cardHeading}>
                      <Text style={styles.cardTitle} numberOfLines={3}>
                        {scenario.title}
                      </Text>
                      <ChevronRight size={20} color={C.dim} strokeWidth={1.8} />
                    </View>
                    <Text style={styles.counterpart} numberOfLines={1}>
                      {scenario.counterpart}
                    </Text>
                    <Text style={styles.goal} numberOfLines={2}>
                      {scenario.goal}
                    </Text>
                    <View style={styles.metaRow}>
                      <Text style={styles.meta}>{scenario.minutes} MIN PRACTICE</Text>
                      {scenario.isCustom ? <Text style={styles.personal}>YOUR SCENARIO</Text> : null}
                      {isLocked ? <View style={styles.trained}><LockKeyhole size={12} color={C.dim} /><Text style={[styles.trainedText, { color: C.dim }]}>PRO</Text></View> : isDone ? (
                        <View style={styles.trained}>
                          <Check size={12} color={C.sage} strokeWidth={2.2} />
                          <Text style={styles.trainedText}>PRACTICED</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </PressCard>
              </Reveal>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: GUTTER },
  header: { gap: 12, marginBottom: 24 },
  display: { ...T.display },
  intro: { ...T.support, maxWidth: 340 },
  continueCard: { minHeight: 90, borderRadius: radius.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: `${C.purple}33`, padding: 18, flexDirection: "row", alignItems: "center", gap: 13, marginBottom: 12 },
  continueEyebrow: { ...eyebrow, color: C.purple },
  continueTitle: { ...T.support, color: C.text, fontFamily: font.semi, marginTop: 5 },
  buildCard: {
    minHeight: 132,
    borderRadius: radius.lg,
    backgroundColor: C.purple,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    ...shadow.hero,
  },
  buildIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  buildCopy: { flex: 1, gap: 4 },
  buildEyebrow: {
    ...eyebrow,
    color: "rgba(255,255,255,0.80)",
  },
  buildTitle: { ...T.title, color: C.onAccent },
  buildSupport: { ...T.caption, color: "rgba(255,255,255,0.74)" },
  filters: { marginHorizontal: -GUTTER, marginTop: 28 },
  filterContent: { paddingHorizontal: GUTTER, gap: 8 },
  filter: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  filterSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  filterLabel: { fontFamily: font.semi, fontSize: 13, color: C.textSoft },
  filterLabelSelected: { color: C.purple },
  sectionHeading: {
    marginTop: 28,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
  },
  sectionCopy: { flex: 1, gap: 4 },
  sectionTitle: { ...T.title },
  sectionSupport: { ...T.caption },
  count: {
    ...T.caption,
    fontFamily: font.semi,
    color: C.purple,
    minWidth: 24,
    textAlign: "right",
  },
  list: { gap: 12 },
  scenarioCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 18,
    ...shadow.layer,
  },
  cardHeading: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  cardTitle: { ...T.title, flex: 1 },
  counterpart: { ...T.caption, color: C.purple, marginTop: 8 },
  goal: { ...T.support, marginTop: 12 },
  metaRow: {
    minHeight: 28,
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  meta: { ...eyebrow, color: C.dim },
  personal: { ...eyebrow, color: C.purple },
  trained: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 },
  trainedText: { ...eyebrow, color: C.sage },
});
