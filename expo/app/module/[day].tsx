import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Mic, Play, RotateCcw, Square, Volume2, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, Eyebrow, GlassCard, GhostButton, MicControl, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { curriculumModule, isModuleId, practiceDayForRoute, type ModuleId } from "@/constants/modules";
import { evaluatePilotAttempt, nextPilotCounterpart } from "@/lib/ai";
import { canContinuePilot } from "@/lib/access";
import { microphoneRecoveryPresentation } from "@/lib/nativeCommerce";
import { paidActivityForState } from "@/lib/paidProduct";
import {
  canCompletePilotRun,
  comparePilotAttempts,
  isPilotModuleUnlocked,
  pilotComparisonPresentation,
  pilotRetrySegment,
  pilotModule,
  selectDay8Pushback,
} from "@/lib/pilotCurriculum";
import {
  createPilotDayRun,
  createPresetPracticeSession,
  preserveDayOneRetry,
  preservePilotAttempt,
  transitionPilotRun,
  upsertPilotDayRun,
  type ActivePracticeSession,
} from "@/lib/practiceSession";
import { useDictation } from "@/lib/useDictation";
import { replaySpeech, resetSpeech, speakPilotAudio, stopSpeech, useSpeech } from "@/lib/voice";
import { useStore } from "@/providers/store";
import type { PilotAttemptKind, PilotAudioLine, PilotCoachResponse, PilotDayRun, PilotModuleState } from "@/types/pilotCurriculum";

const DAY_ONE_RECOVERY_HEADING = "We couldn’t recover your first attempt";
const DAY_ONE_RECOVERY_BODY = "Choose another conversation to continue your practice.";
const RETRY_INVITATION = "Try that same moment again.";

export default function PilotModuleScreen() {
  const params = useLocalSearchParams<{ day: string }>();
  const routeValue = String(params.day);
  const moduleId: ModuleId | null = isModuleId(routeValue) ? routeValue : null;
  const curriculum = curriculumModule(moduleId);
  const day = practiceDayForRoute(routeValue) ?? Number.NaN;
  const module = pilotModule(day);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    access,
    anonymousUserId,
    pilotDoneDays,
    markPilotDayDone,
    activePracticeSession,
    saveActivePracticeSession,
  } = useStore();
  const speech = useSpeech();
  const attemptDictation = useDictation();
  const responseDictation = useDictation();
  const retryDictation = useDictation();
  const [session, setSession] = useState<ActivePracticeSession | null>(activePracticeSession);
  const initialRun = useMemo(() => session && module ? createPilotDayRun(session, module.day, Date.now(), moduleId ?? undefined) : null, [module, moduleId, session]);
  const [run, setRun] = useState<PilotDayRun | null>(initialRun);
  const [state, setState] = useState<PilotModuleState>(day === 1 ? dayOneScreenState(activePracticeSession) : initialRun?.state ?? "module_preview");
  const [lessonIndex, setLessonIndex] = useState<number>(initialRun?.lessonIndex ?? 0);
  const [quizChoice, setQuizChoice] = useState<"A" | "B" | null>(initialRun?.quizChoice ?? null);
  const [activeCapture, setActiveCapture] = useState<PilotAttemptKind>("opener");
  const [attemptText, setAttemptText] = useState<string>(day === 1 ? activePracticeSession?.attemptOne?.transcript ?? "" : initialRun?.attempt?.transcript ?? "");
  const [responseText, setResponseText] = useState<string>(initialRun?.responseAttempt?.transcript ?? "");
  const [retryText, setRetryText] = useState<string>(day === 1 ? activePracticeSession?.attemptTwo?.transcript ?? "" : initialRun?.retryAttempt?.transcript ?? "");
  const [coach, setCoach] = useState<PilotCoachResponse | null>(null);
  const [hasReplayedDayOneAdam, setHasReplayedDayOneAdam] = useState<boolean>(false);
  const isMuted = false;
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!activePracticeSession || activePracticeSession.id === session?.id) return;
    setSession(activePracticeSession);
    if (module) {
      const restored = createPilotDayRun(activePracticeSession, module.day, Date.now(), moduleId ?? undefined);
      setRun(restored);
      if (day !== 1) setState(restored.state);
    }
  }, [activePracticeSession, day, module, moduleId, session?.id]);

  const cancelAttempt = attemptDictation.cancel;
  const cancelResponse = responseDictation.cancel;
  const cancelRetry = retryDictation.cancel;
  useEffect(() => () => {
    resetSpeech().catch(() => {});
    cancelAttempt().catch(() => {});
    cancelResponse().catch(() => {});
    cancelRetry().catch(() => {});
  }, [cancelAttempt, cancelResponse, cancelRetry]);

  const dictation = activeCapture === "opener" ? attemptDictation : activeCapture === "response" ? responseDictation : retryDictation;
  const setCaptureText = activeCapture === "opener" ? setAttemptText : activeCapture === "response" ? setResponseText : setRetryText;

  useEffect(() => {
    if ((dictation.status === "denied" || dictation.status === "error") && state.startsWith("listening")) {
      setError(dictation.error);
      if (dictation.status === "denied") setState("microphone_error");
      else if (/nothing|no speech|silent|didn.t catch/i.test(dictation.error)) setState("no_speech");
      else setState("transcription_error");
    }
  }, [dictation.error, dictation.status, state]);

  const persistRun = useCallback(async (next: PilotDayRun, baseSession?: ActivePracticeSession): Promise<void> => {
    const targetSession = baseSession ?? session;
    if (!targetSession) return;
    const nextSession = upsertPilotDayRun(targetSession, next);
    setRun(next);
    setSession(nextSession);
    setState(next.state);
    await saveActivePracticeSession(nextSession);
  }, [saveActivePracticeSession, session]);

  const ensureSessionAndRun = useCallback(async (): Promise<{ base: ActivePracticeSession; run: PilotDayRun } | null> => {
    if (!module) return null;
    const base = session ?? createPresetPracticeSession(anonymousUserId);
    const next = createPilotDayRun(base, module.day, Date.now(), moduleId ?? undefined);
    if (!session) {
      setSession(base);
      await saveActivePracticeSession(base);
    }
    setRun(next);
    return { base, run: next };
  }, [anonymousUserId, module, moduleId, saveActivePracticeSession, session]);

  const persistLegacyDayOne = useCallback(async (changes: Partial<ActivePracticeSession>): Promise<void> => {
    if (!session) return;
    const next = { ...session, ...changes, updatedAt: Date.now() };
    setSession(next);
    await saveActivePracticeSession(next);
  }, [saveActivePracticeSession, session]);

  const startDay = useCallback(async (): Promise<void> => {
    if (!module) return;
    if (day === 1) {
      if (!session?.attemptOne || !session.originalAdamResponse) return;
      setAttemptText(session.attemptOne.transcript);
      setState("hope_coaching");
      if (!session.coachNote || !session.coachedBehaviorId) {
        const result = await evaluatePilotAttempt(module, session.attemptOne.transcript, session.originalAdamResponse.text);
        setCoach(result);
        await persistLegacyDayOne({
          coachNote: result.note,
          retryInstruction: result.retryInstruction ?? module.retry.direction,
          coachedBehaviorId: result.behaviorId ?? module.primary_behavior_id,
          nextState: "focused_coach_note",
        });
      }
      return;
    }
    const prepared = await ensureSessionAndRun();
    if (!prepared) return;
    const next = transitionPilotRun({ ...prepared.run, lessonIndex: 0 }, "hope_lesson");
    setLessonIndex(0);
    await persistRun(next, prepared.base);
  }, [day, ensureSessionAndRun, module, persistLegacyDayOne, persistRun, session]);

  const chooseCarriedContext = useCallback(async (): Promise<void> => {
    if (day === 1) {
      router.push("/custom");
      return;
    }
    const prepared = await ensureSessionAndRun();
    if (!prepared) return;
    await persistRun({ ...prepared.run, scenarioMode: "carried_context", state: "hope_lesson", updatedAt: Date.now() }, prepared.base);
  }, [day, ensureSessionAndRun, persistRun, router]);

  const nextLesson = useCallback(async (): Promise<void> => {
    if (!module || !run) return;
    if (lessonIndex < module.copy.lessons.length - 1) {
      const nextIndex = lessonIndex + 1;
      setLessonIndex(nextIndex);
      await persistRun({ ...run, lessonIndex: nextIndex, updatedAt: Date.now() });
      return;
    }
    await persistRun(transitionPilotRun(run, "quiz"));
  }, [lessonIndex, module, persistRun, run]);

  const chooseQuiz = useCallback(async (choice: "A" | "B"): Promise<void> => {
    if (!run) return;
    setQuizChoice(choice);
    await persistRun({ ...transitionPilotRun(run, "quiz_feedback"), quizChoice: choice });
  }, [persistRun, run]);

  const startRehearsal = useCallback(async (): Promise<void> => {
    if (!module || !run) return;
    if (module.day === 4 || module.day === 5) {
      try {
        const response = await nextPilotCounterpart(module, "", run.id);
        const line = module.practice.adam_line;
        if (!line || !response.spokenText) return;
        const withCounterpart = { ...transitionPilotRun(run, "adam_response"), adamReactionId: response.reactionId, adamAudioId: response.audioId ?? line.audio_id };
        await persistRun(withCounterpart);
        const playback = await speakPilotAudio(line, { muted: isMuted });
        if (playback === "failed" || playback === "empty") {
          setError("The audio would not play. The counterpart’s words remain visible.");
          await persistRun(transitionPilotRun(withCounterpart, "playback_error"));
          return;
        }
        await persistRun(transitionPilotRun(withCounterpart, "ready_for_response"));
      } catch {
        setError("The counterpart response could not be reached. Your checkpoint is saved.");
        await persistRun(transitionPilotRun(run, "network_error"));
      }
      return;
    }
    setActiveCapture("opener");
    await persistRun(transitionPilotRun(run, "ready_for_attempt"));
  }, [isMuted, module, persistRun, run]);

  const startCapture = useCallback(async (kind: PilotAttemptKind): Promise<void> => {
    await stopSpeech();
    setError("");
    setActiveCapture(kind);
    const selected = kind === "opener" ? attemptDictation : kind === "response" ? responseDictation : retryDictation;
    await selected.start();
    setState(kind === "opener" ? "listening_attempt" : kind === "response" ? "listening_response" : "listening_retry");
  }, [attemptDictation, responseDictation, retryDictation]);

  const stopCapture = useCallback(async (): Promise<void> => {
    const text = await dictation.stop();
    if (text) setCaptureText(text);
    const reviewState: PilotModuleState = activeCapture === "opener" ? "confirm_attempt_transcript" : activeCapture === "response" ? "confirm_response_transcript" : "confirm_retry_transcript";
    if (day !== 1 && run) await persistRun(transitionPilotRun(run, reviewState));
    else {
      if (activeCapture === "retry") await persistLegacyDayOne({ nextState: "confirm_retry_transcript" });
      setState(reviewState);
    }
  }, [activeCapture, day, dictation, persistLegacyDayOne, persistRun, run, setCaptureText]);

  const openTypedFallback = useCallback(async (): Promise<void> => {
    const reviewState: PilotModuleState = activeCapture === "opener" ? "confirm_attempt_transcript" : activeCapture === "response" ? "confirm_response_transcript" : "confirm_retry_transcript";
    setError("");
    if (day === 1) {
      if (activeCapture === "retry") await persistLegacyDayOne({ nextState: "confirm_retry_transcript" });
      setState(reviewState);
    } else if (run) await persistRun(transitionPilotRun(run, reviewState));
  }, [activeCapture, day, persistLegacyDayOne, persistRun, run]);

  const playAdam = useCallback(async (baseRun: PilotDayRun, confirmedAttempt: string): Promise<void> => {
    if (!module) return;
    let response;
    try {
      response = await nextPilotCounterpart(module, confirmedAttempt, baseRun.id);
    } catch {
      setError("The counterpart response could not be reached. Your approved turn is still saved.");
      await persistRun(transitionPilotRun(baseRun, "network_error"));
      return;
    }
    const line = module.day === 8
      ? (module.practice.approved_pushback_bank ?? []).find((item) => item.audio_id === response.audioId)
      : module.practice.adam_line;
    if (!line || !response.spokenText) throw new Error("Approved Adam audio is unavailable");
    const withAdam: PilotDayRun = {
      ...baseRun,
      state: "adam_response",
      adamReactionId: response.reactionId,
      adamAudioId: line.audio_id,
      updatedAt: Date.now(),
    };
    await persistRun(withAdam);
    const playback = await speakPilotAudio(line, { muted: isMuted });
    if (playback === "failed" || playback === "empty") {
      setError("The audio would not play. The counterpart’s words remain visible.");
      await persistRun(transitionPilotRun(withAdam, "playback_error"));
      return;
    }
    await persistRun(transitionPilotRun(withAdam, "ready_for_response"));
  }, [isMuted, module, persistRun]);

  const confirmAttempt = useCallback(async (): Promise<void> => {
    if (!run || attemptText.trim().length < 2) return;
    const preserved = preservePilotAttempt(run, "opener", attemptText);
    await persistRun(preserved);
    await playAdam(preserved, preserved.attempt?.transcript ?? attemptText);
  }, [attemptText, persistRun, playAdam, run]);

  const confirmResponse = useCallback(async (): Promise<void> => {
    if (!module || !run || responseText.trim().length < 2) return;
    const preserved = preservePilotAttempt(run, "response", responseText);
    await persistRun(transitionPilotRun(preserved, "hope_coaching"));
    const coachingTranscript = module.day === 2 || module.day === 8
      ? `${preserved.attempt?.transcript ?? ""}\n${preserved.responseAttempt?.transcript ?? responseText}`
      : preserved.responseAttempt?.transcript ?? responseText;
    const adamText = adamLineForRun(preserved, module)?.text ?? "";
    let result: PilotCoachResponse;
    try {
      result = await evaluatePilotAttempt(module, coachingTranscript, adamText);
    } catch {
      setError("Hope could not finish the feedback. Your approved transcripts are still saved.");
      await persistRun(transitionPilotRun(preserved, "model_error"));
      return;
    }
    setCoach(result);
    const coachedBehaviorId = result.behaviorId ?? module.primary_behavior_id;
    const withCoach: PilotDayRun = {
      ...preserved,
      state: module.day === 3 ? "day3_note_check" : "hope_coaching",
      coachNote: result.note,
      retryInstruction: result.retryInstruction ?? module.retry.direction,
      coachedBehaviorId,
      updatedAt: Date.now(),
    };
    await persistRun(withCoach);
  }, [module, persistRun, responseText, run]);

  const beginRetry = useCallback(async (): Promise<void> => {
    if (!module || !run) return;
    if (pilotRetrySegment(module.day, run.coachedBehaviorId) === "opener") {
      setActiveCapture("retry");
      await persistRun(transitionPilotRun(run, "ready_for_retry"));
      return;
    }
    const adamLine = adamLineForRun(run, module);
    if (adamLine) await speakPilotAudio(adamLine, { muted: isMuted });
    setActiveCapture("retry");
    await persistRun(transitionPilotRun(run, "ready_for_retry"));
  }, [isMuted, module, persistRun, run]);

  const rejectDayThreeNote = useCallback(async (): Promise<void> => {
    if (!run) return;
    setCoach(null);
    await persistRun({
      ...transitionPilotRun(run, "day3_neutral_retry"),
      noteFit: "rejected",
      coachNote: undefined,
      retryInstruction: "Answer the same objection again in your own words.",
    });
  }, [persistRun, run]);

  const confirmRetry = useCallback(async (): Promise<void> => {
    if (!module || retryText.trim().length < 2) return;
    if (day === 1 && session) {
      const preserved = preserveDayOneRetry(session, retryText);
      const behavior = (session.coachedBehaviorId ?? module.primary_behavior_id) as typeof module.primary_behavior_id;
      const comparison = comparePilotAttempts(behavior, session.attemptOne?.transcript ?? attemptText, preserved.attemptTwo?.transcript ?? retryText);
      setSession({ ...preserved, comparison, nextState: "attempt_comparison" });
      await saveActivePracticeSession({ ...preserved, comparison, nextState: "attempt_comparison", updatedAt: Date.now() });
      setState("attempt_comparison");
      return;
    }
    if (!run) return;
    const preserved = preservePilotAttempt(run, "retry", retryText);
    const behavior = preserved.coachedBehaviorId ?? module.primary_behavior_id;
    const original = pilotRetrySegment(module.day, behavior) === "opener" ? preserved.attempt?.transcript ?? "" : preserved.responseAttempt?.transcript ?? "";
    const comparison = comparePilotAttempts(behavior, original, preserved.retryAttempt?.transcript ?? retryText);
    if (pilotRetrySegment(module.day, behavior) === "opener") {
      const line = adamLineForRun(preserved, module);
      if (line) await speakPilotAudio(line, { muted: isMuted });
      await persistRun({ ...preserved, comparison, state: "play_adam_after_opener_retry", updatedAt: Date.now() });
      return;
    }
    await persistRun({ ...transitionPilotRun(preserved, "attempt_comparison"), comparison });
  }, [attemptText, day, isMuted, module, persistRun, retryText, run, saveActivePracticeSession, session]);

  const showTransfer = useCallback(async (): Promise<void> => {
    if (day === 1) {
      await persistLegacyDayOne({ nextState: "transfer_cue" });
      setState("transfer_cue");
    } else if (run) await persistRun(transitionPilotRun(run, "transfer_cue"));
  }, [day, persistLegacyDayOne, persistRun, run]);

  const complete = useCallback(async (): Promise<void> => {
    if (!module) return;
    if (day === 1) {
      if (!session?.attemptTwo) return;
      await markPilotDayDone(module, moduleId ?? undefined);
      await persistLegacyDayOne({ nextState: "complete" });
      setState("complete");
      return;
    }
    if (!canCompletePilotRun(run ?? undefined) || !run) return;
    const completed = transitionPilotRun(run, "complete");
    await persistRun(completed);
    await markPilotDayDone(module, moduleId ?? undefined);
    tap("success");
  }, [day, markPilotDayDone, module, moduleId, persistLegacyDayOne, persistRun, run, session?.attemptTwo]);

  if (!module) return <Missing title="That practice day isn't available." onBack={() => router.navigate("/(tabs)")} />;
  if (!moduleId && !isPilotModuleUnlocked(day, pilotDoneDays)) return <Missing title="That legacy practice is not available yet." onBack={() => router.navigate("/(tabs)")} />;
  const decision = canContinuePilot(access);
  // Development preview access is folded into `access`; release behavior reaches
  // Pro only through the existing RevenueCat entitlement.
  if (!decision.allowed) {
    return <Missing title="This practice module is part of the paid program." action="See the program" onBack={() => router.replace({ pathname: "/paywall", params: { gate: decision.gate ?? "program", ...(moduleId ? { moduleId } : {}) } })} />;
  }

  const dayOneRecoverable = Boolean(session?.attemptOne && session.originalAdamResponse);
  const effectiveState = day === 1 && state === "module_preview" && session?.nextState === "complete" ? "complete" : state;
  const microphoneRecovery = microphoneRecoveryPresentation();
  const adamLine = day === 1 ? null : adamLineForRun(run, module);
  const counterpartLabel = session?.counterpartDisplayLabel ?? session?.counterpart ?? (session?.counterpartRelationship ? `Your ${session.counterpartRelationship.toLowerCase()}` : "Practice partner");
  const responseTarget = counterpartLabel.replace(/^Your /, "your ");
  const retrySegment = pilotRetrySegment(module.day, run?.coachedBehaviorId);
  const paidComparison = pilotComparisonPresentation(run ?? undefined, adamLine, retrySegment);
  const dayOneComparison = session?.attemptOne && session.attemptTwo && session.originalAdamResponse && session.comparison ? {
    counterpartTurnId: session.originalAdamResponse.id,
    counterpartText: session.originalAdamResponse.text,
    firstAttempt: session.attemptOne.transcript,
    retry: session.attemptTwo.transcript,
    evidenceLinkedDifference: session.comparison.text,
  } : null;
  const comparisonPresentation = day === 1 ? dayOneComparison : paidComparison;
  const activeCoach: PilotCoachResponse | null = coach ?? (run?.coachNote ? {
    route: "coach", day, evidenceQuote: null, behaviorId: run.coachedBehaviorId ?? null,
    note: run.coachNote, retryInstruction: run.retryInstruction ?? module.retry.direction, retryPrompt: RETRY_INVITATION,
  } : session?.coachNote ? {
    route: "coach", day: 1, evidenceQuote: session.attemptOne?.transcript ?? null,
    behaviorId: (session.coachedBehaviorId as PilotCoachResponse["behaviorId"]) ?? module.primary_behavior_id,
    note: session.coachNote, retryInstruction: session.retryInstruction ?? module.retry.direction, retryPrompt: RETRY_INVITATION,
  } : null);
  const busy = effectiveState === "hope_coaching" && !activeCoach;
  const paidActivity = paidActivityForState(effectiveState);
  const activityTitle = `${paidActivity[0]?.toUpperCase() ?? ""}${paidActivity.slice(1)}`;

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.navigate("/(tabs)")} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Save and leave practice"><X size={21} color={C.textSoft} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>{activityTitle}</Text><Text style={styles.headerMeta}>{curriculum?.name ?? `Practice ${day}`}</Text></View>
        <View style={styles.iconButton} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {effectiveState === "module_preview" ? day === 1 && !dayOneRecoverable ? (
            <Reveal><Text style={styles.title}>{DAY_ONE_RECOVERY_HEADING}</Text><Text style={styles.lede}>{DAY_ONE_RECOVERY_BODY}</Text><PrimaryButton label="Choose another conversation" onPress={() => router.push("/custom")} style={styles.actionTop} /></Reveal>
          ) : (
            <Reveal><Eyebrow color={C.purple}>{module.copy.eyebrow}</Eyebrow><Text style={styles.title}>{module.copy.heading}</Text><Text style={styles.lede}>{module.copy.body}</Text>{module.copy.practice_points.length ? <GlassCard style={styles.card}>{module.copy.practice_points.map((point) => <Text key={point} style={styles.point}>• {point}</Text>)}</GlassCard> : null}<PrimaryButton label={module.copy.primary_button} onPress={startDay} style={styles.actionTop} /><GhostButton label={module.copy.secondary_button} onPress={chooseCarriedContext} style={styles.secondaryAction} /></Reveal>
          ) : null}

          {effectiveState === "hope_lesson" ? <Lesson line={module.copy.lessons[lessonIndex]} index={lessonIndex} total={module.copy.lessons.length} heading={module.copy.heading} quiz={module.copy.quiz} onPlay={(line) => speakPilotAudio(line)} onContinue={nextLesson} /> : null}
          {effectiveState === "quiz" && module.copy.quiz ? <Quiz quiz={module.copy.quiz} onChoose={chooseQuiz} /> : null}
          {effectiveState === "quiz_feedback" && module.copy.quiz && quizChoice ? <PracticeFeedback quiz={module.copy.quiz} choice={quizChoice} onContinue={() => run && persistRun(transitionPilotRun(run, "preset_scenario"))} onTryAgain={() => run && persistRun(transitionPilotRun(run, "quiz"))} /> : null}

          {effectiveState === "preset_scenario" && module.copy.scenario ? <RehearsalBriefing heading={module.copy.scenario.heading} title={module.copy.scenario.title ?? curriculum?.name ?? module.copy.heading} context={run?.scenarioMode === "carried_context" && session?.topic ? session.topic : contextualizeCounterpart(module.copy.scenario.scenario, counterpartLabel)} target={contextualizeCounterpart(module.copy.scenario.user_job, counterpartLabel)} pressure={contextualizeCounterpart(module.practice.adam_line?.text ?? module.practice.approved_pushback_bank?.[0]?.text ?? "The counterpart will respond with realistic pressure.", counterpartLabel)} counterpart={counterpartLabel} onStart={startRehearsal} onUseMine={chooseCarriedContext} /> : null}

          {effectiveState === "ready_for_attempt" ? <AttemptReady prompt={module.copy.scenario?.attempt_prompt ?? module.copy.scenario?.user_job ?? ""} value={attemptText} onChange={setAttemptText} onStart={() => startCapture("opener")} onReview={() => run && persistRun(transitionPilotRun(run, "confirm_attempt_transcript"))} button="I’m ready to speak" /> : null}
          {effectiveState === "ready_for_response" ? <><CounterpartContext role={counterpartLabel} line={adamLine} onPlay={adamLine ? () => speakPilotAudio(adamLine, { muted: isMuted }) : undefined} /><AttemptReady prompt={`Respond to ${responseTarget}`} value={responseText} onChange={setResponseText} onStart={() => startCapture("response")} onReview={() => run && persistRun(transitionPilotRun(run, "confirm_response_transcript"))} button="I’m ready to speak" /></> : null}
          {effectiveState === "ready_for_retry" ? <><CounterpartContext role={counterpartLabel} line={day === 1 && session?.originalAdamResponse ? { audio_id: session.originalAdamResponse.resolvedAudioId, voice_key: "adam_counterpart", text: session.originalAdamResponse.text } : adamLine} onPlay={day === 1 && session?.originalAdamResponse ? () => speakPilotAudio({ audio_id: session.originalAdamResponse?.resolvedAudioId ?? session.originalAdamResponse?.id ?? "", voice_key: "adam_counterpart", text: session.originalAdamResponse?.text ?? "" }, { muted: isMuted }) : adamLine ? () => speakPilotAudio(adamLine, { muted: isMuted }) : undefined} /><AttemptReady prompt={retryDirection(module, run, session)} value={retryText} onChange={setRetryText} onStart={() => startCapture("retry")} onReview={async () => { if (day === 1) { await persistLegacyDayOne({ nextState: "confirm_retry_transcript" }); setState("confirm_retry_transcript"); } else if (run) await persistRun(transitionPilotRun(run, "confirm_retry_transcript")); }} button="I’m ready to retry" /></> : null}

          {effectiveState === "listening_attempt" || effectiveState === "listening_response" || effectiveState === "listening_retry" ? <Listening level={dictation.level} onStop={stopCapture} /> : null}
          {effectiveState === "confirm_attempt_transcript" ? <TranscriptReview value={attemptText} onChange={setAttemptText} onSubmit={confirmAttempt} /> : null}
          {effectiveState === "confirm_response_transcript" ? <TranscriptReview value={responseText} onChange={setResponseText} onSubmit={confirmResponse} /> : null}
          {effectiveState === "confirm_retry_transcript" ? <TranscriptReview value={retryText} onChange={setRetryText} onSubmit={confirmRetry} /> : null}

          {effectiveState === "hope_coaching" && day === 1 && activeCoach ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow>{session?.originalAdamResponse ? <RoleCard role={counterpartLabel} text={session.originalAdamResponse.text} onPlay={() => speakPilotAudio({ audio_id: session.originalAdamResponse?.resolvedAudioId ?? session.originalAdamResponse?.id ?? "", voice_key: "adam_counterpart", text: session.originalAdamResponse?.text ?? "" }, { muted: isMuted })} /> : null}<CoachCard coach={activeCoach} /><PrimaryButton label="Replay the counterpart response" onPress={async () => { await persistLegacyDayOne({ nextState: "replay_original_adam_response" }); setState("adam_response"); }} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "adam_response" && day === 1 && session?.originalAdamResponse ? <Reveal><Text style={styles.title}>Listen once more, then try your part again.</Text><RoleCard role={counterpartLabel} text={session.originalAdamResponse.text} onPlay={async () => { const outcome = await speakPilotAudio({ audio_id: session.originalAdamResponse?.id ?? `${session.id}-adam-response-1`, voice_key: "adam_counterpart", text: session.originalAdamResponse?.text ?? "" }); if (outcome !== "failed" && outcome !== "empty") setHasReplayedDayOneAdam(true); }} /><PrimaryButton label="I’m ready to retry" disabled={!hasReplayedDayOneAdam} onPress={async () => { await persistLegacyDayOne({ nextState: "spoken_retry" }); setActiveCapture("retry"); setState("ready_for_retry"); }} style={styles.actionTop} /></Reveal> : null}

          {effectiveState === "hope_coaching" && day !== 1 && activeCoach ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><CounterpartContext role={counterpartLabel} line={adamLine} onPlay={adamLine ? () => speakPilotAudio(adamLine, { muted: isMuted }) : undefined} /><CoachCard coach={activeCoach} /><PrimaryButton label="I’m ready to retry" onPress={beginRetry} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "day3_note_check" && activeCoach ? <Reveal><CoachCard coach={activeCoach} /><Text style={styles.title}>Does that fit what happened?</Text><PrimaryButton label="Yes, that fits" onPress={async () => { if (run) await persistRun({ ...run, noteFit: "accepted" }); await beginRetry(); }} style={styles.actionTop} /><GhostButton label="Not quite" onPress={rejectDayThreeNote} style={styles.secondaryAction} /></Reveal> : null}
          {effectiveState === "day3_neutral_retry" ? <Reveal><Text style={styles.title}>Try that same moment again.</Text><PrimaryButton label="I’m ready to retry" onPress={beginRetry} style={styles.actionTop} /></Reveal> : null}
          {busy ? <View style={styles.busyCard}><ActivityIndicator color={C.purple} /><Text style={styles.cardText}>Hope is checking one moment</Text></View> : null}

          {effectiveState === "play_adam_after_opener_retry" && adamLine ? <Reveal><RoleCard role={counterpartLabel} text={adamLine.text} onPlay={() => speakPilotAudio(adamLine)} /><PrimaryButton label="Continue" onPress={() => run && persistRun(transitionPilotRun(run, "attempt_comparison"))} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "attempt_comparison" && comparisonPresentation ? <Reveal><StatusPill label="Review · same moment" tone="purple" /><Text style={styles.lessonHeading}>What changed</Text><Text style={styles.progressiveNote}>Both transcripts below were approved for the same counterpart turn. No score increase is inferred.</Text><CounterpartMoment role={counterpartLabel} presentation={comparisonPresentation} onPlay={day === 1 && session?.originalAdamResponse ? () => speakPilotAudio({ audio_id: session.originalAdamResponse?.resolvedAudioId ?? session.originalAdamResponse?.id ?? "", voice_key: "adam_counterpart", text: session.originalAdamResponse?.text ?? "" }, { muted: isMuted }) : adamLine ? () => speakPilotAudio(adamLine, { muted: isMuted }) : undefined} /><PrimaryButton label="Continue review" onPress={showTransfer} containerStyle={styles.actionTop} /></Reveal> : null}
          {effectiveState === "attempt_comparison" && !comparisonPresentation ? <Reveal><Text style={styles.title}>Finish and approve your retry first.</Text><Text style={styles.lede}>A comparison appears only after both approved transcripts are available for the same counterpart moment.</Text></Reveal> : null}
          {effectiveState === "transfer_cue" ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><Text style={styles.title}>{module.copy.transfer}</Text><PrimaryButton label={module.copy.finish_button} onPress={complete} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "complete" ? <Reveal><StatusPill label="Practice complete" tone="green" /><Text style={styles.lessonHeading}>You practiced the same moment twice.</Text><Text style={styles.lede}>Your saved checkpoint is complete. Today now reflects the finished module activity.</Text><PrimaryButton label="Back to Today" onPress={() => router.navigate("/(tabs)")} containerStyle={styles.actionTop} /></Reveal> : null}
          {effectiveState === "microphone_error" ? <Reveal><Eyebrow color={C.clay}>{microphoneRecovery.title}</Eyebrow><Text style={styles.title}>{error || dictation.error || "Microphone access is off."}</Text><Text style={styles.lede}>Turn microphone access on in device Settings, try again, or type this turn instead. Nothing submits until you approve the transcript.</Text><PrimaryButton label={microphoneRecovery.actions[0]} onPress={() => void Linking.openSettings()} style={styles.actionTop} /><GhostButton label={microphoneRecovery.actions[1]} onPress={() => startCapture(activeCapture)} style={styles.secondaryAction} /><GhostButton label={microphoneRecovery.actions[2]} onPress={() => void openTypedFallback()} style={styles.secondaryAction} /></Reveal> : null}
          {effectiveState === "no_speech" ? <RecoveryState eyebrow="Nothing heard" title="We didn’t catch any words." body="Check that the microphone is clear, then try the same turn again. You can type instead without losing the checkpoint." primary="Try the turn again" onPrimary={() => startCapture(activeCapture)} secondary="Type this turn instead" onSecondary={() => void openTypedFallback()} /> : null}
          {effectiveState === "transcription_error" ? <RecoveryState eyebrow="Transcript" title="We couldn’t turn that recording into text." body="Your module checkpoint is saved. Try the turn again, or type the words you want approved." primary="Try the turn again" onPrimary={() => startCapture(activeCapture)} secondary="Type this turn instead" onSecondary={() => void openTypedFallback()} /> : null}
          {effectiveState === "playback_error" ? <RecoveryState eyebrow="Playback" title="The audio wouldn’t play." body={error || "The counterpart’s reply is written on screen, so audio never blocks the rehearsal."} primary="Try audio again" onPrimary={async () => { if (adamLine) { const outcome = await speakPilotAudio(adamLine, { muted: isMuted }); if (outcome !== "failed" && outcome !== "empty" && run) await persistRun(transitionPilotRun(run, "ready_for_response")); } }} secondary="Continue reading" onSecondary={() => run && persistRun(transitionPilotRun(run, "ready_for_response"))} /> : null}
          {effectiveState === "network_error" ? <RecoveryState eyebrow="Connection" title="The counterpart response wasn’t reached." body={error || "Your approved turn and module checkpoint are saved on this device."} primary="Try again" onPrimary={() => run && playAdam(run, run.attempt?.transcript ?? attemptText)} secondary="Save and exit" onSecondary={() => router.navigate("/(tabs)")} /> : null}
          {effectiveState === "model_error" ? <RecoveryState eyebrow="Feedback" title="Hope couldn’t finish the feedback." body={error || "Your approved transcripts are saved. Retry when the connection is ready."} primary="Try feedback again" onPrimary={() => void confirmResponse()} secondary="Save and exit" onSecondary={() => router.navigate("/(tabs)")} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
      {speech.canReplay && !effectiveState.startsWith("listening") ? <StateDock bottomInset={insets.bottom} style={styles.voiceDock}><GhostButton label={speech.phase === "speaking" ? "Stop voice" : "Replay last voice"} onPress={() => speech.phase === "speaking" ? stopSpeech() : replaySpeech()} /></StateDock> : null}
    </View>
  );
}

function dayOneScreenState(session: ActivePracticeSession | null): PilotModuleState {
  if (!session || session.nextState === "awaiting_onboarding_baseline") return "module_preview";
  const states: Record<Exclude<ActivePracticeSession["nextState"], "awaiting_onboarding_baseline">, PilotModuleState> = {
    focused_coach_note: "module_preview",
    replay_original_adam_response: "adam_response",
    spoken_retry: "ready_for_retry",
    confirm_retry_transcript: "confirm_retry_transcript",
    attempt_comparison: "attempt_comparison",
    transfer_cue: "transfer_cue",
    complete: "complete",
  };
  return states[session.nextState];
}

function adamLineForRun(run: PilotDayRun | null, module: NonNullable<ReturnType<typeof pilotModule>>): PilotAudioLine | null {
  if (module.day !== 8) return module.practice.adam_line ?? null;
  if (run?.adamAudioId) return (module.practice.approved_pushback_bank ?? []).find((line) => line.audio_id === run.adamAudioId) ?? null;
  return run ? selectDay8Pushback(run.id, module) : null;
}

function contextualizeCounterpart(value: string, counterpartLabel: string): string {
  return value.replace(/\bAdam\b/g, counterpartLabel);
}

function retryDirection(module: NonNullable<ReturnType<typeof pilotModule>>, run: PilotDayRun | null, session: ActivePracticeSession | null): string {
  if (module.day === 1) return "Try the same moment again in your own words.";
  if (module.day === 8) return pilotRetrySegment(module.day, run?.coachedBehaviorId) === "opener" ? module.retry.opener_direction ?? module.retry.direction : module.retry.response_direction ?? module.retry.direction;
  return run?.retryInstruction ?? session?.retryInstruction ?? module.retry.direction;
}

function Lesson({ line, index, total, heading, quiz, onPlay, onContinue }: { line?: PilotAudioLine; index: number; total: number; heading: string; quiz?: NonNullable<NonNullable<ReturnType<typeof pilotModule>>["copy"]["quiz"]>; onPlay: (line: PilotAudioLine) => void; onContinue: () => void }) {
  if (!line) return null;
  const showsContrast = index === total - 1 && quiz;
  return <Reveal><StatusPill label={`Lesson concept ${index + 1} of ${total}`} tone="purple" /><Text style={styles.lessonHeading}>{heading}</Text><ProductCard accent style={styles.conceptCard}><View style={styles.conceptMark}><Text style={styles.conceptNumber}>{String(index + 1).padStart(2, "0")}</Text></View><SectionLabel tone={C.purple}>Notice this move</SectionLabel><Text style={styles.conceptText}>{line.text}</Text><Pressable onPress={() => onPlay(line)} style={styles.audioAction} accessibilityRole="button" accessibilityLabel="Hear Hope explain this concept"><Volume2 size={17} color={C.purple} /><Text style={styles.audioLabel}>Hear Hope explain it</Text></Pressable></ProductCard>{showsContrast ? <View style={styles.contrast}><View style={styles.contrastCell}><SectionLabel tone={C.clay}>Less useful here</SectionLabel><Text style={styles.contrastText}>{quiz.option_a.text}</Text></View><View style={[styles.contrastCell, styles.contrastStrong]}><SectionLabel tone={C.sage}>Keeps the move visible</SectionLabel><Text style={styles.contrastText}>{quiz.option_b.text}</Text></View></View> : <Text style={styles.progressiveNote}>One concept at a time. The short practice comes after the final concept.</Text>}<PrimaryButton label={index === total - 1 ? "Complete lesson" : "Next concept"} onPress={onContinue} containerStyle={styles.actionTop} /></Reveal>;
}

function Quiz({ quiz, onChoose }: { quiz: NonNullable<NonNullable<ReturnType<typeof pilotModule>>["copy"]["quiz"]>; onChoose: (choice: "A" | "B") => void }) {
  return <Reveal><StatusPill label="Practice" tone="purple" /><Text style={styles.lessonHeading}>Hear the difference</Text><Text style={styles.lede}>{quiz.prompt}</Text><View style={styles.optionList}><AudioOption label="A" line={quiz.option_a} onChoose={() => onChoose("A")} /><AudioOption label="B" line={quiz.option_b} onChoose={() => onChoose("B")} /></View><Text style={styles.progressiveNote}>Choose the response that best matches the lesson. Feedback stays tied to your answer.</Text></Reveal>;
}

function AudioOption({ label, line, onChoose }: { label: "A" | "B"; line: PilotAudioLine; onChoose: () => void }) {
  return <Pressable onPress={onChoose} style={({ pressed }) => [styles.answer, pressed && styles.answerPressed]} accessibilityRole="button" accessibilityLabel={`Choose ${label}. ${line.text}`}><View style={styles.answerLetter}><Text style={styles.answerLetterText}>{label}</Text></View><Text style={styles.answerText}>{line.text}</Text><Pressable onPress={() => speakPilotAudio(line)} style={styles.answerAudio} accessibilityRole="button" accessibilityLabel={`Play answer ${label}`}><Play size={15} color={C.purple} /></Pressable></Pressable>;
}

function PracticeFeedback({ quiz, choice, onContinue, onTryAgain }: { quiz: NonNullable<NonNullable<ReturnType<typeof pilotModule>>["copy"]["quiz"]>; choice: "A" | "B"; onContinue: () => void; onTryAgain: () => void }) {
  const isCorrect = choice === quiz.stronger_option;
  const chosen = choice === "A" ? quiz.option_a : quiz.option_b;
  return <Reveal><StatusPill label={isCorrect ? "Correct" : "Try the distinction again"} tone={isCorrect ? "green" : "amber"} /><Text style={styles.lessonHeading}>{isCorrect ? "That keeps the move visible." : "Not quite yet."}</Text><ProductCard accent style={styles.feedbackCard}><View style={styles.feedbackChoice}><View style={[styles.answerLetter, isCorrect ? styles.answerLetterCorrect : styles.answerLetterWrong]}>{isCorrect ? <Check size={14} color={C.onAccent} /> : <RotateCcw size={13} color={C.onAccent} />}</View><Text style={styles.answerText}>{chosen.text}</Text></View><View style={styles.feedbackRule} /><SectionLabel tone={isCorrect ? C.sage : "#8A6420"}>Why</SectionLabel><Text style={styles.cardText}>{choice === "A" ? quiz.feedback_a : quiz.feedback_b}</Text></ProductCard>{isCorrect ? <PrimaryButton label="Continue to rehearsal" onPress={onContinue} containerStyle={styles.actionTop} /> : <GhostButton label="Choose again" onPress={onTryAgain} containerStyle={styles.actionTop} />}</Reveal>;
}

function RehearsalBriefing({ heading, title, context, target, pressure, counterpart, onStart, onUseMine }: { heading: string; title: string; context: string; target: string; pressure: string; counterpart: string; onStart: () => void; onUseMine: () => void }) {
  return <Reveal><StatusPill label={heading} tone="purple" /><Text style={styles.lessonHeading}>{title}</Text><Text style={styles.lede}>{context}</Text><View style={styles.briefMap}><View style={styles.briefNode}><SectionLabel tone={C.purple}>Your success target</SectionLabel><Text style={styles.briefText}>{target}</Text></View><View style={styles.briefConnector} /><View style={[styles.briefNode, styles.pressureNode]}><SectionLabel tone="#8A6420">Pressure from {counterpart}</SectionLabel><Text style={styles.briefText}>{pressure}</Text></View></View><Text style={styles.progressiveNote}>You control when recording starts. You can edit and approve every transcript before feedback.</Text><PrimaryButton label="Start rehearsal" onPress={onStart} containerStyle={styles.actionTop} /><GhostButton label="Use my conversation" onPress={onUseMine} containerStyle={styles.secondaryAction} /></Reveal>;
}

function AttemptReady({ prompt, value, onChange, onStart, onReview, button }: { prompt: string; value: string; onChange: (value: string) => void; onStart: () => void; onReview: () => void; button: string }) {
  return <Reveal><Text style={styles.title}>{prompt}</Text><View style={styles.micRow}><MicControl state="ready" onPress={onStart} glyph={<Mic size={28} color={C.purple} />} accessibilityLabel={button} /><Text style={styles.note}>{button}</Text></View><Text style={styles.or}>OR TYPE AS AN ACCESSIBLE FALLBACK</Text><TextInput value={value} onChangeText={onChange} multiline style={styles.transcriptInput} /><PrimaryButton label="Use this transcript" disabled={value.trim().length < 2} onPress={onReview} style={styles.actionTop} /></Reveal>;
}

function Listening({ level, onStop }: { level: number; onStop: () => void }) {
  return <View style={styles.listening}><Text style={styles.title}>Say it in your own words.</Text><MicControl state="listening" level={level} onPress={onStop} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.note}>Done speaking</Text></View>;
}

function TranscriptReview({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return <Reveal><StatusPill label="Transcript review" tone="purple" /><Text style={styles.lessonHeading}>Does this match what you said?</Text><Text style={styles.progressiveNote}>Edit transcript text directly to correct any word. Nothing is analyzed until you approve it.</Text><TextInput value={value} onChangeText={onChange} multiline maxLength={900} style={styles.transcriptInput} accessibilityLabel="Editable transcript" /><PrimaryButton label="Approve this transcript" disabled={value.trim().length < 2} onPress={onSubmit} containerStyle={styles.actionTop} /></Reveal>;
}

function CoachCard({ coach }: { coach: PilotCoachResponse }) {
  return <ProductCard accent style={styles.card}><SectionLabel tone={C.purple}>Hope · one thing</SectionLabel>{coach.evidenceQuote ? <View style={styles.coachEvidence}><Text style={styles.coachEvidenceLabel}>FROM YOUR APPROVED WORDS</Text><Text style={styles.coachQuote}>“{coach.evidenceQuote}”</Text></View> : null}<Text style={styles.cardText}>{coach.note}</Text>{coach.retryInstruction ? <View style={styles.coachNext}><SectionLabel>Same-moment retry</SectionLabel><Text style={styles.retry}>{coach.retryInstruction}</Text></View> : null}<Text style={styles.retry}>{coach.retryPrompt}</Text></ProductCard>;
}

function RoleCard({ role, text, onPlay }: { role: string; text: string; onPlay?: () => void }) {
  return <GlassCard style={styles.card}><View style={styles.roleHead}><Text style={styles.fieldLabel}>{role}</Text>{onPlay ? <Pressable onPress={onPlay} style={styles.playButton} accessibilityRole="button" accessibilityLabel={`Replay ${role}`}><Play size={15} color={C.purple} /></Pressable> : null}</View><Text style={styles.cardText}>{text}</Text></GlassCard>;
}

function CounterpartContext({ role, line, onPlay }: { role: string; line: PilotAudioLine | null; onPlay?: () => void }) {
  if (!line) return <GlassCard style={styles.card}><Text style={styles.fieldLabel}>COUNTERPART RESPONSE</Text><Text style={styles.cardText}>The response audio is unavailable. Continue from the visible prompt below.</Text></GlassCard>;
  return <RoleCard role={role} text={line.text} onPlay={onPlay} />;
}

function CounterpartMoment({ role, presentation, onPlay }: { role: string; presentation: NonNullable<ReturnType<typeof pilotComparisonPresentation>>; onPlay?: () => void }) {
  return <View accessibilityLabel={`Same counterpart turn ${presentation.counterpartTurnId}`}><RoleCard role={`${role} · Same counterpart moment`} text={presentation.counterpartText} onPlay={onPlay} /><View style={styles.comparisonPair}><ProductCard style={styles.comparisonAttempt}><SectionLabel>First approved attempt</SectionLabel><Text style={styles.comparisonText}>{presentation.firstAttempt}</Text></ProductCard><ProductCard accent style={styles.comparisonAttempt}><SectionLabel tone={C.purple}>Approved retry</SectionLabel><Text style={styles.comparisonText}>{presentation.retry}</Text></ProductCard></View><ProductCard style={styles.differenceCard}><SectionLabel tone={C.sage}>One observable difference</SectionLabel><Text style={styles.cardText}>{presentation.evidenceLinkedDifference}</Text></ProductCard></View>;
}

function RecoveryState({ eyebrow: label, title, body, primary, onPrimary, secondary, onSecondary }: { eyebrow: string; title: string; body: string; primary: string; onPrimary: () => void; secondary: string; onSecondary: () => void }) {
  return <Reveal><Eyebrow color={C.amber}>{label}</Eyebrow><Text style={styles.title}>{title}</Text><Text style={styles.lede}>{body}</Text><PrimaryButton label={primary} onPress={onPrimary} containerStyle={styles.actionTop} /><GhostButton label={secondary} onPress={onSecondary} containerStyle={styles.secondaryAction} /></Reveal>;
}

function Missing({ title, action = "Back to Today", onBack }: { title: string; action?: string; onBack: () => void }) {
  return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>{title}</Text><PrimaryButton label={action} onPress={onBack} style={styles.missingButton} /></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, center: { alignItems: "center", justifyContent: "center", padding: GUTTER },
  header: { minHeight: 64, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, iconButton: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, alignItems: "center" }, headerTitle: { fontFamily: font.semi, fontSize: 14, color: C.text }, headerMeta: { ...eyebrow, color: C.dim, marginTop: 2 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display, marginTop: 10 }, lede: { ...T.body, color: C.textSoft, marginTop: 14, lineHeight: 27 },
  actionTop: { marginTop: 24 }, secondaryAction: { marginTop: 10 }, card: { marginTop: 20, gap: 10 }, point: { ...T.support, color: C.text }, fieldLabel: { ...eyebrow, color: C.purple }, cardText: { ...T.body, color: C.text, lineHeight: 26 }, retry: { ...T.support, color: C.textSoft, marginTop: 8 },
  option: { marginTop: 16, gap: 14 }, optionActions: { flexDirection: "row", gap: 10, alignItems: "center" }, micRow: { alignItems: "center", gap: 12, marginTop: 28 }, listening: { alignItems: "center", paddingTop: 34, gap: 20 }, note: { ...T.support, textAlign: "center" }, or: { ...eyebrow, color: C.dim, textAlign: "center", marginVertical: 22 },
  transcriptInput: { ...T.body, minHeight: 150, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.lg, backgroundColor: C.surface, padding: 18, color: C.text, textAlignVertical: "top", ...shadow.layer },
  lessonHeading: { fontFamily: font.bold, fontSize: 30, lineHeight: 36, letterSpacing: -0.5, color: C.text, marginTop: 13 },
  conceptCard: { marginTop: 22, padding: 22 }, conceptMark: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center", marginBottom: 6 }, conceptNumber: { fontFamily: font.bold, fontSize: 17, color: C.purple }, conceptText: { fontFamily: font.medium, fontSize: 20, lineHeight: 30, color: C.text },
  audioAction: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }, audioLabel: { fontFamily: font.semi, fontSize: 13, color: C.purple }, progressiveNote: { ...T.caption, color: C.dim, marginTop: 15 },
  contrast: { flexDirection: "row", gap: 10, marginTop: 15 }, contrastCell: { flex: 1, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(177,64,47,0.18)", backgroundColor: "rgba(255,255,255,0.58)", padding: 14, gap: 8 }, contrastStrong: { borderColor: "rgba(92,138,110,0.24)", backgroundColor: "rgba(255,255,255,0.82)" }, contrastText: { fontFamily: font.regular, fontSize: 13, lineHeight: 19, color: C.text },
  optionList: { gap: 11, marginTop: 22 }, answer: { minHeight: 92, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: C.line, padding: 15, flexDirection: "row", alignItems: "center", gap: 12, ...shadow.layer }, answerPressed: { borderColor: "rgba(81,40,136,0.34)", backgroundColor: C.purpleSoft, transform: [{ scale: 0.988 }] }, answerLetter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" }, answerLetterText: { fontFamily: font.semi, fontSize: 12, color: C.purple }, answerText: { ...T.support, color: C.text, flex: 1 }, answerAudio: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  feedbackCard: { marginTop: 22 }, feedbackChoice: { flexDirection: "row", alignItems: "center", gap: 12 }, answerLetterCorrect: { backgroundColor: C.sage, borderColor: C.sage }, answerLetterWrong: { backgroundColor: C.amber, borderColor: C.amber }, feedbackRule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 4 },
  briefMap: { marginTop: 22 }, briefNode: { borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.78)", borderWidth: 1, borderColor: "rgba(81,40,136,0.22)", padding: 17, gap: 8 }, pressureNode: { borderColor: "rgba(180,130,63,0.26)", backgroundColor: "rgba(255,252,246,0.78)" }, briefConnector: { width: 2, height: 22, backgroundColor: C.lineStrong, marginLeft: 25 }, briefText: { ...T.body, color: C.text },
  coachEvidence: { borderRadius: radius.md, backgroundColor: C.purpleSoft, padding: 14, gap: 5 }, coachEvidenceLabel: { ...eyebrow, fontSize: 9, color: C.purple }, coachQuote: { ...T.support, color: C.text }, coachNext: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line, paddingTop: 12, gap: 4 },
  comparisonPair: { flexDirection: "row", gap: 10, marginTop: 12 }, comparisonAttempt: { flex: 1, padding: 16 }, comparisonText: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: C.text }, differenceCard: { marginTop: 10, backgroundColor: "rgba(255,255,255,0.82)" },
  busyCard: { alignItems: "center", gap: 12, marginTop: 60, padding: 24 }, comparisonRule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 6 }, roleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, playButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  voiceDock: { backgroundColor: "transparent" }, missingButton: { width: 230, marginTop: 22 },
});
