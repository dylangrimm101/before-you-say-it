import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Mic, RotateCcw, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel } from "@/components/PaidProductUI";
import { Backdrop, GhostButton, PrimaryButton, tap } from "@/components/ui";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { drillRoundFeedback, type DrillRoundFeedback } from "@/lib/ai";
import { quickRepCompletionDate, quickRepConfig, quickRepLogId } from "@/lib/quickRep";
import { errorShape, safeLog } from "@/lib/redact";
import { useDictation } from "@/lib/useDictation";
import { useStore } from "@/providers/store";

type Stage = "first" | "cue" | "retry" | "complete";
type InputMode = "voice" | "text";

export default function QuickRepRoute(): React.JSX.Element {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const config = quickRepConfig(params.lessonId);
  const { access, convertedLessonProgress, logDrill } = useStore();
  const hasCompletedLesson = Boolean(config && convertedLessonProgress.some((entry) => entry.lessonId === config.lessonId));
  const dictation = useDictation();
  const draftRef = useRef<TextInput>(null);
  const submittingRef = useRef<boolean>(false);
  const feedbackRequestRef = useRef<number>(0);
  const [stage, setStage] = useState<Stage>("first");
  const [mode, setMode] = useState<InputMode>("voice");
  const [draft, setDraft] = useState<string>("");
  const [firstLine, setFirstLine] = useState<string>("");
  const [retryLine, setRetryLine] = useState<string>("");
  const [cue, setCue] = useState<DrillRoundFeedback | null>(null);
  const [retryCue, setRetryCue] = useState<DrillRoundFeedback | null>(null);
  const [checking, setChecking] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  useEffect(() => () => {
    feedbackRequestRef.current += 1;
    submittingRef.current = false;
  }, []);

  useEffect(() => {
    const announcement = stage === "cue"
      ? "Your Quick Rep feedback is ready. One cue."
      : stage === "retry"
        ? "Same moment. Try again."
        : stage === "complete"
          ? "Quick Rep complete."
          : null;
    if (announcement) AccessibilityInfo.announceForAccessibility(announcement);
  }, [stage]);

  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);

  useEffect(() => {
    if (dictation.error) AccessibilityInfo.announceForAccessibility(dictation.error);
  }, [dictation.error]);

  const close = useCallback(async (): Promise<void> => {
    feedbackRequestRef.current += 1;
    submittingRef.current = false;
    setChecking(false);
    await dictation.cancel().catch((caught: unknown) => safeLog("[quick-rep] cleanup failed", errorShape(caught)));
    router.replace("/(tabs)");
  }, [dictation, router]);

  const switchToText = useCallback(async (): Promise<void> => {
    if (dictation.status === "recording" || dictation.status === "transcribing") {
      try {
        await dictation.cancel();
      } catch (caught) {
        safeLog("[quick-rep] recording cleanup before typing failed", errorShape(caught));
        setError("Finish recording cleanup before switching to typing.");
        return;
      }
    }
    setMode("text");
  }, [dictation]);

  const onMicPress = useCallback(async (): Promise<void> => {
    if (checking || stage === "cue" || stage === "complete") return;
    draftRef.current?.blur();
    Keyboard.dismiss();
    setError("");
    if (dictation.status === "recording") {
      const text = await dictation.stop("reply");
      if (text?.trim()) {
        setDraft(text.trim());
        setMode("text");
      }
      return;
    }
    if (dictation.status === "transcribing") return;
    await dictation.start();
  }, [checking, dictation, stage]);

  const submit = useCallback(async (): Promise<void> => {
    if (!config || checking || submittingRef.current || !draft.trim() || (stage !== "first" && stage !== "retry")) return;
    submittingRef.current = true;
    const requestId = feedbackRequestRef.current + 1;
    feedbackRequestRef.current = requestId;
    const line = draft.trim();
    setChecking(true);
    setError("");
    try {
      const result = await drillRoundFeedback(config.skill, config.feedbackFocus, config.situation, line);
      if (requestId !== feedbackRequestRef.current) return;
      if (stage === "first") {
        setFirstLine(line);
        setCue(result);
        setDraft("");
        setStage("cue");
      } else {
        setRetryLine(line);
        setRetryCue(result);
        await logDrill({
          drillId: quickRepLogId(config.lessonId),
          date: quickRepCompletionDate(),
          score: Math.round(((cue?.score ?? result.score) + result.score) / 2),
          completedAt: Date.now(),
        });
        setDraft("");
        setStage("complete");
        tap("success");
      }
    } catch (caught) {
      if (requestId !== feedbackRequestRef.current) return;
      safeLog("[quick-rep] feedback unavailable", errorShape(caught));
      setError("Your words are safe. We couldn't check this rep yet — try again without recording it again.");
    } finally {
      if (requestId === feedbackRequestRef.current) {
        submittingRef.current = false;
        setChecking(false);
      }
    }
  }, [checking, config, cue?.score, draft, logDrill, stage]);

  const startRetry = useCallback((): void => {
    setStage("retry");
    setMode("voice");
    setDraft("");
    setError("");
    tap("light");
  }, []);

  if (!config || access.entitlement !== "pro" || !hasCompletedLesson) {
    return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>Quick Rep is unavailable.</Text><Text style={styles.body}>Return to Today and complete a lesson before using its Quick Rep.</Text><PrimaryButton label="Back to Today" onPress={() => router.replace("/(tabs)")} containerStyle={styles.unavailableAction} /></View>;
  }

  return <View style={styles.root}>
    <Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <View><SectionLabel tone={C.purple}>Quick Rep</SectionLabel><Text style={styles.headerTitle}>{config.lessonTitle}</Text></View>
      <Pressable onPress={() => void close()} accessibilityRole="button" accessibilityLabel="Close Quick Rep" hitSlop={12} style={styles.closeButton}><X size={20} color={C.textSoft} /></Pressable>
    </View>

    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <ProductCard accent style={styles.moveCard}>
          <Text style={styles.moveLabel}>LAST LESSON’S MOVE</Text>
          <Text style={styles.move}>{config.namedMove}</Text>
        </ProductCard>

        {stage === "complete" ? <CompleteState firstLine={firstLine} retryLine={retryLine} cue={retryCue} onDone={() => void close()} /> : <>
          <View style={styles.promptBlock}>
            <Text style={styles.promptLabel}>{stage === "retry" ? "SAME MOMENT · TRY AGAIN" : "NEW MOMENT"}</Text>
            <Text style={styles.situation}>{config.situation}</Text>
            <Text style={styles.instruction}>{config.instruction}</Text>
          </View>

          {stage === "cue" && cue ? <View accessibilityLiveRegion="polite"><ProductCard style={styles.cueCard}>
            <Text style={styles.cueLabel}>One cue</Text>
            <Text style={styles.cueText}>{cue.feedback}</Text>
            {cue.better.trim() ? <Text style={styles.better}>Try: “{cue.better}”</Text> : null}
            <PrimaryButton label="Try the same moment again" onPress={startRetry} containerStyle={styles.retryAction} />
          </ProductCard></View> : null}

          {(stage === "first" || stage === "retry") ? <View style={styles.capture}>
            {mode === "voice" ? <>
              <Pressable onPress={() => void onMicPress()} disabled={checking || dictation.status === "transcribing"} accessibilityRole="button" accessibilityLabel={dictation.status === "recording" ? "Stop and review Quick Rep" : dictation.status === "transcribing" ? "Transcribing Quick Rep" : "Record Quick Rep"} style={({ pressed }) => [styles.mic, dictation.status === "recording" && styles.micRecording, pressed && styles.pressed]}>
                {dictation.status === "transcribing" ? <ActivityIndicator color={C.onAccent} /> : dictation.status === "recording" ? <Square size={28} color={C.onAccent} fill={C.onAccent} /> : <Mic size={34} color={C.purple} />}
              </Pressable>
              <Text accessibilityLiveRegion="polite" style={styles.captureTitle}>{dictation.status === "recording" ? "Listening… tap when you're done" : dictation.status === "transcribing" ? "Transcribing your words…" : "Say it out loud"}</Text>
              <Text style={styles.captureHelp}>Aim for one clear turn. Most reps take less than a minute.</Text>
              <Text style={styles.capturePrivacy}>Audio is transcribed, then discarded. Your confirmed words are sent for Quick Rep feedback.</Text>
              <GhostButton label="Use typing instead" onPress={() => void switchToText()} disabled={checking || dictation.status === "transcribing"} containerStyle={styles.typeAction} />
            </> : <>
              <TextInput ref={draftRef} value={draft} onChangeText={setDraft} multiline maxLength={700} autoFocus={Platform.OS === "web"} placeholder="Say it the way you would in the moment…" placeholderTextColor={C.dim} style={styles.input} accessibilityLabel="Quick Rep transcript" />
              <Text style={styles.capturePrivacy}>Your words are sent for Quick Rep feedback.</Text>
              <PrimaryButton label={checking ? "Checking your rep…" : stage === "retry" ? "Complete quick rep" : "Check my rep"} onPress={() => void submit()} disabled={checking || !draft.trim()} containerStyle={styles.checkAction} />
              <GhostButton label="Record instead" onPress={() => { setMode("voice"); setDraft(""); }} />
            </>}
            {dictation.error ? <Text accessibilityLiveRegion="assertive" style={styles.error}>{dictation.error}</Text> : null}
            {error ? <View accessibilityLiveRegion="assertive" style={styles.errorBox}><Text style={styles.error}>{error}</Text><Pressable onPress={() => void submit()} accessibilityRole="button" accessibilityLabel="Retry checking Quick Rep" style={styles.retryCheck}><RotateCcw size={16} color={C.purple} /><Text style={styles.retryCheckText}>Try checking again</Text></Pressable></View> : null}
          </View> : null}
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function CompleteState({ firstLine, retryLine, cue, onDone }: { firstLine: string; retryLine: string; cue: DrillRoundFeedback | null; onDone: () => void }): React.JSX.Element {
  return <View style={styles.complete} accessibilityLiveRegion="polite">
    <View style={styles.completeIcon}><Check size={26} color={C.onAccent} strokeWidth={3} /></View>
    <SectionLabel tone={C.purple}>Quick Rep complete</SectionLabel>
    <Text style={styles.completeTitle}>You gave the move another try.</Text>
    {cue?.feedback ? <Text style={styles.completeBody}>{cue.feedback}</Text> : null}
    <ProductCard style={styles.comparison}>
      <Text style={styles.comparisonLabel}>FIRST REP</Text><Text style={styles.comparisonText}>{firstLine}</Text>
      <View style={styles.rule} />
      <Text style={styles.comparisonLabel}>RETRY</Text><Text style={styles.comparisonText}>{retryLine}</Text>
    </ProductCard>
    <PrimaryButton label="Back to Today" onPress={onDone} containerStyle={styles.doneAction} />
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, center: { justifyContent: "center", paddingHorizontal: GUTTER },
  header: { minHeight: 72, paddingHorizontal: GUTTER, paddingBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, headerTitle: { fontFamily: font.bold, fontSize: 18, lineHeight: 23, color: C.text, marginTop: 2 }, closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: C.surface, borderWidth: 1, borderColor: C.line },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 8 }, moveCard: { padding: 18 }, moveLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2, color: C.dim }, move: { fontFamily: font.bold, fontSize: 20, lineHeight: 26, color: C.purple, marginTop: 6 },
  promptBlock: { paddingVertical: 26 }, promptLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.3, color: C.dim }, situation: { ...T.title, fontSize: 25, lineHeight: 32, marginTop: 8 }, instruction: { ...T.support, marginTop: 12 },
  capture: { alignItems: "center", paddingTop: 6 }, mic: { width: 92, height: 92, borderRadius: 46, alignItems: "center", justifyContent: "center", backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: "rgba(81,40,136,0.24)", ...shadow.hero }, micRecording: { backgroundColor: C.purple }, pressed: { transform: [{ scale: 0.98 }] }, captureTitle: { fontFamily: font.bold, fontSize: 18, color: C.text, marginTop: 16 }, captureHelp: { ...T.caption, textAlign: "center", marginTop: 6 }, capturePrivacy: { fontFamily: font.regular, fontSize: 11, lineHeight: 16, color: C.dim, textAlign: "center", marginTop: 8, paddingHorizontal: 12 }, typeAction: { marginTop: 12 },
  input: { width: "100%", minHeight: 142, borderRadius: radius.lg, borderWidth: 1, borderColor: C.line, backgroundColor: C.onAccent, padding: 16, fontFamily: font.regular, fontSize: 16, lineHeight: 23, color: C.text, textAlignVertical: "top" }, checkAction: { width: "100%", marginTop: 12 },
  cueCard: { padding: 20 }, cueLabel: { fontFamily: font.bold, fontSize: 11, letterSpacing: 1.1, textTransform: "uppercase", color: C.purple }, cueText: { ...T.body, fontFamily: font.semi, marginTop: 8 }, better: { ...T.support, marginTop: 12, color: C.textSoft }, retryAction: { marginTop: 18 },
  errorBox: { width: "100%", marginTop: 14, padding: 14, borderRadius: 16, backgroundColor: "rgba(193,91,76,0.08)" }, error: { ...T.caption, color: C.clay, textAlign: "center" }, retryCheck: { minHeight: 44, marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 }, retryCheckText: { fontFamily: font.semi, fontSize: 14, color: C.purple },
  complete: { alignItems: "center", paddingTop: 22 }, completeIcon: { width: 54, height: 54, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: C.purple }, completeTitle: { ...T.title, textAlign: "center", marginTop: 12 }, completeBody: { ...T.support, textAlign: "center", marginTop: 10 }, comparison: { width: "100%", marginTop: 22, padding: 18 }, comparisonLabel: { fontFamily: font.bold, fontSize: 10, letterSpacing: 1.2, color: C.dim }, comparisonText: { ...T.support, marginTop: 5 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 14 }, doneAction: { width: "100%", marginTop: 18 },
  title: { ...T.title, textAlign: "center" }, body: { ...T.support, textAlign: "center", marginTop: 10 }, unavailableAction: { marginTop: 22 },
});
