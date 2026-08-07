import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, X } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SafetyOutcomeView } from "@/components/SafetyOutcome";
import {
  Backdrop,
  Eyebrow,
  GhostButton,
  PressCard,
  PrimaryButton,
  Reveal,
  StateDock,
  tap,
} from "@/components/ui";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { track } from "@/lib/analytics";
import {
  BLANK_SAFETY_ANSWERS,
  SAFETY_QUESTIONS,
  allowsOrdinaryPractice,
  routeFor,
  type SafetyAnswers,
} from "@/lib/safety";
import { useStore } from "@/providers/store";
import type { Difficulty, ReactionPattern } from "@/types/convo";

/** Safety answers stay in memory and are never sent to storage, analytics, or a model. */
export default function SafetyCheck() {
  const params = useLocalSearchParams<{
    id: string;
    difficulty?: Difficulty;
    reaction?: ReactionPattern;
    challengeDay?: string;
    pilotDay?: string;
    entry?: "onboarding";
    persona?: string;
    practiceSessionId?: string;
  }>();
  const router = useRouter();
  const { activePracticeSession, saveActivePracticeSession } = useStore();
  const insets = useSafeAreaInsets();
  const [answers, setAnswers] = useState<SafetyAnswers>(BLANK_SAFETY_ANSWERS);
  const [submitted, setSubmitted] = useState<boolean>(false);

  const outcome = useMemo(() => routeFor(answers), [answers]);
  const canPractice = allowsOrdinaryPractice(outcome.route);

  const toggle = useCallback((id: keyof SafetyAnswers): void => {
    tap("light");
    setAnswers((previous) => ({ ...previous, [id]: !previous[id] }));
  }, []);

  const submit = useCallback((): void => {
    tap("medium");
    setSubmitted(true);
    track(allowsOrdinaryPractice(routeFor(answers).route) ? "safety_gate_shown" : "safety_gate_hard_stop");
  }, [answers]);

  const startPractice = useCallback(async (): Promise<void> => {
    tap("medium");
    if (params.pilotDay) {
      router.replace({ pathname: "/module/[day]", params: { day: params.pilotDay } });
      return;
    }
    if (params.entry === "onboarding" && params.practiceSessionId && activePracticeSession?.id === params.practiceSessionId) {
      await saveActivePracticeSession({ ...activePracticeSession, safetyStatus: "cleared", updatedAt: Date.now() });
    }
    router.replace({
      pathname: "/rehearse/[id]",
      params: {
        id: String(params.id),
        ...(params.difficulty ? { difficulty: params.difficulty } : {}),
        ...(params.reaction ? { reaction: params.reaction } : {}),
        ...(params.challengeDay ? { challengeDay: params.challengeDay } : {}),
        ...(params.entry ? { entry: params.entry } : {}),
        ...(params.persona ? { persona: params.persona } : {}),
        ...(params.practiceSessionId ? { practiceSessionId: params.practiceSessionId } : {}),
      },
    });
  }, [activePracticeSession, params.challengeDay, params.difficulty, params.entry, params.id, params.persona, params.pilotDay, params.practiceSessionId, params.reaction, router, saveActivePracticeSession]);

  const leave = useCallback((): void => {
    tap("light");
    router.replace("/(tabs)");
  }, [router]);

  if (submitted) {
    return (
      <SafetyOutcomeView outcome={outcome}>
        {canPractice ? (
          <>
            <PrimaryButton label={outcome.primaryLabel} onPress={startPractice} />
            <GhostButton label="Not right now" onPress={leave} style={styles.secondaryAction} />
          </>
        ) : (
          <>
            <PrimaryButton label={outcome.primaryLabel} onPress={leave} />
            <Text style={styles.hardStopNote}>
              Practice for this conversation is turned off on purpose. Nothing about this answer was saved.
            </Text>
          </>
        )}
      </SafetyOutcomeView>
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          style={styles.close}
          accessibilityRole="button"
          accessibilityLabel="Close safety check"
        >
          <X size={22} color={C.textSoft} strokeWidth={1.8} />
        </Pressable>
        <Eyebrow style={styles.topLabel}>Private check</Eyebrow>
        <View style={styles.close} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 132 }]}
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0} style={styles.intro}>
          <Text style={styles.display}>Is this conversation safe to have?</Text>
          <Text style={styles.support}>
            Select anything that is true. Some situations need support or a safer plan instead of a direct conversation.
          </Text>
          <Text style={styles.privacyNote}>
            Your answers stay on this screen. They are not saved, sent to a model, or included in analytics.
          </Text>
        </Reveal>

        <View style={styles.questions}>
          {SAFETY_QUESTIONS.map((question, index) => {
            const isSelected = answers[question.id];
            return (
              <Reveal key={question.id} index={1 + index}>
                <PressCard
                  onPress={() => toggle(question.id)}
                  accessibilityLabel={question.prompt}
                >
                  <View style={[styles.question, isSelected && styles.questionSelected]}>
                    <View style={[styles.box, isSelected && styles.boxSelected]}>
                      {isSelected ? <Check size={14} color={C.onAccent} strokeWidth={3} /> : null}
                    </View>
                    <View style={styles.questionCopy}>
                      <Text style={styles.questionText}>{question.prompt}</Text>
                      <Text style={styles.helper}>{question.helper}</Text>
                    </View>
                  </View>
                </PressCard>
              </Reveal>
            );
          })}
        </View>
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        <PrimaryButton label="Continue" tone={C.purple} onPress={submit} />
        <Text style={styles.noneNote}>Nothing here true? Continue to your practice.</Text>
      </StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  topBar: {
    minHeight: 60,
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topLabel: { flex: 1, alignItems: "center" },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 16 },
  intro: { gap: 12, marginBottom: 24 },
  display: { ...T.display },
  support: { ...T.support },
  privacyNote: { ...T.caption },
  questions: { gap: 10 },
  question: {
    minHeight: 88,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 16,
    ...shadow.layer,
  },
  questionSelected: { borderColor: C.purple, backgroundColor: C.surfaceHigh },
  box: {
    width: 24,
    height: 24,
    borderRadius: 7,
    borderWidth: 1.5,
    borderColor: C.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  boxSelected: { borderColor: C.purple, backgroundColor: C.purple },
  questionCopy: { flex: 1, gap: 4 },
  questionText: { ...T.support, fontFamily: font.semi, color: C.text },
  helper: { ...T.caption },
  noneNote: { ...T.caption, textAlign: "center", marginTop: 10 },
  secondaryAction: { marginTop: 10 },
  hardStopNote: { ...T.caption, textAlign: "center", marginTop: 12 },
});
