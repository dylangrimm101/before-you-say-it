import { useRouter } from "expo-router";
import { Mic, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { generateM1L1DynamicReply } from "@/lib/ai";
import { Backdrop, MicControl, PrimaryButton, Reveal, Thinking } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import {
  m1L1CoachExchange,
  m1L1Comparison,
  m1L1EvidenceTrap,
  m1L1GoodVersion,
  selectM1L1PushbackOne,
  type ConvertedLessonConfig,
} from "@/lib/convertedLesson";
import { m1L1ProviderTurn } from "@/lib/m1L1DynamicResponse";
import {
  advanceM1L1FirstResponse,
  attachM1L1Coaching,
  confirmM1L1PressureReplay,
  completeM1L1PressureReplay,
  attachM1L1PushbackOne,
  attachM1L1PushbackTwo,
  preserveM1L1Retry,
  preserveScenarioAttempt,
  scenarioRunForRoute,
  stageM1L1PressureReplay,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
} from "@/lib/scenarioPractice";
import { leaveAfterStrictDictationCleanup } from "@/lib/temporaryRecording";
import { useDictation } from "@/lib/useDictation";
import { playPreparedPilotAudio, preparePilotAudio, replaySpeech, resetSpeech, speakPilotAudioToCompletion, unlockAudioPlayback, useSpeech } from "@/lib/voice";
import { useStore } from "@/providers/store";

interface M1L1PaidPracticeProps {
  requestedRunId?: string;
  convertedLesson: ConvertedLessonConfig;
  onReturnToDeck: (runId: string) => void;
  onDiscard: () => Promise<void>;
}

type CaptureKind = "opener" | "response-one" | "retry";

function reviewState(kind: CaptureKind): PersistedScenarioPracticeRun["run"]["state"] {
  if (kind === "opener") return "confirm_attempt_transcript";
  if (kind === "response-one") return "confirm_response_transcript";
  return "confirm_retry_transcript";
}

function listeningState(kind: CaptureKind): PersistedScenarioPracticeRun["run"]["state"] {
  if (kind === "opener") return "listening_attempt";
  if (kind === "response-one") return "listening_response";
  return "listening_retry";
}

function lineFor(turn: NonNullable<PersistedScenarioPracticeRun["run"]["counterpartTurn"]>) {
  return {
    audio_id: turn.resolvedAudioId ?? turn.id,
    voice_key: turn.semanticVoiceKey ?? "contextual_counterpart",
    text: turn.text,
  } as const;
}

function afterNextPaint(): Promise<void> {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

/** Isolated accepted M1 L1 runtime. Other lessons and shared scenarios never enter this component. */
export function M1L1PaidPractice({ requestedRunId, convertedLesson, onReturnToDeck, onDiscard }: M1L1PaidPracticeProps): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeScenarioRun, replaceActiveScenarioRunStrict } = useStore();
  const restored = scenarioRunForRoute(activeScenarioRun, convertedLesson.scenario.id);
  const [value, setValue] = useState<PersistedScenarioPracticeRun | null>(restored?.run.id === requestedRunId ? restored : null);
  const [draft, setDraft] = useState<string>("");
  const [captureKind, setCaptureKind] = useState<CaptureKind | null>(null);
  const [permissionKind, setPermissionKind] = useState<CaptureKind | null>(null);
  const [isMicrophonePrepared, setIsMicrophonePrepared] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [isOpenerHintVisible, setIsOpenerHintVisible] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const shouldAutoScrollRef = useRef<boolean>(false);
  const dictation = useDictation();
  const speech = useSpeech();
  const cancelDictation = dictation.cancel;

  useEffect(() => () => {
    cancelDictation().catch(() => {});
    resetSpeech().catch(() => {});
  }, [cancelDictation]);

  const persist = useCallback(async (next: PersistedScenarioPracticeRun): Promise<void> => {
    await replaceActiveScenarioRunStrict(next, activeRunRevision(value));
    setValue(next);
  }, [replaceActiveScenarioRunStrict, value]);

  const run = value?.run;
  const lesson = run?.m1L1;
  const currentPressure = lesson?.coachedBeat === 3 ? lesson.pushbackOne : undefined;
  const step = Math.min(lesson?.beat ?? 1, 7);
  const progressLabel = `Step ${step} of 7`;

  useEffect(() => {
    if (run?.state !== "ready_for_second_response" || !run.attempt || !run.responseAttempt || !lesson?.pushbackTwo || lesson.coachedBeat) return;
    const note = m1L1CoachExchange({ opener: run.attempt.transcript, firstResponse: run.responseAttempt.transcript });
    if (!note || !value) return;
    const coached = attachM1L1Coaching(
      value,
      `${note.worked} ${note.change}`,
      note.retryDirection,
      note.coachedBeat,
      note.flags,
      note.selectedDimension,
      Date.now(),
    );
    void persist(coached);
  }, [lesson?.coachedBeat, lesson?.pushbackTwo, persist, run?.attempt, run?.responseAttempt, run?.state, value]);

  const beginRecording = useCallback(async (kind: CaptureKind): Promise<void> => {
    if (!value || speech.phase === "speaking" || speech.phase === "generating") return;
    setDraft("");
    setCaptureKind(kind);
    await persist(transitionScenarioPracticeRun(value, listeningState(kind), Date.now()));
    await dictation.start();
  }, [dictation, persist, speech.phase, value]);

  const requestCapture = useCallback(async (kind: CaptureKind): Promise<void> => {
    if (!isMicrophonePrepared) {
      setPermissionKind(kind);
      return;
    }
    await beginRecording(kind);
  }, [beginRecording, isMicrophonePrepared]);

  const allowMicrophone = useCallback(async (): Promise<void> => {
    const kind = permissionKind;
    if (!kind) return;
    const granted = await dictation.requestPermission();
    if (!granted) return;
    setIsMicrophonePrepared(true);
    setPermissionKind(null);
    await beginRecording(kind);
  }, [beginRecording, dictation, permissionKind]);

  const typeCapture = useCallback(async (kind: CaptureKind): Promise<void> => {
    if (!value) return;
    setCaptureKind(kind);
    setPermissionKind(null);
    await persist(transitionScenarioPracticeRun(value, reviewState(kind), Date.now()));
  }, [persist, value]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!value || !captureKind) return;
    const text = await dictation.stop(captureKind === "opener" ? "opener" : "reply");
    if (text) setDraft(text);
    await persist(transitionScenarioPracticeRun(value, reviewState(captureKind), Date.now()));
  }, [captureKind, dictation, persist, value]);

  const confirmOpening = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2) return;
    void unlockAudioPlayback();
    setBusy(true);
    try {
      const approved = preserveScenarioAttempt(value, "opener", draft, Date.now());
      await persist(approved);
      const fallback = selectM1L1PushbackOne(draft, approved.run.id);
      const generated = await generateM1L1DynamicReply({
        scenario: convertedLesson.scenario,
        kind: "pushback_one",
        approvedTranscript: approved.run.attempt?.transcript ?? draft.trim(),
        openingTranscript: approved.run.attempt?.transcript ?? draft.trim(),
        authoredFallback: fallback.text,
        runId: approved.run.id,
      });
      const selected = generated.source === "provider"
        ? m1L1ProviderTurn(approved.run.id, "pushback_one", generated.reply)
        : fallback;
      const isAudioPrepared = await preparePilotAudio(lineFor(selected));
      const withPressure = attachM1L1PushbackOne(approved, selected, Date.now());
      const ready = transitionScenarioPracticeRun(withPressure, "ready_for_response", Date.now());
      await replaceActiveScenarioRunStrict(ready, activeRunRevision(approved));
      setValue(ready);
      setDraft("");
      await afterNextPaint();
      if (isAudioPrepared) await playPreparedPilotAudio();
    } finally {
      setBusy(false);
    }
  }, [convertedLesson.scenario, draft, persist, replaceActiveScenarioRunStrict, value]);

  const confirmFirstResponse = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2) return;
    void unlockAudioPlayback();
    setBusy(true);
    try {
      const approved = preserveScenarioAttempt(value, "response", draft, Date.now());
      await persist(approved);
      const afterResponse = advanceM1L1FirstResponse(approved, Date.now());
      const fallback = m1L1EvidenceTrap(approved.run.id);
      const generated = await generateM1L1DynamicReply({
        scenario: convertedLesson.scenario,
        kind: "evidence_trap",
        approvedTranscript: approved.run.responseAttempt?.transcript ?? draft.trim(),
        openingTranscript: approved.run.attempt?.transcript ?? "",
        firstPushback: approved.run.m1L1?.pushbackOne?.text,
        firstResponse: approved.run.responseAttempt?.transcript ?? draft.trim(),
        authoredFallback: fallback.text,
        runId: approved.run.id,
      });
      const trap = generated.source === "provider"
        ? m1L1ProviderTurn(approved.run.id, "evidence_trap", generated.reply)
        : fallback;
      const isAudioPrepared = await preparePilotAudio(lineFor(trap));
      const withTrap = attachM1L1PushbackTwo(afterResponse, trap, Date.now());
      const note = withTrap.run.attempt && withTrap.run.responseAttempt
        ? m1L1CoachExchange({ opener: withTrap.run.attempt.transcript, firstResponse: withTrap.run.responseAttempt.transcript })
        : null;
      if (!note) return;
      const coached = attachM1L1Coaching(
        withTrap,
        `${note.worked} ${note.change}`,
        note.retryDirection,
        note.coachedBeat,
        note.flags,
        note.selectedDimension,
        Date.now(),
      );
      await replaceActiveScenarioRunStrict(coached, activeRunRevision(approved));
      setValue(coached);
      setDraft("");
      await afterNextPaint();
      if (isAudioPrepared) await playPreparedPilotAudio();
    } finally {
      setBusy(false);
    }
  }, [convertedLesson.scenario, draft, persist, replaceActiveScenarioRunStrict, value]);

  const confirmRetry = useCallback(async (): Promise<void> => {
    if (!value || !lesson?.selectedDimension || draft.trim().length < 2) return;
    const retried = preserveM1L1Retry(value, draft, Date.now());
    const original = lesson.coachedBeat === 1 ? run?.attempt?.transcript : run?.responseAttempt?.transcript;
    const latest = retried.run.retryAttempt?.transcript;
    if (!original || !latest) return;
    const comparison = m1L1Comparison(original, latest, lesson.selectedDimension, lesson.coachedBeat ?? 5);
    const next = {
      ...retried,
      run: {
        ...retried.run,
        state: "attempt_comparison" as const,
        comparison,
        updatedAt: Math.max(Date.now(), retried.run.updatedAt + 1),
      },
    };
    await persist(next);
    setDraft("");
  }, [draft, lesson, persist, run?.attempt?.transcript, run?.responseAttempt?.transcript, value]);

  const replayFlaggedMoment = useCallback(async (isFinal: boolean): Promise<void> => {
    if (!value || !lesson?.coachedBeat) return;
    const staged = stageM1L1PressureReplay(value, isFinal, Date.now());
    if (staged === value) return;
    await replaceActiveScenarioRunStrict(staged, activeRunRevision(value));
    setValue(staged);
    if (staged.run.m1L1?.replayTarget === "top_of_scene") {
      const confirmed = confirmM1L1PressureReplay(staged, "top_of_scene_reset", Date.now());
      await replaceActiveScenarioRunStrict(confirmed, activeRunRevision(staged));
      setValue(confirmed);
      return;
    }
    if (!currentPressure) return;
    const confirmed = await completeM1L1PressureReplay(staged, () => speakPilotAudioToCompletion(lineFor(currentPressure)), Date.now());
    if (confirmed === staged) return;
    await replaceActiveScenarioRunStrict(confirmed, activeRunRevision(staged));
    setValue(confirmed);
  }, [currentPressure, lesson?.coachedBeat, replaceActiveScenarioRunStrict, value]);

  const retryPendingReplay = useCallback(async (): Promise<void> => {
    if (!value || value.run.state !== "replay_pending" || !currentPressure) return;
    const confirmed = await completeM1L1PressureReplay(value, () => speakPilotAudioToCompletion(lineFor(currentPressure)), Date.now());
    if (confirmed === value) return;
    await replaceActiveScenarioRunStrict(confirmed, activeRunRevision(value));
    setValue(confirmed);
  }, [currentPressure, replaceActiveScenarioRunStrict, value]);

  const acknowledgeReplayFallback = useCallback(async (): Promise<void> => {
    if (!value || value.run.state !== "replay_pending") return;
    const confirmed = confirmM1L1PressureReplay(value, "text_fallback_acknowledged", Date.now());
    if (confirmed === value) return;
    await replaceActiveScenarioRunStrict(confirmed, activeRunRevision(value));
    setValue(confirmed);
  }, [replaceActiveScenarioRunStrict, value]);

  const saveAndLeave = useCallback(async (): Promise<void> => {
    try {
      await leaveAfterStrictDictationCleanup(dictation.cancel, () => router.back());
    } catch {
      Alert.alert("Recording cleanup is pending", "Try again before leaving this rehearsal.");
    }
  }, [dictation, router]);

  const discard = useCallback(async (): Promise<void> => {
    try {
      await dictation.cancel();
      await onDiscard();
    } catch {
      Alert.alert("We couldn’t delete this rehearsal", "The rehearsal is still saved on this device. Try again before leaving.");
    }
  }, [dictation, onDiscard]);

  const messages = useMemo(() => [
    run?.attempt ? { id: run.attempt.id, who: "You", text: run.attempt.transcript, mine: true } : null,
    lesson?.pushbackOne ? { id: lesson.pushbackOne.id, who: "Adam", text: lesson.pushbackOne.text, mine: false } : null,
    run?.responseAttempt ? { id: run.responseAttempt.id, who: "You", text: run.responseAttempt.transcript, mine: true } : null,
    lesson?.pushbackTwo ? { id: lesson.pushbackTwo.id, who: "Adam", text: lesson.pushbackTwo.text, mine: false } : null,
  ].filter((item): item is { id: string; who: string; text: string; mine: boolean } => Boolean(item)), [lesson, run]);
  const autoScrollSignature = `${messages.map((message) => message.id).join(":")}|${busy ? "thinking" : "idle"}|${run?.state ?? "unavailable"}|${run?.coachNote ?? ""}`;
  const previousAutoScrollSignatureRef = useRef<string>(autoScrollSignature);

  useEffect(() => {
    if (previousAutoScrollSignatureRef.current === autoScrollSignature) return;
    previousAutoScrollSignatureRef.current = autoScrollSignature;
    shouldAutoScrollRef.current = true;
    requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }));
  }, [autoScrollSignature]);

  const handleContentSizeChange = useCallback((): void => {
    if (!shouldAutoScrollRef.current) return;
    shouldAutoScrollRef.current = false;
    scrollViewRef.current?.scrollToEnd({ animated: true });
  }, []);

  if (!value || !run || !lesson) {
    return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>This rehearsal is unavailable.</Text><Text style={styles.body}>Return to the lesson and start the accepted M1 L1 work rehearsal.</Text></View>;
  }

  const state = run.state;
  const isListening = state.startsWith("listening_");
  const isReview = state.startsWith("confirm_") && !busy;
  const goodVersion = lesson.selectedDimension && lesson.coachedBeat
    ? m1L1GoodVersion(lesson.selectedDimension, lesson.coachedBeat)
    : null;

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => Alert.alert("Leave this rehearsal?", "Your active rehearsal stays saved unless you explicitly discard it.", [{ text: "Keep practicing", style: "cancel" }, { text: "Save and leave", onPress: () => { void saveAndLeave(); } }, { text: "Discard", style: "destructive", onPress: () => void discard() }])} style={styles.hit} accessibilityRole="button" accessibilityLabel="Leave rehearsal"><X size={21} color={C.textSoft} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>Adam · your colleague</Text><Text style={styles.headerMeta}>{progressLabel}</Text></View><View style={styles.hit} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView ref={scrollViewRef} contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled" onContentSizeChange={handleContentSizeChange}>
        <StatusPill label="WORK · M1 L1" tone="purple" /><Text style={styles.scenarioTitle}>{convertedLesson.scenario.title}</Text><Text style={styles.context}>{convertedLesson.scenario.situation}</Text>
        <View accessible accessibilityLabel={`${progressLabel}. Seven-step rehearsal progress.`} style={styles.progress}><View style={[styles.progressFill, { width: `${(step / 7) * 100}%` }]} /></View>
        {messages.map((message) => <View key={message.id} style={[styles.messageWrap, message.mine ? styles.mine : styles.theirs]}><Text style={styles.messageLabel}>{message.who}</Text><View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleTheirs]}><Text style={[styles.messageText, message.mine ? styles.messageTextMine : null]}>{message.text}</Text></View></View>)}
        {busy && (state === "confirm_attempt_transcript" || state === "confirm_response_transcript") ? <View style={[styles.messageWrap, styles.theirs]} accessibilityLiveRegion="polite" accessibilityLabel="Adam is thinking"><Text style={styles.messageLabel}>Adam</Text><View style={[styles.bubble, styles.bubbleTheirs, styles.thinkingBubble]}><Thinking /><Text style={styles.thinkingText}>Adam is thinking…</Text></View></View> : null}

        {permissionKind ? <ProductCard accent style={styles.card}><SectionLabel tone={C.purple}>Use your voice for this rehearsal</SectionLabel><Text style={styles.body}>Microphone access is used only for the turn you choose to record. You can type instead.</Text>{dictation.status === "denied" ? <><Text style={styles.title}>Microphone access is off</Text><PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} containerStyle={styles.action} /></> : <PrimaryButton label="Allow microphone" onPress={() => void allowMicrophone()} containerStyle={styles.action} />}<Pressable onPress={() => void typeCapture(permissionKind)} style={styles.secondary}><Text style={styles.secondaryText}>Type this turn instead</Text></Pressable></ProductCard> : null}
        {state === "ready_for_attempt" ? <Reveal><Text style={styles.title}>Open the conversation.</Text><Pressable onPress={() => setIsOpenerHintVisible((current) => !current)} style={styles.hintButton} accessibilityRole="button" accessibilityState={{ expanded: isOpenerHintVisible }}><Text style={styles.hintButtonText}>Need help starting?</Text></Pressable>{isOpenerHintVisible ? <ProductCard style={styles.hintCard}><SectionLabel tone={C.purple}>A way to think about it</SectionLabel><Text style={styles.body}>Describe one thing Adam could have done differently. Then say what you need going forward.</Text></ProductCard> : null}<Capture title="Your opener" kind="opener" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /></Reveal> : null}
        {state === "ready_for_response" && lesson.pushbackOne ? <Capture title="Respond to Pushback 1." kind="response-one" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {isListening ? <Reveal><Text style={styles.title}>Recording this turn.</Text><MicControl state="listening" level={dictation.level} onPress={() => void stopRecording()} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.body}>Stopping does not submit. You approve the transcript next.</Text></Reveal> : null}
        {isReview ? <Reveal><StatusPill label="Transcript review" tone="purple" /><Text style={styles.title}>Approve this exact transcript.</Text><TextInput value={draft} onChangeText={setDraft} multiline style={styles.input} accessibilityLabel="Edit confirmed transcript" /><PrimaryButton label="Approve this transcript" disabled={draft.trim().length < 2} onPress={() => void (captureKind === "opener" ? confirmOpening() : captureKind === "response-one" ? confirmFirstResponse() : confirmRetry())} containerStyle={styles.action} /></Reveal> : null}
        {state === "hope_coaching" && lesson.coachedBeat ? <Reveal><StatusPill label="Hope · one observed behavior" tone="purple" /><ProductCard accent style={styles.card}><Text style={styles.body}>{run.coachNote}</Text><SectionLabel tone={C.purple}>Exact-moment retry</SectionLabel><Text style={styles.body}>{run.retryInstruction}</Text></ProductCard><PrimaryButton label={lesson.coachedBeat === 1 ? "Reset to the top of the scene" : "Replay the exact flagged pressure"} onPress={() => void replayFlaggedMoment(false)} containerStyle={styles.action} /></Reveal> : null}
        {state === "ready_for_retry" ? <Capture title="Retry only the flagged moment." kind="retry" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {state === "replay_pending" ? <Reveal><StatusPill label="Replay required" tone="amber" /><Text style={styles.title}>The exact pressure did not finish starting.</Text><Text style={styles.body}>{currentPressure?.text ?? "Return to the top of the scene and retry your opener."}</Text>{currentPressure ? <><PrimaryButton label="Try the exact audio again" onPress={() => void retryPendingReplay()} containerStyle={styles.action} /><Pressable onPress={() => void acknowledgeReplayFallback()} style={styles.secondary}><Text style={styles.secondaryText}>I read the exact pressure — continue</Text></Pressable></> : null}</Reveal> : null}
        {state === "attempt_comparison" && run.comparison ? <Reveal><StatusPill label="Final feedback" tone="purple" /><Text style={styles.title}>What changed or held</Text><Text style={styles.body}>{run.comparison.text}</Text>{goodVersion ? <ProductCard accent style={styles.card}><SectionLabel tone={C.purple}>A strong version</SectionLabel><Text style={styles.body}>{goodVersion}</Text></ProductCard> : null}<PrimaryButton label="Return to the lesson" onPress={() => onReturnToDeck(run.id)} containerStyle={styles.action} /></Reveal> : null}
        {speech.phase === "failed" ? <PrimaryButton label="Try the same audio again" onPress={() => void replaySpeech()} containerStyle={styles.action} /> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  </View>;
}

function Capture({ title, kind, value, onChange, onRecord, onType }: { title: string; kind: CaptureKind; value: string; onChange: (text: string) => void; onRecord: (kind: CaptureKind) => Promise<void>; onType: (kind: CaptureKind) => Promise<void> }): React.JSX.Element {
  return <Reveal><Text style={styles.title}>{title}</Text><View style={styles.capture}><MicControl state="ready" onPress={() => void onRecord(kind)} glyph={<Mic size={28} color={C.purple} />} accessibilityLabel="Start recording" /><Text style={styles.or}>OR TYPE AS AN ACCESSIBLE FALLBACK</Text><TextInput value={value} onChangeText={onChange} multiline style={styles.input} /><PrimaryButton label="Review typed transcript" disabled={value.trim().length < 2} onPress={() => void onType(kind)} containerStyle={styles.action} /></View></Reveal>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, center: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  header: { minHeight: 70, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, hit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, alignItems: "center" }, headerTitle: { fontFamily: font.bold, fontSize: 17, color: C.text }, headerMeta: { ...T.caption, color: C.purple, marginTop: 2 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 12 }, scenarioTitle: { ...T.title, marginTop: 10 }, context: { ...T.support, marginTop: 7 }, progress: { height: 5, borderRadius: 3, backgroundColor: C.track, overflow: "hidden", marginTop: 14 }, progressFill: { height: "100%", backgroundColor: C.purple },
  title: { ...T.title, marginTop: 22 }, body: { ...T.support, marginTop: 8 }, action: { marginTop: 18 }, capture: { alignItems: "center", marginTop: 18 }, or: { ...T.caption, marginVertical: 16 }, input: { ...T.body, minHeight: 108, width: "100%", backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.md, padding: 16, textAlignVertical: "top" },
  card: { marginTop: 16, gap: 10 }, hintButton: { minHeight: 44, alignSelf: "flex-start", justifyContent: "center", marginTop: 6 }, hintButtonText: { ...T.support, color: C.purple, fontFamily: font.semi }, hintCard: { marginTop: 4, gap: 2 }, secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" }, secondaryText: { ...T.caption, color: C.purple, fontFamily: font.semi },
  messageWrap: { maxWidth: "84%", marginTop: 10 }, thinkingBubble: { minWidth: 156, flexDirection: "row", alignItems: "center", gap: 10 }, thinkingText: { ...T.caption, color: C.textSoft }, mine: { alignSelf: "flex-end", alignItems: "flex-end" }, theirs: { alignSelf: "flex-start", alignItems: "flex-start" }, messageLabel: { ...T.caption, fontFamily: font.semi, marginBottom: 4 }, bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 }, bubbleMine: { backgroundColor: C.purple }, bubbleTheirs: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.line }, messageText: { ...T.support, color: C.text }, messageTextMine: { color: C.onAccent },
});
