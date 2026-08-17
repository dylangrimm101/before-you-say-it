import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Lock } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FreeJourneyResults } from "@/components/FreeJourneyResults";
import {
  Backdrop,
  Eyebrow,
  GlassCard,
  HeroSurface,
  PrimaryButton,
  PressCard,
  StateDock,
  tap,
  useReducedMotion,
} from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { CURRICULUM_MODULES, curriculumModule, type ModuleId } from "@/constants/modules";
import {
  CONVERSATION_PHASES,
  conversionEvidence,
} from "@/lib/conversion";
import {
  getConversionBuild,
  subscribeConversionBuild,
  type ConversionBuild,
  type ConversionEvent,
} from "@/lib/conversionBuild";
import { getLiveSessionContent } from "@/lib/ephemeral";
import { cancelPendingResult } from "@/lib/freeJourney";
import { useIsPro } from "@/lib/purchases";
import { safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";

const PIPELINE_ROWS: { event: ConversionEvent; label: string }[] = [
  { event: "transcript.confirmed", label: "Reading your pressure pattern" },
  { event: "exchange.paired", label: "Finding where the conversation stalled" },
  { event: "skill.identified", label: "Choosing the first skill to train" },
  { event: "path.mapped", label: "Finalizing your report" },
];

function quote(text: string): string {
  const clean = text.trim();
  return clean.length > 0 ? `“${clean}”` : "";
}

type PipelineStatus = "queued" | "active" | "done";

function statusOf(index: number, completedCount: number): PipelineStatus {
  if (index < completedCount) return "done";
  if (index === completedCount) return "active";
  return "queued";
}

function ReferencePipelineRow({ label, status }: { label: string; status: PipelineStatus }) {
  const progress = status === "done" ? 100 : status === "active" ? 8 : 0;
  return (
    <View style={[styles.referencePipelineRow, status === "queued" && styles.referencePipelineQueued]}>
      <View style={styles.referencePipelineHead}>
        <Text style={[styles.referencePipelineLabel, status === "active" && styles.referencePipelineActive]}>{label}</Text>
        {status === "done" ? (
          <View style={styles.referencePipelineCheck}><Check size={13} color={C.onAccent} strokeWidth={2.7} /></View>
        ) : status === "active" ? (
          <Text style={styles.referencePipelinePercent}>{progress}%</Text>
        ) : (
          <View style={styles.referencePipelineCircle} />
        )}
      </View>
      <View style={styles.referencePipelineTrack}>
        <View style={[styles.referencePipelineFill, { width: `${progress}%` }]} />
      </View>
    </View>
  );
}

function Artifact({ children, duration = 380 }: { children: React.ReactNode; duration?: number }) {
  const isReduced = useReducedMotion();
  const value = useRef<Animated.Value>(new Animated.Value(isReduced ? 1 : 0)).current;

  useEffect(() => {
    if (isReduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [duration, isReduced, value]);

  return (
    <Animated.View
      accessibilityLiveRegion="none"
      style={{
        opacity: value,
        transform: [{ translateY: value.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
}

function PlanBuildScreen({ build, onReady }: { build: ConversionBuild; onReady: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isReduced = useReducedMotion();
  const [completedCount, setCompletedCount] = useState<number>(0);
  const stageProgress = useRef<Animated.Value>(new Animated.Value(0)).current;
  const screenOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;

  useEffect(() => {
    safeLog("[evidence] native post-rehearsal screen", {
      platform: Platform.OS,
      screen: "personalizing",
    });
  }, []);

  const availableCount = Math.min(build.events.length, PIPELINE_ROWS.length);

  useEffect(() => {
    if (completedCount >= availableCount) return;
    if (isReduced) {
      setCompletedCount(availableCount);
      return;
    }

    stageProgress.setValue(0);
    const presentCompletedEvent = Animated.timing(stageProgress, {
      toValue: 1,
      duration: 680,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    presentCompletedEvent.start(({ finished }) => {
      if (finished) setCompletedCount((current) => Math.min(current + 1, availableCount));
    });
    return () => presentCompletedEvent.stop();
  }, [availableCount, completedCount, isReduced, stageProgress]);

  const isReady =
    completedCount === PIPELINE_ROWS.length && build.events.includes("plan.ready");

  const revealDebrief = useCallback(() => {
    if (isReduced) {
      onReady();
      return;
    }
    Animated.sequence([
      Animated.delay(520),
      Animated.timing(screenOpacity, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) onReady();
    });
  }, [isReduced, onReady, screenOpacity]);

  useEffect(() => {
    if (!isReady) return;
    revealDebrief();
  }, [isReady, revealDebrief]);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingTop: insets.top + 24,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View>
          <Text style={styles.buildTitle}>Personalizing your{"\n"}<Text style={styles.buildTitleAccent}>practice plan…</Text></Text>
          <Text style={styles.buildAcknowledgement}>You did the hard part. Practicing it out loud is the step most people skip.</Text>
          <View style={styles.referencePipeline}>
            {PIPELINE_ROWS.map((row, index) => (
              <ReferencePipelineRow key={row.event} label={row.label} status={statusOf(index, completedCount)} />
            ))}
          </View>

          {isReady ? (
            <Artifact duration={320}>
              <Text style={styles.readyTitle}>Your communication baseline is ready</Text>
            </Artifact>
          ) : null}
        </View>
      </ScrollView>

      {build.error ? (
        <StateDock bottomInset={insets.bottom}>
          <Text style={styles.errorText}>{build.error}</Text>
          <PrimaryButton label="Back to today" onPress={() => router.replace("/(tabs)")} />
        </StateDock>
      ) : null}
    </Animated.View>
  );
}

function PhaseGraph() {
  const isReduced = useReducedMotion();
  const heights = [24, 48, 70, 92];
  const animations = useRef<Animated.Value[]>(heights.map(() => new Animated.Value(isReduced ? 1 : 0))).current;

  useEffect(() => {
    if (isReduced) {
      animations.forEach((animation) => animation.setValue(1));
      return;
    }
    const leftToRightBuild = Animated.stagger(
      110,
      animations.map((animation) =>
        Animated.timing(animation, {
          toValue: 1,
          duration: 420,
          easing: Easing.bezier(0.22, 0.9, 0.28, 1),
          useNativeDriver: true,
        }),
      ),
    );
    leftToRightBuild.start();
    return () => leftToRightBuild.stop();
  }, [animations, isReduced]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Four curriculum blocks across eight modules. You start at the recommended module."
      style={styles.graphBlock}
    >
      <View style={styles.graphBars}>
        {CONVERSATION_PHASES.map((phase, index) => {
          const height = heights[index] ?? 0;
          const animation = animations[index];
          return (
            <View key={phase.id} style={styles.barColumn}>
              <Animated.View
                style={[
                  styles.bar,
                  {
                    height,
                    opacity: 1 - index * 0.16,
                    transform: [
                      { translateY: animation.interpolate({ inputRange: [0, 1], outputRange: [height / 2, 0] }) },
                      { scaleY: animation },
                    ],
                  },
                ]}
              >
                {index === 0 ? <View style={styles.startMarker}><View style={styles.startDot} /></View> : null}
              </Animated.View>
            </View>
          );
        })}
      </View>
      <View style={styles.graphLabels}>
        {CONVERSATION_PHASES.map((phase, index) => (
          <View key={phase.id} style={styles.graphLabelColumn}>
            <Text style={[styles.graphDays, index === 0 && styles.graphDaysCurrent]}>{phase.days}</Text>
            {index === 0 ? <Text style={styles.graphCurrentName}>{phase.name}</Text> : null}
          </View>
        ))}
      </View>
      <Text style={styles.phasesNote}>
        Phases 2–4 open as you go: staying open, handling pushback, then using it for real.
      </Text>
    </View>
  );
}

function FreeDebrief({ id, build }: { id: string; build: ConversionBuild | null }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sessions, activePracticeSession, saveActivePracticeSession } = useStore();
  const hasPurchasedPro = useIsPro();
  const [isChanging, setIsChanging] = useState<boolean>(false);
  const session = sessions.find((item) => item.id === id);
  const live = getLiveSessionContent(id);
  const debrief = build?.debrief ?? live?.debrief ?? null;
  const turns = build?.turns ?? live?.turns ?? [];
  const evidence = debrief ? conversionEvidence(turns, debrief, activePracticeSession?.provisionalModuleId) : null;
  const recommendedModuleId: ModuleId | null = activePracticeSession?.recommendation?.moduleId ?? evidence?.focus.id ?? null;
  const recommendedModule = curriculumModule(recommendedModuleId);

  const chooseModule = useCallback(async (moduleId: ModuleId): Promise<void> => {
    if (!activePracticeSession?.recommendation) return;
    await saveActivePracticeSession({
      ...activePracticeSession,
      recommendation: {
        ...activePracticeSession.recommendation,
        moduleId,
        status: moduleId === activePracticeSession.recommendation.moduleId ? "confirmed" : "changed",
      },
      updatedAt: Date.now(),
    });
    setIsChanging(false);
  }, [activePracticeSession, saveActivePracticeSession]);

  const startPlan = useCallback(() => {
    if (!session) return;
    tap("medium");
    // Preview-only access must never skip the commercial conversion step.
    // Only an actual RevenueCat entitlement can bypass the paywall.
    if (!recommendedModuleId) return;
    if (!hasPurchasedPro) {
      router.push({ pathname: "/paywall", params: { gate: "recommended-path", source: "debrief", moduleId: recommendedModuleId } });
      return;
    }
    router.replace({ pathname: "/module/[day]", params: { day: recommendedModuleId } });
  }, [hasPurchasedPro, recommendedModuleId, router, session]);

  if (activePracticeSession?.id === id && activePracticeSession.insufficientEvidence) {
    const insufficient = activePracticeSession.insufficientEvidence;
    const retryAnalysis = async (): Promise<void> => {
      const retrySession = {
        ...activePracticeSession,
        freeRehearsalTurns: undefined,
        freeRehearsalCompletedAt: undefined,
        recommendation: undefined,
        sharedResult: undefined,
        insufficientEvidence: undefined,
        postRehearsalState: undefined,
        freeJourneyCheckpoint: "rehearsal" as const,
        updatedAt: Date.now(),
      };
      await saveActivePracticeSession(retrySession);
      router.replace({
        pathname: "/rehearse/[id]",
        params: {
          id: activePracticeSession.scenarioId,
          entry: "onboarding",
          practiceSessionId: activePracticeSession.id,
          reaction: activePracticeSession.expectedReaction,
          persona: activePracticeSession.persona,
        },
      });
    };
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Eyebrow color={C.purple}>One more complete exchange</Eyebrow>
        <Text style={styles.missingTitle}>{insufficient.headline}</Text>
        <Text style={styles.missingBody}>{insufficient.note}</Text>
        <GlassCard style={styles.insufficientCard} raised={false}>
          <Text style={styles.lockedTitle}>What to do next</Text>
          <Text style={styles.lockedBody}>{insufficient.nextStep}</Text>
        </GlassCard>
        <PrimaryButton label="Practice this conversation again" onPress={() => void retryAnalysis()} style={styles.missingButton} />
      </View>
    );
  }

  if (activePracticeSession?.id === id && activePracticeSession.sharedResult) {
    return <FreeJourneyResults session={activePracticeSession} />;
  }

  if (activePracticeSession?.id === id) {
    const retryResult = async (): Promise<void> => {
      await saveActivePracticeSession(cancelPendingResult(activePracticeSession));
      router.replace({
        pathname: "/rehearse/[id]",
        params: {
          id: activePracticeSession.scenarioId,
          entry: "onboarding",
          practiceSessionId: activePracticeSession.id,
          reaction: activePracticeSession.expectedReaction,
          persona: activePracticeSession.persona,
        },
      });
    };
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Eyebrow color={C.purple}>Your approved exchange is safe</Eyebrow>
        <Text style={styles.missingTitle}>We couldn’t finish your communication baseline.</Text>
        <Text style={styles.missingBody}>No generic debrief has been substituted. Return to the complete transcript and retry the real analysis.</Text>
        <PrimaryButton label="Return to complete transcript" onPress={() => void retryResult()} style={styles.missingButton} />
      </View>
    );
  }

  if (!evidence) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Text style={styles.missingTitle}>This private debrief is no longer available.</Text>
        <Text style={styles.missingBody}>Your completed practice still counts, but the transcript was not stored.</Text>
        <PrimaryButton label="Back to today" onPress={() => router.replace("/(tabs)")} style={styles.missingButton} />
      </View>
    );
  }

  const hasPair = evidence.confidence === "confirmed_quote" && evidence.learnerQuote.length > 0;

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 22,
          paddingHorizontal: GUTTER,
          paddingBottom: 32,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.privateRow}>
          <Text style={styles.privatePractice}>Private practice</Text>
        </View>
        <Eyebrow color={C.dim}>Your starting point</Eyebrow>
        <Text style={styles.debriefTitle}>{recommendedModule ? `Start with ${recommendedModule.name}` : evidence.focus.headline}</Text>

        {hasPair ? (
          <View style={styles.beforeAfter}>
            <View style={styles.beforeCard}>
              <Text style={[eyebrow, styles.beforeLabel]}>You said</Text>
              <Text style={styles.pairQuote}>{quote(evidence.learnerQuote)}</Text>
              <Text style={styles.beforeNote}>{evidence.focus.beforeNote}</Text>
            </View>
            <View style={styles.afterCard}>
              <Text style={[eyebrow, styles.afterLabel]}>One adjustment</Text>
              <Text style={styles.pairQuote}>{evidence.immediateAction}</Text>
              <Text style={styles.afterNote}>{evidence.focus.afterNote}</Text>
            </View>
          </View>
        ) : (
          <GlassCard style={styles.lockedCard} raised={false}>
            <Text style={styles.lockedTitle}>I couldn’t verify one exact quote with enough confidence.</Text>
            <Text style={styles.lockedBody}>Your intake gives us a starting point, but you can choose a different module below.</Text>
          </GlassCard>
        )}

        {evidence.supportedStrength ? <Text style={styles.curriculumNote}>Supported strength: {evidence.supportedStrength}</Text> : null}

        <PhaseGraph />

        <HeroSurface style={styles.focusCard}>
          <Text style={[eyebrow, styles.heroEyebrow]}>Recommended starting module</Text>
          <Text style={styles.focusName}>{recommendedModule?.name ?? evidence.focus.name}</Text>
          <Text style={styles.focusBody}>{evidence.focus.body}</Text>
        </HeroSurface>

        <GlassCard style={styles.lockedCard}>
          <View style={styles.lockedHead}>
            <Lock size={17} color={C.purple} />
            <Text style={styles.lockedTitle}>Practice, not more static advice</Text>
          </View>
          <Text style={styles.lockedBody}>Hope teaches one move, Adam responds, and you retry the same moment before comparing the two attempts.</Text>
        </GlassCard>

        <PressCard onPress={() => setIsChanging((value) => !value)} accessibilityLabel="Change recommended module">
          <Text style={styles.changeLink}>{isChanging ? "Keep this recommendation" : "This isn’t the right starting point"}</Text>
        </PressCard>
        {isChanging ? <View style={styles.moduleChoices}>{CURRICULUM_MODULES.map((module) => <PressCard key={module.id} onPress={() => void chooseModule(module.id)}><View style={[styles.moduleChoice, module.id === recommendedModuleId && styles.moduleChoiceOn]}><Text style={styles.moduleChoiceNumber}>{module.number}</Text><Text style={styles.moduleChoiceText}>{module.name}</Text></View></PressCard>)}</View> : null}

        <Text style={styles.curriculumNote}>
          The eight modules are available to browse. Your rehearsal recommends where to start; you stay in control of the choice.
        </Text>
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        <PrimaryButton label="See my recommended practice path" onPress={startPlan} />
        <Text style={styles.freeNote}>This debrief stays yours for free.</Text>
      </StateDock>
    </View>
  );
}

export default function DebriefScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const sessionId = String(id);
  const [showDebrief, setShowDebrief] = useState<boolean>(false);
  const getSnapshot = useCallback(() => getConversionBuild(sessionId), [sessionId]);
  const build = useSyncExternalStore(subscribeConversionBuild, getSnapshot, getSnapshot);
  const live = getLiveSessionContent(sessionId);
  const ready = build?.events.includes("plan.ready") ?? false;

  // Historical navigation has no active build; when live content exists, open
  // directly to its debrief rather than replaying a loading sequence.
  const shouldBuild = build !== null && !showDebrief;
  const shouldShowDebrief = showDebrief || (build === null && live !== null);

  if (shouldBuild) {
    return <PlanBuildScreen build={build} onReady={() => setShowDebrief(true)} />;
  }
  if (shouldShowDebrief || ready) {
    return <FreeDebrief id={sessionId} build={build} />;
  }
  return <FreeDebrief id={sessionId} build={null} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  center: { alignItems: "center", justifyContent: "center", padding: 30 },
  privateRow: { alignItems: "flex-end", minHeight: 24 },
  privatePractice: { ...eyebrow, color: C.dim },
  buildTitle: { ...T.display, fontFamily: font.bold, fontSize: 32, lineHeight: 40, textAlign: "center" },
  buildTitleAccent: { color: C.purple },
  buildAcknowledgement: { ...T.support, fontSize: 16, lineHeight: 24, color: C.textSoft, textAlign: "center", marginTop: 12, marginHorizontal: 4 },
  referencePipeline: { gap: 22, marginTop: 30 },
  referencePipelineRow: { gap: 10 },
  referencePipelineQueued: { opacity: 0.42 },
  referencePipelineHead: { minHeight: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  referencePipelineLabel: { ...T.support, flex: 1, color: C.textSoft, fontFamily: font.semi, fontSize: 16 },
  referencePipelineActive: { color: C.text },
  referencePipelinePercent: { ...T.support, color: C.purple, fontFamily: font.semi },
  referencePipelineCircle: { width: 26, height: 26, borderRadius: 13, borderWidth: 1, borderColor: C.lineStrong },
  referencePipelineCheck: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: C.purple },
  referencePipelineTrack: { height: 8, borderRadius: 4, backgroundColor: "rgba(81,40,136,0.07)", overflow: "hidden" },
  referencePipelineFill: { height: 8, borderRadius: 4, backgroundColor: C.purple },
  artifactCard: { marginTop: 10, borderRadius: radius.md, padding: 15 },
  confirmed: { color: C.dim },
  artifactQuote: { ...T.support, color: C.text, marginTop: 7 },
  exchange: { marginTop: 9, gap: 7 },
  exchangeRow: { flexDirection: "row", gap: 9 },
  speaker: { ...eyebrow, color: C.dim, width: 58, paddingTop: 2 },
  exchangeText: { ...T.caption, color: C.textSoft, flex: 1 },
  skillArtifact: { marginTop: 10, borderRadius: radius.md, padding: 14 },
  focusEyebrow: { color: C.purple },
  skillArtifactName: { ...T.support, fontFamily: font.semi, color: C.text, marginTop: 4 },
  pathArtifact: { marginTop: 9, gap: 7 },
  pathArtifactRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  pathDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.track },
  pathDotCurrent: { backgroundColor: C.purple },
  pathName: { ...T.caption, color: C.text, flex: 1 },
  pathNameFuture: { color: C.dim },
  pathDays: { ...T.caption, color: C.dim },
  readyTitle: { ...T.title, marginTop: 20 },
  readySupport: { ...T.support, marginTop: 6 },
  errorText: { ...T.support, color: C.clay, textAlign: "center", marginBottom: 10 },
  debriefTitle: { ...T.display, marginTop: 8 },
  beforeAfter: { flexDirection: "row", gap: 9, marginTop: 20 },
  beforeCard: { flex: 1, minHeight: 160, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.30)", padding: 14 },
  afterCard: { flex: 1, minHeight: 160, borderRadius: radius.md, borderWidth: 1, borderColor: `${C.purple}55`, backgroundColor: C.surfaceHigh, padding: 14, ...shadow.layer },
  beforeLabel: { color: C.dim },
  afterLabel: { color: C.purple },
  pairQuote: { ...T.support, color: C.text, marginTop: 8, flexGrow: 1 },
  beforeNote: { ...T.caption, color: C.dim, marginTop: 12 },
  afterNote: { ...T.caption, color: C.purple, marginTop: 12 },
  graphBlock: { marginTop: 25 },
  graphBars: { height: 96, flexDirection: "row", alignItems: "flex-end", gap: 8 },
  barColumn: { flex: 1, height: 96, justifyContent: "flex-end" },
  bar: { width: "100%", backgroundColor: C.purple, borderTopLeftRadius: 7, borderTopRightRadius: 7 },
  graphLabels: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  graphLabelColumn: { flex: 1, minWidth: 0 },
  startMarker: { position: "absolute", top: "40%", left: "50%", width: 14, height: 14, marginLeft: -7, borderRadius: 7, borderWidth: 2, borderColor: C.onAccent, alignItems: "center", justifyContent: "center" },
  startDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.onAccent },
  graphDays: { fontFamily: font.semi, fontSize: 11, lineHeight: 16, color: C.dim, marginTop: 8 },
  graphDaysCurrent: { color: C.purple },
  graphCurrentName: { fontFamily: font.semi, fontSize: 12, lineHeight: 16, color: C.text, marginTop: 2 },
  phasesNote: { ...T.caption, marginTop: 14 },
  focusCard: { marginTop: 24 },
  heroEyebrow: { color: "rgba(255,255,255,0.76)" },
  focusName: { ...T.title, color: C.onAccent, fontSize: 24, lineHeight: 30, marginTop: 8 },
  focusBody: { ...T.support, color: "rgba(255,255,255,0.84)", marginTop: 9 },
  lockedCard: { marginTop: 22, borderRadius: radius.md, padding: 18 },
  lockedHead: { flexDirection: "row", alignItems: "center", gap: 9 },
  lockedTitle: { ...T.support, fontFamily: font.semi, color: C.text, flex: 1 },
  lockedBody: { ...T.support, marginTop: 10 },
  curriculumNote: { ...T.caption, marginTop: 22, marginBottom: 8 },
  changeLink: { ...T.support, color: C.purple, fontFamily: font.semi, textAlign: "center", minHeight: 48, lineHeight: 48, marginTop: 8 },
  moduleChoices: { gap: 8, marginTop: 4 },
  moduleChoice: { minHeight: 54, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 15, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface },
  moduleChoiceOn: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  moduleChoiceNumber: { ...eyebrow, color: C.purple, width: 20 },
  moduleChoiceText: { ...T.support, color: C.text, flex: 1 },
  freeNote: { ...T.caption, textAlign: "center", marginTop: 8 },
  missingTitle: { ...T.title, textAlign: "center" },
  missingBody: { ...T.support, textAlign: "center", marginTop: 10 },
  missingButton: { width: 260, marginTop: 22 },
  insufficientCard: { width: "100%", marginTop: 18, padding: 18 },
});
