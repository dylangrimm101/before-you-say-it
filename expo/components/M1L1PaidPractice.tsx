import { useRouter } from "expo-router";
import { Mic, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { Backdrop, MicControl, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import {
  m1L1BehaviorFlags,
  m1L1CoachExchange,
  m1L1Comparison,
  m1L1EvidenceTrap,
  selectM1L1PushbackOne,
  type ConvertedLessonConfig,
} from "@/lib/convertedLesson";
import {
  advanceM1L1FirstResponse,
  attachM1L1Coaching,
  confirmM1L1PressureReplay,
  completeM1L1PressureReplay,
  attachM1L1PushbackOne,
  attachM1L1PushbackTwo,
  preserveM1L1Retry,
  preserveM1L1SecondResponse,
  preserveScenarioAttempt,
  scenarioRunForRoute,
  stageM1L1PressureReplay,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
} from "@/lib/scenarioPractice";
import { leaveAfterStrictDictationCleanup } from "@/lib/temporaryRecording";
import { useDictation } from "@/lib/useDictation";
import { replaySpeech, resetSpeech, speakPilotAudio, speakPilotAudioToCompletion, useSpeech } from "@/lib/voice";
import { useStore } from "@/providers/store";

interface M1L1PaidPracticeProps {
  requestedRunId?: string;
  convertedLesson: ConvertedLessonConfig;
  onReturnToDeck: (runId: string) => void;
  onDiscard: () => Promise<void>;
}

type CaptureKind = "opener" | "response-one" | "response-two" | "retry" | "final-retry";

function reviewState(kind: CaptureKind): PersistedScenarioPracticeRun["run"]["state"] {
  if (kind === "opener") return "confirm_attempt_transcript";
  if (kind === "response-one") return "confirm_response_transcript";
  if (kind === "response-two") return "confirm_second_response_transcript";
  if (kind === "final-retry") return "confirm_final_retry_transcript";
  return "confirm_retry_transcript";
}

function listeningState(kind: CaptureKind): PersistedScenarioPracticeRun["run"]["state"] {
  if (kind === "opener") return "listening_attempt";
  if (kind === "response-one") return "listening_response";
  if (kind === "response-two") return "listening_second_response";
  if (kind === "final-retry") return "listening_final_retry";
  return "listening_retry";
}

function lineFor(turn: NonNullable<PersistedScenarioPracticeRun["run"]["counterpartTurn"]>) {
  return {
    audio_id: turn.resolvedAudioId ?? turn.id,
    voice_key: turn.semanticVoiceKey ?? "contextual_counterpart",
    text: turn.text,
  } as const;
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
  const currentPressure = lesson?.coachedBeat === 3 ? lesson.pushbackOne : lesson?.coachedBeat === 5 ? lesson.pushbackTwo : undefined;
  const step = lesson?.beat ?? 1;
  const progressLabel = `Step ${step} of 8`;

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
    setBusy(true);
    const approved = preserveScenarioAttempt(value, "opener", draft, Date.now());
    const selected = selectM1L1PushbackOne(draft, approved.run.id);
    const withPressure = attachM1L1PushbackOne(approved, selected, Date.now());
    const ready = transitionScenarioPracticeRun(withPressure, "ready_for_response", Date.now());
    await persist(ready);
    setDraft("");
    await speakPilotAudio(lineFor(selected));
    setBusy(false);
  }, [draft, persist, value]);

  const confirmFirstResponse = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2) return;
    const approved = preserveScenarioAttempt(value, "response", draft, Date.now());
    const afterResponse = advanceM1L1FirstResponse(approved, Date.now());
    const trap = m1L1EvidenceTrap(approved.run.id);
    const withTrap = attachM1L1PushbackTwo(afterResponse, trap, Date.now());
    await persist(withTrap);
    setDraft("");
    await speakPilotAudio(lineFor(trap));
  }, [draft, persist, value]);

  const confirmSecondResponse = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2) return;
    const approved = preserveM1L1SecondResponse(value, draft, Date.now());
    const note = run?.attempt && run.responseAttempt
      ? m1L1CoachExchange({ opener: run.attempt.transcript, firstResponse: run.responseAttempt.transcript, secondResponse: draft })
      : null;
    if (!note) return;
    const coached = attachM1L1Coaching(
      approved,
      `${note.worked} ${note.change}`,
      note.retryDirection,
      note.coachedBeat,
      note.flags,
      note.selectedDimension,
      Date.now(),
    );
    await persist(coached);
    setDraft("");
  }, [draft, persist, run?.attempt, run?.responseAttempt, value]);

  const confirmRetry = useCallback(async (isFinal: boolean): Promise<void> => {
    if (!value || !lesson?.selectedDimension || draft.trim().length < 2) return;
    const retried = preserveM1L1Retry(value, draft, Date.now());
    const original = lesson.coachedBeat === 1 ? run?.attempt?.transcript : lesson.coachedBeat === 3 ? run?.responseAttempt?.transcript : lesson.secondResponseAttempt?.transcript;
    const latest = retried.run.m1L1?.finalRetryAttempt?.transcript ?? retried.run.retryAttempt?.transcript;
    if (!original || !latest) return;
    const comparison = m1L1Comparison(original, latest, lesson.selectedDimension, lesson.coachedBeat ?? 5);
    const afterFlags = m1L1BehaviorFlags(latest, lesson.coachedBeat ?? 5);
    const selectedAfter = afterFlags.find((item) => item.dimension === lesson.selectedDimension)?.status;
    const shouldOfferFinal = !isFinal && selectedAfter !== "met" && (retried.run.m1L1?.retryCount ?? 0) < convertedLesson.retryCap;
    const next = {
      ...retried,
      run: {
        ...retried.run,
        state: shouldOfferFinal ? "final_retry_available" as const : "attempt_comparison" as const,
        comparison,
        updatedAt: Math.max(Date.now(), retried.run.updatedAt + 1),
      },
    };
    await persist(next);
    setDraft("");
  }, [convertedLesson.retryCap, draft, lesson, persist, run?.attempt?.transcript, run?.responseAttempt?.transcript, value]);

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
    lesson?.secondResponseAttempt ? { id: lesson.secondResponseAttempt.id, who: "You", text: lesson.secondResponseAttempt.transcript, mine: true } : null,
  ].filter((item): item is { id: string; who: string; text: string; mine: boolean } => Boolean(item)), [lesson, run]);

  if (!value || !run || !lesson) {
    return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>This rehearsal is unavailable.</Text><Text style={styles.body}>Return to the lesson and start the accepted M1 L1 work rehearsal.</Text></View>;
  }

  const state = run.state;
  const isListening = state.startsWith("listening_");
  const isReview = state.startsWith("confirm_");

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => Alert.alert("Leave this rehearsal?", "Your active rehearsal stays saved unless you explicitly discard it.", [{ text: "Keep practicing", style: "cancel" }, { text: "Save and leave", onPress: () => { void saveAndLeave(); } }, { text: "Discard", style: "destructive", onPress: () => void discard() }])} style={styles.hit} accessibilityRole="button" accessibilityLabel="Leave rehearsal"><X size={21} color={C.textSoft} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>Adam · your colleague</Text><Text style={styles.headerMeta}>{progressLabel}</Text></View><View style={styles.hit} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 120 }]} keyboardShouldPersistTaps="handled">
        <StatusPill label="WORK · M1 L1" tone="purple" /><Text style={styles.scenarioTitle}>{convertedLesson.scenario.title}</Text><Text style={styles.context}>{convertedLesson.scenario.situation}</Text>
        <View accessible accessibilityLabel={`${progressLabel}. Eight-beat rehearsal progress.`} style={styles.progress}><View style={[styles.progressFill, { width: `${(step / 8) * 100}%` }]} /></View>
        {messages.map((message) => <View key={message.id} style={[styles.messageWrap, message.mine ? styles.mine : styles.theirs]}><Text style={styles.messageLabel}>{message.who}</Text><View style={[styles.bubble, message.mine ? styles.bubbleMine : styles.bubbleTheirs]}><Text style={[styles.messageText, message.mine ? styles.messageTextMine : null]}>{message.text}</Text></View></View>)}

        {permissionKind ? <ProductCard accent style={styles.card}><SectionLabel tone={C.purple}>Use your voice for this rehearsal</SectionLabel><Text style={styles.body}>Microphone access is used only for the turn you choose to record. You can type instead.</Text>{dictation.status === "denied" ? <><Text style={styles.title}>Microphone access is off</Text><PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} containerStyle={styles.action} /></> : <PrimaryButton label="Allow microphone" onPress={() => void allowMicrophone()} containerStyle={styles.action} />}<Pressable onPress={() => void typeCapture(permissionKind)} style={styles.secondary}><Text style={styles.secondaryText}>Type this turn instead</Text></Pressable></ProductCard> : null}
        {state === "ready_for_attempt" ? <Capture title="Open with one point, one proof, and one move." kind="opener" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {state === "ready_for_response" && lesson.pushbackOne ? <Capture title="Respond to Pushback 1." kind="response-one" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {state === "ready_for_second_response" && lesson.pushbackTwo ? <Capture title="Respond to the evidence trap." kind="response-two" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {isListening ? <Reveal><Text style={styles.title}>Recording this turn.</Text><MicControl state="listening" level={dictation.level} onPress={() => void stopRecording()} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.body}>Stopping does not submit. You approve the transcript next.</Text></Reveal> : null}
        {isReview ? <Reveal><StatusPill label="Transcript review" tone="purple" /><Text style={styles.title}>Approve this exact transcript.</Text><TextInput value={draft} onChangeText={setDraft} multiline style={styles.input} accessibilityLabel="Edit confirmed transcript" /><PrimaryButton label="Approve this transcript" disabled={draft.trim().length < 2 || busy} onPress={() => void (captureKind === "opener" ? confirmOpening() : captureKind === "response-one" ? confirmFirstResponse() : captureKind === "response-two" ? confirmSecondResponse() : confirmRetry(captureKind === "final-retry"))} containerStyle={styles.action} />{busy ? <ActivityIndicator color={C.purple} /> : null}</Reveal> : null}
        {state === "hope_coaching" && lesson.coachedBeat ? <Reveal><StatusPill label="Hope · one observed behavior" tone="purple" /><ProductCard accent style={styles.card}><Text style={styles.body}>{run.coachNote}</Text><SectionLabel tone={C.purple}>Exact-moment retry</SectionLabel><Text style={styles.body}>{run.retryInstruction}</Text></ProductCard><PrimaryButton label={lesson.coachedBeat === 1 ? "Reset to the top of the scene" : "Replay the exact flagged pressure"} onPress={() => void replayFlaggedMoment(false)} containerStyle={styles.action} /></Reveal> : null}
        {state === "ready_for_retry" ? <Capture title="Retry only the flagged moment." kind="retry" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /> : null}
        {state === "final_retry_available" && lesson.coachedBeat ? <Reveal><StatusPill label="Optional final retry · 2 of 2" tone="amber" /><Text style={styles.title}>One final retry is available.</Text><Text style={styles.body}>Replay the same exact moment before final capture, or continue to the behavior-only comparison.</Text><PrimaryButton label={lesson.coachedBeat === 1 ? "Reset to the top of the scene" : "Replay the exact pressure"} onPress={() => void replayFlaggedMoment(true)} containerStyle={styles.action} /><Pressable onPress={() => void persist(transitionScenarioPracticeRun(value, "attempt_comparison", Date.now()))} style={styles.secondary}><Text style={styles.secondaryText}>Continue without another retry</Text></Pressable></Reveal> : null}
        {state === "replay_pending" ? <Reveal><StatusPill label="Replay required" tone="amber" /><Text style={styles.title}>The exact pressure did not finish starting.</Text><Text style={styles.body}>{currentPressure?.text ?? "Return to the top of the scene and retry your opener."}</Text>{currentPressure ? <><PrimaryButton label="Try the exact audio again" onPress={() => void retryPendingReplay()} containerStyle={styles.action} /><Pressable onPress={() => void acknowledgeReplayFallback()} style={styles.secondary}><Text style={styles.secondaryText}>I read the exact pressure — continue</Text></Pressable></> : null}</Reveal> : null}
        {state === "ready_for_final_retry_capture" ? <Reveal><StatusPill label="Exact moment replayed" tone="purple" /><Capture title="Final retry" kind="final-retry" value={draft} onChange={setDraft} onRecord={requestCapture} onType={typeCapture} /></Reveal> : null}
        {state === "attempt_comparison" && run.comparison ? <Reveal><StatusPill label="Behavior-only comparison" tone="purple" /><Text style={styles.title}>What changed or held</Text><Text style={styles.body}>{run.comparison.text}</Text><PrimaryButton label="Return to the lesson" onPress={() => onReturnToDeck(run.id)} containerStyle={styles.action} /></Reveal> : null}
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
  card: { marginTop: 16, gap: 10 }, secondary: { minHeight: 44, alignItems: "center", justifyContent: "center" }, secondaryText: { ...T.caption, color: C.purple, fontFamily: font.semi },
  messageWrap: { maxWidth: "84%", marginTop: 10 }, mine: { alignSelf: "flex-end", alignItems: "flex-end" }, theirs: { alignSelf: "flex-start", alignItems: "flex-start" }, messageLabel: { ...T.caption, fontFamily: font.semi, marginBottom: 4 }, bubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 }, bubbleMine: { backgroundColor: C.purple }, bubbleTheirs: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.line }, messageText: { ...T.support, color: C.text }, messageTextMine: { color: C.onAccent },
});
