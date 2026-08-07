import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useRouter } from "expo-router";
import { Bell, ChevronRight, Minus, RotateCcw, ShieldCheck, Trash2, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { Alert, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, Meter, PressCard, Reveal, tap } from "@/components/ui";
import { DIFFICULTY } from "@/constants/scenarios";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { overallOf, spokenLineCount } from "@/lib/progress";
import { useStore } from "@/providers/store";

const AXES = [
  { key: "clarity", label: "Clarity", tone: C.sage },
  { key: "empathy", label: "Empathy", tone: "#4F6C8F" },
  { key: "assertiveness", label: "Assertiveness", tone: C.purple },
] as const;

function formatTime(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ReminderCard() {
  const { reminder, setReminder } = useStore();
  const [showPicker, setShowPicker] = useState<boolean>(false);

  const enabled = reminder?.enabled ?? false;
  const hour = reminder?.hour ?? 18;
  const minute = reminder?.minute ?? 30;

  const pickerValue = new Date();
  pickerValue.setHours(hour, minute, 0, 0);

  const denied = () => {
    const msg = "Turn on notifications for Before You Say It in Settings to get your daily nudge.";
    if (Platform.OS === "web") return;
    Alert.alert("Notifications are off", msg);
  };

  const toggle = async (next: boolean) => {
    tap("light");
    const ok = await setReminder({ enabled: next, hour, minute });
    if (!ok) denied();
  };

  const onTimeChange = async (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);
    if (event.type !== "set" || !date) return;
    tap("light");
    const ok = await setReminder({
      enabled: true,
      hour: date.getHours(),
      minute: date.getMinutes(),
    });
    if (!ok) denied();
  };

  if (Platform.OS === "web") {
    return (
      <View style={styles.reminderCard}>
        <View style={styles.reminderHead}>
          <Bell size={16} color={C.amber} />
          <Text style={styles.reminderTitle}>Daily reminder</Text>
        </View>
        <Text style={styles.reminderBody}>
          Reminders work on your phone — open the app there to set one.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.reminderCard}>
      <View style={styles.reminderHead}>
        <Bell size={16} color={C.amber} />
        <Text style={styles.reminderTitle}>Daily reminder</Text>
        <Switch
          value={enabled}
          onValueChange={toggle}
          trackColor={{ false: C.surfaceHigh, true: `${C.amber}88` }}
          thumbColor={enabled ? C.amber : C.dim}
        />
      </View>
      <Text style={styles.reminderBody}>
        {enabled
          ? "A nudge to knock out your two-minute drill."
          : "Get a nudge at your time of choice so the streak never slips."}
      </Text>
      {enabled ? (
        <PressCard
          onPress={() => {
            tap("light");
            setShowPicker((v) => !v);
          }}
        >
          <View style={styles.timeRow}>
            <Text style={[eyebrow, { color: C.dim }]}>Remind me at</Text>
            <Text style={styles.timeValue}>{formatTime(hour, minute)}</Text>
          </View>
        </PressCard>
      ) : null}
      {enabled && (showPicker || Platform.OS === "ios") ? (
        <DateTimePicker
          value={pickerValue}
          mode="time"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onTimeChange}
          themeVariant="light"
          style={styles.picker}
        />
      ) : null}
    </View>
  );
}

export default function Progress() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    completed,
    averages,
    streak,
    deleteSession,
    devProEnabled,
    toggleDevPro,
  } = useStore();

  /**
   * Trend of overall scores: the most recent reps (up to 3) vs the reps
   * just before them. Positive = improving. Null until 2+ completed reps.
   */
  const trend = useMemo(() => {
    const overalls = completed.filter((s) => s.scores).map((s) => overallOf(s.scores));
    if (overalls.length < 2) return null;
    const window = Math.max(1, Math.min(3, Math.floor(overalls.length / 2)));
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const recent = avg(overalls.slice(0, window));
    const prior = avg(overalls.slice(window, window * 2));
    return Math.round(recent - prior);
  }, [completed]);

  const confirmDeleteOne = (id: string, title: string) => {
    tap("medium");
    if (Platform.OS === "web") {
      deleteSession(id);
      return;
    }
    Alert.alert(
      "Delete this session?",
      `The record for “${title}” will be removed from this device.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => deleteSession(id) },
      ],
    );
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 22,
          paddingHorizontal: GUTTER,
          paddingBottom: 40,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0}>
          <Eyebrow color={C.dim}>Your training</Eyebrow>
          <Text style={styles.title}>
            {completed.length === 0
              ? "No reps logged yet."
              : `${completed.length} rehearsal${completed.length === 1 ? "" : "s"} in the bank.`}
          </Text>
        </Reveal>

        {averages ? (
          <Reveal index={1}>
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={[eyebrow, { color: C.dim }]}>Average across all reps</Text>
                {trend !== null ? (
                  <View
                    style={[
                      styles.trendPill,
                      {
                        borderColor:
                          trend > 0 ? `${C.sage}55` : trend < 0 ? `${C.clay}55` : C.lineStrong,
                        backgroundColor:
                          trend > 0
                            ? "rgba(95,115,85,0.10)"
                            : trend < 0
                              ? "rgba(132,59,42,0.10)"
                              : "transparent",
                      },
                    ]}
                  >
                    {trend > 0 ? (
                      <TrendingUp size={13} color={C.sage} strokeWidth={2.4} />
                    ) : trend < 0 ? (
                      <TrendingDown size={13} color={C.clay} strokeWidth={2.4} />
                    ) : (
                      <Minus size={13} color={C.dim} strokeWidth={2.4} />
                    )}
                    <Text
                      style={[
                        styles.trendText,
                        { color: trend > 0 ? C.sage : trend < 0 ? C.clay : C.dim },
                      ]}
                    >
                      {trend > 0 ? `+${trend}` : trend < 0 ? `${trend}` : "even"}
                    </Text>
                  </View>
                ) : null}
              </View>
              {trend !== null ? (
                <Text style={styles.trendNote}>
                  {trend > 0
                    ? "Your recent reps score higher than the ones before."
                    : trend < 0
                      ? "Recent reps dipped a little — one focused rep turns it around."
                      : "Holding steady across your recent reps."}
                </Text>
              ) : null}
              <View style={{ marginTop: 18, gap: 16 }}>
                {AXES.map((a, i) => (
                  <View key={a.key}>
                    <View style={styles.axisRow}>
                      <Text style={styles.axisLabel}>{a.label}</Text>
                      <Text style={[styles.axisValue, { color: a.tone }]}>
                        {averages[a.key]}
                      </Text>
                    </View>
                    <Meter value={averages[a.key]} tone={a.tone} delay={70 * i} />
                  </View>
                ))}
              </View>
            </View>
          </Reveal>
        ) : (
          <Reveal index={1}>
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Your scores appear here</Text>
              <Text style={styles.emptyBody}>
                Finish a rehearsal and you&apos;ll get feedback on clarity, empathy, and assertiveness — then watch them change over time. Delivery isn’t scored because audio isn’t analyzed.
              </Text>
            </View>
          </Reveal>
        )}

        <Reveal index={2}>
          <ReminderCard />
        </Reveal>

        <Reveal index={3}>
          <View style={styles.practiceLine}>
            <Text style={styles.practiceValue}>{streak}</Text>
            <Text style={styles.practiceLabel}>{streak === 1 ? "day" : "days"} practiced in a row</Text>
            <View style={styles.practiceDot} />
            <Text style={styles.practiceValue}>{spokenLineCount(completed)}</Text>
            <Text style={styles.practiceLabel}>lines spoken</Text>
          </View>
        </Reveal>

        {completed.length > 0 ? (
          <>
            <Reveal index={4}>
              <Eyebrow color={C.dim} style={{ marginTop: 30, marginBottom: 8 }}>
                History
              </Eyebrow>
            </Reveal>
            {completed.map((s, i) => {
              const avg = overallOf(s.scores);
              const label = s.title ?? "A scenario you wrote";
              return (
                <Reveal key={s.id} index={5 + i}>
                  <PressCard onPress={() => router.push(`/debrief/${s.id}`)}>
                    <View style={styles.historyRow}>
                      <View
                        style={[
                          styles.scoreBadge,
                          { borderColor: avg >= 70 ? C.sage : avg >= 50 ? C.amber : C.clay },
                        ]}
                      >
                        <Text
                          style={[
                            styles.scoreBadgeText,
                            { color: avg >= 70 ? C.sage : avg >= 50 ? C.amber : C.clay },
                          ]}
                        >
                          {avg}
                        </Text>
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.historyTitle} numberOfLines={1}>
                          {label}
                        </Text>
                        <Text style={styles.historyMeta}>
                          {DIFFICULTY[s.difficulty].label} ·{" "}
                          {new Date(s.endedAt ?? s.startedAt).toLocaleDateString()}
                        </Text>
                      </View>
                      <PressCard
                        onPress={() => confirmDeleteOne(s.id, label)}
                        style={styles.deleteHit}
                      >
                        <Trash2 size={15} color={C.dim} />
                      </PressCard>
                      <ChevronRight size={18} color={C.dim} />
                    </View>
                  </PressCard>
                </Reveal>
              );
            })}
          </>
        ) : null}

        <View style={styles.utilitySection}>
          {__DEV__ ? (
            <View style={styles.privacyRow}>
              <ShieldCheck size={16} color={C.purpleLight} />
              <View style={styles.flex}>
                <Text style={styles.privacyLabel}>Unlock all days for testing</Text>
                <Text style={styles.privacyBody}>
                  Preview-only access to Days 1–8. This does not create a subscription.
                </Text>
              </View>
              <Switch
                value={devProEnabled}
                onValueChange={(enabled: boolean) => {
                  tap("light");
                  toggleDevPro(enabled);
                }}
                trackColor={{ false: C.surfaceHigh, true: C.purpleLight }}
                thumbColor={devProEnabled ? C.purple : C.dim}
                accessibilityLabel="Unlock all days for testing"
              />
            </View>
          ) : null}

          <PressCard onPress={() => router.push("/onboarding")}>
            <View style={styles.privacyRow}>
              <RotateCcw size={16} color={C.purpleLight} />
              <View style={styles.flex}>
                <Text style={styles.privacyLabel}>Replay the welcome flow</Text>
                <Text style={styles.privacyBody}>
                  Walk through onboarding, then continue into a fresh rehearsal and debrief.
                </Text>
              </View>
              <ChevronRight size={18} color={C.dim} />
            </View>
          </PressCard>

          <PressCard onPress={() => router.push("/privacy")}>
          <View style={styles.privacyRow}>
            <ShieldCheck size={16} color={C.purpleLight} />
            <View style={styles.flex}>
              <Text style={styles.privacyLabel}>Privacy &amp; data</Text>
              <Text style={styles.privacyBody}>
                What is stored, what is sent, and how to delete it.
              </Text>
            </View>
            <ChevronRight size={18} color={C.dim} />
          </View>
          </PressCard>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  title: { ...T.display, marginTop: 8, marginBottom: 24 },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 20,
    ...shadow.layer,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  trendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  trendText: { ...T.caption, fontFamily: font.semi },
  trendNote: { ...T.caption, marginTop: 10 },
  axisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  axisLabel: { ...T.support, fontFamily: font.semi },
  axisValue: { ...T.support, fontFamily: font.semi },
  empty: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: C.lineStrong,
    padding: 22,
  },
  emptyTitle: { ...T.title },
  emptyBody: { ...T.support, marginTop: 8 },
  reminderCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 18,
    marginTop: 12,
  },
  reminderHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  reminderTitle: { ...T.support, flex: 1, fontFamily: font.semi, color: C.text },
  reminderBody: { ...T.caption, marginTop: 10 },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: `${C.amber}33`,
  },
  timeValue: { ...T.support, fontFamily: font.semi, color: C.purple },
  picker: { alignSelf: "center", marginTop: 4 },
  practiceLine: {
    minHeight: 52,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 4,
  },
  practiceValue: { ...T.support, fontFamily: font.semi, color: C.purple },
  practiceLabel: T.caption,
  practiceDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: C.dim, marginHorizontal: 4 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  scoreBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  scoreBadgeText: { ...T.caption, fontFamily: font.semi },
  historyTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  historyMeta: { ...T.caption, marginTop: 3 },
  // 44pt is the smallest reliable touch target, and this one sits between two
  // other tappable areas in the same row.
  deleteHit: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  utilitySection: { marginTop: 34, gap: 10 },
  privacyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 17,
  },
  privacyLabel: { ...T.support, fontFamily: font.semi, color: C.text },
  privacyBody: { ...T.caption, marginTop: 4 },
});
