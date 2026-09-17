import { useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowUp,
  Keyboard,
  Mic,
  RotateCcw,
  Settings,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  // `Keyboard` is already the lucide icon in this file, so the platform module
  // is aliased rather than shadowing it.
  Keyboard as RNKeyboard,
  KeyboardAvoidingView,
  InteractionManager,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { RehearsalBriefing } from "@/components/RehearsalBriefing";
import { ScenarioPaidPractice } from "@/components/ScenarioPaidPractice";
import {
  Backdrop,
  GhostButton,
  Meter,
  MicControl,
  PressCard,
  PrimaryButton,
  StateDock,
  Thinking,
  Waveform,
  tap,
  useReducedMotion,
  type MicState,
} from "@/components/ui";
import {
  DEFAULT_PERSONA,
  isPersonaVoice,
  personaFor,
  voiceForRehearsal,
} from "@/constants/personas";
import { expectedReactionLabel } from "@/constants/onboardingScenarios";
import { C, GUTTER, eyebrow, font, radius, T } from "@/constants/theme";
import { bysiContract, generateDebrief, nextCounterpartTurn } from "@/lib/ai";
import {normalFreeRecoveryEnabled,requestNormalFree} from '@/lib/normalFreeRuntime';
import {normalFreeRecoveryContract,normalFreeRecoveryTranscript} from '@/lib/normalFreeRecoveryPayload';
import {applyRecovery,mayRequestRestart,recoveryMessage,type RecoveryState} from '@/lib/phaseRecovery';
import {authoritativeNormalFreeContract,recoveredNormalFreePractice} from "@/lib/normalFreeCheckpoint";
import { FreeAcquisitionRequestError, FreeAcquisitionSafetyError } from "@/lib/freeAcquisitionOutcome";
import { FREE_REHEARSAL_USER_TURNS, rehearsalTurnCap } from "@/lib/access";
import {
  beginConversionBuild,
  cancelConversionBuild,
  emitConversionEvent,
  failConversionBuild,
  isConversionBuildActive,
} from "@/lib/conversionBuild";
import { conversionEvidence, selectFocusSkill } from "@/lib/conversion";
import { approvedUserTurn, buildFreeJourneyResult, recognizerEndState, shouldGeneratePushback } from "@/lib/freeJourney";
import { setLiveSessionContent } from "@/lib/ephemeral";
import { createOnboardingPracticeSession, preserveFreeRehearsalArtifact, type ActivePracticeSession } from "@/lib/practiceSession";
import { transitionPostRehearsal } from "@/lib/postRehearsalFlow";
import { errorShape, safeLog } from "@/lib/redact";
import { createScoredPracticeRecord } from "@/lib/scoredPracticeHistory";
import {
  initialRehearsalState,
  renderCounterpartMessage,
  speechTextFor,
  turnFailureMessage,
} from "@/lib/rehearsal";
import {
  audioFailureMessage,
  micDisabledHint,
  micLocked,
  mutedHint,
  speakerControl,
  speakerLabel,
  tapToHearLabel,
} from "@/lib/speech";
import { useDictation } from "@/lib/useDictation";
import {
  replaySpeech,
  resetSpeech,
  speak,
  stopSpeech,
  unlockAudioPlayback,
  useSpeech,
} from "@/lib/voice";
import { useStore } from "@/providers/store";
import type { Difficulty, PersonaVoice, ReactionPattern, Scenario, Turn } from "@/types/convo";
import { SESSION_SCHEMA_VERSION, type SessionRecord } from "@/types/privacy";

let seq = 0;
function uid(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}`;
}

function onboardingScenarioFromSession(session: ActivePracticeSession, id: string): Scenario {
  const counterpart = session.counterpartDisplayLabel || session.counterpart || "Conversation partner";
  return {
    id,
    category: session.category,
    title: session.scenarioTitle || "Your conversation",
    counterpart,
    situation: session.topic || session.scenarioTitle || "Private custom scenario",
    persona: session.persona || DEFAULT_PERSONA,
    goal: session.behavioralGoal || session.usefulOutcome || "Practice this conversation",
    opensWith: "user",
    openingLine: "",
    minutes: 5,
    isCustom: session.scenarioSource === "user_supplied",
  };
}

/**
 * The rehearsal is modelled as one state at a time, and the dock renders the
 * control set for exactly that state. Anything not usable in a state is absent
 * rather than greyed, so a dead control is never sitting there inviting a tap.
 */
type RehearsalStage = "briefing" | "permission" | "practice";

type DockState =
  | "autoplay-blocked"
  | "complete"
  | "composing"
  | "response-unavailable"
  | "mic-blocked"
  | "mic-error"
  | "playback-failed"
  | "waiting"
  | "speaking"
  | "listening"
  | "ready"
  | "text";

export default function RehearseRoute() {
  const params = useLocalSearchParams<{ id: string; entry?: "onboarding"; scenarioRunId?: string }>();
  const { findScenario } = useStore();
  const scenario = findScenario(String(params.id));
  if (params.entry !== "onboarding" && scenario) {
    return <ScenarioPaidPractice scenario={scenario} requestedRunId={params.scenarioRunId} />;
  }
  return <LegacyRehearse />;
}

function LegacyRehearse() {
  const params = useLocalSearchParams<{
    id: string;
    difficulty?: Difficulty;
    reaction?: ReactionPattern;
    challengeDay?: string;
    entry?: "onboarding";
    persona?: string;
    practiceSessionId?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    findScenario,
    upsertSession,
    profile,
    markChallengeDayDone,
    access,
    activePracticeSession,
    saveActivePracticeSession,
    saveScoredPracticeRecord,
    saveCurrentGuestAssessment,
    anonymousUserId,
  } = useStore();
  const challengeDay = params.challengeDay ? Number(params.challengeDay) : null;

  const routeScenario = findScenario(String(params.id));
  const matchingOnboardingSession = params.entry === "onboarding" && activePracticeSession?.id === params.practiceSessionId
    ? activePracticeSession
    : null;
  const synthesizedActiveScenario = Boolean(
    routeScenario && matchingOnboardingSession
      && routeScenario.id === matchingOnboardingSession.scenarioId
      && routeScenario.counterpart === matchingOnboardingSession.counterpart
      && routeScenario.situation === matchingOnboardingSession.topic
      && routeScenario.goal === matchingOnboardingSession.usefulOutcome,
  );
  const hasAuthoritativeFreeContract = Boolean(authoritativeNormalFreeContract(matchingOnboardingSession));
  const redactedCustomSession = matchingOnboardingSession?.scenarioSource === "user_supplied" && !hasAuthoritativeFreeContract;
  const verifiableRouteScenario = synthesizedActiveScenario || redactedCustomSession ? null : routeScenario;
  const scenario = routeScenario ?? (matchingOnboardingSession ? onboardingScenarioFromSession(matchingOnboardingSession, String(params.id)) : null);
  const onboardingPersona: PersonaVoice | undefined =
    params.entry === "onboarding" && isPersonaVoice(params.persona)
      ? params.persona
      : undefined;
  // The onboarding handoff uses the choice made on the previous screen directly,
  // avoiding a stale persisted profile during navigation. Daily rehearsals retain
  // their scenario-gender override behavior.
  const persona: PersonaVoice = voiceForRehearsal(
    scenario ?? null,
    profile?.persona ?? DEFAULT_PERSONA,
    onboardingPersona,
  );
  const difficulty: Difficulty = params.difficulty ?? "steady";
  const reaction: ReactionPattern | undefined =
    (params.reaction as ReactionPattern) || undefined;
  const outcome = params.entry === "onboarding"
    ? activePracticeSession?.usefulOutcome
    : (profile?.outcome ?? scenario?.goal);

  const sessionId = useRef<string>(params.practiceSessionId ? String(params.practiceSessionId) : uid());
  const startedAt = useRef<number>(Date.now());
  const scrollRef = useRef<ScrollView | null>(null);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const opened = useRef<boolean>(false);
  const persistedTurnsRef = useRef<string>(
    JSON.stringify(activePracticeSession?.freeRehearsalTurns ?? []),
  );

  const [turns, setTurns] = useState<Turn[]>(() =>
    params.entry === "onboarding" && activePracticeSession?.id === params.practiceSessionId
      ? activePracticeSession?.freeRehearsalTurns ?? []
      : [],
  );
  const [stream, setStream] = useState<string>("");
  const recoveryRequired=normalFreeRecoveryEnabled&&params.entry==='onboarding';
  // This flag identifies the instantiated normal /api/native/free transport on
  // this onboarding route, not the server's RPC selector. Its exchange proof
  // binds already-approved turns. Other routes/legacy transports keep editing.
  const finalTranscriptReadOnly = recoveryRequired;
  const [recoveryReady,setRecoveryReady]=useState(!recoveryRequired);
  const [recoveryState,setRecoveryState]=useState<RecoveryState>({status:'checking'});
  const [recoveryBusy,setRecoveryBusy]=useState(false);
  const [contextMissing,setContextMissing]=useState(false);
  const [contextDraft,setContextDraft]=useState({title:'',counterpart:'',situation:'',goal:'',persona:'',openingLine:''});
  const recoverySerial=useRef(0);
  const recoveryCheckRef=useRef<()=>Promise<boolean>>(async()=>!recoveryRequired);

  useEffect(() => {
    const currentSession = activePracticeSession;
    if (params.entry !== "onboarding" || !currentSession || currentSession.id !== params.practiceSessionId || turns.length === 0) return;
    const serializedTurns = JSON.stringify(turns);
    if (persistedTurnsRef.current === serializedTurns) return;
    persistedTurnsRef.current = serializedTurns;
    const roles = turns.map((turn) => turn.role).join(",");
    saveActivePracticeSession({
      ...currentSession,
      freeRehearsalTurns: turns,
      freeJourneyCheckpoint: "rehearsal",
      ...(roles === "user,them,user,them" ? { postRehearsalState: transitionPostRehearsal(currentSession.postRehearsalState, "rehearsal_complete") } : {}),
      updatedAt: Date.now(),
    }).catch(() => {});
  }, [activePracticeSession, params.entry, params.practiceSessionId, saveActivePracticeSession, turns]);
  const [thinking, setThinking] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  /** Blurred when switching to voice, so the keyboard cannot cover the mic. */
  const draftRef = useRef<TextInput>(null);
  const [tension, setTension] = useState<number>(18);
  const [error, setError] = useState<string>("");
  /** A transcribed line waiting for the user to review, edit and submit it. */
  const [pending, setPending] = useState<string>("");
  const [reviewingPendingTranscript, setReviewingPendingTranscript] = useState<boolean>(false);
  /** Set when a counterpart turn could not be produced and can be retried. */
  const [canRetry, setCanRetry] = useState<boolean>(false);
  /** Guards against a second submission while one turn is in flight. */
  const busy = useRef<boolean>(false);
  /** Synchronous guard: two taps can precede the disabled-button render. */
  const finalApprovalStarted = useRef<boolean>(false);
  const [closing, setClosing] = useState<boolean>(false);
  const [reviewingTranscript, setReviewingTranscript] = useState<boolean>(false);
  const [approvalError, setApprovalError] = useState<string>("");
  const [reviewDrafts, setReviewDrafts] = useState<{ opening: string; response: string }>({ opening: "", response: "" });
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [voiceOn, setVoiceOn] = useState<boolean>(true);
  const voiceOnRef = useRef<boolean>(true);
  voiceOnRef.current = voiceOn;
  const dictation = useDictation();
  const cancelDictation = dictation.cancel;
  const cancelDictationRef = useRef(cancelDictation);
  cancelDictationRef.current = cancelDictation;
  const [rehearsalStage, setRehearsalStage] = useState<RehearsalStage>(() => {
    if (params.entry !== "onboarding" || turns.length > 0) return "practice";
    const checkpoint = activePracticeSession?.freeJourneyCheckpoint;
    return checkpoint && checkpoint !== "briefing" ? "practice" : "briefing";
  });
  const [permissionBusy, setPermissionBusy] = useState<boolean>(false);
  const speech = useSpeech();
  const isReduced = useReducedMotion();
  const audioBusy = speech.phase === "speaking" || speech.phase === "generating";
  /** While the counterpart's voice is generating or playing the mic is inert. */
  const recordingLimitedHere = recoveryState.recordingLimited===true &&
    (recoveryState.phase==='start'?turns.length<2:recoveryState.phase==='pushback'?turns.length<4:false);
  const micDisabled = micLocked(speech.phase) || recordingLimitedHere;
  const speakerState = speakerControl(!voiceOn, speech.phase, speech.canReplay);

  // Hope or Adam is the stable rehearsal identity. The scenario describes the
  // role they are playing; it must never replace the selected name in the UI.
  const themName = params.entry === "onboarding"
    ? activePracticeSession?.counterpartDisplayLabel ?? activePracticeSession?.counterpart ?? scenario?.counterpart ?? "The other person"
    : personaFor(persona).name;

  /**
   * A free rehearsal is a fixed exchange, not an open-ended chat: the opener
   * plus two full round trips. The final response remains on screen until the
   * user explicitly asks to analyze the rep. Paid accounts end when they choose.
   */
  // The onboarding rehearsal is always the same concise two-turn experience,
  // even when a preview build has Pro access enabled for testing later flows.
  const isPaidScenario = params.entry !== "onboarding";
  const turnCap = params.entry === "onboarding"
    ? FREE_REHEARSAL_USER_TURNS
    : rehearsalTurnCap(access.entitlement);
  const myTurnCount = turns.filter((t) => t.role === "user").length;
  const hasReachedTurnCap = turnCap !== null && myTurnCount >= turnCap;
  const isRepReadyForAnalysis =
    hasReachedTurnCap &&
    !thinking &&
    stream.length === 0 &&
    turns[turns.length - 1]?.role === "them";
  const latestRole = turns[turns.length - 1]?.role;
  const turnTask = useMemo((): { step: string; prompt: string } => {
    if (isRepReadyForAnalysis) {
      return {
        step: "REHEARSAL COMPLETE",
        prompt: params.entry === "onboarding"
          ? "Your two spoken turns are ready to review."
          : "Your spoken rehearsal is ready to review.",
      };
    }
    if (params.entry !== "onboarding") {
      return latestRole === "user"
        ? { step: `TURN ${myTurnCount}`, prompt: `${themName} is responding…` }
        : { step: "YOUR TURN", prompt: myTurnCount === 0 ? "You start. What do you say?" : "What do you say now?" };
    }
    if (myTurnCount >= 2) {
      return { step: "TURN 2 OF 2", prompt: `${themName} is responding…` };
    }
    if (myTurnCount === 1 && latestRole === "them") {
      return { step: "TURN 2 OF 2", prompt: "They’ve pushed back. What do you say now?" };
    }
    if (myTurnCount === 1) {
      return { step: "TURN 1 OF 2", prompt: `${themName} is responding…` };
    }
    return { step: "TURN 1 OF 2", prompt: "You start. What do you say?" };
  }, [isRepReadyForAnalysis, latestRole, myTurnCount, params.entry, themName]);
  const showsUserPrompt = !isRepReadyForAnalysis && latestRole !== "user" && !thinking && !audioBusy;

  useEffect(() => {
    if (!isRepReadyForAnalysis) return;
    safeLog("[evidence] native post-rehearsal screen", {
      platform: Platform.OS,
      screen: "rehearsal-complete",
      step: "rehearsal_complete",
    });
  }, [isRepReadyForAnalysis]);

  useEffect(() => {
    if (!reviewingTranscript) return;
    safeLog("[evidence] native post-rehearsal screen", {
      platform: Platform.OS,
      screen: "complete-transcript",
      step: "transcript_review",
    });
  }, [reviewingTranscript]);

  const reveal = useCallback((full: string, nudge: string) => {
    const commit = (): void => {
      setStream("");
      setTurns((prev) => [
        ...prev,
        { id: uid(), role: "them", text: full, nudge: nudge || undefined },
      ]);
    };
    if (revealTimer.current) clearInterval(revealTimer.current);
    if (isReduced) {
      commit();
      return;
    }
    const words = full.trim().split(/\s+/);
    let i = 0;
    setStream("");
    revealTimer.current = setInterval(() => {
      i += 1;
      setStream(words.slice(0, i).join(" "));
      if (i >= words.length) {
        if (revealTimer.current) clearInterval(revealTimer.current);
        revealTimer.current = null;
        commit();
      }
    }, 42);
  }, [isReduced]);

  // Only a scenario explicitly configured as counterpart-first opens with a
  // partner line. User-initiated scenarios start with an empty transcript and
  // wait for the user's opening.
  useEffect(() => {
    if (opened.current || !scenario || !recoveryReady || turns.length>0) return;
    const line = initialRehearsalState(scenario).initialCounterpartLine;
    if (!line) return;
    opened.current = true;
    const spoken = speechTextFor(line, themName);
    const t = setTimeout(() => {
      if (spoken.length === 0) {
        reveal(line, "");
        return;
      }
      // Keep the transcript staged while the voice is generated. The words begin
      // appearing only once playback starts (or immediately if audio is muted).
      speak(spoken, persona, { muted: !voiceOnRef.current })
        .then(() => reveal(line, ""))
        .catch((e) => {
          safeLog("[rehearse] opening speech failed", errorShape(e));
          reveal(line, "");
        });
    }, 550);
    return () => clearTimeout(t);
  }, [scenario, reveal, persona, themName, recoveryReady, turns.length]);

  // Leaving the screen must stop playback and drop the staged line, so nothing
  // can be heard after the rehearsal is over. Do not depend on cancelDictation:
  // recorder updates recreate that function and would abort an in-flight transcribe.
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
      cancelDictationRef.current().catch(() => {});
      resetSpeech().catch(() => {});
    };
  }, []);

  /**
   * Produce exactly one counterpart reply for the given transcript. The user
   * turn is already in `history`, so a failure can be retried without
   * duplicating or dropping anything the user said.
   */
  const generateCounterpart = useCallback(
    async (history: Turn[]) => {
      if (!scenario) return;
      setError("");
      setCanRetry(false);
      setThinking(true);
      try {
        const res = await nextCounterpartTurn(
          scenario,
          difficulty,
          history,
          reaction,
          outcome,
          persona,
          activePracticeSession?.entryRoute,
          false,
          authoritativeNormalFreeContract(activePracticeSession),
        );
        const userTurnCount = history.filter((turn) => turn.role === "user").length;
        safeLog("[evidence] native counterpart accepted", {
          entryRoute: activePracticeSession?.entryRoute ?? "unknown",
          persona,
          turn: userTurnCount === 1 ? "pushback" : "close",
          userTurnCount,
        });
        setTension(res.tension);
        setThinking(false);
        const spoken = recoveryRequired ? res.reply : speechTextFor(res.reply, themName);
        // Match the web flow: the generated counterpart text is visible immediately,
        // then that exact Hope/Adam line is sent to BYSI TTS. The learner's own
        // transcript never enters the playback path.
        reveal(res.reply, res.nudge);
        if (spoken.length > 0) {
          await speak(spoken, persona, { muted: !voiceOnRef.current });
        }
      } catch (e) {
        if (e instanceof FreeAcquisitionSafetyError) {
          setThinking(false);setCanRetry(false);
          await resetSpeech().catch(() => {});
          router.replace({ pathname: '/safety', params: { sessionId: activePracticeSession?.id } });
          return;
        }
        safeLog("[rehearse] turn failed", errorShape(e));
        setThinking(false);
        // Never invent a reply on the client — offer the turn again instead.
        setError(e instanceof FreeAcquisitionRequestError ? e.message : turnFailureMessage(themName));
        setCanRetry(e instanceof FreeAcquisitionRequestError ? e.retryable : true);
      } finally {
        busy.current = false;
      }
    },
    [scenario, difficulty, reaction, outcome, reveal, persona, themName, activePracticeSession, router, recoveryRequired],
  );

  /** Commit the user's reviewed line. Only an explicit submit advances a turn. */
  const submitText = useCallback(
    async (text: string) => {
      const clean = text.trim();
      if (!scenario || clean.length === 0 || hasReachedTurnCap) return;
      if (busy.current || thinking) return;
      busy.current = true;
      tap("light");
      // This submit is the user's last gesture before the reply arrives, so it
      // is the only chance to satisfy the browser's autoplay policy.
      await unlockAudioPlayback();
      setPending("");
      setReviewingPendingTranscript(false);
      setDraft("");
      const mine: Turn = approvedUserTurn(uid(), clean);
      const next = [...turns, mine];
      setTurns(next);
      if (shouldGeneratePushback(turns)) {
        await generateCounterpart(next);
      } else {
        busy.current = false;
        const currentSession = activePracticeSession;
        if (params.entry === "onboarding" && currentSession && currentSession.id === params.practiceSessionId) {
          await saveActivePracticeSession({ ...currentSession, freeRehearsalTurns: next, freeJourneyCheckpoint: "rehearsal", updatedAt: Date.now() });
        }
      }
    },
    [scenario, thinking, turns, generateCounterpart, hasReachedTurnCap, activePracticeSession, params.entry, params.practiceSessionId, saveActivePracticeSession],
  );

  const retryTurn = useCallback(() => {
    if (busy.current || thinking) return;
    busy.current = true;
    tap("light");
    generateCounterpart(turns);
  }, [thinking, turns, generateCounterpart]);

  const send = useCallback(() => {
    const text = draft.trim();
    if (text.length === 0) return;
    submitText(text);
  }, [draft, submitText]);

  const approvePendingTranscript = useCallback((): void => {
    const turn = myTurnCount === 0 ? "opener" : "reply";
    safeLog("[evidence] transcript approved in native UI", {
      entryRoute: activePracticeSession?.entryRoute ?? "unknown",
      platform: Platform.OS,
      screen: "rehearsal-confirm-transcript",
      turn,
    });
    void submitText(pending);
  }, [activePracticeSession?.entryRoute, myTurnCount, pending, submitText]);

  const onMicTap = useCallback(async () => {
    if (thinking || closing) return;
    if(dictation.status!=="recording"&&!(await recoveryCheckRef.current()))return;
    // The microphone stays disabled while the counterpart is talking, so a tap
    // here is inert. Stopping playback belongs to the speaker control, which
    // keeps one deliberate mic tap always meaning "start recording".
    if (micLocked(speech.phase)) return;
    if (dictation.status === "recording") {
      tap("medium");
      const turn = myTurnCount === 0 ? "opener" : "reply";
      const text = await dictation.stop(turn);
      // Transcription finishing never submits the turn. The line goes into a
      // review state and waits for the user to send it.
      if (text && text.trim().length > 0) {
        tap("success");
        setPending(recognizerEndState(text).pendingText);
        setReviewingPendingTranscript(true);
        safeLog("[evidence] confirm transcript shown in native UI", {
          entryRoute: activePracticeSession?.entryRoute ?? "unknown",
          platform: Platform.OS,
          screen: "rehearsal-confirm-transcript",
          turn,
        });
      }
      return;
    }
    if (dictation.status === "transcribing") return;
    await dictation.start();
    tap("medium");
  }, [activePracticeSession?.entryRoute, dictation, thinking, closing, myTurnCount, speech.phase]);

  const toggleSpeaker = useCallback(() => {
    tap("light");
    if (audioBusy) {
      stopSpeech().catch(() => {});
      return;
    }
    setVoiceOn((v) => {
      if (v) stopSpeech().catch(() => {});
      return !v;
    });
  }, [audioBusy]);

  /**
   * Play the last counterpart line again. Also serves the tap-to-hear control
   * after a blocked autoplay and the retry after an audio failure — both run
   * inside a real tap, which is what iOS requires.
   */
  const onReplay = useCallback(() => {
    tap("light");
    setVoiceOn(true);
    replaySpeech().catch((e) => safeLog("[rehearse] replay failed", errorShape(e)));
  }, []);

  const stopPlayback = useCallback(() => {
    tap("light");
    stopSpeech().catch(() => {});
  }, []);

  const continueWithoutAudio = useCallback(() => {
    tap("light");
    setVoiceOn(false);
    stopSpeech().catch(() => {});
  }, []);

  const switchToText = useCallback(() => {
    tap("light");
    void dictation.reset().then(() => setMode("text")).catch((caught: unknown) => safeLog("[rehearse] recording cleanup pending", errorShape(caught)));
  }, [dictation]);

  const retryMicrophone = useCallback((): void => {
    if (thinking || closing || micLocked(speech.phase)) return;
    tap("light");
    void dictation.reset().then(async () => {if(await recoveryCheckRef.current())await dictation.start();}).catch((caught: unknown) => safeLog("[rehearse] microphone retry cleanup pending", errorShape(caught)));
  }, [closing, dictation, speech.phase, thinking]);

  const openMicrophoneSettings = useCallback((): void => {
    tap("light");
    Linking.openSettings().catch((caught) => {
      safeLog("[rehearse] open settings failed", errorShape(caught));
    });
  }, []);

  const activatePractice = useCallback((preferredMode: "voice" | "text" = "voice"): void => {
    setMode(preferredMode);
    setRehearsalStage("practice");
    const currentSession = activePracticeSession;
    if (params.entry === "onboarding" && currentSession && currentSession.id === params.practiceSessionId) {
      saveActivePracticeSession({ ...currentSession, freeJourneyCheckpoint: "rehearsal", updatedAt: Date.now() }).catch((caught) => {
        safeLog("[rehearse] checkpoint update failed", errorShape(caught));
      });
    }
  }, [activePracticeSession, params.entry, params.practiceSessionId, saveActivePracticeSession]);

  const requestMicrophoneAccess = useCallback(async (): Promise<void> => {
    if (permissionBusy) return;
    setPermissionBusy(true);
    tap("light");
    const granted = await dictation.requestPermission();
    setPermissionBusy(false);
    if (granted) activatePractice("voice");
  }, [activatePractice, dictation, permissionBusy]);

  const analyzeApprovedTranscript = useCallback(async (approvedTurns: Turn[]) => {
    if (!scenario) return;
    const turns = approvedTurns;
    const mine = turns.filter((turn) => turn.role === "user");
    if (mine.length !== 2) return;
    setClosing(true);
    tap("medium");
    await resetSpeech().catch(() => {});
    const id = sessionId.current;
    beginConversionBuild({ id, scenarioTitle: scenario.title, counterpartName: themName, turns: approvedTurns });
    let generationSession: ActivePracticeSession | null = activePracticeSession;
    if (params.entry === "onboarding" && activePracticeSession?.id === id) {
      generationSession = {
        ...activePracticeSession,
        freeRehearsalTurns: approvedTurns,
        freeRehearsalCompletedAt: Date.now(),
        freeJourneyCheckpoint: "generating",
        postRehearsalState: transitionPostRehearsal(activePracticeSession.postRehearsalState, "generating"),
        insufficientEvidence: undefined,
        updatedAt: Date.now(),
      };
      await saveActivePracticeSession(generationSession);
    }
    safeLog("[evidence] native flow reached debrief", {
      entryRoute: activePracticeSession?.entryRoute ?? "unknown",
      platform: Platform.OS,
      screen: "debrief",
      userTurnCount: mine.length,
    });
    router.replace(`/debrief/${id}`);

    try {
      await new Promise<void>((resolve) => InteractionManager.runAfterInteractions(() => resolve()));
      emitConversionEvent(id, "transcript.confirmed");
      emitConversionEvent(id, "exchange.paired");
      const generated = await generateDebrief(
        scenario,
        difficulty,
        turns,
        reaction,
        outcome,
        activePracticeSession?.entryRoute,
        false,
        authoritativeNormalFreeContract(activePracticeSession),
      );
      const { analysis, debrief } = generated;
      if (!isConversionBuildActive(id)) return;
      if (params.entry === "onboarding" && generationSession?.id === id && analysis.mode === "insufficient_evidence") {
        const insufficient = analysis.insufficient_evidence;
        if (!insufficient?.headline?.trim() || !insufficient.note?.trim() || !insufficient.next_step?.trim()) {
          throw new Error("The insufficient-evidence response was incomplete.");
        }
        const preserved = preserveFreeRehearsalArtifact(generationSession, approvedTurns, Date.now());
        await saveActivePracticeSession({
          ...preserved,
          freeRehearsalTurns: approvedTurns,
          freeRehearsalCompletedAt: Date.now(),
          freeJourneyCheckpoint: "insufficient_evidence",
          postRehearsalState: transitionPostRehearsal(preserved.postRehearsalState, "insufficient_evidence"),
          sharedResult: undefined,
          recommendation: undefined,
          insufficientEvidence: {
            headline: insufficient.headline.trim(),
            note: insufficient.note.trim(),
            nextStep: insufficient.next_step.trim(),
          },
          updatedAt: Date.now(),
        });
        emitConversionEvent(id, "plan.ready");
        safeLog("[evidence] native insufficient result", {
          event: "plan.ready",
          platform: Platform.OS,
          screen: "insufficient-evidence",
          status: "api-confirmed",
        });
        return;
      }
      if (!debrief) throw new Error('No assessed debrief is available');
      emitConversionEvent(id, "skill.identified", debrief);
      const focus = selectFocusSkill(debrief, activePracticeSession?.provisionalModuleId);
      const evidence = conversionEvidence(approvedTurns, debrief, activePracticeSession?.provisionalModuleId);
      emitConversionEvent(id, "path.mapped");
      setLiveSessionContent(id, { turns: approvedTurns, debrief, outcome });

      if (params.entry === "onboarding" && generationSession?.id === id) {
        const preserved = preserveFreeRehearsalArtifact(generationSession, approvedTurns, Date.now());
        const evidenceTurn = evidence.learnerQuote ? mine.find((turn) => turn.text.includes(evidence.learnerQuote)) ?? null : null;
        const withRecommendation = {
          ...preserved,
          freeRehearsalTurns: approvedTurns,
          freeRehearsalCompletedAt: Date.now(),
          recommendation: {
            moduleId: focus.id,
            ...(generationSession.provisionalModuleId ? { hypothesisModuleId: generationSession.provisionalModuleId } : {}),
            evidenceQuote: evidence.learnerQuote || null,
            evidenceTurnId: evidenceTurn?.id ?? null,
            confidence: evidence.confidence,
            status: "suggested" as const,
            supportedStrength: evidence.supportedStrength,
            immediateAction: evidence.immediateAction,
            createdAt: Date.now(),
          },
          coachNote: focus.body,
          retryInstruction: focus.name,
          nextState: "focused_coach_note" as const,
          freeJourneyCheckpoint: "pressure_moment" as const,
          postRehearsalState: transitionPostRehearsal(preserved.postRehearsalState, "pressure"),
          insufficientEvidence: undefined,
          updatedAt: Date.now(),
        };
        const completedAt = Date.now();
        const sharedResult = buildFreeJourneyResult(withRecommendation, debrief, analysis);
        await saveCurrentGuestAssessment({ ...withRecommendation, sharedResult });
        const approvedTextByTurnId = new Map(approvedTurns.map((turn) => [turn.id, turn.text]));
        await saveScoredPracticeRecord(createScoredPracticeRecord(sharedResult, {
          completedAt,
          scenarioId: scenario.id,
          scenarioTitle: scenario.isCustom ? "Your conversation" : scenario.title,
          approvedTextByTurnId,
        }));
      }

      const record: SessionRecord = {
        schemaVersion: SESSION_SCHEMA_VERSION, id, scenarioId: scenario.id,
        title: scenario.isCustom ? undefined : scenario.title,
        counterpart: scenario.isCustom ? undefined : scenario.counterpart,
        category: scenario.category, difficulty, persona, reaction, skillIds: [focus.id],
        turnCount: approvedTurns.length, userTurnCount: mine.length, retryCount: 0,
        completed: true, startedAt: startedAt.current, endedAt: Date.now(), contentRetained: false,
      };
      await upsertSession(record);
      if (challengeDay !== null) await markChallengeDayDone(challengeDay);
      emitConversionEvent(id, "plan.ready");
      safeLog("[evidence] native debrief ready", {
        entryRoute: activePracticeSession?.entryRoute ?? "unknown",
        event: "plan.ready",
        platform: Platform.OS,
        screen: "debrief",
        userTurnCount: mine.length,
      });
      tap("success");
    } catch (caught) {
      if (caught instanceof FreeAcquisitionSafetyError) {
        cancelConversionBuild(id);
        await resetSpeech().catch(() => {});
        router.replace({ pathname: '/safety', params: { sessionId: id, returnTo: 'generating' } });
        return;
      }
      safeLog("[rehearse] debrief failed", errorShape(caught));
      const normalFree = process.env.EXPO_PUBLIC_BYSI_BUILD_MODE !== 'staging-account' && !!process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN;
      failConversionBuild(id, normalFree ? {
        message:caught instanceof FreeAcquisitionRequestError ? caught.message : 'Your result could not be confirmed. Recover the same operation without restarting your free session.',
        retry:caught instanceof FreeAcquisitionRequestError && !caught.retryable ? undefined : async()=>{await analyzeApprovedTranscript(approvedTurns);},
      } : undefined);
    }
  }, [scenario, difficulty, reaction, outcome, upsertSession, router, challengeDay, markChallengeDayDone, persona, themName, params.entry, activePracticeSession, saveActivePracticeSession, saveScoredPracticeRecord, saveCurrentGuestAssessment]);

  const openTranscriptReview = useCallback((): void => {
    const userTurns = turns.filter((turn) => turn.role === "user");
    setReviewDrafts({ opening: userTurns[0]?.text ?? "", response: userTurns[1]?.text ?? "" });
    setReviewingTranscript(true);
    const currentSession = activePracticeSession;
    if (params.entry === "onboarding" && currentSession && currentSession.id === params.practiceSessionId) {
      saveActivePracticeSession({
        ...currentSession,
        freeRehearsalTurns: turns,
        freeJourneyCheckpoint: "transcript_review",
        postRehearsalState: transitionPostRehearsal(currentSession.postRehearsalState, "transcript_review"),
        updatedAt: Date.now(),
      }).catch(() => {});
    }
  }, [activePracticeSession, params.entry, params.practiceSessionId, saveActivePracticeSession, turns]);

  const approveTranscript = useCallback((): void => {
    if (finalApprovalStarted.current || !reviewDrafts.opening.trim() || !reviewDrafts.response.trim()) return;
    finalApprovalStarted.current = true;
    setApprovalError("");
    let userIndex = 0;
    const approvedTurns = finalTranscriptReadOnly ? turns : turns.map((turn): Turn => turn.role !== "user" ? turn : { ...turn, text: (userIndex++ === 0 ? reviewDrafts.opening : reviewDrafts.response).trim() });
    setTurns(approvedTurns);
    setReviewingTranscript(false);
    void analyzeApprovedTranscript(approvedTurns).catch(() => {
      // Setup/persistence failed before the debrief's own retry handling took over.
      finalApprovalStarted.current = false;
      cancelConversionBuild(sessionId.current);
      setClosing(false);
      setReviewingTranscript(true);
      setApprovalError("We couldn't prepare your debrief. Please try approving again.");
    });
  }, [analyzeApprovedTranscript, finalTranscriptReadOnly, reviewDrafts, turns]);

  const exitRehearsal = useCallback(async (): Promise<void> => {
    await cancelDictation();
    await resetSpeech();
    if (params.entry === "onboarding") {
      if (activePracticeSession?.id === params.practiceSessionId) {
        await saveActivePracticeSession(null);
      }
      // Safety-check enters this screen with replace(), so there may be no back
      // entry. Returning explicitly also prevents the unfinished-session resume
      // guard from immediately sending the learner into the abandoned rep again.
      router.replace("/onboarding");
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
  }, [activePracticeSession?.id, cancelDictation, params.entry, params.practiceSessionId, router, saveActivePracticeSession]);

  const leave = useCallback(() => {
    const act = (): void => {
      void exitRehearsal().catch((caught: unknown) => {
        safeLog("[rehearse] exit blocked by pending recording cleanup", errorShape(caught));
        setError("Recording cleanup is still pending. Try leaving again after cleanup succeeds.");
      });
    };
    if (turns.filter((t) => t.role === "user").length === 0 || Platform.OS === "web") {
      act();
      return;
    }
    Alert.alert("Leave the rehearsal?", "This rep won't be saved.", [
      { text: "Stay", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: act },
    ]);
  }, [exitRehearsal, turns]);

  const dockState: DockState = useMemo(() => {
    if (reviewingPendingTranscript) return "composing";
    if (thinking) return "waiting";
    if (audioBusy) return "speaking";
    if (canRetry || error.length > 0) return "response-unavailable";
    if (speech.phase === "blocked") return "autoplay-blocked";
    if (speech.phase === "failed") return "playback-failed";
    if (hasReachedTurnCap) return "complete";
    if (mode === "text") return "text";
    if (dictation.status === "denied") return "mic-blocked";
    if (dictation.status === "error") return "mic-error";
    if (dictation.status === "recording" || dictation.status === "transcribing") {
      return "listening";
    }
    return "ready";
  }, [
    reviewingPendingTranscript,
    thinking,
    audioBusy,
    canRetry,
    error,
    speech.phase,
    hasReachedTurnCap,
    mode,
    dictation.status,
  ]);
  const usesImmersiveVoiceDock =
    dockState === "ready" ||
    dockState === "listening" ||
    dockState === "waiting" ||
    dockState === "speaking";

  const micState: MicState = micDisabled
    ? "disabled"
    : dictation.status === "recording"
      ? "listening"
      : dictation.status === "transcribing"
        ? "detected"
        : dictation.status === "denied" || dictation.status === "error"
          ? "error"
          : "ready";

  const checkRecovery=async():Promise<boolean>=>{
    if(!recoveryRequired)return true;
    const localSession=matchingOnboardingSession;
    const serial=++recoverySerial.current;setRecoveryBusy(true);
    try{
      const localContract=authoritativeNormalFreeContract(localSession);
      const hasLocalWords=Boolean(localSession&&turns.some(turn=>turn.text.trim().length>0));
      const recoveryPayloadScenario=localContract?scenario:verifiableRouteScenario;
      const response=await requestNormalFree('recover',hasLocalWords&&recoveryPayloadScenario?{contract:localContract??normalFreeRecoveryContract(recoveryPayloadScenario,reaction,outcome,localSession!.entryRoute,difficulty),transcript:normalFreeRecoveryTranscript(turns,recoveryPayloadScenario)}:{});
      if(serial!==recoverySerial.current)return false;
      if(!response.ok)throw Error('Practice check failed');
      const state:RecoveryState=await response.json();const localTurns=localSession?turns:[];const restored=applyRecovery(state,localTurns);
      setRecoveryState(state);
      if(!restored.ready){setRecoveryReady(false);return false;}
      // Privacy placeholders are display-only, including storage written by older clients.
      // Ask the server first: a committed checkpoint can restore the exact original.
      if(!state.checkpoint && !localContract && (!scenario || scenario.situation==='Private custom scenario')){
        setContextMissing(true);setRecoveryReady(false);return false;
      }
      setContextMissing(false);
      const changed=JSON.stringify(restored.turns)!==JSON.stringify(localTurns);
      const recovered=!verifiableRouteScenario||!localSession?recoveredNormalFreePractice(state,anonymousUserId,String(params.practiceSessionId??sessionId.current),Date.now(),localTurns):null;
      const recoveryScenario=recovered?.scenario??routeScenario??(localSession?onboardingScenarioFromSession(localSession,String(params.id)):null);
      if(!recoveryScenario){setRecoveryReady(false);return false;}
      if(changed||!localSession||(recovered&&!verifiableRouteScenario)){
        const session=recovered?.session??localSession??createOnboardingPracticeSession(String(params.practiceSessionId??sessionId.current),anonymousUserId,recoveryScenario,outcome??recoveryScenario.goal,reaction??'not-sure',Date.now(),{
          entryRoute:'real_conversation',
          scenarioSource:recoveryScenario.isCustom?'user_supplied':'approved_authored',
          scenarioTitle:recoveryScenario.title,
          counterpartRelationship:recoveryScenario.persona??'Conversation partner',
          counterpartDisplayLabel:themName,
          behavioralGoal:recoveryScenario.goal,
          persona,
        });
        await saveActivePracticeSession({...session,freeRehearsalTurns:restored.turns,freeJourneyCheckpoint:'rehearsal',normalFreeContract:authoritativeNormalFreeContract(session)??(state.checkpoint?.contract as Record<string,unknown>|undefined),normalFreeCheckpointRevision:state.checkpoint?.revision,normalFreeCheckpointPhase:state.phase,updatedAt:Date.now()});
        if(serial!==recoverySerial.current)return false;
        persistedTurnsRef.current=JSON.stringify(restored.turns);setTurns(restored.turns);
      }
      setCanRetry(restored.turns[restored.turns.length-1]?.role==='user');setRecoveryReady(true);
      // The recovered line uses the existing approved ElevenLabs path, never device TTS.
      if(changed&&restored.audio)void speak(restored.audio.text,persona,{muted:!voiceOnRef.current}).catch(()=>{});
      return !changed;
    }catch{if(serial===recoverySerial.current){setRecoveryState({status:'unavailable'});setRecoveryReady(false);}return false;}
    finally{if(serial===recoverySerial.current)setRecoveryBusy(false);}
  };
  recoveryCheckRef.current=checkRecovery;
  useEffect(()=>{const serialRef=recoverySerial;void recoveryCheckRef.current();return ()=>{serialRef.current++;};},[params.practiceSessionId,hasAuthoritativeFreeContract]);
  const restartRecovery=async()=>{
    if(recoveryBusy||!mayRequestRestart(recoveryState))return;
    setRecoveryBusy(true);
    try{
      const response=await requestNormalFree('restart',{sessionId:recoveryState.sessionId,generation:recoveryState.generation});
      if(!response.ok){const result=await response.json();setRecoveryState({...recoveryState,status:result.code});return;}
      await resetSpeech();router.replace('/onboarding');
    }catch{setRecoveryState({...recoveryState,status:'unavailable'});}
    finally{setRecoveryBusy(false);}
  };
  const contextDraftComplete=Object.entries(contextDraft).every(([key,value])=>key==='openingLine'||value.trim().length>0);
  const confirmContext=async()=>{
    if(!contextMissing||!contextDraftComplete||recoveryBusy||!matchingOnboardingSession)return;
    const session=matchingOnboardingSession;
    const restoredScenario:Scenario={id:session.scenarioId,category:session.category,...contextDraft,opensWith:'user',minutes:5,isCustom:true};
    setRecoveryBusy(true);
    try{
      // This is an explicit user restoration, not reconstruction from approved words or a hash.
      // The store's existing consent boundary still strips these fields on disk when saving is off.
      await saveActivePracticeSession({...session,topic:contextDraft.situation,counterpart:contextDraft.counterpart,
        counterpartDisplayLabel:contextDraft.counterpart,scenarioTitle:contextDraft.title,usefulOutcome:contextDraft.goal,
        behavioralGoal:contextDraft.goal,normalFreeContract:{...bysiContract(restoredScenario,reaction,contextDraft.goal,session.entryRoute,difficulty)},updatedAt:Date.now()});
    }catch{setRecoveryState({status:'unavailable'});}
    finally{setRecoveryBusy(false);}
  };
  if(recoveryRequired&&!recoveryReady&&contextMissing){
    return <View style={styles.root}><Backdrop/><ScrollView contentContainerStyle={{padding:GUTTER,paddingTop:insets.top+24}} keyboardShouldPersistTaps="handled">
      <Text style={T.title}>Restore your conversation context</Text>
      <Text style={T.support}>Your approved words are safe. Custom context was not saved on this device, and no server conversation checkpoint is available. Re-enter and confirm the context you want to use before sending. This does not enable custom-text saving or reset recording limits.</Text>
      {turns.map(turn=><Text key={turn.id} style={T.support}>{turn.text}</Text>)}
      {([
        ['title','Restore conversation title'],['counterpart','Restore counterpart'],['situation','Restore situation'],
        ['goal','Restore goal'],['persona','Restore counterpart behavior'],['openingLine','Restore opening line'],
      ] as const).map(([key,label])=><View key={key}><Text style={T.support}>{label}{key==='openingLine'?' (optional; you open this conversation)':''}</Text><TextInput accessibilityLabel={label} value={contextDraft[key]} onChangeText={value=>setContextDraft(current=>({...current,[key]:value}))} multiline maxLength={2000} style={styles.reviewInput}/></View>)}
      <Text style={T.support}>Confirming uses this context with your existing approved opener. It does not claim that missing details were recovered automatically.</Text>
      <PrimaryButton label="Confirm restored context" disabled={!contextDraftComplete||recoveryBusy} onPress={()=>void confirmContext()}/>
      <GhostButton label="Check for saved context again" disabled={recoveryBusy} onPress={()=>void checkRecovery()}/>
      <GhostButton label="Back" onPress={()=>router.replace('/account-practice')}/>
    </ScrollView></View>;
  }
  if(recoveryRequired&&!recoveryReady){
    return <View style={[styles.root,styles.center]}><Backdrop/>
      <Text style={T.title}>{recoveryState.status==='checking'?'Checking your rehearsal':'Continue your practice'}</Text>
      <Text style={T.support}>{recoveryState.status==='checking'?'Checking the saved conversation before recording.':recoveryMessage(recoveryState.recordingLimited?'recording_limit':recoveryState.status)}</Text>
      {recoveryState.status==='recording_limit'||recoveryState.recordingLimited?<ScrollView>{applyRecovery(recoveryState,turns).turns.map(turn=><Text key={turn.id} style={T.support}>{turn.text}</Text>)}</ScrollView>:<PrimaryButton label="Check again" disabled={recoveryBusy} onPress={()=>void checkRecovery()}/>}
      {mayRequestRestart(recoveryState)?<><Text style={T.support}>A new rehearsal starts only after the server confirms the current practice can move forward without reusing stale work.</Text><PrimaryButton label="Start new rehearsal" disabled={recoveryBusy} onPress={()=>void restartRecovery()}/></>:null}
      <PrimaryButton label="Back" onPress={()=>router.replace('/account-practice')}/>
    </View>;
  }

  if (!scenario) {
    return (
      <View style={[styles.root, styles.center]}>
        <Backdrop />
        <Text style={T.title}>This rehearsal needs fresh context.</Text>
        <Text style={[T.support, styles.missingBody]}>Choose another conversation to continue your practice.</Text>
        <PressCard onPress={leave} accessibilityLabel="Choose another conversation">
          <View style={styles.analyzeBtn}><Text style={styles.analyzeText}>Choose another conversation</Text></View>
        </PressCard>
      </View>
    );
  }

  if (rehearsalStage === "briefing") {
    return (
      <View style={styles.root}>
        <Backdrop />
        <View style={[styles.introHeader, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={leave} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to questions">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.introScroll, { paddingBottom: 24 }]} showsVerticalScrollIndicator={false}>
          <RehearsalBriefing
            entryRoute={activePracticeSession?.entryRoute}
            counterpart={themName}
            situation={scenario.situation}
            desiredOutcome={outcome ?? scenario.goal}
            expectedReaction={expectedReactionLabel(reaction ?? activePracticeSession?.expectedReaction ?? "not-sure")}
            behavioralGoal={activePracticeSession?.behavioralGoal ?? "Say what you need clearly and ask for a concrete next step."}
          />
        </ScrollView>
        <StateDock bottomInset={insets.bottom}>
          <PrimaryButton label="Start my rehearsal" onPress={() => setRehearsalStage("permission")} />
        </StateDock>
      </View>
    );
  }

  if (rehearsalStage === "permission") {
    const permissionDenied = dictation.status === "denied" || dictation.status === "error";
    return (
      <View style={styles.root}>
        <Backdrop />
        <View style={[styles.introHeader, { paddingTop: insets.top + 8 }]}>
          <Pressable onPress={() => setRehearsalStage("briefing")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to rehearsal briefing">
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.permissionMeta}>FREE REHEARSAL</Text>
        </View>
        <View style={styles.permissionBody}>
          <View style={styles.permissionIcon}><Mic size={30} color={C.purple} strokeWidth={1.7} /></View>
          <Text style={styles.permissionTitle}>{permissionDenied ? "Microphone access is off." : "Allow the microphone"}</Text>
          <Text style={styles.permissionCopy}>{permissionDenied ? "Turn microphone access on in Settings, try again, or type your opening instead." : "Recording only happens while you hold a turn. Audio is transcribed, then discarded — you confirm the text before anything is sent."}</Text>
        </View>
        <StateDock bottomInset={insets.bottom}>
          {permissionDenied ? <PrimaryButton label="Open Settings" onPress={openMicrophoneSettings} /> : <PrimaryButton label={permissionBusy ? "Checking microphone…" : "Allow microphone"} onPress={() => void requestMicrophoneAccess()} disabled={permissionBusy} />}
          <GhostButton label="Type this turn instead" onPress={() => activatePractice("text")} />
          {permissionDenied ? (
            <PressCard onPress={() => void requestMicrophoneAccess()} accessibilityLabel="Try microphone again">
              <Text style={styles.permissionSecondary}>Try again</Text>
            </PressCard>
          ) : (
            <>
              <PressCard onPress={() => setRehearsalStage("briefing")} accessibilityLabel="Not now">
                <Text style={styles.permissionSecondary}>Not now</Text>
              </PressCard>
            </>
          )}
        </StateDock>
      </View>
    );
  }

  if (reviewingTranscript) {
    const counterpartTurns = turns.filter((turn) => turn.role === "them");
    return (
      <View style={styles.root}>
        <Backdrop />
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={[styles.reviewScroll, { paddingTop: insets.top + 8, paddingBottom: 28 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Pressable onPress={() => { setApprovalError(""); setReviewingTranscript(false); }} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back to rehearsal">
              <Text style={styles.reviewBackTop}>Back</Text>
            </Pressable>
            <Text style={styles.reviewEyebrow}>{finalTranscriptReadOnly ? "REVIEW" : "REVIEW AND CORRECT"}</Text>
            <Text style={styles.reviewTitle}>{finalTranscriptReadOnly ? "Review your conversation." : "Check what we heard."}</Text>
            {finalTranscriptReadOnly ? <Text style={styles.reviewPrivacy}>To keep this result matched to the conversation, previously approved lines can’t be edited here.</Text> : null}
            <Text style={styles.reviewLabel}>YOU · TURN 1</Text>
            {finalTranscriptReadOnly
              ? <Text selectable style={styles.reviewInput} accessibilityLabel="Approved opening">{turns.find((turn) => turn.role === "user")?.text ?? ""}</Text>
              : <TextInput value={reviewDrafts.opening} onChangeText={(opening) => setReviewDrafts((current) => ({ ...current, opening }))} multiline style={styles.reviewInput} accessibilityLabel="Edit your opening" />}
            <Text style={[styles.reviewLabel, styles.counterpartLabel]}>{themName.toUpperCase()}</Text>
            <View style={styles.counterpartReview}><Text style={styles.counterpartReviewText}>{counterpartTurns[0]?.text ?? ""}</Text></View>
            <Text style={styles.reviewLabel}>YOU · TURN 2</Text>
            {finalTranscriptReadOnly
              ? <Text selectable style={styles.reviewInput} accessibilityLabel="Approved response under pressure">{turns.filter((turn) => turn.role === "user")[1]?.text ?? ""}</Text>
              : <TextInput value={reviewDrafts.response} onChangeText={(response) => setReviewDrafts((current) => ({ ...current, response }))} multiline style={styles.reviewInput} accessibilityLabel="Edit your response under pressure" />}
            <Text style={[styles.reviewLabel, styles.counterpartLabel]}>{themName.toUpperCase()} · CLOSE</Text>
            <View style={styles.counterpartReview}><Text style={styles.counterpartReviewText}>{counterpartTurns[1]?.text ?? ""}</Text></View>
            <Text style={styles.reviewPrivacy}>Nothing gets analyzed until you approve it.</Text>
            {error ? <Text accessibilityRole="alert" style={styles.reviewPrivacy}>{error}</Text> : null}
            {approvalError ? <Text accessibilityRole="alert" style={styles.reviewPrivacy}>{approvalError}</Text> : null}
          </ScrollView>
          <StateDock bottomInset={insets.bottom}>
            <PrimaryButton label="Approve transcript" onPress={approveTranscript} disabled={!reviewDrafts.opening.trim() || !reviewDrafts.response.trim() || closing} />
          </StateDock>
        </KeyboardAvoidingView>
      </View>
    );
  }

  const dock = DOCK_COPY[dockState](themName, themName, {
    micHint: micDisabledHint(speech.phase, themName),
    muted: !voiceOn && speech.canReplay ? mutedHint(themName) : null,
    dictation:
      dictation.status === "denied"
        ? "Mic access needed — check Settings"
        : dictation.status === "error"
          ? dictation.error
          : null,
    analyzing: audioBusy,
    generating: speech.phase === "generating",
    ready: isRepReadyForAnalysis,
  });

  return (
    <View style={styles.root}>
      <Backdrop />

      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.headerRow}>
          <View style={styles.headerSide} />
          <Text style={styles.headerTurn}>{turnTask.step}</Text>
          <Pressable
            onPress={leave}
            disabled={closing}
            style={styles.closeHit}
            accessibilityRole="button"
            accessibilityLabel="Close rehearsal"
          >
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>

        {isPaidScenario && turns.length > 0 ? <View style={styles.tensionWrap}>
          <Text style={[eyebrow, styles.tensionLabel]}>Tension</Text>
          <View style={styles.flex}>
            <Meter
              value={tension}
              height={3}
              tone={tension > 66 ? C.clay : tension > 33 ? C.amber : C.sage}
            />
          </View>
        </View> : null}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={styles.flex}
          contentContainerStyle={styles.transcript}
          onContentSizeChange={() =>
            scrollRef.current?.scrollToEnd({ animated: !isReduced })
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {showsUserPrompt ? (
            <View style={styles.taskIntro} accessibilityLiveRegion="polite">
              <Text style={styles.taskIntroLabel}>YOUR TURN</Text>
              <Text style={styles.taskIntroPrompt}>{turnTask.prompt}</Text>
            </View>
          ) : null}
          <View style={styles.threadContext}>
            <Text style={styles.threadContextLabel}>SITUATION YOU’RE OPENING FOR</Text>
            <Text style={styles.threadContextText}>{scenario.situation}</Text>
            {outcome ? <Text style={styles.threadContextGoal}>Goal: {outcome}</Text> : null}
            <Text style={styles.inPersonNote}>In person with {themName}</Text>
          </View>

          {turns.map((t) =>
            t.role === "user" ? (
              <Line key={t.id} mine text={t.text} speaker="You" />
            ) : (
              <View key={t.id}>
                <Line
                  text={t.text}
                  speaker={themName}
                  counterpart={themName}
                />
                {t.nudge ? <Nudge text={t.nudge} /> : null}
              </View>
            ),
          )}

          {stream.length > 0 ? (
            <Line
              text={stream}
              speaker={themName}
              counterpart={themName}
              streaming
            />
          ) : null}
          {(thinking || (audioBusy && stream.length === 0)) ? (
            <View style={styles.themWrap} accessibilityLiveRegion="polite">
              <Text style={styles.speaker}>{themName}</Text>
              <View style={[styles.bubble, styles.themBubble, styles.activityBubble]}>
                <Thinking />
                <Text style={styles.activityText}>{speech.phase === "speaking" ? `${themName} is speaking…` : `${themName} is thinking…`}</Text>
              </View>
            </View>
          ) : null}

          {error.length > 0 && !canRetry ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <StateDock bottomInset={insets.bottom} style={usesImmersiveVoiceDock ? styles.voiceDock : undefined}>
          {!usesImmersiveVoiceDock ? (
            <>
              <View style={styles.dockHead} accessibilityLiveRegion="polite" accessibilityRole="text">
                <View
                  style={[
                    styles.dockDot,
                    { backgroundColor: DOCK_TONE[dockState] },
                  ]}
                />
                <Text style={[eyebrow, styles.dockLabel]}>{dock.label}</Text>
              </View>
              {dock.help ? <Text style={styles.dockHelp}>{dock.help}</Text> : null}
            </>
          ) : null}

          {dockState === "response-unavailable" ? (
            <View style={styles.recoveryRow}>
              <PressCard
                onPress={canRetry ? retryTurn : () => router.replace('/(tabs)')}
                containerStyle={styles.flexWide}
                accessibilityLabel={canRetry ? 'Retry sending' : 'Back to today'}
              >
                <View style={styles.analyzeBtn}>
                  <RotateCcw size={18} color={C.onAccent} strokeWidth={1.7} />
                  <Text style={styles.analyzeText}>{canRetry ? 'Retry sending' : 'Back to today'}</Text>
                </View>
              </PressCard>
            </View>
          ) : dockState === "mic-blocked" ? (
            <View style={styles.deniedActions}>
              <PressCard onPress={openMicrophoneSettings} accessibilityLabel="Open Settings">
                <View style={styles.analyzeBtn}>
                  <Settings size={18} color={C.onAccent} strokeWidth={1.7} />
                  <Text style={styles.analyzeText}>Open Settings</Text>
                </View>
              </PressCard>
              <View style={styles.row}>
                <PressCard onPress={retryMicrophone} containerStyle={styles.flexOne} accessibilityLabel="Try again">
                  <View style={styles.secondaryBtn}>
                    <RotateCcw size={18} color={C.textSoft} strokeWidth={1.7} />
                    <Text style={styles.secondaryText}>Try again</Text>
                  </View>
                </PressCard>
                <PressCard onPress={switchToText} containerStyle={styles.flexOne} accessibilityLabel="Type instead">
                  <View style={styles.secondaryBtn}>
                    <Keyboard size={18} color={C.textSoft} strokeWidth={1.7} />
                    <Text style={styles.secondaryText}>Type instead</Text>
                  </View>
                </PressCard>
              </View>
            </View>
          ) : dockState === "mic-error" ? (
            <View style={styles.row}>
              <PressCard onPress={switchToText} containerStyle={styles.flexOne} accessibilityLabel="Type instead">
                <View style={styles.secondaryBtn}>
                  <Keyboard size={18} color={C.textSoft} strokeWidth={1.7} />
                  <Text style={styles.secondaryText}>Type instead</Text>
                </View>
              </PressCard>
              <PressCard onPress={onMicTap} containerStyle={styles.flexWide} accessibilityLabel="Try mic again">
                <View style={styles.analyzeBtn}>
                  <RotateCcw size={18} color={C.onAccent} strokeWidth={1.7} />
                  <Text style={styles.analyzeText}>Try mic again</Text>
                </View>
              </PressCard>
            </View>
          ) : dockState === "autoplay-blocked" || dockState === "playback-failed" ? (
            <View style={styles.row}>
              <PressCard onPress={continueWithoutAudio} containerStyle={styles.flexOne}>
                <View style={styles.secondaryBtn}>
                  <VolumeX size={18} color={C.textSoft} strokeWidth={1.7} />
                  <Text style={styles.secondaryText}>Keep reading</Text>
                </View>
              </PressCard>
              <PressCard onPress={onReplay} containerStyle={styles.flexWide}>
                <View style={styles.analyzeBtn}>
                  <Volume2 size={18} color={C.onAccent} strokeWidth={1.7} />
                  <Text style={styles.analyzeText}>
                    {dockState === "autoplay-blocked"
                      ? tapToHearLabel(themName)
                      : "Try voice again"}
                  </Text>
                </View>
              </PressCard>
            </View>
          ) : dockState === "complete" && !isRepReadyForAnalysis ? (
            // The cap is reached but the final response is still landing. Keep
            // an explicit escape available even if generation or playback stalls.
            <View style={styles.completeActions}>
              <View style={styles.completeWaiting}>
                <ActivityIndicator color={C.purple} />
              </View>

            </View>
          ) : dockState === "complete" ? (
            <View style={styles.completeActions}>
              <PressCard
                onPress={openTranscriptReview}
                disabled={audioBusy || closing}
                haptic="medium"
                accessibilityLabel="Review complete transcript"
              >
                <View style={styles.analyzeBtn}>
                    <Text style={styles.analyzeText}>Review transcript</Text>
                </View>
              </PressCard>
              {speech.canReplay ? (
                <PressCard onPress={onReplay} accessibilityLabel={`Replay ${themName}'s response`}>
                  <View style={styles.secondaryBtn}>
                    <Volume2 size={17} color={C.textSoft} strokeWidth={1.7} />
                    <Text style={styles.secondaryText}>Replay response</Text>
                  </View>
                </PressCard>
              ) : null}
            </View>
          ) : dockState === "composing" ? (
            <View style={styles.composeWrap}>
              <Text style={styles.composeLabel}>EDIT TRANSCRIPT</Text>
              <TextInput
                value={pending}
                onChangeText={setPending}
                style={styles.composeInput}
                multiline
                maxLength={600}
                editable={!closing}
                accessibilityLabel="Your line, ready to send"
              />
              <View style={styles.row}>
                <PressCard
                  onPress={() => {
                    tap("light");
                    setPending("");
                    setReviewingPendingTranscript(false);
                  }}
                  containerStyle={styles.flexOne}
                >
                  <View style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Re-record</Text>
                  </View>
                </PressCard>
                <PressCard
                  onPress={approvePendingTranscript}
                  disabled={thinking || pending.trim().length === 0}
                  containerStyle={styles.flexWide}
                  haptic="medium"
                >
                  <View
                    style={[
                      styles.analyzeBtn,
                      pending.trim().length === 0 ? styles.analyzeBtnWaiting : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.analyzeText,
                        pending.trim().length === 0 ? styles.analyzeTextWaiting : null,
                      ]}
                    >
                      {myTurnCount === 0 ? "Use this opener" : "Use this reply"}
                    </Text>
                  </View>
                </PressCard>
              </View>
            </View>
          ) : dockState === "waiting" ? (
            <View style={styles.immersiveControl} accessibilityLiveRegion="polite">
              <View style={styles.voiceOrb}><Thinking /></View>
              <Text style={styles.voiceState}>{themName.toUpperCase()} IS THINKING</Text>
              <Text style={styles.typeUnavailable}>Type this turn instead</Text>
            </View>
          ) : dockState === "speaking" ? (
            <View style={styles.immersiveControl} accessibilityLiveRegion="polite">
              <Pressable
                onPress={stopPlayback}
                style={styles.voiceOrb}
                accessibilityRole="button"
                accessibilityLabel={`${themName} is speaking. Tap to stop.`}
              >
                <Waveform active subtle={speech.phase === "generating"} tone={C.purple} bars={5} height={34} />
              </Pressable>
              <Text style={styles.voiceState}>{themName.toUpperCase()} IS SPEAKING — TAP TO STOP</Text>
              <Text style={styles.typeUnavailable}>Type this turn instead</Text>
            </View>
          ) : dockState === "text" ? (
            <View style={styles.textRow}>
              <Pressable
                onPress={() => {
                  tap("light");
                  // Going to voice must dismiss the keyboard, otherwise it stays
                  // up and covers the mic and the counterpart's last line.
                  draftRef.current?.blur();
                  RNKeyboard.dismiss();
                  setMode("voice");
                }}
                hitSlop={10}
                style={styles.iconHit}
                accessibilityRole="button"
                accessibilityLabel="Switch to voice"
              >
                <Mic size={20} color={C.textSoft} strokeWidth={1.7} />
              </Pressable>
              <TextInput
                ref={draftRef}
                value={draft}
                onChangeText={setDraft}
                placeholder="Say it the way you would…"
                placeholderTextColor={C.dim}
                style={styles.input}
                multiline
                maxLength={600}
                editable={!closing}
                accessibilityLabel="Type your line"
              />
              <PressCard onPress={send} accessibilityLabel="Send your line" disabled={draft.trim().length === 0 || thinking}>
                <View
                  style={[
                    styles.sendBtn,
                    draft.trim().length === 0 || thinking ? styles.sendBtnOff : null,
                  ]}
                >
                  <ArrowUp
                    size={20}
                    color={draft.trim().length === 0 || thinking ? C.textDim : C.onAccent}
                    strokeWidth={2.4}
                  />
                </View>
              </PressCard>
            </View>
          ) : (
            <View style={styles.immersiveControl}>
              <MicControl
                state={micState}
                level={dictation.level}
                onPress={onMicTap}
                disabled={closing || micDisabled}
                accessibilityState={{ disabled: micDisabled }}
                accessibilityLabel={
                  micDisabled
                    ? (micDisabledHint(speech.phase, themName) ?? "")
                    : dictation.status === "recording"
                      ? "Stop and review your line"
                      : "Record your line"
                }
                glyph={
                  dictation.status === "transcribing" ? (
                    <ActivityIndicator color={C.onAccent} />
                  ) : dictation.status === "recording" ? (
                    <Square size={26} color={C.onAccent} fill={C.onAccent} />
                  ) : (
                    <Mic
                      size={30}
                      color={micDisabled ? C.textDim : C.purple}
                      strokeWidth={1.7}
                    />
                  )
                }
              />
              <Text style={styles.voiceState} accessibilityLiveRegion="polite">
                {dictation.status === "transcribing"
                  ? "Turning your voice into text…"
                  : dictation.status === "recording"
                    ? "LISTENING NOW — TAP TO STOP"
                    : "TAP TO SPEAK"}
              </Text>
              <Pressable
                onPress={() => {
                  tap("light");
                  setMode("text");
                }}
                hitSlop={10}
                style={styles.typeInsteadHit}
                accessibilityRole="button"
                accessibilityLabel="Type this turn instead"
              >
                <Text style={styles.typeInsteadText}>Type this turn instead</Text>
              </Pressable>
              {speech.canReplay ? (
                <Pressable onPress={toggleSpeaker} hitSlop={10} accessibilityRole="button" accessibilityLabel={speakerLabel(speakerState, themName)}>
                  <Text style={styles.voiceUtility}>{speakerState === "muted" ? `Hear ${themName}` : "Voice on"}</Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </StateDock>
      </KeyboardAvoidingView>

      {closing ? <Closing /> : null}
    </View>
  );
}

interface DockHints {
  micHint: string | null;
  muted: string | null;
  dictation: string | null;
  analyzing: boolean;
  generating: boolean;
  /** False while the counterpart's closing response is still arriving. */
  ready: boolean;
}

const DOCK_TONE: Record<DockState, string> = {
  "autoplay-blocked": C.amber,
  complete: C.purple,
  composing: C.purple,
  "response-unavailable": C.clay,
  "mic-blocked": C.clay,
  "mic-error": C.amber,
  "playback-failed": C.amber,
  waiting: C.amber,
  speaking: C.purpleLight,
  listening: C.purple,
  ready: C.sage,
  text: C.sage,
};

/**
 * One label and one support line per state. Keeping the copy in a single table
 * makes it obvious that every state says exactly what is happening and what
 * the user can do about it.
 */
const DOCK_COPY: Record<
  DockState,
  (them: string, counterpart: string, hints: DockHints) => { label: string; help: string }
> = {
  "autoplay-blocked": (them) => ({
    label: "Tap to hear",
    help: `Your device paused ${them}'s voice. The response is still here to read.`,
  }),
  complete: (them, _counterpart, h) => {
    if (!h.ready) {
      return {
        label: "Final response",
        help: `${them}'s full response will stay here for you to read and hear before analysis.`,
      };
    }
    return {
      label: h.analyzing ? "Final response" : "Rep complete",
      help: h.analyzing
        ? "Listen through the response. Analysis will be ready when they finish speaking."
        : "Read it again or replay it whenever you're ready. Nothing moves on until you choose.",
    };
  },
  composing: () => ({
    label: "Composing",
    help: "Edit it if we misheard. Nothing is sent until you approve this turn.",
  }),
  "response-unavailable": (_them, _counterpart, h) => ({
    label: "Response unavailable",
    help: h.dictation ?? "Your line is safe. The practice service didn't answer, so you can retry without saying it again.",
  }),
  "mic-blocked": () => ({
    label: "Microphone access is off.",
    help: "Open Settings to allow access, try the permission request again, or type this turn instead.",
  }),
  "mic-error": (_them, _counterpart, h) => ({
    label: h.dictation?.startsWith("Voice transcription")
      ? "Transcription unavailable"
      : (h.dictation || "Microphone unavailable"),
    help: h.dictation ?? "Try the microphone again, or type this turn instead.",
  }),
  "playback-failed": (_them, counterpart) => ({
    label: "Voice unavailable",
    help: audioFailureMessage(counterpart),
  }),
  waiting: (them) => ({ label: them, help: `${them} is thinking…` }),
  speaking: (them, _counterpart, h) => ({
    label: them,
    help: h.generating ? `${them} is thinking…` : `${them} is speaking.`,
  }),
  listening: () => ({ label: "Listening", help: "Tap again when you've finished the line." }),
  text: () => ({ label: "Your turn", help: "Return adds a line — it never sends." }),
  ready: (_them, _counterpart, h) => ({
    label: "Your turn",
    help: h.dictation ?? h.micHint ?? h.muted ?? "Tap the mic and say your line out loud.",
  }),
};

/** A confirmed spoken line, presented with familiar thread alignment. */
function Line({
  text,
  mine,
  speaker,
  counterpart,
  streaming = false,
}: {
  text: string;
  mine?: boolean;
  speaker: string;
  counterpart?: string;
  streaming?: boolean;
}) {
  // Counterpart text always goes through the renderer, so beats read as natural
  // sentences and no transport artifact can reach the screen.
  const { beatLine, body } = mine
    ? { beatLine: null, body: text }
    : renderCounterpartMessage(text, counterpart ?? speaker);
  const isReduced = useReducedMotion();
  const arrival = useRef(new Animated.Value(isReduced ? 1 : 0)).current;
  useEffect(() => {
    if (isReduced) {
      arrival.setValue(1);
      return;
    }
    const animation = Animated.spring(arrival, {
      toValue: 1,
      speed: 18,
      bounciness: 2,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [arrival, isReduced]);
  if (!mine && beatLine === null && body.length === 0) return null;
  return (
    <Animated.View
      style={[
        mine ? styles.mineWrap : styles.themWrap,
        {
          opacity: arrival,
          transform: [
            {
              translateX: arrival.interpolate({
                inputRange: [0, 1],
                outputRange: [mine ? 14 : -14, 0],
              }),
            },
            { translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) },
          ],
        },
      ]}
    >
      <Text style={[styles.speaker, mine ? styles.mineSpeaker : null]}>{speaker}</Text>
      <View style={[styles.bubble, mine ? styles.mineBubble : styles.themBubble]}>
        {beatLine ? <Text style={[styles.beat, mine ? styles.mineBeat : null]}>{beatLine}</Text> : null}
        {body.length > 0 ? (
          streaming ? (
            <FadingWords text={body} />
          ) : (
            <Text style={mine ? styles.mineText : styles.themText}>{body}</Text>
          )
        ) : null}
      </View>
    </Animated.View>
  );
}

function FadingWords({ text }: { text: string }) {
  const words = text.split(/\s+/);
  return (
    <Text style={styles.themText}>
      {words.map((word, index) => (
        <FadingWord key={`${index}-${word}`} word={word} hasSpace={index < words.length - 1} />
      ))}
    </Text>
  );
}

function FadingWord({ word, hasSpace }: { word: string; hasSpace: boolean }) {
  const isReduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(isReduced ? 1 : 0)).current;
  useEffect(() => {
    if (isReduced) {
      opacity.setValue(1);
      return;
    }
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isReduced, opacity]);
  return <Animated.Text style={{ opacity }}>{word}{hasSpace ? " " : ""}</Animated.Text>;
}

function Nudge({ text }: { text: string }) {
  const isReduced = useReducedMotion();
  const v = useRef(new Animated.Value(isReduced ? 1 : 0)).current;
  useEffect(() => {
    if (isReduced) {
      v.setValue(1);
      return;
    }
    Animated.timing(v, {
      toValue: 1,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [v, isReduced]);
  return (
    <Animated.View
      style={[
        styles.nudge,
        {
          opacity: v,
          transform: [
            { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
          ],
        },
      ]}
    >
      <Text style={styles.nudgeText}>{text}</Text>
    </Animated.View>
  );
}

function Closing() {
  return (
    <View style={styles.overlay}>
      <ActivityIndicator color={C.purple} />
      <Text style={styles.overlayTitle}>Reviewing your rehearsal</Text>
      <Text style={styles.overlayBody}>
        Reviewing the transcript from this rehearsal.
      </Text>
      <Text style={styles.overlayNote}>
        Your practice isn&apos;t shared with the person you&apos;re rehearsing about.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  flexOne: { flex: 1 },
  flexWide: { flex: 1.3 },
  center: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER, gap: 16 },
  missingBody: { textAlign: "center", color: C.textSoft },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  deniedActions: { gap: 10 },
  introHeader: { minHeight: 54, paddingHorizontal: GUTTER, justifyContent: "center" },
  backText: { ...T.support, fontFamily: font.medium, color: C.text },
  introScroll: { paddingHorizontal: GUTTER, paddingTop: 10 },
  permissionMeta: { ...eyebrow, position: "absolute", left: 0, right: 0, bottom: 17, textAlign: "center", color: C.dim },
  permissionBody: { flex: 1, paddingHorizontal: 34, alignItems: "center", justifyContent: "center", paddingBottom: 70 },
  permissionIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: C.purpleSoft, borderWidth: 1, borderColor: "rgba(81,40,136,0.14)", alignItems: "center", justifyContent: "center", marginBottom: 24 },
  permissionTitle: { ...T.display, textAlign: "center", color: C.text },
  permissionCopy: { ...T.support, textAlign: "center", color: C.textSoft, marginTop: 12, lineHeight: 24 },
  permissionSecondary: { ...T.support, fontFamily: font.semi, textAlign: "center", color: C.purple, minHeight: 44, textAlignVertical: "center" },

  header: {
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  headerRow: { flexDirection: "row", alignItems: "center", minHeight: 48 },
  headerSide: { width: 64 },
  headerTurn: { ...eyebrow, flex: 1, textAlign: "center", color: C.textSoft, fontSize: 12 },
  closeHit: { width: 64, minHeight: 44, alignItems: "flex-end", justifyContent: "center" },
  closeText: { fontFamily: font.regular, fontSize: 17, color: C.text },
  iconHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  tensionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  tensionLabel: { ...eyebrow, color: C.dim },

  transcript: { paddingHorizontal: GUTTER, paddingTop: 18, paddingBottom: 28 },
  taskIntro: { marginBottom: 16 },
  taskIntroLabel: { ...eyebrow, color: C.purple, marginBottom: 8, fontSize: 12 },
  taskIntroPrompt: { ...T.display, fontFamily: font.bold, fontSize: 26, lineHeight: 32 },
  threadContext: { width: "100%", paddingHorizontal: 18, paddingVertical: 18, borderRadius: radius.md, backgroundColor: "rgba(255,255,255,0.58)", borderWidth: 1, borderColor: C.glassEdge, marginBottom: 26 },
  threadContextLabel: { ...eyebrow, color: C.textSoft, marginBottom: 10, fontSize: 12 },
  threadContextText: { ...T.body, color: C.text, lineHeight: 25 },
  threadContextGoal: { ...T.support, color: C.textSoft, marginTop: 13 },
  inPersonNote: { ...eyebrow, color: C.purple, marginTop: 14, fontSize: 10 },
  reviewScroll: { paddingHorizontal: GUTTER, gap: 12 },
  reviewBackTop: { ...T.support, color: C.textSoft, minHeight: 44, textAlignVertical: "center" },
  reviewEyebrow: { ...eyebrow, color: C.dim, fontSize: 12, marginTop: 2 },
  reviewTitle: { ...T.display, fontFamily: font.bold, fontSize: 31, lineHeight: 38, marginBottom: 8 },
  reviewLabel: { ...eyebrow, color: C.purple, fontSize: 11, marginTop: 8 },
  counterpartLabel: { color: C.amber, marginLeft: 16 },
  reviewInput: { ...T.body, minHeight: 88, maxHeight: 150, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.elevated, padding: 16, textAlignVertical: "top", color: C.text },
  counterpartReview: { borderRadius: radius.lg, backgroundColor: C.surface, borderWidth: 1, borderColor: C.line, paddingHorizontal: 18, paddingVertical: 17 },
  counterpartReviewText: { ...T.body, color: C.text },
  reviewPrivacy: { ...T.caption, color: C.dim, marginTop: 8 },

  themWrap: { alignSelf: "flex-start", alignItems: "flex-start", maxWidth: "84%", marginBottom: 16 },
  mineWrap: { alignSelf: "flex-end", alignItems: "flex-end", maxWidth: "84%", marginBottom: 16 },
  speaker: { ...eyebrow, color: C.dim, marginBottom: 6, marginHorizontal: 5 },
  mineSpeaker: { textAlign: "right" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, minHeight: 44 },
  themBubble: { backgroundColor: "rgba(255,255,255,0.88)", borderWidth: 1, borderColor: C.glassEdge, borderRadius: 20, borderTopLeftRadius: 6, shadowColor: "#241633", shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 2 },
  mineBubble: { backgroundColor: C.purple, borderRadius: 20, borderTopRightRadius: 6, shadowColor: C.purple, shadowOffset: { width: 0, height: 7 }, shadowOpacity: 0.18, shadowRadius: 16, elevation: 3 },
  themText: { ...T.body, color: C.text, lineHeight: 24 },
  mineText: { ...T.body, color: C.onAccent, lineHeight: 24 },
  beat: { ...T.caption, color: C.textDim, fontStyle: "italic", marginBottom: 5 },
  mineBeat: { color: "rgba(255,255,255,0.76)" },
  activityBubble: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  activityText: { ...T.caption, color: C.textSoft },
  nudge: {
    borderLeftWidth: 2,
    borderLeftColor: C.amber,
    paddingLeft: 12,
    marginTop: -10,
    marginBottom: 22,
  },
  nudgeText: { ...T.caption, color: C.amber },

  errorBox: { gap: 10, marginBottom: 20 },
  errorText: { ...T.caption, color: C.clay },
  dockHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  dockDot: { width: 6, height: 6, borderRadius: 3 },
  dockLabel: { color: C.dim },
  dockHelp: { ...T.caption, marginTop: 6 },

  voiceDock: { minHeight: 260 },
  immersiveControl: { alignItems: "center", justifyContent: "center", paddingTop: 4, gap: 14 },
  voiceOrb: { width: 104, height: 104, borderRadius: 52, backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  voiceState: { ...eyebrow, color: C.purple, textAlign: "center", fontSize: 12 },
  typeInsteadHit: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12 },
  typeInsteadText: { ...T.support, color: C.textSoft },
  typeUnavailable: { ...T.support, color: C.textDim, opacity: 0.72, minHeight: 44, textAlignVertical: "center" },
  voiceUtility: { ...T.caption, color: C.purple, minHeight: 36, textAlignVertical: "center" },
  playbackRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    minHeight: 88,
  },
  secondaryBtn: {
    height: 52,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: C.lineStrong,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  secondaryText: { ...T.support, fontFamily: font.semi, color: C.textSoft },
  analyzeBtn: {
    height: 52,
    borderRadius: radius.button,
    backgroundColor: C.purple,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    shadowColor: C.purple,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.26,
    shadowRadius: 18,
    elevation: 5,
  },
  analyzeBtnWaiting: {
    backgroundColor: "rgba(23,26,31,0.04)",
    shadowOpacity: 0,
    elevation: 0,
  },
  analyzeText: { fontFamily: font.semi, fontSize: 15, color: C.onAccent },
  analyzeTextWaiting: { color: C.textDim },

  completeWaiting: { minHeight: 52, alignItems: "center", justifyContent: "center", marginTop: 12 },
  completeActions: { gap: 10, marginTop: 12 },
  recoveryRow: { marginTop: 12 },
  composeWrap: { gap: 12, marginTop: 10 },
  composeLabel: { ...eyebrow, color: C.purple },
  composeInput: {
    ...T.body,
    backgroundColor: C.surfaceHigh,
    borderWidth: 1,
    borderColor: C.glassEdge,
    borderRadius: radius.md,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
    maxHeight: 150,
  },

  textRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 },
  input: {
    ...T.body,
    flex: 1,
    minHeight: 48,
    maxHeight: 132,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surfaceHigh,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sendBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: C.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnOff: { backgroundColor: "rgba(23,26,31,0.05)" },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(242,242,246,0.96)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 44,
    gap: 14,
  },
  overlayTitle: { ...T.title, marginTop: 8 },
  overlayBody: { ...T.support, textAlign: "center" },
  overlayNote: { ...T.caption, textAlign: "center", marginTop: 8 },
});
