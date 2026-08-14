import { useRouter } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, PrimaryButton, PressCard, StateDock, tap, useReducedMotion } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, shadow } from "@/constants/theme";
import { CONVERSATION_PHASES } from "@/lib/conversion";
import type { ActivePracticeSession, FreeJourneyCheckpoint } from "@/lib/practiceSession";
import { completedPracticeSessionToSharedTranscript } from "@/lib/sharedProductAdapters";
import { useStore } from "@/providers/store";
import type { PracticeShiftV1, SharedSignalV1 } from "@/types/sharedProduct";

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
  const [expanded, setExpanded] = useState<boolean>(false);
  const [resultCard, setResultCard] = useState<ResultCard>("index");
  const cardProgress = useRef<Animated.Value>(new Animated.Value(1)).current;
  const cardDirection = useRef<1 | -1>(1);
  const result = session.sharedResult;
  const checkpoint: FreeJourneyCheckpoint = session.freeJourneyCheckpoint ?? "pressure_moment";

  const move = useCallback(async (next: FreeJourneyCheckpoint): Promise<void> => {
    tap("medium");
    await saveActivePracticeSession({ ...session, freeJourneyCheckpoint: next, updatedAt: Date.now() });
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
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 26, paddingBottom: insets.bottom + 150 }]}>
          <Text style={styles.eyebrow}>YOUR PRESSURE MOMENT</Text>
          <Text style={styles.title}>{moment.headline}</Text>
          <View style={styles.exchange}>
            <ExchangeNode label="Your ask" text={byId.get(moment.opening_turn_id) ?? ""} tone="you" />
            <ExchangeNode label="The pushback" text={byId.get(moment.pushback_turn_id) ?? ""} tone="push" />
            <ExchangeNode label="Your response" text={byId.get(moment.pressure_response_turn_id) ?? ""} tone="you" last />
          </View>
          <Text style={styles.observation}>{moment.observation}</Text>
          <PressCard onPress={() => setExpanded((value) => !value)} accessibilityLabel="How BYSI read this">
            <View style={styles.disclosure}>
              <Text style={styles.disclosureText}>How BYSI read this</Text>
              {expanded ? <ChevronUp size={17} color={C.purple} /> : <ChevronDown size={17} color={C.purple} />}
            </View>
          </PressCard>
          {expanded ? (
            <View style={styles.details}>
              <Detail label="Observed" text={moment.observation} />
              <Detail label="Why it matters here" text={moment.why_it_matters} />
              <Detail label="Confidence" text={moment.confidence_statement} />
            </View>
          ) : null}
        </ScrollView>
        <StateDock bottomInset={insets.bottom}>
          <PrimaryButton label="Show what changes with practice" onPress={() => void move("rewrite")} />
          <Text style={styles.dockPromise}>See your same ask rewritten as one specific request you could actually say.</Text>
        </StateDock>
      </View>
    );
  }

  if (checkpoint === "rewrite") {
    const rewrite = result.rewrite ?? { original_ask: byId.get(result.pressure_moment.opening_turn_id) ?? "", clearer_version: session.recommendation?.immediateAction ?? result.practice_shift.practice_target_steps[1] ?? "" };
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 150 }]}>
          <PressCard onPress={() => void move("pressure_moment")} accessibilityLabel="Back to Pressure Moment"><Text style={styles.back}>Back</Text></PressCard>
          <Text style={styles.eyebrow}>YOUR WORDS, MADE USABLE</Text>
          <Text style={styles.title}>Here’s what practice is helping you say</Text>
          <View style={styles.rewriteCard}>
            <Detail label="Your original ask" text={`“${rewrite.original_ask}”`} />
            <View style={styles.rewriteDivider} />
            <Detail label="A clearer version" text={`“${rewrite.clearer_version}”`} />
          </View>
          <Text style={styles.observation}>Practice is what makes this version come out when they push back. That is what the practice plan trains.</Text>
        </ScrollView>
        <StateDock bottomInset={insets.bottom}><PrimaryButton label="See the practice plan" onPress={() => void move("practice_shift")} /></StateDock>
      </View>
    );
  }

  if (checkpoint === "practice_shift") {
    return (
      <View style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 150 }]}>
          <PressCard onPress={() => void move("rewrite")} accessibilityLabel="Back to clearer version">
            <Text style={styles.back}>Back</Text>
          </PressCard>
          <Text style={styles.eyebrow}>YOUR PRACTICE SHIFT</Text>
          <Text style={styles.title}>{result.practice_shift.headline}</Text>
          <ShiftComparison shift={result.practice_shift} />
          <View style={styles.goal}>
            <Text style={styles.detailLabel}>YOUR GOAL</Text>
            <Text style={styles.goalText}>{result.practice_shift.success_target}</Text>
          </View>
          <Text style={styles.caveat}>{result.practice_shift.caveat}</Text>
        </ScrollView>
        <StateDock bottomInset={insets.bottom}>
          <PrimaryButton label="See my Starting Index" onPress={() => void move("starting_index")} />
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
                <Text style={styles.indexValue}>{result.starting_index.index_value ?? "—"}</Text>
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
              <Text style={styles.groupLabel}>NOT OBSERVED YET</Text>
              {unobservedSignals.map((signal) => <SignalRow key={signal.signal_key} signal={signal} />)}
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
                  await saveActivePracticeSession({ ...session, freeJourneyCheckpoint: "complete", updatedAt: Date.now() });
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
    <View style={styles.exchangeRow}>
      <View style={styles.exchangeRail}>
        <View style={[styles.exchangeDot, tone === "push" && styles.exchangeDotPush]} />
        {!last ? <View style={styles.exchangeLine} /> : null}
      </View>
      <View style={styles.exchangeCopy}>
        <Text style={[styles.nodeLabel, tone === "push" && styles.pushLabel]}>{label}</Text>
        <Text style={styles.quote}>“{text}”</Text>
      </View>
    </View>
  );
}

function Detail({ label, text }: { label: string; text: string }) {
  return <View style={styles.detail}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailText}>{text}</Text></View>;
}

function ShiftComparison({ shift }: { shift: PracticeShiftV1 }) {
  return (
    <View style={styles.comparison}>
      <ShiftColumn label="WITHOUT PRACTICE" steps={shift.current_pattern_steps} tone={C.amber} />
      <View style={styles.divider} />
      <ShiftColumn label="WITH BYSI PRACTICE" steps={shift.practice_target_steps} tone={C.purple} />
    </View>
  );
}

function ShiftColumn({ label, steps, tone }: { label: string; steps: string[]; tone: string }) {
  return (
    <View style={styles.shiftColumn}>
      <Text style={[styles.shiftLabel, { color: tone }]}>{label}</Text>
      {steps.map((step, index) => (
        <React.Fragment key={`${label}-${index}`}>
          <View style={styles.shiftStep}>
            <View style={[styles.smallDot, { backgroundColor: tone }]} />
            <Text style={styles.shiftText}>{step}</Text>
          </View>
          {index < steps.length - 1 ? <Text style={[styles.shiftArrow, { color: tone }]}>↓</Text> : null}
        </React.Fragment>
      ))}
    </View>
  );
}

function SignalRow({ signal }: { signal: SharedSignalV1 }) {
  return (
    <View style={styles.signalRow}>
      <Text style={styles.signalName}>{SIGNAL_LABELS[signal.signal_key]}</Text>
      {signal.score === null ? (
        <><View style={styles.dashedTrack} /><Text style={styles.notObserved}>Not observed</Text></>
      ) : (
        <><View style={styles.scoreTrack}><View style={[styles.scoreFill, { width: `${signal.score}%` }]} /></View><Text style={styles.score}>{Math.round(signal.score)}</Text></>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { justifyContent: "center", paddingHorizontal: GUTTER, gap: 14 },
  scroll: { paddingHorizontal: GUTTER, gap: 14 },
  eyebrow: { ...eyebrow, color: C.purple },
  title: { ...T.display },
  support: { ...T.support, textAlign: "center" },
  returnButton: { marginTop: 12 },
  back: { ...T.support, color: C.textSoft, fontFamily: font.semi, minHeight: 44, textAlignVertical: "center" },
  exchange: { backgroundColor: C.elevated, borderRadius: 24, padding: 20, ...shadow.layer },
  exchangeRow: { flexDirection: "row", gap: 12 },
  exchangeRail: { width: 12, alignItems: "center" },
  exchangeDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.purple, marginTop: 5 },
  exchangeDotPush: { backgroundColor: C.amber },
  exchangeLine: { flex: 1, width: 1, minHeight: 28, backgroundColor: C.lineStrong },
  exchangeCopy: { flex: 1, paddingBottom: 15, gap: 5 },
  nodeLabel: { ...eyebrow, color: C.purple, fontSize: 9 },
  pushLabel: { color: C.amber },
  quote: { ...T.support, color: C.text },
  observation: { ...T.support, color: C.textSoft },
  dockPromise: { ...T.caption, color: C.textSoft, textAlign: "center" },
  rewriteCard: { backgroundColor: C.elevated, borderRadius: 24, padding: 20, gap: 16, ...shadow.layer },
  rewriteDivider: { height: 1, backgroundColor: C.line },
  disclosure: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  disclosureText: { ...T.caption, color: C.purple, fontFamily: font.semi },
  details: { gap: 13, paddingLeft: 13, borderLeftWidth: 2, borderLeftColor: `${C.purple}3D` },
  detail: { gap: 4 },
  detailLabel: { ...eyebrow, color: C.dim, fontSize: 9 },
  detailText: { ...T.support, color: C.text },
  comparison: { flexDirection: "row", gap: 10, backgroundColor: C.elevated, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 16, ...shadow.layer },
  shiftColumn: { flex: 1, minWidth: 0, gap: 5 },
  divider: { width: 1, backgroundColor: C.line, marginHorizontal: 1 },
  shiftLabel: { ...eyebrow, fontSize: 8, lineHeight: 12, minHeight: 25 },
  shiftStep: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
  smallDot: { width: 6, height: 6, borderRadius: 3, marginTop: 6, flexShrink: 0 },
  shiftText: { flex: 1, minWidth: 0, color: C.text, fontFamily: font.regular, fontSize: 13, lineHeight: 18 },
  shiftArrow: { fontFamily: font.semi, fontSize: 12, lineHeight: 13, marginLeft: 11 },
  goal: { gap: 4 },
  goalText: { ...T.support, color: C.text },
  caveat: { ...T.caption, color: C.dim },
  layerCard: { minHeight: 470, borderRadius: 28, backgroundColor: C.elevated, padding: 22, gap: 12, ...shadow.layer },
  pathCard: { justifyContent: "flex-start" },
  cardTitle: { ...T.title, fontSize: 18 },
  indexRow: { flexDirection: "row", alignItems: "flex-end", gap: 13 },
  indexCopy: { flex: 1, paddingBottom: 4 },
  indexValue: { fontFamily: font.bold, fontSize: 42, lineHeight: 46, color: C.purple },
  indexCount: { ...T.caption, color: C.dim },
  averageNote: { ...T.caption, color: C.textSoft, paddingBottom: 11, borderBottomWidth: 1, borderBottomColor: C.line },
  groupLabel: { ...eyebrow, fontSize: 9, color: C.dim },
  emptyEvidence: { ...T.caption, color: C.textSoft },
  signalRow: { minHeight: 26, flexDirection: "row", alignItems: "center", gap: 9 },
  signalName: { ...T.caption, color: C.text, width: 78 },
  dashedTrack: { flex: 1, height: 6, borderRadius: 3, borderWidth: 1, borderStyle: "dashed", borderColor: C.lineStrong },
  notObserved: { ...T.caption, fontSize: 11, width: 78, textAlign: "right" },
  scoreTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: C.track, overflow: "hidden" },
  scoreFill: { height: 6, backgroundColor: C.purple },
  score: { ...T.caption, width: 28, textAlign: "right" },
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
