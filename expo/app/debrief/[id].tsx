import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Lock } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
  type ConversionEvidence,
} from "@/lib/conversion";
import {
  getConversionBuild,
  subscribeConversionBuild,
  type ConversionBuild,
  type ConversionEvent,
} from "@/lib/conversionBuild";
import { getLiveSessionContent } from "@/lib/ephemeral";
import { useIsPro } from "@/lib/purchases";
import { useStore } from "@/providers/store";
import type { Turn } from "@/types/convo";

const PIPELINE_ROWS: { event: ConversionEvent; label: string }[] = [
  { event: "transcript.confirmed", label: "Reviewing what you said" },
  { event: "exchange.paired", label: "Looking at your opener and the response together" },
  { event: "skill.identified", label: "Identifying the skill to build first" },
  { event: "path.mapped", label: "Mapping your recommended practice path" },
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

function ProgressSegment({ filled }: { filled: boolean }) {
  const isReduced = useReducedMotion();
  const value = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    if (!filled) return;
    if (isReduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: 420,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [filled, isReduced, value]);

  return (
    <View style={styles.segmentTrack}>
      <Animated.View
        style={[
          styles.segmentFill,
          { transformOrigin: "left center", transform: [{ scaleX: value }] },
        ]}
      />
    </View>
  );
}

function SegmentProgress({ completedCount }: { completedCount: number }) {
  return (
    <View
      style={styles.segments}
      accessibilityRole="progressbar"
      accessibilityValue={{
        min: 0,
        max: PIPELINE_ROWS.length,
        now: completedCount,
        text: `${completedCount} of ${PIPELINE_ROWS.length} complete`,
      }}
    >
      {PIPELINE_ROWS.map((row, index) => (
        <ProgressSegment key={row.event} filled={index < completedCount} />
      ))}
    </View>
  );
}

function WaitingDots() {
  const values = useRef<Animated.Value[]>([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  useEffect(() => {
    const loops = values.map((value, index) => {
      const remainingDelay = Math.max(0, 320 - index * 160);
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 160),
          Animated.timing(value, {
            toValue: 1,
            duration: 440,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 440,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(remainingDelay),
        ]),
      );
    });
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [values]);

  return (
    <View style={styles.waitingDots} accessibilityLabel="Working">
      {values.map((value, index) => (
        <Animated.View
          key={index}
          style={[
            styles.waitingDot,
            {
              opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
              transform: [
                { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

function TranscriptArtifact({ turns }: { turns: Turn[] }) {
  const learnerQuote = turns.find((turn) => turn.role === "user")?.text ?? "";
  if (!learnerQuote) return null;
  return (
    <GlassCard style={styles.artifactCard} raised={false}>
      <Text style={[eyebrow, styles.confirmed]}>Confirmed</Text>
      <Text style={styles.artifactQuote}>{quote(learnerQuote)}</Text>
    </GlassCard>
  );
}

function ExchangeArtifact({ build }: { build: ConversionBuild }) {
  const learner = build.turns.find((turn) => turn.role === "user")?.text ?? "";
  const counterpart = build.turns.find((turn) => turn.role === "them")?.text ?? "";
  if (!learner || !counterpart) return null;
  return (
    <View style={styles.exchange}>
      <View style={styles.exchangeRow}>
        <Text style={styles.speaker}>You</Text>
        <Text style={styles.exchangeText}>{quote(learner)}</Text>
      </View>
      <View style={styles.exchangeRow}>
        <Text style={styles.speaker}>{build.counterpartName}</Text>
        <Text style={styles.exchangeText}>{quote(counterpart)}</Text>
      </View>
    </View>
  );
}

function SkillArtifact({ evidence }: { evidence: ConversionEvidence | null }) {
  if (!evidence) return null;
  return (
    <GlassCard style={styles.skillArtifact} raised={false}>
      <Text style={[eyebrow, styles.focusEyebrow]}>First skill</Text>
      <Text style={styles.skillArtifactName}>{evidence.focus.name}</Text>
    </GlassCard>
  );
}

function PathArtifact() {
  return (
    <View style={styles.pathArtifact}>
      {CONVERSATION_PHASES.map((phase, index) => (
        <View key={phase.id} style={styles.pathArtifactRow}>
          <View style={[styles.pathDot, index === 0 && styles.pathDotCurrent]} />
          <Text style={[styles.pathName, index > 0 && styles.pathNameFuture]} numberOfLines={1}>
            {phase.name}
          </Text>
          <Text style={styles.pathDays}>Days {phase.days}</Text>
        </View>
      ))}
    </View>
  );
}

function PipelineArtifact({ row, build, evidence }: {
  row: (typeof PIPELINE_ROWS)[number];
  build: ConversionBuild;
  evidence: ConversionEvidence | null;
}) {
  switch (row.event) {
    case "transcript.confirmed":
      return <TranscriptArtifact turns={build.turns} />;
    case "exchange.paired":
      return <ExchangeArtifact build={build} />;
    case "skill.identified":
      return <SkillArtifact evidence={evidence} />;
    case "path.mapped":
      return <PathArtifact />;
  }
}

function ActiveAnalysis() {
  const isReduced = useReducedMotion();
  const pulse = useRef<Animated.Value>(new Animated.Value(0)).current;
  const scan = useRef<Animated.Value>(new Animated.Value(0)).current;

  useEffect(() => {
    if (isReduced) {
      pulse.setValue(0.55);
      scan.setValue(0.5);
      return;
    }
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    );
    const scanLoop = Animated.loop(
      Animated.timing(scan, {
        toValue: 1,
        duration: 1050,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    pulseLoop.start();
    scanLoop.start();
    return () => {
      pulseLoop.stop();
      scanLoop.stop();
    };
  }, [isReduced, pulse, scan]);

  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.activeAnalysis}
    >
      <Animated.View
        style={[
          styles.activeGlow,
          { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.42] }) },
        ]}
      />
      <Animated.View
        style={[
          styles.scanLine,
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
            transform: [{ translateY: scan.interpolate({ inputRange: [0, 1], outputRange: [-2, 50] }) }],
          },
        ]}
      />
    </View>
  );
}

function PipelineRow({
  row,
  status,
  build,
  evidence,
  isLast,
}: {
  row: (typeof PIPELINE_ROWS)[number];
  status: PipelineStatus;
  build: ConversionBuild;
  evidence: ConversionEvidence | null;
  isLast: boolean;
}) {
  const isReduced = useReducedMotion();
  const rowOpacity = useRef<Animated.Value>(new Animated.Value(status === "queued" ? 0.32 : 1)).current;
  const doneOpacity = useRef<Animated.Value>(new Animated.Value(status === "done" ? 1 : 0)).current;

  useEffect(() => {
    const target = status === "queued" ? 0.32 : 1;
    if (isReduced) {
      rowOpacity.setValue(target);
      return;
    }
    const animation = Animated.timing(rowOpacity, {
      toValue: target,
      duration: 200,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isReduced, rowOpacity, status]);

  useEffect(() => {
    const target = status === "done" ? 1 : 0;
    if (isReduced) {
      doneOpacity.setValue(target);
      return;
    }
    const animation = Animated.timing(doneOpacity, {
      toValue: target,
      duration: 180,
      easing: Easing.bezier(0.22, 0.9, 0.28, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [doneOpacity, isReduced, status]);

  return (
    <Animated.View style={[styles.pipelineRow, { opacity: rowOpacity }]}>
      <View style={styles.markerColumn}>
        {!isLast ? (
          <View style={styles.timelineTrack}>
            <Animated.View
              style={[
                styles.timelineFill,
                { opacity: doneOpacity, transform: [{ scaleY: doneOpacity }] },
              ]}
            />
          </View>
        ) : null}
        <View style={styles.markerFrame}>
          <Animated.View
            style={[
              styles.marker,
              status === "active" && styles.markerActive,
              { opacity: doneOpacity.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) },
            ]}
          />
          <Animated.View style={[styles.markerDone, { opacity: doneOpacity }]}>
            <Check size={13} color={C.sage} strokeWidth={2.7} />
          </Animated.View>
        </View>
      </View>
      <View style={[styles.pipelineContent, status === "active" && styles.pipelineContentActive]}>
        {status === "active" ? <ActiveAnalysis /> : null}
        <Text
          accessibilityLiveRegion={status === "active" ? "polite" : "none"}
          style={[styles.pipelineLabel, status === "active" && styles.pipelineLabelActive]}
        >
          {status === "active" ? `Analyzing · ${row.label}` : row.label}
        </Text>
        {status === "done" ? (
          <Artifact>
            <PipelineArtifact row={row} build={build} evidence={evidence} />
          </Artifact>
        ) : null}
      </View>
    </Animated.View>
  );
}

function PlanBuildScreen({ build, onReady }: { build: ConversionBuild; onReady: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isReduced = useReducedMotion();
  const [completedCount, setCompletedCount] = useState<number>(0);
  const stageProgress = useRef<Animated.Value>(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView | null>(null);
  const isFollowingNewest = useRef<boolean>(true);
  const screenOpacity = useRef<Animated.Value>(new Animated.Value(1)).current;
  const evidence = build.debrief ? conversionEvidence(build.turns, build.debrief) : null;

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
    Animated.timing(screenOpacity, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onReady();
    });
  }, [isReduced, onReady, screenOpacity]);

  return (
    <Animated.View style={[styles.root, { opacity: screenOpacity }]}>
      <Backdrop />
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{
          paddingTop: insets.top + 26,
          paddingHorizontal: GUTTER,
          paddingBottom: insets.bottom + 158,
        }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={({ nativeEvent }) => {
          const distanceFromBottom =
            nativeEvent.contentSize.height -
            nativeEvent.layoutMeasurement.height -
            nativeEvent.contentOffset.y;
          isFollowingNewest.current = distanceFromBottom <= 48;
        }}
        onContentSizeChange={() => {
          if (isFollowingNewest.current) {
            scrollRef.current?.scrollToEnd({ animated: !isReduced });
          }
        }}
      >
        <View>
          <View style={styles.privateRow}>
            <Text style={styles.privatePractice}>Private practice</Text>
          </View>
          <Text style={styles.buildTitle}>Building your communication plan</Text>
          <SegmentProgress completedCount={completedCount} />

          <View style={styles.pipeline}>
            {PIPELINE_ROWS.map((row, index) => (
              <PipelineRow
                key={row.event}
                row={row}
                status={statusOf(index, completedCount)}
                build={build}
                evidence={evidence}
                isLast={index === PIPELINE_ROWS.length - 1}
              />
            ))}
          </View>

          {isReady ? (
            <Artifact duration={320}>
              <Text style={styles.readyTitle}>Your starting point is ready</Text>
              <Text style={styles.readySupport}>
                One moment from your rehearsal, one skill to build, and where it sits in the curriculum.
              </Text>
            </Artifact>
          ) : null}
        </View>
      </ScrollView>

      <StateDock bottomInset={insets.bottom}>
        {build.error ? (
          <>
            <Text style={styles.errorText}>{build.error}</Text>
            <PrimaryButton label="Back to today" onPress={() => router.replace("/(tabs)")} />
          </>
        ) : isReady ? (
          <PrimaryButton label="See what I found" onPress={revealDebrief} />
        ) : (
          <View style={styles.workingRow}>
            {isReduced ? <Text style={styles.workingText}>Working</Text> : <WaitingDots />}
          </View>
        )}
      </StateDock>
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
          paddingBottom: insets.bottom + 148,
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
  buildTitle: { ...T.display, marginTop: 4, maxWidth: 330 },
  segments: { flexDirection: "row", gap: 6, marginTop: 14, marginBottom: 16 },
  segmentTrack: { height: 3, flex: 1, borderRadius: 2, backgroundColor: C.track, overflow: "hidden" },
  segmentFill: { ...StyleSheet.absoluteFillObject, backgroundColor: C.purple },
  pipeline: { gap: 13 },
  pipelineRow: { flexDirection: "row", gap: 10, minHeight: 50 },
  markerColumn: { width: 18, paddingTop: 3, alignItems: "center" },
  timelineTrack: { position: "absolute", top: 20, bottom: -16, width: 2, borderRadius: 1, backgroundColor: C.track, overflow: "hidden" },
  timelineFill: { ...StyleSheet.absoluteFillObject, backgroundColor: C.purple, transformOrigin: "top center" },
  markerFrame: { width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  marker: { position: "absolute", width: 15, height: 15, borderRadius: 8, borderWidth: 1, borderColor: C.lineStrong },
  markerActive: { borderColor: C.purple, borderStyle: "dashed", borderWidth: 1.5 },
  markerDone: { position: "absolute", width: 18, height: 18, alignItems: "center", justifyContent: "center" },
  pipelineContent: { flex: 1, minHeight: 44, paddingVertical: 7, paddingHorizontal: 10, overflow: "hidden", borderRadius: radius.sm },
  pipelineContentActive: { borderWidth: 1, borderColor: `${C.purple}38`, backgroundColor: `${C.purple}0A` },
  activeAnalysis: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  activeGlow: { ...StyleSheet.absoluteFillObject, backgroundColor: `${C.purple}22` },
  scanLine: { position: "absolute", left: 0, right: 0, top: 0, height: 2, backgroundColor: C.purple },
  pipelineLabel: { ...T.support, color: C.dim, zIndex: 1 },
  pipelineLabelActive: { ...T.body, fontFamily: font.semi, color: C.text },
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
  workingRow: { minHeight: 56, alignItems: "center", justifyContent: "center" },
  workingText: { ...T.support, fontFamily: font.semi, color: C.dim },
  waitingDots: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  waitingDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: C.purple },
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
  missingButton: { width: 220, marginTop: 22 },
});
