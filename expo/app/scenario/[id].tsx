import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Target, UserRound } from "lucide-react-native";
import React, { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import {
  Backdrop,
  PressCard,
  PrimaryButton,
  Reveal,
  SelectionWipe,
  StateDock,
} from "@/components/ui";
import { voiceForScenario } from "@/constants/personas";
import { CATEGORIES, DIFFICULTY } from "@/constants/scenarios";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { canStartRehearsal } from "@/lib/access";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { scenarioStartDisposition } from "@/lib/scenarioLifecycle";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import { useStore } from "@/providers/store";
import type { Difficulty, ReactionPattern } from "@/types/convo";

const LEVELS: Difficulty[] = ["gentle", "steady", "challenging"];

export default function ScenarioBrief() {
  const params = useLocalSearchParams<{
    id: string;
    level?: Difficulty;
    challengeDay?: string;
    reaction?: ReactionPattern;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { findScenario, profile, access, activeScenarioRun, createActiveScenarioRunStrict, archiveActiveScenarioRunStrict } = useStore();
  const [level, setLevel] = useState<Difficulty>(
    (params.level as Difficulty) ?? "steady",
  );
  const scenario = findScenario(String(params.id));

  if (!scenario) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Text style={T.support}>That scenario is no longer available.</Text>
        <PrimaryButton
          label="Go back"
          onPress={() => router.back()}
          containerStyle={styles.missingButton}
        />
      </View>
    );
  }

  const category = CATEGORIES.find((item) => item.id === scenario.category);
  const accent = category?.accent ?? C.purple;

  const start = async (): Promise<void> => {
    const decision = canStartRehearsal(access);
    if (!decision.allowed) {
      router.push({
        pathname: "/paywall",
        params: { gate: decision.gate ?? "another-rehearsal" },
      });
      return;
    }

    const disposition = scenarioStartDisposition(activeScenarioRun, scenario.id);
    if (disposition.kind === "protected_conflict") {
      Alert.alert("A lesson rehearsal is still active", "Return to that lesson to finish or discard it before starting a standalone scenario.");
      return;
    }
    if (disposition.kind === "resume") {
      router.push({ pathname: "/rehearse/[id]", params: { id: scenario.id, scenarioRunId: disposition.runId } });
      return;
    }
    try {
      if (disposition.kind === "retire_then_create") {
        const expected = activeRunRevision(activeScenarioRun);
        if (!expected || expected.runId !== disposition.runId) throw new Error("Active scenario identity changed");
        await archiveActiveScenarioRunStrict(expected);
      }
      const runId = `scenario-${scenario.id}-${Date.now().toString(36)}`;
      await createActiveScenarioRunStrict(createScenarioPracticeRun(
        scenario,
        level,
        params.reaction ?? profile?.reaction ?? "not-sure",
        runId,
        Date.now(),
        voiceForScenario(scenario, profile?.persona ?? "woman-hope"),
      ));
      router.push({
        pathname: "/rehearse/[id]",
        params: {
          id: scenario.id,
          difficulty: level,
          reaction: params.reaction ?? profile?.reaction ?? "not-sure",
          scenarioRunId: runId,
          ...(params.challengeDay ? { challengeDay: params.challengeDay } : {}),
        },
      });
    } catch {
      Alert.alert("Couldn’t start the rehearsal", "Your existing rehearsal is still safe. Try again.");
    }
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <PaidHeader title="Scenario briefing" onBack={() => router.back()} />

        <Reveal index={0}>
          <StatusPill label={category?.label ?? "Rehearsal"} tone="purple" />
          <Text style={styles.title}>{scenario.title}</Text>
        </Reveal>

        <Reveal index={1}>
          <ProductCard accent style={styles.detailCard}>
            <View style={styles.cardHeading}>
              <UserRound size={20} color={accent} strokeWidth={1.7} />
              <Text style={styles.cardEyebrow}>You’ll be talking to</Text>
            </View>
            <Text style={styles.counterpart}>{scenario.counterpart}</Text>
            <Text style={styles.situation}>{scenario.situation}</Text>
          </ProductCard>
        </Reveal>

        <Reveal index={2}>
          <ProductCard accent style={styles.detailCard}>
            <View style={styles.cardHeading}>
              <Target size={20} color={accent} strokeWidth={1.7} />
              <Text style={styles.cardEyebrow}>Your objective</Text>
            </View>
            <Text style={styles.goal}>{scenario.goal}</Text>
          </ProductCard>
        </Reveal>

        <Reveal index={3}>
          <View style={styles.difficultyHeading}>
            <SectionLabel>Practice difficulty</SectionLabel>
            <Text style={styles.difficultySupport}>
              Choose how much resistance you want from {scenario.counterpart}.
            </Text>
          </View>
        </Reveal>

        <View style={styles.levelColumn}>
          {LEVELS.map((item, index) => {
            const selected = item === level;
            const detail = DIFFICULTY[item];
            return (
              <Reveal key={item} index={4 + index}>
                <PressCard
                  onPress={() => setLevel(item)}
                  containerStyle={styles.levelHit}
                  accessibilityLabel={`${detail.label}: ${detail.note}`}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <View style={[styles.level, selected && styles.levelSelected]}>
                    <SelectionWipe selected={selected} />
                    <View style={[styles.bars, styles.selectedContent]}>
                      {[0, 1, 2].map((bar) => (
                        <View
                          key={bar}
                          style={[
                            styles.bar,
                            { height: 8 + bar * 6 },
                            bar <= LEVELS.indexOf(item)
                              ? { backgroundColor: selected ? accent : C.lineStrong }
                              : null,
                          ]}
                        />
                      ))}
                    </View>
                    <View style={[styles.levelCopy, styles.selectedContent]}>
                      <Text style={[styles.levelLabel, selected && styles.levelLabelSelected]}>
                        {detail.label}
                      </Text>
                      <Text style={[styles.levelNote, selected && styles.levelNoteSelected]}>{detail.note}</Text>
                    </View>
                    <View style={[styles.check, styles.selectedContent, selected && styles.checkSelected]}>
                      {selected ? (
                        <Check size={16} color={C.purple} strokeWidth={2.2} />
                      ) : null}
                    </View>
                  </View>
                </PressCard>
              </Reveal>
            );
          })}
        </View>

        <Reveal index={7}>
          <Text style={styles.disclaimer}>
            A rehearsal is private practice designed to help you prepare before a real conversation.
          </Text>
        </Reveal>
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        <PrimaryButton label="Start the rehearsal" onPress={() => void start()} />
      </StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  center: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: GUTTER,
  },
  missingButton: { alignSelf: "stretch", marginTop: 24 },
  content: {
    paddingHorizontal: GUTTER,
    paddingBottom: 32,
  },
  title: {
    ...T.display,
    marginBottom: 24,
    marginTop: 8,
  },
  detailCard: {
    marginBottom: 12,
    padding: 20,
  },
  cardHeading: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  cardEyebrow: { ...eyebrow, color: C.dim },
  counterpart: {
    ...T.title,
    marginTop: 16,
  },
  situation: {
    ...T.support,
    marginTop: 8,
  },
  goal: {
    ...T.body,
    marginTop: 16,
  },
  difficultyHeading: {
    gap: 8,
    marginBottom: 12,
    marginTop: 20,
  },
  difficultySupport: { ...T.support },
  levelColumn: { gap: 10 },
  levelHit: { width: "100%" },
  level: {
    alignItems: "center",
    backgroundColor: C.surface,
    borderColor: C.glassEdge,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: 16,
    minHeight: 76,
    paddingHorizontal: 16,
    paddingVertical: 14,
    overflow: "hidden",
  },
  levelSelected: { borderColor: C.purple },
  selectedContent: { zIndex: 1 },
  bars: {
    alignItems: "flex-end",
    flexDirection: "row",
    gap: 3,
    height: 20,
  },
  bar: {
    backgroundColor: C.line,
    borderRadius: 2,
    width: 4,
  },
  levelCopy: { flex: 1 },
  levelLabel: {
    color: C.textSoft,
    fontFamily: font.semi,
    fontSize: 17,
    lineHeight: 26,
  },
  levelLabelSelected: { color: C.onAccent },
  levelNote: { ...T.caption, marginTop: 2 },
  levelNoteSelected: { color: C.onAccent },
  check: {
    alignItems: "center",
    borderColor: C.lineStrong,
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: "center",
    width: 22,
  },
  checkSelected: {
    backgroundColor: C.onAccent,
    borderColor: C.onAccent,
  },
  disclaimer: {
    ...T.caption,
    marginTop: 24,
  },
});
