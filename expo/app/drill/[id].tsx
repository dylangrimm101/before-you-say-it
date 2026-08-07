import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowUp, Check, Mic, Square, X } from "lucide-react-native";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, Meter, PressCard, PrimaryButton, tap } from "@/components/ui";
import { DRILLS } from "@/constants/drills";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { drillRoundFeedback, type DrillRoundFeedback } from "@/lib/ai";
import { errorShape, safeLog } from "@/lib/redact";
import { useDictation } from "@/lib/useDictation";
import { useStore } from "@/providers/store";

function dayKey(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

interface RoundOutcome {
  reply: string;
  result: DrillRoundFeedback;
}

export default function DrillScreen() {
  const params = useLocalSearchParams<{ id: string; challengeDay?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const drill = useMemo(() => DRILLS.find((d) => d.id === String(params.id)), [params.id]);

  const [round, setRound] = useState<number>(0);
  const [draft, setDraft] = useState<string>("");
  /** Blurred on mic tap so dictation never competes with the keyboard. */
  const draftRef = useRef<TextInput>(null);
  const [scoring, setScoring] = useState<boolean>(false);
  const [outcomes, setOutcomes] = useState<RoundOutcome[]>([]);
  const [error, setError] = useState<string>("");
  const [logged, setLogged] = useState<boolean>(false);

  const { logDrill, markChallengeDayDone } = useStore();
  const challengeDay = params.challengeDay ? Number(params.challengeDay) : null;

  const dictation = useDictation();

  const done = drill ? outcomes.length >= drill.rounds.length : false;
  const current = drill && !done ? drill.rounds[round] : null;
  const lastOutcome = outcomes.length > round ? outcomes[round] : null;

  const average = useMemo(() => {
    if (outcomes.length === 0) return 0;
    return Math.round(outcomes.reduce((a, o) => a + o.result.score, 0) / outcomes.length);
  }, [outcomes]);

  const submit = useCallback(
    async (text: string) => {
      if (!drill || !current || scoring || text.trim().length === 0) return;
      tap("light");
      setError("");
      setScoring(true);
      try {
        const result = await drillRoundFeedback(
          drill.skill,
          current.focus,
          current.line,
          text.trim(),
        );
        setOutcomes((prev) => [...prev, { reply: text.trim(), result }]);
        setDraft("");
        tap("success");
      } catch (e) {
        safeLog("[drill] feedback failed", errorShape(e));
        setError("Couldn't score that one — try again.");
      } finally {
        setScoring(false);
      }
    },
    [drill, current, scoring],
  );

  const onMicTap = useCallback(async () => {
    if (scoring) return;
    // Speaking and typing are alternatives: put the keyboard away so the mic
    // state and the line being captured stay visible.
    draftRef.current?.blur();
    Keyboard.dismiss();
    if (dictation.status === "recording") {
      tap("medium");
      const text = await dictation.stop();
      if (text && text.trim().length > 0) setDraft((d) => (d ? `${d} ${text}` : text));
      return;
    }
    if (dictation.status === "transcribing") return;
    await dictation.start();
    tap("medium");
  }, [dictation, scoring]);


  const next = useCallback(async () => {
    if (!drill) return;
    tap("medium");
    if (round + 1 >= drill.rounds.length) {
      // finished — log once
      if (!logged) {
        setLogged(true);
        await logDrill({
          drillId: drill.id,
          date: dayKey(Date.now()),
          score: average,
          completedAt: Date.now(),
        });
        if (challengeDay !== null) {
          await markChallengeDayDone(challengeDay);
        }
        tap("success");
      }
      setRound(round + 1);
      return;
    }
    setRound(round + 1);
  }, [drill, round, logged, logDrill, average, challengeDay, markChallengeDayDone]);

  if (!drill) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Text style={{ color: C.dim }}>That drill is gone.</Text>
      </View>
    );
  }

  const finished = round >= drill.rounds.length;

  return (
    <View style={styles.root}>
      <Backdrop />

      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.close}>
          <X size={19} color={C.textSoft} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {drill.title}
          </Text>
          <Text style={[eyebrow, { color: C.dim }]}>
            {drill.skill} · {finished ? "done" : `round ${round + 1} of ${drill.rounds.length}`}
          </Text>
        </View>
        <View style={styles.close}>
          <Check size={18} color={finished ? C.sage : C.dim} />
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {finished ? (
            <View style={styles.summary}>
              <Eyebrow color={C.purple}>Drill complete</Eyebrow>
              <Text style={styles.summaryScore}>{average}</Text>
              <Text style={styles.summarySub}>
                {average >= 75
                  ? "Sharp. That's how it sounds when you mean it."
                  : average >= 55
                    ? "Solid reps. One more run tomorrow and it'll stick."
                    : "Good — the awkward reps are the ones that count."}
              </Text>
              <View style={styles.summaryList}>
                {outcomes.map((o, i) => (
                  <View key={`${drill.rounds[i].line}-${i}`} style={styles.summaryRow}>
                    <Text style={styles.summaryRowScore}>{o.result.score}</Text>
                    <Text style={styles.summaryRowText} numberOfLines={2}>
                      {o.result.feedback}
                    </Text>
                  </View>
                ))}
              </View>
              <PrimaryButton
                label="Done"
                onPress={() => router.back()}
                style={{ marginTop: 24, alignSelf: "stretch" }}
              />
            </View>
          ) : (
            <>
              <View style={styles.setupCard}>
                <Eyebrow color={C.dim}>Your focus</Eyebrow>
                <Text style={styles.setupText}>{drill.setup}</Text>
              </View>

              {current ? (
                <View style={styles.lineCard}>
                  <Text style={styles.lineText}>{current.line}</Text>
                  <Text style={styles.focusText}>{current.focus}</Text>
                </View>
              ) : null}

              {lastOutcome ? (
                <View style={styles.feedbackCard}>
                  <View style={styles.feedbackTop}>
                    <Eyebrow color={C.purple}>Round {round + 1}</Eyebrow>
                    <Text style={styles.feedbackScore}>{lastOutcome.result.score}</Text>
                  </View>
                  <Meter value={lastOutcome.result.score} tone={C.purple} height={5} />
                  <Text style={styles.feedbackText}>{lastOutcome.result.feedback}</Text>
                  {lastOutcome.result.better ? (
                    <Text style={styles.betterText}>
                      Try: &ldquo;{lastOutcome.result.better}&rdquo;
                    </Text>
                  ) : null}
                  <PrimaryButton
                    label={round + 1 >= drill.rounds.length ? "See your score" : "Next round"}
                        onPress={next}
                    style={{ marginTop: 16 }}
                  />
                </View>
              ) : null}

              {error.length > 0 ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {!finished && !lastOutcome ? (
          <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
            <Pressable onPress={onMicTap} hitSlop={8} style={styles.micSmall}>
              {dictation.status === "transcribing" ? (
                <ActivityIndicator size="small" color={C.purple} />
              ) : dictation.status === "recording" ? (
                <Square size={18} color={C.clay} fill={C.clay} />
              ) : (
                <Mic size={20} color={C.textSoft} />
              )}
            </Pressable>
            <TextInput
              ref={draftRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={
                dictation.status === "recording"
                  ? "Listening…"
                  : "Say it out loud, then type or dictate…"
              }
              placeholderTextColor={C.dim}
              style={styles.input}
              multiline
              maxLength={400}
              // Kept non-editable while the mic owns the turn, otherwise the
              // field can retake focus and the keyboard slides back over it.
              editable={!scoring && dictation.status !== "recording"}
            />
            <PressCard
              onPress={() => submit(draft)}
              disabled={draft.trim().length === 0 || scoring}
            >
              <View
                style={[
                  styles.sendBtn,
                  {
                    backgroundColor:
                      draft.trim().length === 0 || scoring ? C.surfaceHigh : C.purple,
                  },
                ]}
              >
                {scoring ? (
                  <ActivityIndicator size="small" color={C.dim} />
                ) : (
                  <ArrowUp
                    size={20}
                    color={draft.trim().length === 0 ? C.dim : C.onAccent}
                    strokeWidth={2.6}
                  />
                )}
              </View>
            </PressCard>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  center: { alignItems: "center", justifyContent: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center", gap: 3 },
  headerTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  body: { paddingHorizontal: GUTTER, paddingTop: 12, paddingBottom: 32, gap: 16 },
  setupCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 16,
  },
  setupText: { ...T.support, marginTop: 8 },
  lineCard: {
    borderRadius: radius.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.glassEdge,
    padding: 24,
    ...shadow.layer,
  },
  lineText: T.title,
  focusText: { ...T.caption, color: C.purple, fontFamily: font.semi, marginTop: 16 },
  feedbackCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surfaceHigh,
    padding: 20,
    gap: 12,
    ...shadow.layer,
  },
  feedbackTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  feedbackScore: { ...T.title, color: C.purple },
  feedbackText: T.support,
  betterText: { ...T.support, fontStyle: "italic" },
  errorBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${C.clay}66`,
    backgroundColor: C.claySoft,
    padding: 12,
  },
  errorText: { ...T.caption, color: C.clay },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: GUTTER,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.barEdge,
    backgroundColor: C.barSolid,
  },
  micSmall: {
    width: 44,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    ...T.body,
    flex: 1,
    minHeight: 52,
    maxHeight: 120,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 13,
  },
  sendBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: { alignItems: "center", paddingTop: 24, paddingHorizontal: 8 },
  summaryScore: { ...T.display, color: C.purple, marginTop: 12 },
  summarySub: { ...T.support, textAlign: "center", marginTop: 8 },
  summaryList: { alignSelf: "stretch", marginTop: 24, gap: 10 },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 16,
  },
  summaryRowScore: { ...T.title, color: C.purple, width: 34 },
  summaryRowText: { ...T.caption, flex: 1 },
});
