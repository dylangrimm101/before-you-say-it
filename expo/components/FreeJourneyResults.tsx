import { useRouter } from "expo-router";
import Svg, { Circle, Path } from "react-native-svg";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, PrimaryButton, PressCard, StateDock, tap, useReducedMotion } from "@/components/ui";
import { curriculumModule } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, shadow } from "@/constants/theme";
import { CONVERSATION_PHASES } from "@/lib/conversion";
import type { ActivePracticeSession, FreeJourneyCheckpoint } from "@/lib/practiceSession";
import { transitionPostRehearsal } from "@/lib/postRehearsalFlow";
import { safeLog } from "@/lib/redact";
import { completedPracticeSessionToSharedTranscript } from "@/lib/sharedProductAdapters";
import { useStore } from "@/providers/store";
import type { SharedSignalV1 } from "@/types/sharedProduct";

const SIGNAL_LABELS: Record<SharedSignalV1["signal_key"], string> = {
  clarity: "Clarity",
  specificity: "Specificity",
  steadiness: "Steadiness",
  listening: "Listening",
  boundaries: "Boundaries",
  repair: "Repair",
};

type ResultCard = "index" | "path";

export function FreeJourneyResults({ session }: { session: ActivePracticeSession }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { saveActivePracticeSession } = useStore();
  const isReduced = useReducedMotion();
  const [resultCard, setResultCard] = useState<ResultCard>("index");
  const cardProgress = useRef<Animated.Value>(new Animated.Value(1)).current;
  const cardDirection = useRef<1 | -1>(1);
  const result = session.sharedResult;
  const storedCheckpoint: FreeJourneyCheckpoint = session.freeJourneyCheckpoint ?? "pressure_moment";
  // A completed result must never fall back into an earlier rehearsal checkpoint
  // because of a late persistence write from the screen we just left.
  const checkpoint: FreeJourneyCheckpoint =
    storedCheckpoint === "briefing" ||
    storedCheckpoint === "rehearsal" ||
    storedCheckpoint === "transcript_review" ||
    storedCheckpoint === "generating"
      ? "pressure_moment"
      : storedCheckpoint;

  useEffect(() => {
    safeLog("[evidence] native post-rehearsal screen", {
      checkpoint,
      platform: Platform.OS,
      screen: checkpoint === "pressure_moment"
        ? "communication-baseline"
        : checkpoint === "practice_shift"
          ? "practice-shift"
          : checkpoint,
    });
  }, [checkpoint]);

  const move = useCallback(async (next: FreeJourneyCheckpoint): Promise<void> => {
    tap("medium");
    const postRehearsalState = next === "pressure_moment"
      ? "pressure" as const
      : next === "rewrite"
        ? "rewrite" as const
        : next === "practice_shift"
          ? "shift" as const
          : session.postRehearsalState;
    await saveActivePracticeSession({
      ...session,
      freeJourneyCheckpoint: next,
      postRehearsalState: postRehearsalState
        ? transitionPostRehearsal(session.postRehearsalState, postRehearsalState)
        : undefined,
      updatedAt: Date.now(),
    });
  }, [saveActivePracticeSession, session]);

  const showResultCard = useCallback((next: ResultCard): void => {
    if (next === resultCard) return;
    tap("medium");
    cardDirection.current = next === "path" ? 1 : -1;
    setResultCard(next);
  }, [resultCard]);

  useEffect(() => {
    if (isReduced) {
      cardProgress.setValue(1);
      return;
    }
    cardProgress.setValue(0);
    const animation = Animated.timing(cardProgress, {
      toValue: 1,
      duration: 280,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [cardProgress, isReduced, resultCard]);

  if (!result?.pressure_moment || !result.practice_shift || !result.starting_index || !result.first_focus) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Text style={styles.title}>Your evidence needs another look.</Text>
        <Text style={styles.support}>Your approved transcript is safe on this device. Return to the rehearsal and try analysis again.</Text>
        <PrimaryButton
          label="Return to rehearsal"
          onPress={() => router.replace({ pathname: "/rehearse/[id]", params: { id: session.scenarioId, entry: "onboarding", practiceSessionId: session.id } })}
          style={styles.returnButton}
        />
      </View>
    );
  }

  const transcript = completedPracticeSessionToSharedTranscript(session);
  const byId = new Map<string, string>(transcript.turns.map((turn) => [turn.id, turn.approved_text]));

  if (checkpoint === "pressure_moment") {
    const moment = result.pressure_moment;
    const observedSignals = result.signals.filter((signal) => signal.observation_status === "observed");
    const unobservedSignals = result.signals.filter((signal) => signal.observation_status !== "observed");
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 32 }]} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>Your communication baseline</Text>
          <Text style={styles.title}>{moment.headline || "You stayed in the room. Now make the ask hold."}</Text>
          <Text style={styles.observation}>{moment.observation}</Text>
          <View style={styles.stallCard}>
            <Text style={styles.stallText}><Text style={styles.stallLead}>Where it stalls: </Text>You stayed in the conversation, but the ask still did not hold under pressure.</Text>
          </View>
          <View style={styles.exchange}>
            <Text style={styles.focusEyebrow}>FIRST PRACTICE FOCUS</Text>
            <Text style={styles.focusTitle}>{result.first_focus.first_focus_label}</Text>
            <Text style={styles.focusSummary}>{curriculumModule(result.first_focus.recommended_module_id)?.promise ?? "This module trains the next move, so the conversation has something concrete to hold onto."}</Text>
            <View style={styles.rewriteDivider} />
            <ExchangeNode label="Your ask" text={byId.get(moment.opening_turn_id) ?? ""} tone="you" />
            <ExchangeNode label="The pushback" text={byId.get(moment.pushback_turn_id) ?? ""} tone="push" />
            <ExchangeNode label="Your response" text={byId.get(moment.pressure_response_turn_id) ?? ""} tone="you" last />
          </View>
          <View style={styles.baselineAction}>
            <PrimaryButton label="Show what changes with practice" onPress={() => void move("rewrite")} />
            <Text style={styles.dockPromise}>See your same ask rewritten as one specific request you could actually say.</Text>
          </View>
          <View style={styles.baselineCard}>
            <View style={styles.startingIndexSummary}>
              <View style={styles.startingIndexCopy}>
                <Text style={styles.groupLabel}>STARTING INDEX</Text>
                <Text style={styles.startingIndexScope}>A partial view from this rehearsal only</Text>
              </View>
              <View style={styles.startingIndexBadge}><Text style={styles.startingIndexValue}>{result.starting_index.index_value ?? "—"}</Text></View>
            </View>
            <Text style={styles.baselineScope}>{result.starting_index.observed_count} of 6 signals observed. Unobserved signals aren’t scored.</Text>
            <Text style={styles.groupLabel}>WHAT THIS REP SHOWED</Text>
            {observedSignals.length > 0
              ? observedSignals.map((signal) => <SignalRow key={signal.signal_key} signal={signal} />)
              : <Text style={styles.emptyEvidence}>This short exchange did not support a responsible score yet.</Text>}
            {unobservedSignals.length > 0 ? <>
              <Text style={styles.groupLabel}>NOT TESTED YET</Text>
              <View style={styles.signalChips}>
                {unobservedSignals.map((signal) => <View key={signal.signal_key} style={styles.signalChip}><Text style={styles.signalChipText}>{SIGNAL_LABELS[signal.signal_key]}</Text></View>)}
              </View>
            </> : null}
          </View>
        </ScrollView>
      </View>
    );
  }

  if (checkpoint === "rewrite") {
    const rewrite = result.rewrite ?? { original_ask: byId.get(result.pressure_moment.opening_turn_id) ?? "", clearer_version: session.recommendation?.immediateAction ?? result.practice_shift.practice_target_steps[1] ?? "" };
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 28 }]}>
          <PressCard onPress={() => void move("pressure_moment")} accessibilityLabel="Back to Communication baseline"><Text style={styles.back}>Back</Text></PressCard>
          <View style={styles.rewriteHeroSpace} />
          <Text style={styles.title}>Here’s what practice is helping you say</Text>
          <View style={styles.rewriteCard}>
            <Text style={styles.rewriteEyebrow}>YOUR WORDS, MADE USABLE</Text>
            <View style={styles.originalBlock}>
              <Text style={styles.detailLabel}>YOUR ORIGINAL ASK</Text>
              <Text style={styles.originalQuote}>“{rewrite.original_ask}”</Text>
            </View>
            <View style={styles.clearerBlock}>
              <Text style={[styles.detailLabel, styles.clearerLabel]}>A CLEARER VERSION</Text>
              <Text style={styles.clearerQuote}>“{rewrite.clearer_version}”</Text>
            </View>
            <Text style={styles.rewriteNote}>{"Practice is what makes this version come out when they push back. That's what the practice plan trains."}</Text>
          </View>
        </ScrollView>
        <StateDock bottomInset={insets.bottom}><PrimaryButton label="See the practice plan" onPress={() => void move("practice_shift")} /></StateDock>
      </View>
    );
  }

  if (checkpoint === "practice_shift") {
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: 28 }]}>
          <PressCard onPress={() => void move("rewrite")} accessibilityLabel="Back to clearer version">
            <Text style={styles.back}>Back</Text>
          </PressCard>
          <Text style={styles.title}>Your thoughts and feelings are valid and deserve to be heard.</Text>
          <Text style={styles.observation}>Practicing your communication skills builds the confidence to find the right words when pressure shows up.</Text>
          <ShiftComparison />
          <PracticeImprovementGraph />
        </ScrollView>
        <StateDock bottomInset={insets.bottom}>
          <PrimaryButton
            label="Start 7-Day free trial"
            onPress={async () => {
              safeLog("[evidence] native post-rehearsal transition", {
                platform: Platform.OS,
                screen: "pay1",
                step: "practice-shift-to-trial",
              });
              await saveActivePracticeSession({ ...session, freeJourneyCheckpoint: "complete", postRehearsalState: transitionPostRehearsal(session.postRehearsalState, "pay1"), updatedAt: Date.now() });
              router.push({ pathname: "/paywall", params: { gate: "recommended-path", source: "debrief", moduleId: result.first_focus?.recommended_module_id } });
            }}
          />
        </StateDock>
      </View>
    );
  }

  const cardWidth = Math.max(280, width - GUTTER * 2);
  const observedSignals = result.signals.filter((signal) => signal.observation_status === "observed");
  const unobservedSignals = result.signals.filter((signal) => signal.observation_status !== "observed");
  const cardMotion = isReduced ? undefined : {
    opacity: cardProgress,
    transform: [{
      translateX: cardProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [cardDirection.current * 24, 0],
      }),
    }],
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 46 }]}
        showsVerticalScrollIndicator={false}
      >
        <PressCard onPress={() => void move("practice_shift")} accessibilityLabel="Back to Practice Shift">
          <Text style={styles.back}>Back</Text>
        </PressCard>
        <Text style={styles.eyebrow}>YOUR STARTING POINT</Text>
        <Text style={styles.title}>A partial view from one approved exchange.</Text>
        <Animated.View style={cardMotion}>
          {resultCard === "index" ? (
            <View style={[styles.layerCard, { width: cardWidth }]} accessibilityLabel="Partial Starting Index card">
              <Text style={styles.cardTitle}>Where you are now</Text>
              <View style={styles.indexRow}>
                <View style={styles.indexScoreBadge}><Text style={styles.indexValue}>{result.starting_index.index_value ?? "—"}</Text></View>
                <View style={styles.indexCopy}>
                  <Text style={styles.detailLabel}>PARTIAL INDEX</Text>
                  <Text style={styles.indexCount}>{result.starting_index.observed_count} of 6 signals observed</Text>
                </View>
              </View>
              <Text style={styles.averageNote}>
                {result.starting_index.index_value === null
                  ? "There is not enough evidence to calculate a number yet."
                  : `${result.starting_index.index_value} averages observed signals only.`}{" "}
                Unobserved signals aren’t scored.
              </Text>
              <Text style={styles.groupLabel}>OBSERVED IN THIS REHEARSAL</Text>
              {observedSignals.length > 0
                ? observedSignals.map((signal) => <SignalRow key={signal.signal_key} signal={signal} />)
                : <Text style={styles.emptyEvidence}>No signal had enough evidence for a responsible score in this short exchange.</Text>}
              {unobservedSignals.length > 0 ? <>
                <Text style={styles.groupLabel}>NOT TESTED YET</Text>
                <View style={styles.signalChips}>
                  {unobservedSignals.map((signal) => <View key={signal.signal_key} style={styles.signalChip}><Text style={styles.signalChipText}>{SIGNAL_LABELS[signal.signal_key]}</Text></View>)}
                </View>
              </> : null}
              <PrimaryButton label="See my practice path" onPress={() => showResultCard("path")} style={styles.cardAction} />
            </View>
          ) : (
            <View style={[styles.layerCard, styles.pathCard, { width: cardWidth }]} accessibilityLabel="Practice path card">
              <Text style={styles.cardTitle}>Your practice path</Text>
              <Text style={styles.pathLead}>{result.first_focus.first_focus_label}</Text>
              <Text style={styles.pathEvidence}>{session.recommendation?.immediateAction ?? "Your first focus is based on this approved exchange."}</Text>
              <View style={styles.path}>
                {CONVERSATION_PHASES.map((phase, index) => (
                  <View key={phase.id} style={styles.pathRow}>
                    <View style={styles.pathRail}>
                      <View style={[styles.pathDot, index === 0 && styles.pathDotOn]} />
                      {index < CONVERSATION_PHASES.length - 1 ? <View style={styles.pathLine} /> : null}
                    </View>
                    <View style={styles.pathCopy}>
                      <Text style={[styles.pathName, index === 0 && styles.pathNameOn]}>{phase.name}</Text>
                      <Text style={styles.pathDays}>{phase.days}</Text>
                    </View>
                  </View>
                ))}
              </View>
              <PressCard onPress={() => showResultCard("index")} accessibilityLabel="Back to Starting Index">
                <Text style={styles.reverseCard}>Back to Starting Index</Text>
              </PressCard>
              <PrimaryButton
                label="Continue with my path"
                onPress={async () => {
                  await saveActivePracticeSession({ ...session, freeJourneyCheckpoint: "complete", postRehearsalState: transitionPostRehearsal(session.postRehearsalState, "pay1"), updatedAt: Date.now() });
                  router.push({ pathname: "/paywall", params: { gate: "recommended-path", source: "debrief", moduleId: result.first_focus?.recommended_module_id } });
                }}
                style={styles.continueButton}
              />
            </View>
          )}
        </Animated.View>
      </ScrollView>
    </View>
  );
}

function ExchangeNode({ label, text, tone, last = false }: { label: string; text: string; tone: "you" | "push"; last?: boolean }) {
  return (
    <View style={[styles.exchangeRow, !last && styles.exchangeRowDivided]}>
      <Text style={[styles.nodeLabel, tone === "push" && styles.pushLabel]}>{label}</Text>
      <Text style={styles.quote}>“{text}”</Text>
    </View>
  );
}

function ShiftComparison() {
  return (
    <View style={styles.comparison}>
      <ShiftSection label="WITHOUT PRACTICE" tone={C.amber} regularSteps={[
        "The conversation starts with the same vague ask",
        "Pushback makes the point harder to hold",
      ]} strongSteps={[
        "You explain more than you need to",
        "The conversation ends without a clear next step",
      ]} />
      <View style={styles.divider} />
      <ShiftSection label="WITH BYSI PRACTICE" tone={C.purple} regularSteps={[
        "Turn the thought into one clear request",
        "Stay steady when they get defensive",
      ]} strongSteps={[
        "Acknowledge them without dropping your point",
        "Return to one clear next step",
      ]} />
    </View>
  );
}

function ShiftSection({ label, regularSteps, strongSteps, tone }: { label: string; regularSteps: string[]; strongSteps: string[]; tone: string }) {
  return (
    <View style={styles.shiftSection}>
      <Text style={[styles.shiftLabel, { color: tone }]}>{label}</Text>
      {regularSteps.map((step) => <Text key={step} style={styles.shiftText}>{step}</Text>)}
      {strongSteps.map((step) => <Text key={step} style={[styles.shiftText, styles.shiftStrong, { color: tone }]}>{step}</Text>)}
    </View>
  );
}

function PracticeImprovementGraph() {
  return (
    <View style={styles.improvementCard} accessible accessibilityRole="image" accessibilityLabel="Skills improve with BYSI practice while the same ask without practice stays in the same loop.">
      <Text style={styles.improvementLabel}>IMPROVE YOUR COMMUNICATION WITH PRACTICE</Text>
      <View style={styles.graphCanvas}>
        <Svg width="100%" height="190" viewBox="0 0 320 190">
          <Path d="M16 150 C60 150 70 144 95 116 S145 121 176 88 S220 82 252 76 S281 55 302 40" fill="none" stroke={C.purple} strokeWidth="4" strokeLinecap="round" />
          <Path d="M16 150 C82 159 144 169 204 174 S270 176 302 176" fill="none" stroke={C.amber} strokeWidth="3" strokeLinecap="round" />
          <Circle cx="16" cy="150" r="6" fill={C.purple} />
          <Circle cx="302" cy="40" r="7" fill={C.purple} />
          <Circle cx="302" cy="176" r="6" fill={C.amber} />
        </Svg>
        <View style={styles.practiceBadge}><Text style={styles.practiceBadgeText}>With BYSI practice</Text></View>
        <View style={styles.loopBadge}><Text style={styles.loopBadgeText}>Same ask, same loop</Text></View>
      </View>
      <View style={styles.graphAxis}><Text style={styles.graphAxisText}>TODAY</Text><Text style={styles.graphAxisText}>IN 30 DAYS</Text></View>
      <Text style={styles.graphCaption}>Skills improvement</Text>
    </View>
  );
}

function SignalRow({ signal }: { signal: SharedSignalV1 }) {
  const isSpecificity = signal.signal_key === "specificity";
  return (
    <View style={[styles.signalBlock, isSpecificity && styles.signalBlockFocus]}>
      <View style={styles.signalRow}>
        <Text style={[styles.signalName, isSpecificity && styles.signalNameFocus]}>{SIGNAL_LABELS[signal.signal_key]}</Text>
        <View style={styles.scoreTrack}>
          {signal.score !== null ? <View style={[styles.scoreFill, isSpecificity && styles.scoreFillFocus, { width: `${signal.score}%` }]} /> : null}
        </View>
        <Text style={styles.score}>{signal.score === null ? "—" : Math.round(signal.score)}</Text>
      </View>
      {signal.evidence_summary ? <Text style={styles.signalEvidence}>{signal.evidence_summary}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: "center", paddingHorizontal: GUTTER, gap: 14 },
  scroll: { paddingHorizontal: GUTTER, gap: 12 },
  eyebrow: { ...eyebrow, color: C.purple },
  title: { ...T.display, fontSize: 27, lineHeight: 33 },
  support: { ...T.support, textAlign: "center" },
  returnButton: { marginTop: 12 },
  back: { ...T.support, color: C.textSoft, fontFamily: font.semi, minHeight: 44, textAlignVertical: "center" },
  exchange: { backgroundColor: C.elevated, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 17, ...shadow.layer },
  exchangeRow: { gap: 5, paddingVertical: 13 },
  exchangeRowDivided: { borderBottomWidth: 1, borderBottomColor: C.line },
  nodeLabel: { ...eyebrow, color: C.purple, fontSize: 9 },
  pushLabel: { color: C.amber },
  quote: { ...T.support, color: C.text, fontSize: 14, lineHeight: 21 },
  observation: { ...T.support, color: C.textSoft, lineHeight: 21 },
  stallCard: { borderRadius: 17, borderWidth: 1, borderColor: `${C.purple}22`, backgroundColor: `${C.purple}0C`, paddingHorizontal: 15, paddingVertical: 13 },
  stallText: { ...T.support, color: C.text, lineHeight: 21 },
  stallLead: { color: C.purple, fontFamily: font.semi },
  focusEyebrow: { ...eyebrow, color: C.purple, fontSize: 9 },
  focusTitle: { ...T.title, fontSize: 19, lineHeight: 24, marginTop: 4 },
  focusSummary: { ...T.support, color: C.textSoft, fontSize: 14, lineHeight: 21, marginTop: 5 },
  dockPromise: { ...T.caption, color: C.textSoft, textAlign: "center", marginTop: 7, paddingHorizontal: 8 },
  baselineAction: { marginTop: 4, marginBottom: 8 },
  baselineCard: { backgroundColor: C.elevated, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 17, gap: 10, ...shadow.layer },
  startingIndexSummary: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 14 },
  startingIndexCopy: { flex: 1, gap: 3 },
  startingIndexScope: { ...T.caption, color: C.textSoft },
  startingIndexBadge: { minWidth: 70, height: 64, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 19, borderWidth: 1, borderColor: `${C.purple}24`, backgroundColor: `${C.purple}08` },
  startingIndexValue: { fontFamily: font.bold, fontSize: 34, lineHeight: 38, color: C.purple },
  baselineScope: { ...T.caption, color: C.dim },
  signalChips: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  signalChip: { borderRadius: 999, backgroundColor: "rgba(255,255,255,0.34)", borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong, paddingHorizontal: 11, paddingVertical: 6 },
  signalChipText: { ...T.caption, color: C.textSoft, fontSize: 12 },
  rewriteHeroSpace: { height: 96 },
  rewriteCard: { backgroundColor: C.elevated, borderRadius: 24, padding: 20, gap: 16, ...shadow.layer },
  rewriteEyebrow: { ...eyebrow, color: C.purple, fontSize: 11 },
  originalBlock: { borderLeftWidth: 3, borderLeftColor: `${C.amber}55`, paddingLeft: 12, gap: 5 },
  originalQuote: { ...T.body, color: C.textSoft },
  clearerBlock: { borderLeftWidth: 3, borderLeftColor: C.purple, paddingLeft: 12, gap: 5 },
  clearerLabel: { color: C.purple },
  clearerQuote: { ...T.title, fontSize: 20, lineHeight: 28 },
  rewriteNote: { ...T.support, color: C.dim, marginTop: 2 },
  rewriteDivider: { height: 1, backgroundColor: C.line, marginTop: 14 },
  detailLabel: { ...eyebrow, color: C.dim, fontSize: 9 },
  comparison: { backgroundColor: C.elevated, borderRadius: 24, paddingHorizontal: 20, paddingVertical: 18, ...shadow.layer },
  shiftSection: { gap: 9 },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 16 },
  shiftLabel: { ...eyebrow, fontSize: 10, lineHeight: 14 },
  shiftText: { color: C.textSoft, fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  shiftStrong: { fontFamily: font.semi },
  improvementCard: { backgroundColor: C.elevated, borderRadius: 24, padding: 18, ...shadow.layer },
  improvementLabel: { ...eyebrow, color: C.purple, fontSize: 10 },
  graphCanvas: { height: 190, marginTop: 10 },
  practiceBadge: { position: "absolute", right: 2, top: 0, borderRadius: 10, backgroundColor: C.purple, paddingHorizontal: 12, paddingVertical: 7 },
  practiceBadgeText: { fontFamily: font.semi, fontSize: 10, color: C.onAccent },
  loopBadge: { position: "absolute", right: 2, bottom: 25, borderRadius: 10, borderWidth: 1, borderColor: `${C.amber}55`, backgroundColor: "#F8F4EC", paddingHorizontal: 11, paddingVertical: 6 },
  loopBadgeText: { fontFamily: font.semi, fontSize: 10, color: C.amber },
  graphAxis: { flexDirection: "row", justifyContent: "space-between", marginTop: -2 },
  graphAxisText: { ...eyebrow, color: C.purple, fontSize: 9 },
  graphCaption: { ...T.caption, fontFamily: font.semi, color: C.text, textAlign: "center", marginTop: 12 },
  layerCard: { borderRadius: 26, backgroundColor: C.elevated, padding: 18, gap: 11, ...shadow.layer },
  pathCard: { justifyContent: "flex-start" },
  cardTitle: { ...T.title, fontSize: 18 },
  indexRow: { flexDirection: "row", alignItems: "center", gap: 13 },
  indexScoreBadge: { minWidth: 74, height: 68, paddingHorizontal: 12, alignItems: "center", justifyContent: "center", borderRadius: 20, borderWidth: 1, borderColor: `${C.purple}24`, backgroundColor: `${C.purple}08` },
  indexCopy: { flex: 1 },
  indexValue: { fontFamily: font.bold, fontSize: 36, lineHeight: 40, color: C.purple },
  indexCount: { ...T.caption, color: C.dim },
  averageNote: { ...T.caption, color: C.textSoft, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  groupLabel: { ...eyebrow, fontSize: 9, color: C.dim },
  emptyEvidence: { ...T.caption, color: C.textSoft },
  signalBlock: { gap: 6, borderRadius: 16, backgroundColor: `${C.purple}08`, paddingHorizontal: 12, paddingVertical: 11 },
  signalBlockFocus: { backgroundColor: `${C.amber}0D`, borderWidth: 1, borderColor: `${C.amber}35` },
  signalRow: { minHeight: 24, flexDirection: "row", alignItems: "center", gap: 9 },
  signalEvidence: { ...T.caption, color: C.textSoft, fontSize: 12, lineHeight: 17 },
  signalName: { ...T.caption, color: C.text, fontFamily: font.medium, width: 78 },
  signalNameFocus: { color: C.amber },
  scoreTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: "rgba(23,26,31,0.08)", overflow: "hidden" },
  scoreFill: { height: 6, borderRadius: 3, backgroundColor: C.purple },
  scoreFillFocus: { backgroundColor: `${C.amber}B8` },
  score: { ...T.caption, width: 28, color: C.text, fontFamily: font.semi, textAlign: "right" },
  cardAction: { marginTop: "auto" },
  pathLead: { ...T.body, fontFamily: font.semi, color: C.purple },
  pathEvidence: { ...T.caption, color: C.textSoft },
  path: { marginTop: 4 },
  pathRow: { flexDirection: "row", minHeight: 58 },
  pathRail: { width: 22, alignItems: "center" },
  pathDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: C.lineStrong, backgroundColor: C.elevated },
  pathDotOn: { backgroundColor: C.purple, borderColor: C.purple },
  pathLine: { flex: 1, width: 1.5, borderLeftWidth: 1.5, borderStyle: "dashed", borderColor: `${C.purple}55` },
  pathCopy: { flex: 1, paddingBottom: 14 },
  pathName: { ...T.support, color: C.dim },
  pathNameOn: { color: C.text, fontFamily: font.semi },
  pathDays: { ...T.caption, color: C.dim },
  reverseCard: { ...T.caption, minHeight: 44, color: C.purple, fontFamily: font.semi, textAlign: "center", textAlignVertical: "center" },
  continueButton: { marginTop: 2 },
});
