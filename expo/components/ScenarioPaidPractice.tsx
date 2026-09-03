import { useRouter } from "expo-router";
import { Mic, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { M1L1PaidPractice } from "@/components/M1L1PaidPractice";
import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, MicControl, PrimaryButton, Reveal, StateDock, Thinking } from "@/components/ui";
import { DIFFICULTY } from "@/constants/scenarios";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { generateApprovedRehearsalDynamicReply, generateDebrief, nextCounterpartTurn } from "@/lib/ai";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import type { ConvertedLessonConfig } from "@/lib/convertedLesson";
import {
  approvedRehearsalCoachExchange,
  approvedRehearsalAuthoredCorpus,
  approvedRehearsalComparison,
  type ApprovedRehearsalConfig,
} from "@/lib/approvedRehearsals";
import {
  advanceApprovedRehearsalFirstResponse,
  approvedRehearsalReplayPressure,
  attachApprovedRehearsalCoaching,
  attachApprovedRehearsalPushbackOne,
  attachApprovedRehearsalPushbackTwo,
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeApprovedRehearsalReplay,
  completeScenarioComparison,
  confirmApprovedRehearsalReplay,
  preserveApprovedRehearsalRetry,
  preserveScenarioAttempt,
  scenarioPracticePresentation,
  stageApprovedRehearsalReplay,
  scenarioRunForRoute,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
  type ScenarioCounterpartPresentation,
} from "@/lib/scenarioPractice";
import { errorShape, safeLog } from "@/lib/redact";
import { playSharedScenarioPressure } from "@/lib/scenarioAudio";
import { leaveAfterStrictDictationCleanup } from "@/lib/temporaryRecording";
import { useDictation } from "@/lib/useDictation";
import { replaySpeech, resetSpeech, speakPilotAudio, speakPilotAudioToCompletion, useSpeech } from "@/lib/voice";
import { useStore } from "@/providers/store";
import type { Scenario, Turn } from "@/types/convo";
import { SESSION_SCHEMA_VERSION, type SessionRecord } from "@/types/privacy";

interface ScenarioPaidPracticeProps {
  scenario: Scenario;
  lessonTitle?: string;
  lessonMove?: string | null;
  requestedRunId?: string;
  convertedLesson?: ConvertedLessonConfig;
  approvedRehearsal?: ApprovedRehearsalConfig;
  onReturnToDeck?: (runId: string) => void;
  onDiscard?: () => Promise<void>;
}

function turn(id: string, role: Turn["role"], text: string): Turn {
  return { id, role, text };
}

/** Routes only accepted M1 L1 into its isolated authored runtime. */
export function ScenarioPaidPractice(props: ScenarioPaidPracticeProps): React.JSX.Element {
  if (props.convertedLesson && props.requestedRunId && props.onReturnToDeck && props.onDiscard) {
    return <M1L1PaidPractice requestedRunId={props.requestedRunId} convertedLesson={props.convertedLesson} onReturnToDeck={props.onReturnToDeck} onDiscard={props.onDiscard} />;
  }
  return <SharedScenarioPaidPractice {...props} />;
}

/** Shared non-converted scenario surface; it never defaults to Adam. */
function SharedScenarioPaidPractice({ scenario, lessonTitle, lessonMove, requestedRunId, convertedLesson, approvedRehearsal, onReturnToDeck, onDiscard }: ScenarioPaidPracticeProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeScenarioRun, replaceActiveScenarioRunStrict, clearActiveScenarioRunStrict, upsertSession } = useStore();
  const restored = scenarioRunForRoute(activeScenarioRun, scenario.id);
  const [value, setValue] = useState<PersistedScenarioPracticeRun | null>(
    restored && (!requestedRunId || restored.run.id === requestedRunId) ? restored : null,
  );
  const [draft, setDraft] = useState<string>(() => {
    const seeded = restored?.run;
    if (seeded?.state === "confirm_attempt_transcript") return seeded.attempt?.transcript ?? "";
    if (seeded?.state === "confirm_response_transcript") return seeded.responseAttempt?.transcript ?? "";
    if (seeded?.state === "confirm_retry_transcript") return seeded.retryAttempt?.transcript ?? "";
    return "";
  });
  const valueRef = useRef<PersistedScenarioPracticeRun | null>(value);
  const captureTransitionInFlightRef = useRef<boolean>(false);
  const approvalInFlightRef = useRef<boolean>(false);
  const replayTransitionInFlightRef = useRef<boolean>(false);
  const permissionTransitionInFlightRef = useRef<boolean>(false);
  const discardInFlightRef = useRef<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [pendingVoiceKind, setPendingVoiceKind] = useState<"opener" | "response" | "retry" | null>(null);
  const [isMicrophonePrepared, setIsMicrophonePrepared] = useState<boolean>(false);
  const dictation = useDictation();
  const speech = useSpeech();
  const cancelDictation = dictation.cancel;
  const isLessonPractice = Boolean(convertedLesson || approvedRehearsal);

  useEffect(() => () => {
    cancelDictation().catch(() => {});
    resetSpeech().catch(() => {});
  }, [cancelDictation]);

  const persist = useCallback(async (next: PersistedScenarioPracticeRun): Promise<void> => {
    await replaceActiveScenarioRunStrict(next, activeRunRevision(valueRef.current));
    valueRef.current = next;
    setValue(next);
  }, [replaceActiveScenarioRunStrict]);

  const run = value?.run;
  const context = run?.scenarioContext;
  const state = run?.state;
  const lessonState = run?.approvedRehearsal;
  const pressureOne = lessonState?.pushbackOne ?? run?.counterpartTurn;
  const coachedPressure = run ? approvedRehearsalReplayPressure(run) : undefined;
  const pressure = state === "hope_coaching" || state === "replay_pending" || state === "ready_for_retry" || state === "listening_retry" || state === "confirm_retry_transcript" || state === "attempt_comparison" ? coachedPressure ?? pressureOne : pressureOne;
  const presentation = scenarioPracticePresentation(value);
  const counterpartPresentation: ScenarioCounterpartPresentation | undefined = pressure && context ? {
    name: context.counterpartName,
    role: context.counterpartRole,
    text: pressure.text,
    continuityLabel: "Same pressure moment",
    accessibilityLabel: `${context.counterpartName}, ${context.counterpartRole}. Same pressure moment. ${pressure.text}`,
  } : presentation.isAvailable ? presentation.counterpart : undefined;
  const leaveAfterCleanup = useCallback(async (): Promise<void> => {
    try {
      await leaveAfterStrictDictationCleanup(dictation.cancel, () => router.back());
    } catch {
      setError("Recording cleanup is still pending. Try leaving again after cleanup succeeds.");
    }
  }, [dictation, router]);
  const discardAfterCleanup = useCallback(async (): Promise<void> => {
    if (!onDiscard || discardInFlightRef.current) return;
    discardInFlightRef.current = true;
    try {
      await dictation.cancel();
      await onDiscard();
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] discard cleanup failed", errorShape(caught));
      setError("Recording cleanup or rehearsal deletion is still pending. Try discarding again.");
    } finally {
      discardInFlightRef.current = false;
    }
  }, [dictation, onDiscard]);
  const abandonNormalRun = useCallback(async (): Promise<void> => {
    if (discardInFlightRef.current) return;
    const expected = activeRunRevision(valueRef.current);
    if (!expected) return;
    discardInFlightRef.current = true;
    try {
      await dictation.cancel();
      await clearActiveScenarioRunStrict(expected);
      router.replace("/(tabs)/library");
    } catch (caught: unknown) {
      safeLog("[scenario] abandon failed", errorShape(caught));
      setError("We couldn’t abandon this rehearsal safely. It remains saved; try again.");
    } finally {
      discardInFlightRef.current = false;
    }
  }, [clearActiveScenarioRunStrict, dictation, router]);
  const handleClose = useCallback((): void => {
    if (!isLessonPractice) {
      Alert.alert(
        "Leave this rehearsal?",
        "Save it to resume this exact scenario later, or abandon it to start fresh.",
        [
          { text: "Keep practicing", style: "cancel" },
          { text: "Save and leave", onPress: () => { void leaveAfterCleanup(); } },
          { text: "Abandon rehearsal", style: "destructive", onPress: () => { void abandonNormalRun(); } },
        ],
      );
      return;
    }
    Alert.alert(
      "Leave this rehearsal?",
      "Your lesson progress is saved. Your current rehearsal stays here on this device until you finish or discard it.",
      [
        { text: "Keep practicing", style: "cancel" },
        { text: "Save and leave", onPress: () => { void leaveAfterCleanup(); } },
        { text: "Discard this rehearsal", style: "destructive", onPress: () => { void discardAfterCleanup(); } },
      ],
    );
  }, [abandonNormalRun, discardAfterCleanup, isLessonPractice, leaveAfterCleanup]);
  const difficultyLabel = context ? DIFFICULTY[context.difficulty].label : "";

  const startRecording = useCallback(async (kind: "opener" | "response" | "retry"): Promise<void> => {
    if (!value || speech.phase === "speaking" || speech.phase === "generating" || captureTransitionInFlightRef.current) return;
    captureTransitionInFlightRef.current = true;
    setDraft("");
    setError("");
    try {
      const started = await dictation.start();
      if (!started) throw new Error("Microphone capture did not start");
      const nextState = kind === "opener" ? "listening_attempt" : kind === "response" ? "listening_response" : "listening_retry";
      try {
        await persist(transitionScenarioPracticeRun(value, nextState, Date.now()));
      } catch (error: unknown) {
        await dictation.cancel();
        throw error;
      }
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] recording start failed", errorShape(caught));
      setError("We couldn’t start recording. Try the microphone again or type this turn instead.");
    } finally {
      captureTransitionInFlightRef.current = false;
    }
  }, [dictation, persist, speech.phase, value]);

  const beginCapture = useCallback(async (kind: "opener" | "response" | "retry"): Promise<void> => {
    if (isLessonPractice && !isMicrophonePrepared) {
      setPendingVoiceKind(kind);
      return;
    }
    await startRecording(kind);
  }, [isLessonPractice, isMicrophonePrepared, startRecording]);

  const allowMicrophone = useCallback(async (): Promise<void> => {
    const kind = pendingVoiceKind;
    if (!kind || permissionTransitionInFlightRef.current) return;
    permissionTransitionInFlightRef.current = true;
    try {
      const granted = await dictation.requestPermission();
      if (!granted) return;
      setIsMicrophonePrepared(true);
      setPendingVoiceKind(null);
      await startRecording(kind);
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] microphone preparation failed", errorShape(caught));
      setError("We couldn’t prepare the microphone. Try again or type this turn instead.");
    } finally {
      permissionTransitionInFlightRef.current = false;
    }
  }, [dictation, pendingVoiceKind, startRecording]);

  const openTypedFallback = useCallback(async (): Promise<void> => {
    const kind = pendingVoiceKind;
    if (!kind || !value || captureTransitionInFlightRef.current) return;
    captureTransitionInFlightRef.current = true;
    try {
      const review = kind === "opener" ? "confirm_attempt_transcript" : kind === "response" ? "confirm_response_transcript" : "confirm_retry_transcript";
      await persist(transitionScenarioPracticeRun(value, review, Date.now()));
      setPendingVoiceKind(null);
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] typed fallback failed", errorShape(caught));
      setError("We couldn’t open transcript review. Your typed wording is still here; try again.");
    } finally {
      captureTransitionInFlightRef.current = false;
    }
  }, [pendingVoiceKind, persist, value]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!value || captureTransitionInFlightRef.current) return;
    captureTransitionInFlightRef.current = true;
    try {
      const text = await dictation.stop(state === "listening_attempt" ? "opener" : "reply");
      if (text) setDraft(text);
      const review = state === "listening_attempt" ? "confirm_attempt_transcript" : state === "listening_response" ? "confirm_response_transcript" : "confirm_retry_transcript";
      await persist(transitionScenarioPracticeRun(value, review, Date.now()));
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] recording stop failed", errorShape(caught));
      Alert.alert("We couldn’t open transcript review", "Your rehearsal is still saved. Stop again, or leave and return to resume.");
    } finally {
      captureTransitionInFlightRef.current = false;
    }
  }, [dictation, persist, state, value]);

  const openTypedReview = useCallback(async (review: "confirm_attempt_transcript" | "confirm_response_transcript" | "confirm_retry_transcript"): Promise<void> => {
    if (!value || captureTransitionInFlightRef.current) return;
    captureTransitionInFlightRef.current = true;
    try {
      await persist(transitionScenarioPracticeRun(value, review, Date.now()));
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] typed review failed", errorShape(caught));
      setError("We couldn’t open transcript review. Your typed wording is still here; try again.");
    } finally {
      captureTransitionInFlightRef.current = false;
    }
  }, [persist, value]);

  const confirmOpening = useCallback(async (): Promise<void> => {
    if (!value || !context || draft.trim().length < 2 || approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    setBusy(true);
    setError("");
    const approved = preserveScenarioAttempt(value, "opener", draft, Date.now());
    try {
      await persist(approved);
      const openingTranscript = approved.run.attempt?.transcript ?? draft.trim();
      const result = approvedRehearsal
        ? await generateApprovedRehearsalDynamicReply({
          scenario,
          lessonId: approvedRehearsal.lessonId,
          kind: "pushback_one",
          counterpartId: approvedRehearsal.counterpartId,
          namedMove: approvedRehearsal.namedMove,
          coachedBehaviorId: approvedRehearsal.coachedBehaviorId,
          retryDirection: approvedRehearsal.retryDirection,
          approvedTranscript: openingTranscript,
          openingTranscript,
          authoredCorpus: approvedRehearsalAuthoredCorpus(approvedRehearsal),
          runId: approved.run.id,
        })
        : await nextCounterpartTurn(
          scenario,
          context.difficulty,
          [turn(approved.run.attempt?.id ?? `${approved.run.id}-opener`, "user", openingTranscript)],
          context.reaction,
          context.objective,
        );
      const pressureText = result.reply.trim();
      if (!pressureText) throw new Error("Counterpart pressure is unavailable");
      const pressureTurn = {
        id: `${approved.run.id}-counterpart-turn-1`,
        text: pressureText,
        source: "provider" as const,
        reactionId: approvedRehearsal ? `${approvedRehearsal.lessonId}-dynamic-pressure-1` : `${approved.run.id}-provider-pressure`,
        semanticVoiceKey: "contextual_counterpart" as const,
        resolvedAudioId: `${approved.run.curriculumVersion}-${approved.run.id}-counterpart-turn-1`,
      };
      const withPressure = approvedRehearsal
        ? attachApprovedRehearsalPushbackOne(approved, pressureTurn, Date.now())
        : attachScenarioCounterpartTurn(approved, pressureTurn, Date.now());
      setDraft("");
      await persist(transitionScenarioPracticeRun(withPressure, "ready_for_response", Date.now()));
      await playSharedScenarioPressure(withPressure.run.counterpartTurn!, context.contextualPersona, speakPilotAudio);
    } catch {
      setError(`${context.counterpartName}'s response did not come through. Your approved transcript is saved.`);
      await persist(transitionScenarioPracticeRun(approved, "network_error", Date.now()));
    } finally {
      approvalInFlightRef.current = false;
      setBusy(false);
    }
  }, [approvedRehearsal, context, draft, persist, scenario, value]);

  const confirmResponse = useCallback(async (): Promise<void> => {
    if (!value || !context || !pressureOne || draft.trim().length < 2 || approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    setBusy(true);
    setError("");
    const approved = preserveScenarioAttempt(value, "response", draft, Date.now());
    try {
      await persist(approved);
      const response = approved.run.responseAttempt?.transcript ?? draft.trim();
      if (approvedRehearsal) {
        const advanced = advanceApprovedRehearsalFirstResponse(approved, Date.now());
        const openingTranscript = approved.run.attempt?.transcript ?? "";
        const result = await generateApprovedRehearsalDynamicReply({
          scenario,
          lessonId: approvedRehearsal.lessonId,
          kind: "pushback_two",
          counterpartId: approvedRehearsal.counterpartId,
          namedMove: approvedRehearsal.namedMove,
          coachedBehaviorId: approvedRehearsal.coachedBehaviorId,
          retryDirection: approvedRehearsal.retryDirection,
          approvedTranscript: response,
          openingTranscript,
          firstPressure: pressureOne.text,
          firstResponse: response,
          authoredCorpus: approvedRehearsalAuthoredCorpus(approvedRehearsal),
          runId: approved.run.id,
        });
        const pressureText = result.reply.trim();
        if (!pressureText) throw new Error("Second counterpart pressure is unavailable");
        const withSecondPressure = attachApprovedRehearsalPushbackTwo(advanced, {
          id: `${approved.run.id}-counterpart-turn-2`,
          text: pressureText,
          source: "provider",
          reactionId: `${approvedRehearsal.lessonId}-dynamic-pressure-2`,
          semanticVoiceKey: "contextual_counterpart",
          resolvedAudioId: `${approved.run.curriculumVersion}-${approved.run.id}-counterpart-turn-2`,
        }, Date.now());
        const opener = withSecondPressure.run.attempt?.transcript;
        const firstResponse = withSecondPressure.run.responseAttempt?.transcript;
        if (!opener || !firstResponse) throw new Error("Approved exchange is incomplete");
        const note = approvedRehearsalCoachExchange(approvedRehearsal, { opener, firstResponse });
        const coached = attachApprovedRehearsalCoaching(withSecondPressure, note.note, note.retryDirection, note.coachedBehaviorId, {
          coachedBeat: note.coachedBeat,
          selectedDimension: note.selectedDimension,
          status: note.flags[0].status,
          evidenceQuote: note.evidenceQuote,
        }, Date.now());
        setDraft("");
        await persist(coached);
        await playSharedScenarioPressure(coached.run.approvedRehearsal!.pushbackTwo!, context.contextualPersona, speakPilotAudio);
        return;
      }
      const generated = await generateDebrief(scenario, context.difficulty, [
        turn(approved.run.attempt?.id ?? `${approved.run.id}-opener`, "user", approved.run.attempt?.transcript ?? ""),
        turn(pressureOne.id, "them", pressureOne.text),
        turn(approved.run.responseAttempt?.id ?? `${approved.run.id}-response`, "user", response),
      ], context.reaction, context.objective);
      const flag = generated.debrief.flags[0];
      const coached = attachScenarioCoaching(approved, flag?.quote ? `In “${flag.quote},” ${flag.issue}` : generated.debrief.headline, flag?.reframe ?? generated.debrief.nextRep ?? "Answer the same pressure again with one concrete next step.", "pushback_response", Date.now());
      setDraft("");
      await persist(coached);
    } catch {
      setError(approvedRehearsal ? `${context.counterpartName}'s second pushback did not come through. Your approved transcripts are saved.` : "Hope could not finish the feedback. Your approved transcripts are saved.");
      await persist(transitionScenarioPracticeRun(approved, approvedRehearsal ? "network_error" : "model_error", Date.now()));
    } finally {
      approvalInFlightRef.current = false;
      setBusy(false);
    }
  }, [approvedRehearsal, context, draft, persist, pressureOne, scenario, value]);

  const confirmRetry = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2 || approvalInFlightRef.current) return;
    approvalInFlightRef.current = true;
    const approved = approvedRehearsal
      ? preserveApprovedRehearsalRetry(value, draft, Date.now())
      : preserveScenarioAttempt(value, "retry", draft, Date.now());
    const comparedBase = completeScenarioComparison(approved, Date.now());
    const coachedBeat = comparedBase.run.coachingObservation?.coachedBeat;
    const original = coachedBeat === 1
      ? comparedBase.run.attempt?.transcript
      : comparedBase.run.responseAttempt?.transcript;
    const compared = approvedRehearsal && original && comparedBase.run.retryAttempt
      ? { ...comparedBase, run: { ...comparedBase.run, comparison: approvedRehearsalComparison(approvedRehearsal, original, comparedBase.run.retryAttempt.transcript) } }
      : comparedBase;
    try {
      await persist(compared);
      setDraft("");
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] retry approval failed", errorShape(caught));
      setError("We couldn’t save that retry. Your wording is still here; try approving it again.");
    } finally {
      approvalInFlightRef.current = false;
    }
  }, [approvedRehearsal, draft, persist, value]);

  const replayPressureForRetry = useCallback(async (): Promise<void> => {
    if (!value || !context || replayTransitionInFlightRef.current) return;
    replayTransitionInFlightRef.current = true;
    try {
      if (approvedRehearsal) {
        const staged = value.run.state === "replay_pending" ? value : stageApprovedRehearsalReplay(value, Date.now());
        if (staged === value && value.run.state !== "replay_pending") return;
        if (staged !== value) await persist(staged);
        if (staged.run.approvedRehearsal?.replayTarget === "top_of_scene") {
          await persist(confirmApprovedRehearsalReplay(staged, "top_of_scene_reset", Date.now()));
          return;
        }
        const exactPressure = approvedRehearsalReplayPressure(staged.run);
        if (!exactPressure) return;
        const confirmed = await completeApprovedRehearsalReplay(staged, () => speakPilotAudioToCompletion({
          audio_id: exactPressure.resolvedAudioId ?? exactPressure.id,
          voice_key: exactPressure.semanticVoiceKey ?? "contextual_counterpart",
          text: exactPressure.text,
        }), Date.now());
        if (confirmed !== staged) await persist(confirmed);
        return;
      }
      if (!pressure) return;
      await persist(transitionScenarioPracticeRun(value, "ready_for_retry", Date.now()));
      await playSharedScenarioPressure(pressure, context.contextualPersona, speakPilotAudio);
    } catch (caught: unknown) {
      safeLog("[approved-rehearsal] retry pressure failed", errorShape(caught));
      setError("We couldn’t replay that moment. Your rehearsal is saved; try again.");
    } finally {
      replayTransitionInFlightRef.current = false;
    }
  }, [approvedRehearsal, context, persist, pressure, value]);

  const acknowledgeReplayFallback = useCallback(async (): Promise<void> => {
    if (!value || value.run.state !== "replay_pending") return;
    const proof = value.run.approvedRehearsal?.replayTarget === "top_of_scene" ? "top_of_scene_reset" : "text_fallback_acknowledged";
    await persist(confirmApprovedRehearsalReplay(value, proof, Date.now()));
  }, [persist, value]);

  const finish = useCallback(async (): Promise<void> => {
    if (!value || !context || !run?.retryAttempt || !pressure) return;
    try {
      const completed = transitionScenarioPracticeRun(value, "complete", Date.now());
      await persist(completed);
      const record: SessionRecord = {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: run.id,
      scenarioId: context.scenarioId,
      title: context.title,
      counterpart: context.counterpartLabel,
      category: context.category,
      difficulty: context.difficulty,
      reaction: context.reaction,
      skillIds: ["pushback_response"],
      turnCount: 4,
      userTurnCount: 3,
      retryCount: 1,
      completed: true,
      startedAt: run.createdAt,
      endedAt: Date.now(),
      contentRetained: false,
      };
      await upsertSession(record);
      const expected = activeRunRevision(completed);
      if (!expected) throw new Error("Completed scenario revision is unavailable");
      await clearActiveScenarioRunStrict(expected);
      router.replace("/(tabs)/library");
    } catch (caught: unknown) {
      safeLog("[scenario] completion cleanup failed", errorShape(caught));
      setError("We couldn’t finish this scenario safely. Your completed rehearsal is saved; use Back to Scenarios to retry cleanup.");
    }
  }, [clearActiveScenarioRunStrict, context, persist, pressure, router, run, upsertSession, value]);
  const leaveCompleted = useCallback(async (): Promise<void> => {
    const expected = activeRunRevision(valueRef.current);
    if (!expected) {
      router.replace("/(tabs)/library");
      return;
    }
    try {
      await clearActiveScenarioRunStrict(expected);
      router.replace("/(tabs)/library");
    } catch (caught: unknown) {
      safeLog("[scenario] completed run cleanup failed", errorShape(caught));
      setError("We couldn’t clear the completed rehearsal yet. Try returning to Scenarios again.");
    }
  }, [clearActiveScenarioRunStrict, router]);

  if (!value || !context || !run || !presentation.isAvailable) {
    const unavailableTitle = presentation.isAvailable ? "This scenario run is unavailable." : presentation.title;
    const unavailableBody = presentation.isAvailable ? "Return to Scenarios and start a fresh rehearsal. No generic practice fixture was substituted." : presentation.body;
    return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>{unavailableTitle}</Text><Text style={styles.body}>{unavailableBody}</Text><PrimaryButton label="Back to Scenarios" onPress={() => router.replace("/(tabs)/library")} containerStyle={styles.action} /></View>;
  }

  const isListening = state === "listening_attempt" || state === "listening_response" || state === "listening_retry";
  const reviewKind = state === "confirm_attempt_transcript" ? "opening" : state === "confirm_response_transcript" ? "first response" : "retry";
  const showReview = state === "confirm_attempt_transcript" || state === "confirm_response_transcript" || state === "confirm_retry_transcript";
  const coachedOriginal = run.coachingObservation?.coachedBeat === 1
    ? run.attempt?.transcript
    : run.responseAttempt?.transcript;

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={handleClose} style={styles.close} accessibilityRole="button" accessibilityLabel="Leave rehearsal"><X size={21} color={C.textSoft} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>{approvedRehearsal && lessonTitle ? lessonTitle : context.counterpartName}</Text><Text style={styles.headerMeta}>{approvedRehearsal ? `Lesson rehearsal · Step ${Math.min(lessonState?.beat ?? 1, 7)} of 7` : `${context.counterpartRole} · ${difficultyLabel}`}</Text></View><View style={styles.close} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 150 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {approvedRehearsal ? <ProductCard accent style={styles.lessonIdentity}><SectionLabel tone={C.purple}>Lesson rehearsal</SectionLabel><Text style={styles.lessonIdentityTitle}>{lessonTitle}</Text>{lessonMove ? <Text style={styles.lessonIdentityMove}>{lessonMove}</Text> : null}</ProductCard> : null}
        <StatusPill label={context.category.toUpperCase()} tone="purple" /><Text style={styles.scenarioTitle}>{context.title}</Text><Text style={styles.context}>{context.situation}</Text>
        <ProductCard style={styles.identityCard}><View><SectionLabel>Counterpart</SectionLabel><Text style={styles.identityValue}>{context.counterpartLabel}</Text></View><View><SectionLabel>Objective</SectionLabel><Text style={styles.identityValue}>{context.objective}</Text></View><View><SectionLabel>Pressure level</SectionLabel><Text style={styles.identityValue}>{difficultyLabel} · {DIFFICULTY[context.difficulty].note}</Text></View></ProductCard>

        {isLessonPractice ? <ConversationThread run={run} counterpartName={context.counterpartName} /> : null}
        {busy && (state === "confirm_attempt_transcript" || state === "confirm_response_transcript") ? <CounterpartThinking name={context.counterpartName} /> : null}
        {pendingVoiceKind ? <ProductCard accent style={styles.permissionCard}><SectionLabel tone={C.purple}>Use your voice for this rehearsal</SectionLabel><Text style={styles.body}>BYSI asks for microphone access only while you’re practicing. You can type this turn instead.</Text>{dictation.status === "denied" ? <><Text style={styles.title}>Microphone access is off</Text><Text style={styles.body}>Turn it on in Settings, or type this turn instead.</Text><PrimaryButton label="Open Settings" onPress={() => void Linking.openSettings()} containerStyle={styles.action} /></> : <PrimaryButton label="Allow microphone" onPress={() => void allowMicrophone()} containerStyle={styles.action} />}<Pressable onPress={() => void openTypedFallback()} style={styles.permissionSecondary}><Text style={styles.permissionSecondaryText}>Type this turn instead</Text></Pressable><Pressable onPress={() => setPendingVoiceKind(null)} style={styles.permissionSecondary}><Text style={styles.permissionSecondaryText}>Back to rehearsal</Text></Pressable></ProductCard> : null}
        {state === "ready_for_attempt" ? <Reveal><Text style={styles.title}>Open the conversation with {context.counterpartName}.</Text><Text style={styles.body}>Say the first thing you want {context.counterpartRole} to hear. You will approve the transcript before {context.counterpartName} responds.</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void beginCapture("opener")} onType={() => void openTypedReview("confirm_attempt_transcript")} /></Reveal> : null}
        {isListening ? dictation.status === "transcribing" ? <Reveal><Text style={styles.title}>Preparing your transcript…</Text><Thinking /><Text style={styles.body}>Your recording has stopped. You’ll approve the wording next.</Text></Reveal> : <View style={styles.listening}><Text style={styles.title}>Recording your {state === "listening_attempt" ? "opening" : state === "listening_response" ? "first response" : "retry"}.</Text><MicControl state="listening" level={dictation.level} onPress={() => void stopRecording()} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.body}>Tap when you are done. Nothing advances until you approve the transcript.</Text></View> : null}
        {showReview ? <Reveal><StatusPill label="Transcript review" tone="purple" /><Text style={styles.title}>Approve your {reviewKind}.</Text>{dictation.error ? <Text style={styles.body}>{dictation.error} You can type your wording below.</Text> : null}{error ? <Text style={styles.body}>{error}</Text> : null}{reviewKind !== "opening" && pressure ? <CounterpartCard presentation={counterpartPresentation} /> : null}<TextInput value={draft} onChangeText={setDraft} multiline style={styles.input} accessibilityLabel={`Edit ${reviewKind} transcript`} /><PrimaryButton label="Approve this transcript" disabled={draft.trim().length < 2 || busy} onPress={() => void (reviewKind === "opening" ? confirmOpening() : reviewKind === "first response" ? confirmResponse() : confirmRetry())} containerStyle={styles.action} />{busy ? <ActivityIndicator color={C.purple} style={styles.busy} /> : null}</Reveal> : null}
        {state === "ready_for_response" && pressure ? <Reveal><CounterpartCard presentation={counterpartPresentation} />{speech.phase === "speaking" || speech.phase === "generating" ? <Text style={styles.speaking}>{context.counterpartName} is speaking…</Text> : speech.phase === "failed" ? <PrimaryButton label="Try audio again" onPress={() => void replaySpeech()} containerStyle={styles.action} /> : null}<Text style={styles.title}>Respond to the pressure.</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void beginCapture("response")} onType={() => void openTypedReview("confirm_response_transcript")} /></Reveal> : null}
        {state === "hope_coaching" && pressure ? <Reveal><StatusPill label="Hope · one observed behavior" tone="purple" /><CounterpartCard presentation={counterpartPresentation} /><ProductCard accent style={styles.coachCard}><SectionLabel tone={C.purple}>Hope noticed</SectionLabel><Text style={styles.body}>{run.coachNote}</Text><SectionLabel tone={C.purple}>Same-moment retry</SectionLabel><Text style={styles.body}>{run.retryInstruction}</Text></ProductCard><PrimaryButton label={`Retry the same ${context.counterpartName} moment`} onPress={() => void replayPressureForRetry()} containerStyle={styles.action} /></Reveal> : null}
        {state === "replay_pending" ? <Reveal><StatusPill label="Replay required" tone="amber" /><Text style={styles.title}>Replay the exact flagged moment.</Text><CounterpartCard presentation={counterpartPresentation} />{pressure ? <PrimaryButton label="Try the exact audio again" onPress={() => void replayPressureForRetry()} containerStyle={styles.action} /> : null}<Pressable onPress={() => void acknowledgeReplayFallback()} style={styles.permissionSecondary}><Text style={styles.permissionSecondaryText}>{lessonState?.replayTarget === "top_of_scene" ? "Reset to the top of the scene" : "I read the exact pressure — continue"}</Text></Pressable></Reveal> : null}
        {state === "ready_for_retry" && (pressure || lessonState?.replayTarget === "top_of_scene") ? <Reveal><StatusPill label="Same-moment retry" tone="purple" /><CounterpartCard presentation={counterpartPresentation} /><Text style={styles.title}>Answer the exact same turn again.</Text><Text style={styles.body}>{run.retryInstruction}</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void beginCapture("retry")} onType={() => void openTypedReview("confirm_retry_transcript")} /></Reveal> : null}
        {state === "attempt_comparison" && run.retryAttempt && run.comparison && coachedOriginal ? <Reveal><StatusPill label="Review · same moment" tone="purple" /><Text style={styles.title}>Compare your two responses.</Text><CounterpartCard presentation={counterpartPresentation} /><Comparison label="Original approved response" text={coachedOriginal} /><Comparison label="Retry approved response" text={run.retryAttempt.transcript} /><Text style={styles.body}>{run.comparison.text}</Text><PrimaryButton label={isLessonPractice ? "See my results" : "Continue"} onPress={() => { if (isLessonPractice && onReturnToDeck) onReturnToDeck(run.id); else void persist(transitionScenarioPracticeRun(value, "transfer_cue", Date.now())); }} containerStyle={styles.action} /></Reveal> : null}
        {state === "transfer_cue" ? <Reveal><StatusPill label="Hope · wrap-up" tone="purple" /><Text style={styles.title}>Take the clearer wording into the real conversation.</Text><Text style={styles.body}>This completion belongs to {context.title}, with {context.counterpartName} as {context.counterpartRole}. No unrelated practice fixture was used.</Text><PrimaryButton label="Complete scenario" onPress={() => void finish()} containerStyle={styles.action} /></Reveal> : null}
        {state === "complete" ? <Reveal><StatusPill label="Scenario complete" tone="green" /><Text style={styles.title}>{context.title} is complete.</Text><Text style={styles.body}>You practiced one {context.counterpartName} pressure moment twice at {difficultyLabel.toLowerCase()} difficulty.</Text>{error ? <Text style={styles.body}>{error}</Text> : null}<PrimaryButton label="Back to Scenarios" onPress={() => void leaveCompleted()} containerStyle={styles.action} /></Reveal> : null}
        {state === "network_error" || state === "model_error" ? <Reveal><StatusPill label="Saved checkpoint" tone="amber" /><Text style={styles.title}>{error}</Text><PrimaryButton label="Return to this scenario" onPress={() => void persist(transitionScenarioPracticeRun(value, state === "network_error" ? (run.responseAttempt ? "confirm_response_transcript" : "confirm_attempt_transcript") : "confirm_response_transcript", Date.now()))} containerStyle={styles.action} /></Reveal> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    {busy && state !== "confirm_attempt_transcript" ? <StateDock bottomInset={insets.bottom}><View style={styles.processing}><ActivityIndicator color={C.purple} /><Text style={styles.body}>Hope is reviewing your approved words</Text></View></StateDock> : null}
  </View>;
}

function CounterpartThinking({ name }: { name: string }): React.JSX.Element {
  return <View style={styles.thinkingWrap} accessibilityLiveRegion="polite" accessibilityLabel={`${name} is thinking`}><Text style={styles.messageLabel}>{name}</Text><View style={[styles.messageBubble, styles.bubbleTheirs, styles.thinkingBubble]}><Thinking /><Text style={styles.thinkingText}>{name} is thinking…</Text></View></View>;
}

function ConversationThread({ run, counterpartName }: { run: PersistedScenarioPracticeRun["run"]; counterpartName: string }) {
  const messages = [
    run.attempt ? { id: run.attempt.id, speaker: "You", text: run.attempt.transcript, mine: true } : null,
    run.counterpartTurn ? { id: run.counterpartTurn.id, speaker: counterpartName, text: run.counterpartTurn.text, mine: false } : null,
    run.responseAttempt ? { id: run.responseAttempt.id, speaker: "You", text: run.responseAttempt.transcript, mine: true } : null,
    run.approvedRehearsal?.pushbackTwo ? { id: run.approvedRehearsal.pushbackTwo.id, speaker: counterpartName, text: run.approvedRehearsal.pushbackTwo.text, mine: false } : null,
    run.retryAttempt ? { id: run.retryAttempt.id, speaker: "You · retry", text: run.retryAttempt.transcript, mine: true } : null,
  ].filter((message): message is { id: string; speaker: string; text: string; mine: boolean } => Boolean(message));
  if (messages.length === 0) return null;
  return <View style={styles.thread}>{messages.map((message) => <View key={message.id} style={[styles.messageWrap, message.mine ? styles.messageMine : styles.messageTheirs]}><Text style={styles.messageLabel}>{message.speaker}</Text><View style={[styles.messageBubble, message.mine ? styles.bubbleMine : styles.bubbleTheirs]}><Text style={[styles.messageText, message.mine ? styles.messageTextMine : null]}>{message.text}</Text></View></View>)}</View>;
}

function CaptureActions({ value, onChange, onRecord, onType }: { value: string; onChange: (text: string) => void; onRecord: () => void; onType: () => void }) {
  return <View style={styles.capture}><MicControl state="ready" onPress={onRecord} glyph={<Mic size={28} color={C.purple} />} accessibilityLabel="Start recording" /><Text style={styles.or}>OR TYPE AS AN ACCESSIBLE FALLBACK</Text><TextInput value={value} onChangeText={onChange} multiline style={styles.input} /><PrimaryButton label="Review typed transcript" disabled={value.trim().length < 2} onPress={onType} containerStyle={styles.action} /></View>;
}

function CounterpartCard({ presentation }: { presentation?: ScenarioCounterpartPresentation }) {
  if (!presentation) return null;
  return <View accessible accessibilityLabel={presentation.accessibilityLabel}><ProductCard accent style={styles.counterpartCard}><SectionLabel tone={C.purple}>{presentation.name} · {presentation.role}</SectionLabel><Text style={styles.counterpartText}>“{presentation.text}”</Text><Text style={styles.continuityLabel}>{presentation.continuityLabel}</Text></ProductCard></View>;
}

function Comparison({ label, text }: { label: string; text: string }) {
  return <ProductCard style={styles.comparison}><SectionLabel>{label}</SectionLabel><Text style={styles.body}>“{text}”</Text></ProductCard>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, center: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  header: { minHeight: 70, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1, alignItems: "center" }, headerTitle: { fontFamily: font.bold, fontSize: 17, color: C.text }, headerMeta: { ...T.caption, color: C.purple, marginTop: 2 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 12 }, scenarioTitle: { ...T.title, marginTop: 10 }, context: { ...T.support, marginTop: 7 }, identityCard: { marginTop: 16, gap: 14 }, identityValue: { ...T.support, color: C.text, marginTop: 4 },
  lessonIdentity: { marginBottom: 18, gap: 5 }, lessonIdentityTitle: { ...T.title, fontSize: 22, lineHeight: 28 }, lessonIdentityMove: { ...T.support, color: C.purple },
  title: { ...T.title, marginTop: 22 }, body: { ...T.support, marginTop: 8 }, action: { marginTop: 18 }, capture: { alignItems: "center", marginTop: 22 }, or: { ...T.caption, marginVertical: 16 }, input: { ...T.body, minHeight: 108, width: "100%", backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.md, padding: 16, textAlignVertical: "top" },
  listening: { alignItems: "center", gap: 20, paddingTop: 36 }, thinkingWrap: { alignSelf: "flex-start", alignItems: "flex-start", marginTop: 16 }, thinkingBubble: { minWidth: 156, flexDirection: "row", alignItems: "center", gap: 10 }, thinkingText: { ...T.caption, color: C.textSoft }, busy: { marginTop: 14 }, speaking: { ...T.caption, color: C.purple, marginTop: 10 }, thread: { marginTop: 16, gap: 12 }, messageWrap: { maxWidth: "84%" }, messageMine: { alignSelf: "flex-end", alignItems: "flex-end" }, messageTheirs: { alignSelf: "flex-start", alignItems: "flex-start" }, messageLabel: { ...T.caption, fontFamily: font.semi, marginBottom: 4 }, messageBubble: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 11 }, bubbleMine: { backgroundColor: C.purple }, bubbleTheirs: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.line }, messageText: { ...T.support, color: C.text }, messageTextMine: { color: C.onAccent }, processing: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }, permissionCard: { marginTop: 16 }, permissionSecondary: { minHeight: 44, alignItems: "center", justifyContent: "center" }, permissionSecondaryText: { ...T.caption, color: C.purple, fontFamily: font.semi }, counterpartCard: { marginTop: 18 }, counterpartText: { ...T.body, marginTop: 10 }, continuityLabel: { ...T.caption, marginTop: 12 }, coachCard: { marginTop: 14, gap: 8 }, comparison: { marginTop: 10 },
});
