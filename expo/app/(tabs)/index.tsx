import { useRouter } from "expo-router";
import { Check, ChevronRight } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, useReducedMotion } from "@/components/ui";
import { curriculumModule, type CurriculumModule } from "@/constants/modules";
import { approvedLessonDeck } from "@/constants/approvedLessons";
import { C, GUTTER, eyebrow, font, radius, shadow, T } from "@/constants/theme";
import { nextLaunchDeck } from "@/lib/launchCurriculum";
import {
  TODAY_ACTIVITY_KEYS,
  TODAY_CARD_GAP,
  TODAY_CARD_HEIGHT,
  TODAY_CARD_PADDING,
  TODAY_CARD_RADIUS,
  TODAY_CHART_DURATION_MS,
  TODAY_ENTRANCE_DURATION_MS,
  TODAY_ENTRANCE_STAGGER_MS,
  TODAY_PIN_STEP,
  todayActivityPresentation,
  todayIndexPresentation,
  todayRecentPractice,
  type TodayActivityKey,
  type TodayActivityPresentation,
  type TodayIndexPresentation,
} from "@/lib/today";
import { useStore } from "@/providers/store";
import type { PilotModule } from "@/types/pilotCurriculum";

const SIGNALS = ["Clarity", "Specificity", "Listening", "Steadiness", "Boundaries", "Repair"] as const;
const SIGNAL_COLORS = ["#512888", "#6B4E9E", "#8571B0", "#9E8CC2", "#B3A4D0", "#C7BCDE"] as const;
const CARD_TINTS = ["#FFFFFF", "#FDFCFE", "#FBFAFD", "#F9F7FC"] as const;
interface ActivityCopy {
  title: string;
  body: string;
}

interface DeckLayerProps {
  children: React.ReactNode;
  entrance: Animated.Value;
  order: number;
  scrollOffset: Animated.Value;
}

function pinnedTranslation(order: number, scrollOffset: Animated.Value): Animated.AnimatedInterpolation<number> {
  const naturalTop = order * (TODAY_CARD_HEIGHT + TODAY_CARD_GAP);
  const pinnedTop = order * TODAY_PIN_STEP;
  const pinThreshold = naturalTop - pinnedTop;
  if (pinThreshold === 0) {
    return scrollOffset.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolateLeft: "clamp",
      extrapolateRight: "extend",
    });
  }
  return scrollOffset.interpolate({
    inputRange: [0, pinThreshold, pinThreshold + 1],
    outputRange: [0, 0, 1],
    extrapolateLeft: "clamp",
    extrapolateRight: "extend",
  });
}

function DeckLayer({ children, entrance, order, scrollOffset }: DeckLayerProps) {
  return (
    <Animated.View
      style={[
        styles.cardLayer,
        {
          zIndex: 10 + order * 10,
          opacity: entrance,
          transform: [
            { translateY: pinnedTranslation(order, scrollOffset) },
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) },
            { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.978, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function activityCopy(key: TodayActivityKey, module: CurriculumModule, moduleDay: PilotModule | undefined): ActivityCopy {
  if (key === "lesson") return { title: module.name, body: moduleDay?.copy.body ?? "Learn the move behind your first focus." };
  if (key === "practice") return { title: "Practice the distinction", body: moduleDay?.copy.quiz?.prompt ?? "Choose the response that keeps the communication move visible." };
  if (key === "rehearsal") return { title: moduleDay?.copy.scenario?.heading ?? "Use it under pressure", body: moduleDay?.copy.scenario?.user_job ?? "Try the move against realistic pushback, then repeat the moment once." };
  return { title: "See what changed", body: moduleDay?.copy.transfer ?? "Compare your responses and carry one adjustment forward." };
}

function IndexCard({ index, chartProgress, hasLessonUpdate, onDetails }: { index: TodayIndexPresentation; chartProgress: Animated.Value; hasLessonUpdate: boolean; onDetails: () => void }) {
  const chartSlots = Array.from({ length: 7 }, (_, slot) => {
    const valueIndex = slot - (7 - index.chartValues.length);
    return valueIndex >= 0 ? index.chartValues[valueIndex] ?? null : null;
  });
  const valueLabel = index.kind === "insufficient" ? "—" : String(index.value);
  const statusLabel = index.kind === "overall" ? "Overall Index" : index.kind === "partial" ? "Partial Index" : "Insufficient evidence";

  return (
    <View style={[styles.card, styles.indexCard]} accessibilityLabel={`Current Communication Index. ${statusLabel}. ${index.value ?? "No Index value"}. ${index.observedCount} of 6 signals observed.${hasLessonUpdate ? " Latest completed lesson included." : ""}`}>
      <View style={styles.cardTopRow}>
        <View style={styles.indexLabelRow}><Text style={styles.cardEyebrow}>Communication Index</Text><View style={styles.currentBadge}><View style={styles.currentDot} /><Text style={styles.currentBadgeText}>Current</Text></View></View>
        <Pressable onPress={onDetails} accessibilityRole="button" accessibilityLabel="Communication Index details" hitSlop={12}>
          <View style={styles.detailsRow}><Text style={styles.details}>Details</Text><ChevronRight size={12} color={C.purple} /></View>
        </Pressable>
      </View>
      <View style={styles.indexHeading}>
        <View><Text style={styles.currentIndexCaption}>Your current Index</Text><View style={styles.indexValueRow}><Text style={styles.indexValue}>{valueLabel}</Text>{index.value !== null ? <Text style={styles.outOf}>/ 100</Text> : null}</View></View>
        <View style={styles.indexPills}><View style={styles.pill}><Text style={styles.pillText}>{statusLabel}</Text></View><View style={styles.pill}><Text style={styles.pillText}>{index.observedCount} of 6 signals</Text></View>{hasLessonUpdate ? <View style={styles.updatedPill}><Check size={10} color={C.purple} strokeWidth={3} /><Text style={styles.updatedPillText}>Latest lesson included</Text></View> : null}</View>
      </View>
      <View style={styles.chartArea}>
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={index.chartValues.length === 0 ? "No scored practice values yet" : `Scored practice history. ${index.chartValues.join(", ")} on a zero to one hundred scale.`}>
          {chartSlots.map((value, slot) => <View key={slot} style={styles.chartTrack}>{value === null ? null : <Animated.View style={[styles.chartBar, slot === 6 && styles.chartBarCurrent, { height: `${value}%`, transform: [{ scaleY: chartProgress }] }]} />}</View>)}
        </View>
        <Text style={styles.chartCaption}>{index.chartValues.length === 0 ? "No scored practice history yet · 0–100" : `Scored practice history · ${index.chartValues.length} of 7 · 0–100`}</Text>
      </View>
      <View style={styles.indexFooter}>
        <View style={styles.signalLegend}>{SIGNALS.map((label, indexValue) => <View key={label} style={styles.signalItem}><View style={[styles.signalMark, { backgroundColor: SIGNAL_COLORS[indexValue] }]} /><Text style={styles.signalLabel}>{label}</Text></View>)}</View>
        <Text numberOfLines={2} style={styles.focus}><Text style={styles.focusKey}>Focus · </Text>{index.focus ?? "Complete an approved rehearsal to establish an evidence-backed focus."}</Text>
      </View>
    </View>
  );
}

function ActivityCard({ activity, copy, tint, onPress }: { activity: TodayActivityPresentation; copy: ActivityCopy; tint: string; onPress: () => void }) {
  const isCurrent = activity.state === "current";
  const isCompleted = activity.state === "completed";
  return (
    <View style={[styles.card, { backgroundColor: tint }, isCurrent && styles.cardCurrent]} accessibilityLabel={`${activity.key}. ${activity.state}. ${copy.title}`}>
      <View style={styles.cardTopRow}>
        <View style={styles.activityMeta}><Text style={[styles.activityKind, isCurrent && styles.activityKindCurrent]}>{activity.key}</Text></View>
        {isCompleted ? <View style={styles.check}><Check size={12} color={C.onAccent} strokeWidth={3} /></View> : null}
      </View>
      <Text numberOfLines={2} style={[styles.activityTitle, !isCurrent && styles.activityTitleQuiet]}>{copy.title}</Text>
      <Text numberOfLines={3} style={[styles.activityBody, !isCurrent && styles.activityBodyQuiet]}>{copy.body}</Text>
      {isCurrent && activity.ctaLabel ? <Pressable onPress={onPress} style={({ pressed }) => [styles.primaryAction, pressed && styles.primaryActionPressed]} accessibilityRole="button" accessibilityLabel={activity.ctaLabel}><Text style={styles.primaryActionText}>{activity.ctaLabel}</Text></Pressable> : <View style={styles.quietState}><Text style={styles.quietStateText}>{isCompleted ? "Complete · Review" : "Up next"}</Text></View>}
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isReduced = useReducedMotion();
  const { access, activityDays, activePracticeSession, convertedLessonProgress, moduleCloseProgress, scoredPracticeHistory } = useStore();
  const nextDeckId = nextLaunchDeck(convertedLessonProgress, moduleCloseProgress);
  const nextDeck = approvedLessonDeck(nextDeckId);
  const moduleId = nextDeck?.module === 2 ? "make_a_clear_ask" : "get_to_the_point";
  const recommended = curriculumModule(moduleId);
  const moduleDay: PilotModule | undefined = undefined;
  const index = useMemo<TodayIndexPresentation>(
    () => todayIndexPresentation(activePracticeSession?.sharedResult, scoredPracticeHistory),
    [activePracticeSession?.sharedResult, scoredPracticeHistory],
  );
  const recentDays = useMemo(() => todayRecentPractice(activityDays, new Date()), [activityDays]);
  const activities = useMemo(() => todayActivityPresentation(undefined, false), []);
  const entrances = useRef<Animated.Value[]>(Array.from({ length: 5 }, () => new Animated.Value(0))).current;
  const chartProgress = useRef<Animated.Value>(new Animated.Value(0)).current;
  const scrollOffset = useRef<Animated.Value>(new Animated.Value(0)).current;
  const onDeckScroll = useMemo(
    () => Animated.event(
      [{ nativeEvent: { contentOffset: { y: scrollOffset } } }],
      { useNativeDriver: true },
    ),
    [scrollOffset],
  );

  useEffect(() => {
    if (isReduced) {
      entrances.forEach((value) => value.setValue(1));
      chartProgress.setValue(1);
      return;
    }
    entrances.forEach((value) => value.setValue(0));
    chartProgress.setValue(0);
    const cards = Animated.parallel(entrances.map((value, order) => Animated.timing(value, { toValue: 1, duration: TODAY_ENTRANCE_DURATION_MS, delay: order * TODAY_ENTRANCE_STAGGER_MS, easing: Easing.bezier(0.22, 0.9, 0.28, 1), useNativeDriver: true })));
    const chart = Animated.timing(chartProgress, { toValue: 1, duration: TODAY_CHART_DURATION_MS, delay: 300, easing: Easing.bezier(0.22, 0.9, 0.28, 1), useNativeDriver: true });
    Animated.parallel([cards, chart]).start();
    return () => { cards.stop(); chart.stop(); };
  }, [chartProgress, entrances, isReduced]);

  const openCurrentActivity = useCallback((): void => {
    if (!nextDeckId) { router.push("/path"); return; }
    if (access.entitlement !== "pro") { router.push({ pathname: "/paywall", params: { gate: "program", moduleId } }); return; }
    router.push({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: nextDeckId } });
  }, [access.entitlement, moduleId, nextDeckId, router]);

  const openPath = useCallback((): void => { router.push("/path"); }, [router]);
  const openProgress = useCallback((): void => { router.push("/(tabs)/progress"); }, [router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}><Text style={styles.todayTitle}>Today</Text></View>
      <View style={styles.recentStrip} accessibilityLabel="Recent practice, seven days">
        {recentDays.map((day) => <View key={day.key} style={[styles.day, day.isToday && styles.dayToday]}><View style={[styles.dayDot, day.hasPractice && styles.dayDotDone, day.isToday && !day.hasPractice && styles.dayDotToday]}>{day.hasPractice ? <Check size={9} color={C.onAccent} strokeWidth={3} /> : null}</View><Text style={[styles.dayLabel, day.isToday && styles.dayLabelToday]}>{day.label}</Text></View>)}
      </View>
      <Animated.ScrollView
        style={styles.deck}
        contentContainerStyle={[styles.deckContent, { paddingBottom: insets.bottom + 116 }]}
        onScroll={onDeckScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <DeckLayer entrance={entrances[0]} order={0} scrollOffset={scrollOffset}>
          <IndexCard index={index} chartProgress={chartProgress} hasLessonUpdate={scoredPracticeHistory.length > 0} onDetails={openProgress} />
        </DeckLayer>
        {TODAY_ACTIVITY_KEYS.map((key, activityIndex) => {
          const activity = activities[activityIndex];
          const order = activityIndex + 1;
          if (!activity) return null;
          const copy = key === "lesson" && nextDeck
            ? { title: nextDeck.shortName, body: nextDeck.isCloseDeck ? "Bring the five moves together and complete the module." : `Module ${nextDeck.module} · Lesson ${nextDeck.lesson}` }
            : recommended ? activityCopy(key, recommended, moduleDay) : { title: key === "review" ? "See what changed" : `${key[0]?.toUpperCase() ?? ""}${key.slice(1)}`, body: "Complete the current approved lesson to continue." };
          return <DeckLayer key={key} entrance={entrances[order]} order={order} scrollOffset={scrollOffset}><ActivityCard activity={activity} copy={copy} tint={CARD_TINTS[activityIndex]} onPress={openCurrentActivity} /></DeckLayer>;
        })}
        <Pressable onPress={openPath} accessibilityRole="button" accessibilityLabel="View your practice path" style={styles.pathLink}><Text style={styles.pathText}>View your path</Text><ChevronRight size={15} color={C.purple} /></Pressable>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { paddingHorizontal: GUTTER, paddingBottom: 10 },
  todayTitle: { fontFamily: font.bold, fontSize: 28, lineHeight: 32, letterSpacing: -0.5, color: C.text },
  recentStrip: { flexDirection: "row", gap: 6, paddingHorizontal: GUTTER, paddingBottom: 14 },
  day: { flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.55)", alignItems: "center", justifyContent: "center", gap: 5 },
  dayToday: { borderColor: "rgba(81,40,136,0.34)", backgroundColor: C.purpleSoft },
  dayDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 1.5, borderColor: "rgba(23,26,31,0.18)", alignItems: "center", justifyContent: "center" },
  dayDotDone: { backgroundColor: C.purple, borderColor: C.purple }, dayDotToday: { borderColor: "rgba(81,40,136,0.5)" },
  dayLabel: { fontFamily: font.semi, fontSize: 10, lineHeight: 12, letterSpacing: 0.6, textTransform: "uppercase", color: C.dim }, dayLabelToday: { color: C.purple },
  deck: { flex: 1 }, deckContent: { paddingHorizontal: 20, isolation: "isolate" },
  cardLayer: { paddingBottom: TODAY_CARD_GAP },
  card: { height: TODAY_CARD_HEIGHT, borderRadius: TODAY_CARD_RADIUS, padding: TODAY_CARD_PADDING, backgroundColor: C.onAccent, borderWidth: 1, borderColor: C.line, ...shadow.layer },
  indexCard: { backgroundColor: "#FCFAFF", borderColor: "rgba(81,40,136,0.2)", shadowColor: C.purple, shadowOffset: { width: 0, height: 13 }, shadowOpacity: 0.12, shadowRadius: 28, elevation: 7 },
  cardCurrent: { borderColor: "rgba(81,40,136,0.22)", shadowColor: C.purple, shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.14, shadowRadius: 26, elevation: 8 },
  cardTopRow: { minHeight: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  indexLabelRow: { flexDirection: "row", alignItems: "center", gap: 8 }, cardEyebrow: { ...eyebrow, color: C.dim }, currentBadge: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: C.purpleSoft }, currentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.purple }, currentBadgeText: { fontFamily: font.bold, fontSize: 9, letterSpacing: 0.6, textTransform: "uppercase", color: C.purple }, detailsRow: { flexDirection: "row", alignItems: "center", gap: 1 }, details: { fontFamily: font.semi, fontSize: 12, color: C.purple },
  indexHeading: { minHeight: 76, marginTop: 4, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }, currentIndexCaption: { fontFamily: font.medium, fontSize: 11, lineHeight: 13, color: C.dim, marginBottom: -2 },
  indexValueRow: { flexDirection: "row", alignItems: "flex-end", gap: 5 }, indexValue: { fontFamily: font.bold, fontSize: 58, lineHeight: 63, letterSpacing: -2.2, color: C.purple }, outOf: { fontFamily: font.regular, fontSize: 14, color: C.dim, paddingBottom: 8 },
  indexPills: { alignItems: "flex-end", gap: 4, paddingBottom: 5 }, pill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill, backgroundColor: "rgba(23,26,31,0.05)", borderWidth: 1, borderColor: C.line }, pillText: { fontFamily: font.semi, fontSize: 9, color: C.textSoft }, updatedPill: { minHeight: 22, paddingHorizontal: 8, borderRadius: 11, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.purpleSoft }, updatedPillText: { fontFamily: font.semi, fontSize: 9, color: C.purple },
  chartArea: { flex: 1, minHeight: 0, marginTop: 2, gap: 5 }, chart: { flex: 1, minHeight: 0, flexDirection: "row", alignItems: "flex-end", gap: 6 }, chartTrack: { flex: 1, height: "100%", borderRadius: 5, backgroundColor: "rgba(81,40,136,0.07)", overflow: "hidden", justifyContent: "flex-end" }, chartBar: { width: "100%", borderRadius: 5, backgroundColor: "rgba(81,40,136,0.24)", transformOrigin: "bottom" }, chartBarCurrent: { backgroundColor: C.purple }, chartCaption: { fontFamily: font.medium, fontSize: 10, lineHeight: 12, color: C.dim },
  indexFooter: { paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, gap: 6 }, signalLegend: { flexDirection: "row", flexWrap: "wrap", rowGap: 5 }, signalItem: { width: "33.333%", flexDirection: "row", alignItems: "center", gap: 5 }, signalMark: { width: 7, height: 7, borderRadius: 2 }, signalLabel: { fontFamily: font.medium, fontSize: 10, color: C.textSoft }, focus: { fontFamily: font.regular, fontSize: 11, lineHeight: 15, color: C.textSoft }, focusKey: { fontFamily: font.semi, fontSize: 10, textTransform: "uppercase", letterSpacing: 1, color: C.purple },
  activityMeta: { flexDirection: "row", alignItems: "center", gap: 5 }, activityKind: { fontFamily: font.semi, fontSize: 10, letterSpacing: 1.4, textTransform: "uppercase", color: C.dim }, activityKindCurrent: { color: C.purple }, check: { width: 19, height: 19, borderRadius: 10, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  activityTitle: { fontFamily: font.bold, fontSize: 20, lineHeight: 25, letterSpacing: -0.25, color: C.text, marginTop: 10 }, activityTitleQuiet: { color: C.textSoft }, activityBody: { ...T.support, fontSize: 14, lineHeight: 20, color: C.textSoft, flex: 1, marginTop: 9 }, activityBodyQuiet: { color: C.dim },
  primaryAction: { height: 52, borderRadius: radius.pill, backgroundColor: C.purple, alignItems: "center", justifyContent: "center", ...shadow.hero }, primaryActionPressed: { backgroundColor: C.purplePressed, transform: [{ scale: 0.985 }] }, primaryActionText: { fontFamily: font.semi, fontSize: 16, color: C.onAccent },
  quietState: { height: 52, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" }, quietStateText: { fontFamily: font.semi, fontSize: 14, color: C.dim },
  pathLink: { minHeight: 52, paddingTop: 14, paddingBottom: 320, flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 3 }, pathText: { fontFamily: font.semi, fontSize: 14, color: C.purple },
});
