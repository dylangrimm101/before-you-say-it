import { useLocalSearchParams, useRouter } from "expo-router";
import { Mic, Pause, Play, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, GhostButton, MicControl, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { curriculumModule, isModuleId, practiceDayForRoute, type ModuleId } from "@/constants/modules";
import { evaluatePilotAttempt, nextPilotCounterpart } from "@/lib/ai";
import { canContinuePilot } from "@/lib/access";
import {
  canCompletePilotRun,
  comparePilotAttempts,
  isPilotModuleUnlocked,
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
  const [isMuted, setIsMuted] = useState<boolean>(false);
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
      setState("microphone_error");
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
      const response = await nextPilotCounterpart(module, "", run.id);
      const line = module.practice.adam_line;
      if (!line || !response.spokenText) return;
      await persistRun({ ...transitionPilotRun(run, "adam_response"), adamReactionId: response.reactionId, adamAudioId: response.audioId ?? line.audio_id });
      await speakPilotAudio(line, { muted: isMuted });
      await persistRun(transitionPilotRun({ ...run, adamReactionId: response.reactionId, adamAudioId: response.audioId ?? line.audio_id }, "ready_for_response"));
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

  const playAdam = useCallback(async (baseRun: PilotDayRun, confirmedAttempt: string): Promise<void> => {
    if (!module) return;
    const response = await nextPilotCounterpart(module, confirmedAttempt, baseRun.id);
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
    await speakPilotAudio(line, { muted: isMuted });
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
    const result = await evaluatePilotAttempt(module, coachingTranscript, adamText);
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
  const adamLine = day === 1 ? null : adamLineForRun(run, module);
  const activeCoach: PilotCoachResponse | null = coach ?? (run?.coachNote ? {
    route: "coach", day, evidenceQuote: null, behaviorId: run.coachedBehaviorId ?? null,
    note: run.coachNote, retryInstruction: run.retryInstruction ?? module.retry.direction, retryPrompt: RETRY_INVITATION,
  } : session?.coachNote ? {
    route: "coach", day: 1, evidenceQuote: session.attemptOne?.transcript ?? null,
    behaviorId: (session.coachedBehaviorId as PilotCoachResponse["behaviorId"]) ?? module.primary_behavior_id,
    note: session.coachNote, retryInstruction: session.retryInstruction ?? module.retry.direction, retryPrompt: RETRY_INVITATION,
  } : null);
  const busy = effectiveState === "hope_coaching" && !activeCoach;

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.navigate("/(tabs)")} style={styles.iconButton} accessibilityRole="button" accessibilityLabel="Leave practice"><X size={21} color={C.textSoft} /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>{curriculum?.name ?? `Legacy practice ${day}`}</Text><Text style={styles.headerMeta}>{curriculum ? `Module ${curriculum.number} · ` : ""}{module.duration_minutes[0]}–{module.duration_minutes[1]} min</Text></View>
        <Pressable onPress={() => { setIsMuted((value) => !value); stopSpeech().catch(() => {}); }} style={styles.iconButton} accessibilityRole="button" accessibilityLabel={isMuted ? "Turn voice on" : "Mute voice"}>{isMuted ? <Play size={18} color={C.textSoft} /> : <Pause size={18} color={C.textSoft} />}</Pressable>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 140 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {effectiveState === "module_preview" ? day === 1 && !dayOneRecoverable ? (
            <Reveal><Text style={styles.title}>{DAY_ONE_RECOVERY_HEADING}</Text><Text style={styles.lede}>{DAY_ONE_RECOVERY_BODY}</Text><PrimaryButton label="Choose another conversation" onPress={() => router.push("/custom")} style={styles.actionTop} /></Reveal>
          ) : (
            <Reveal><Eyebrow color={C.purple}>{module.copy.eyebrow}</Eyebrow><Text style={styles.title}>{module.copy.heading}</Text><Text style={styles.lede}>{module.copy.body}</Text>{module.copy.practice_points.length ? <GlassCard style={styles.card}>{module.copy.practice_points.map((point) => <Text key={point} style={styles.point}>• {point}</Text>)}</GlassCard> : null}<PrimaryButton label={module.copy.primary_button} onPress={startDay} style={styles.actionTop} /><GhostButton label={module.copy.secondary_button} onPress={chooseCarriedContext} style={styles.secondaryAction} /></Reveal>
          ) : null}

          {effectiveState === "hope_lesson" ? <Lesson line={module.copy.lessons[lessonIndex]} index={lessonIndex} total={module.copy.lessons.length} onPlay={(line) => speakPilotAudio(line)} onContinue={nextLesson} /> : null}
          {effectiveState === "quiz" && module.copy.quiz ? <Quiz quiz={module.copy.quiz} onChoose={chooseQuiz} /> : null}
          {effectiveState === "quiz_feedback" && module.copy.quiz && quizChoice ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><Text style={styles.title}>{quizChoice === "A" ? module.copy.quiz.feedback_a : module.copy.quiz.feedback_b}</Text><PrimaryButton label="Continue" onPress={() => run && persistRun(transitionPilotRun(run, "preset_scenario"))} style={styles.actionTop} /></Reveal> : null}

          {effectiveState === "preset_scenario" && module.copy.scenario ? <Reveal><Eyebrow color={C.purple}>{module.copy.scenario.heading}</Eyebrow>{module.copy.scenario.title ? <Text style={styles.title}>{module.copy.scenario.title}</Text> : null}<Text style={styles.lede}>{run?.scenarioMode === "carried_context" && session?.topic ? session.topic : module.copy.scenario.scenario}</Text><GlassCard style={styles.card}><Text style={styles.fieldLabel}>YOUR JOB</Text><Text style={styles.cardText}>{module.copy.scenario.user_job}</Text></GlassCard><PrimaryButton label="Start rehearsal" onPress={startRehearsal} style={styles.actionTop} /><GhostButton label="Use my conversation" onPress={chooseCarriedContext} style={styles.secondaryAction} /></Reveal> : null}

          {effectiveState === "ready_for_attempt" ? <AttemptReady prompt={module.copy.scenario?.attempt_prompt ?? module.copy.scenario?.user_job ?? ""} value={attemptText} onChange={setAttemptText} onStart={() => startCapture("opener")} onReview={() => run && persistRun(transitionPilotRun(run, "confirm_attempt_transcript"))} button="I’m ready to speak" /> : null}
          {effectiveState === "ready_for_response" ? <AttemptReady prompt={module.copy.scenario?.response_prompt ?? ""} value={responseText} onChange={setResponseText} onStart={() => startCapture("response")} onReview={() => run && persistRun(transitionPilotRun(run, "confirm_response_transcript"))} button="I’m ready to speak" /> : null}
          {effectiveState === "ready_for_retry" ? <AttemptReady prompt={retryDirection(module, run, session)} value={retryText} onChange={setRetryText} onStart={() => startCapture("retry")} onReview={async () => { if (day === 1) { await persistLegacyDayOne({ nextState: "confirm_retry_transcript" }); setState("confirm_retry_transcript"); } else if (run) await persistRun(transitionPilotRun(run, "confirm_retry_transcript")); }} button="I’m ready to retry" /> : null}

          {effectiveState === "listening_attempt" || effectiveState === "listening_response" || effectiveState === "listening_retry" ? <Listening level={dictation.level} onStop={stopCapture} /> : null}
          {effectiveState === "confirm_attempt_transcript" ? <TranscriptReview value={attemptText} onChange={setAttemptText} onSubmit={confirmAttempt} /> : null}
          {effectiveState === "confirm_response_transcript" ? <TranscriptReview value={responseText} onChange={setResponseText} onSubmit={confirmResponse} /> : null}
          {effectiveState === "confirm_retry_transcript" ? <TranscriptReview value={retryText} onChange={setRetryText} onSubmit={confirmRetry} /> : null}

          {effectiveState === "hope_coaching" && day === 1 && activeCoach ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><CoachCard coach={activeCoach} /><PrimaryButton label="Replay Adam’s original response" onPress={async () => { await persistLegacyDayOne({ nextState: "replay_original_adam_response" }); setState("adam_response"); }} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "adam_response" && day === 1 && session?.originalAdamResponse ? <Reveal><Text style={styles.title}>Listen once more, then try your part again.</Text><RoleCard role="Adam" text={session.originalAdamResponse.text} onPlay={async () => { const outcome = await speakPilotAudio({ audio_id: session.originalAdamResponse?.id ?? `${session.id}-adam-response-1`, voice_key: "adam_counterpart", text: session.originalAdamResponse?.text ?? "" }); if (outcome !== "failed" && outcome !== "empty") setHasReplayedDayOneAdam(true); }} /><PrimaryButton label="I’m ready to retry" disabled={!hasReplayedDayOneAdam} onPress={async () => { await persistLegacyDayOne({ nextState: "spoken_retry" }); setActiveCapture("retry"); setState("ready_for_retry"); }} style={styles.actionTop} /></Reveal> : null}

          {effectiveState === "hope_coaching" && day !== 1 && activeCoach ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><CoachCard coach={activeCoach} /><PrimaryButton label="I’m ready to retry" onPress={beginRetry} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "day3_note_check" && activeCoach ? <Reveal><CoachCard coach={activeCoach} /><Text style={styles.title}>Does that fit what happened?</Text><PrimaryButton label="Yes, that fits" onPress={async () => { if (run) await persistRun({ ...run, noteFit: "accepted" }); await beginRetry(); }} style={styles.actionTop} /><GhostButton label="Not quite" onPress={rejectDayThreeNote} style={styles.secondaryAction} /></Reveal> : null}
          {effectiveState === "day3_neutral_retry" ? <Reveal><Text style={styles.title}>Try that same moment again.</Text><PrimaryButton label="I’m ready to retry" onPress={beginRetry} style={styles.actionTop} /></Reveal> : null}
          {busy ? <View style={styles.busyCard}><ActivityIndicator color={C.purple} /><Text style={styles.cardText}>Hope is checking one moment</Text></View> : null}

          {effectiveState === "play_adam_after_opener_retry" && adamLine ? <Reveal><RoleCard role="Adam" text={adamLine.text} onPlay={() => speakPilotAudio(adamLine)} /><PrimaryButton label="Continue" onPress={() => run && persistRun(transitionPilotRun(run, "attempt_comparison"))} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "attempt_comparison" ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><Text style={styles.title}>First attempt and retry</Text><GlassCard style={styles.card}><Text style={styles.cardText}>{day === 1 ? session?.comparison?.text : run?.comparison?.text}</Text></GlassCard><PrimaryButton label="Continue" onPress={showTransfer} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "transfer_cue" ? <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><Text style={styles.title}>{module.copy.transfer}</Text><PrimaryButton label={module.copy.finish_button} onPress={complete} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "complete" ? <Reveal><Eyebrow color={C.sage}>Practice complete</Eyebrow><Text style={styles.title}>You practiced the moment twice.</Text><PrimaryButton label="Back to curriculum" onPress={() => router.navigate("/(tabs)")} style={styles.actionTop} /></Reveal> : null}
          {effectiveState === "microphone_error" ? <Reveal><Text style={styles.title}>{error || dictation.error}</Text><PrimaryButton label={activeCapture === "retry" ? "I’m ready to retry" : "I’m ready to speak"} onPress={() => startCapture(activeCapture)} style={styles.actionTop} /></Reveal> : null}
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

function retryDirection(module: NonNullable<ReturnType<typeof pilotModule>>, run: PilotDayRun | null, session: ActivePracticeSession | null): string {
  if (module.day === 1) return "Try the same moment again in your own words.";
  if (module.day === 8) return pilotRetrySegment(module.day, run?.coachedBehaviorId) === "opener" ? module.retry.opener_direction ?? module.retry.direction : module.retry.response_direction ?? module.retry.direction;
  return run?.retryInstruction ?? session?.retryInstruction ?? module.retry.direction;
}

function Lesson({ line, index, total, onPlay, onContinue }: { line?: PilotAudioLine; index: number; total: number; onPlay: (line: PilotAudioLine) => void; onContinue: () => void }) {
  if (!line) return null;
  return <Reveal><Eyebrow color={C.purple}>Hope · {index + 1} of {total}</Eyebrow><RoleCard role="Hope" text={line.text} onPlay={() => onPlay(line)} /><PrimaryButton label="Continue" onPress={onContinue} style={styles.actionTop} /></Reveal>;
}

function Quiz({ quiz, onChoose }: { quiz: NonNullable<NonNullable<ReturnType<typeof pilotModule>>["copy"]["quiz"]>; onChoose: (choice: "A" | "B") => void }) {
  return <Reveal><Eyebrow color={C.purple}>Hope</Eyebrow><Text style={styles.title}>{quiz.prompt}</Text><AudioOption label="A" line={quiz.option_a} onChoose={() => onChoose("A")} /><AudioOption label="B" line={quiz.option_b} onChoose={() => onChoose("B")} /></Reveal>;
}

function AudioOption({ label, line, onChoose }: { label: "A" | "B"; line: PilotAudioLine; onChoose: () => void }) {
  return <GlassCard style={styles.option}><Text style={styles.cardText}>{line.text}</Text><View style={styles.optionActions}><GhostButton label={`Play ${label}`} onPress={() => speakPilotAudio(line)} /><PrimaryButton label={`Choose ${label}`} onPress={onChoose} /></View></GlassCard>;
}

function AttemptReady({ prompt, value, onChange, onStart, onReview, button }: { prompt: string; value: string; onChange: (value: string) => void; onStart: () => void; onReview: () => void; button: string }) {
  return <Reveal><Text style={styles.title}>{prompt}</Text><View style={styles.micRow}><MicControl state="ready" onPress={onStart} glyph={<Mic size={28} color={C.purple} />} accessibilityLabel={button} /><Text style={styles.note}>{button}</Text></View><Text style={styles.or}>OR TYPE AS AN ACCESSIBLE FALLBACK</Text><TextInput value={value} onChangeText={onChange} multiline style={styles.transcriptInput} /><PrimaryButton label="Use this transcript" disabled={value.trim().length < 2} onPress={onReview} style={styles.actionTop} /></Reveal>;
}

function Listening({ level, onStop }: { level: number; onStop: () => void }) {
  return <View style={styles.listening}><Text style={styles.title}>Say it in your own words.</Text><MicControl state="listening" level={level} onPress={onStop} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.note}>Done speaking</Text></View>;
}

function TranscriptReview({ value, onChange, onSubmit }: { value: string; onChange: (value: string) => void; onSubmit: () => void }) {
  return <Reveal><Text style={styles.title}>Does this match what you said?</Text><TextInput value={value} onChangeText={onChange} multiline maxLength={900} style={styles.transcriptInput} /><GhostButton label="Edit transcript" onPress={() => {}} style={styles.secondaryAction} /><PrimaryButton label="Use this transcript" disabled={value.trim().length < 2} onPress={onSubmit} style={styles.actionTop} /></Reveal>;
}

function CoachCard({ coach }: { coach: PilotCoachResponse }) {
  return <GlassCard style={styles.card}><Text style={styles.cardText}>{coach.note}</Text>{coach.retryInstruction ? <Text style={styles.retry}>{coach.retryInstruction}</Text> : null}<Text style={styles.retry}>{coach.retryPrompt}</Text></GlassCard>;
}

function RoleCard({ role, text, onPlay }: { role: string; text: string; onPlay: () => void }) {
  return <GlassCard style={styles.card}><View style={styles.roleHead}><Text style={styles.fieldLabel}>{role}</Text><Pressable onPress={onPlay} style={styles.playButton} accessibilityRole="button" accessibilityLabel={`Play ${role}`}><Play size={15} color={C.purple} /></Pressable></View><Text style={styles.cardText}>{text}</Text></GlassCard>;
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
  busyCard: { alignItems: "center", gap: 12, marginTop: 60, padding: 24 }, roleHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, playButton: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center" },
  voiceDock: { backgroundColor: "transparent" }, missingButton: { width: 230, marginTop: 22 },
});
