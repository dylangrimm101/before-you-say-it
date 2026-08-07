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
import {
  Backdrop,
  Meter,
  MicControl,
  PressCard,
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
import { generateDebrief, nextCounterpartTurn } from "@/lib/ai";
import { FREE_REHEARSAL_USER_TURNS, rehearsalTurnCap } from "@/lib/access";
import {
  beginConversionBuild,
  emitConversionEvent,
  failConversionBuild,
} from "@/lib/conversionBuild";
import { conversionEvidence, selectFocusSkill } from "@/lib/conversion";
import { setLiveSessionContent } from "@/lib/ephemeral";
import { preserveFreeRehearsalArtifact } from "@/lib/practiceSession";
import { errorShape, safeLog } from "@/lib/redact";
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
import type { Difficulty, PersonaVoice, ReactionPattern, Turn } from "@/types/convo";
import { SESSION_SCHEMA_VERSION, type SessionRecord } from "@/types/privacy";

let seq = 0;
function uid(): string {
  seq += 1;
  return `${Date.now().toString(36)}-${seq}`;
}

/**
 * The rehearsal is modelled as one state at a time, and the dock renders the
 * control set for exactly that state. Anything not usable in a state is absent
 * rather than greyed, so a dead control is never sitting there inviting a tap.
 */
type DockState =
  | "autoplay-blocked"
  | "complete"
  | "composing"
  | "connection-lost"
  | "mic-blocked"
  | "mic-error"
  | "playback-failed"
  | "waiting"
  | "speaking"
  | "listening"
  | "ready"
  | "text";

export default function Rehearse() {
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
  } = useStore();
  const challengeDay = params.challengeDay ? Number(params.challengeDay) : null;

  const scenario = findScenario(String(params.id));
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

  const initial = scenario
    ? initialRehearsalState(scenario)
    : { waitingForUserOpening: true, initialCounterpartLine: null };

  const [turns, setTurns] = useState<Turn[]>(() =>
    params.entry === "onboarding" && activePracticeSession?.id === params.practiceSessionId
      ? activePracticeSession?.freeRehearsalTurns ?? []
      : [],
  );
  const [stream, setStream] = useState<string>("");

  useEffect(() => {
    const currentSession = activePracticeSession;
    if (params.entry !== "onboarding" || !currentSession || currentSession.id !== params.practiceSessionId || turns.length === 0) return;
    const serializedTurns = JSON.stringify(turns);
    if (persistedTurnsRef.current === serializedTurns) return;
    persistedTurnsRef.current = serializedTurns;
    saveActivePracticeSession({ ...currentSession, freeRehearsalTurns: turns, updatedAt: Date.now() }).catch(() => {});
  }, [activePracticeSession, params.entry, params.practiceSessionId, saveActivePracticeSession, turns]);
  const [thinking, setThinking] = useState<boolean>(false);
  const [draft, setDraft] = useState<string>("");
  /** Blurred when switching to voice, so the keyboard cannot cover the mic. */
  const draftRef = useRef<TextInput>(null);
  const [tension, setTension] = useState<number>(18);
  const [error, setError] = useState<string>("");
  /** A transcribed line waiting for the user to review, edit and submit it. */
  const [pending, setPending] = useState<string>("");
  /** Set when a counterpart turn could not be produced and can be retried. */
  const [canRetry, setCanRetry] = useState<boolean>(false);
  /** Guards against a second submission while one turn is in flight. */
  const busy = useRef<boolean>(false);
  const [closing, setClosing] = useState<boolean>(false);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [voiceOn, setVoiceOn] = useState<boolean>(true);
  const voiceOnRef = useRef<boolean>(true);
  voiceOnRef.current = voiceOn;
  const dictation = useDictation();
  const speech = useSpeech();
  const isReduced = useReducedMotion();
  const audioBusy = speech.phase === "speaking" || speech.phase === "generating";
  /** While the counterpart's voice is generating or playing the mic is inert. */
  const micDisabled = micLocked(speech.phase);
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
    if (opened.current || !scenario) return;
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
  }, [scenario, reveal, persona, themName]);

  // Leaving the screen must stop playback and drop the staged line, so nothing
  // can be heard after the rehearsal is over.
  useEffect(() => {
    return () => {
      if (revealTimer.current) clearInterval(revealTimer.current);
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
        );
        setTension(res.tension);
        setThinking(false);
        const spoken = speechTextFor(res.reply, themName);
        if (spoken.length === 0) {
          reveal(res.reply, res.nudge);
        } else {
          // The acquisition rehearsal always honors the selected voice. Keep the
          // response staged while TTS is generated, then reveal it as playback starts.
          await speak(spoken, persona, { muted: !voiceOnRef.current });
          reveal(res.reply, res.nudge);
        }
      } catch (e) {
        safeLog("[rehearse] turn failed", errorShape(e));
        setThinking(false);
        // Never invent a reply on the client — offer the turn again instead.
        setError(turnFailureMessage(themName));
        setCanRetry(true);
      } finally {
        busy.current = false;
      }
    },
    [scenario, difficulty, reaction, outcome, reveal, persona, themName],
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
      setDraft("");
      const mine: Turn = { id: uid(), role: "user", text: clean };
      const next = [...turns, mine];
      setTurns(next);
      await generateCounterpart(next);
    },
    [scenario, thinking, turns, generateCounterpart, hasReachedTurnCap],
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

  const onMicTap = useCallback(async () => {
    if (thinking || closing) return;
    // The microphone stays disabled while the counterpart is talking, so a tap
    // here is inert. Stopping playback belongs to the speaker control, which
    // keeps one deliberate mic tap always meaning "start recording".
    if (micLocked(speech.phase)) return;
    if (dictation.status === "recording") {
      tap("medium");
      const text = await dictation.stop();
      // Transcription finishing never submits the turn. The line goes into a
      // review state and waits for the user to send it.
      if (text && text.trim().length > 0) {
        tap("success");
        setPending(text.trim());
      }
      return;
    }
    if (dictation.status === "transcribing") return;
    await dictation.start();
    tap("medium");
  }, [dictation, thinking, closing, speech.phase]);

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

  const mutePlayback = useCallback(() => {
    tap("light");
    setVoiceOn(false);
    stopSpeech().catch(() => {});
  }, []);

  const continueWithoutAudio = useCallback(() => {
    tap("light");
    setVoiceOn(false);
    stopSpeech().catch(() => {});
  }, []);

  const switchToText = useCallback(() => {
    tap("light");
    dictation.reset();
    setMode("text");
  }, [dictation]);

  const finish = useCallback(async () => {
    if (!scenario) return;
    const mine = turns.filter((t) => t.role === "user");
    if (mine.length < 2) {
      const msg = "Say at least a couple of lines so there's something to review.";
      if (Platform.OS === "web") setError(msg);
      else Alert.alert("Too early to review", msg);
      return;
    }
    setClosing(true);
    tap("medium");
    resetSpeech().catch(() => {});
    const id = sessionId.current;

    // Open on an empty first frame. Named pipeline boundaries advance the
    // sequence after navigation mounts; no staged timer manufactures progress.
    beginConversionBuild({
      id,
      scenarioTitle: scenario.title,
      counterpartName: themName,
      turns,
    });
    router.replace(`/debrief/${id}`);

    try {
      await new Promise<void>((resolve) => {
        InteractionManager.runAfterInteractions(() => resolve());
      });
      emitConversionEvent(id, "transcript.confirmed");
      emitConversionEvent(id, "exchange.paired");

      const debrief = await generateDebrief(scenario, difficulty, turns, reaction, outcome);
      emitConversionEvent(id, "skill.identified", debrief);

      // The curriculum is fixed. Analysis only selects one authored starting
      // skill inside phase one; it never generates a personal roadmap.
      const focus = selectFocusSkill(debrief, activePracticeSession?.provisionalModuleId);
      const evidence = conversionEvidence(turns, debrief, activePracticeSession?.provisionalModuleId);
      emitConversionEvent(id, "path.mapped");
      setLiveSessionContent(id, { turns, debrief, outcome });

      if (params.entry === "onboarding" && activePracticeSession?.id === id) {
        const preserved = preserveFreeRehearsalArtifact(activePracticeSession, turns, Date.now());
        const evidenceTurn = evidence.learnerQuote
          ? mine.find((turn) => turn.text.includes(evidence.learnerQuote)) ?? null
          : null;
        await saveActivePracticeSession({
          ...preserved,
          freeRehearsalTurns: turns,
          freeRehearsalCompletedAt: Date.now(),
          recommendation: {
            moduleId: focus.id,
            ...(activePracticeSession.provisionalModuleId ? { hypothesisModuleId: activePracticeSession.provisionalModuleId } : {}),
            evidenceQuote: evidence.learnerQuote || null,
            evidenceTurnId: evidenceTurn?.id ?? null,
            confidence: evidence.confidence,
            status: "suggested",
            supportedStrength: evidence.supportedStrength,
            immediateAction: evidence.immediateAction,
            createdAt: Date.now(),
          },
          coachNote: focus.body,
          retryInstruction: focus.name,
          nextState: "focused_coach_note",
          updatedAt: Date.now(),
        });
      }

      const record: SessionRecord = {
        schemaVersion: SESSION_SCHEMA_VERSION,
        id,
        scenarioId: scenario.id,
        title: scenario.isCustom ? undefined : scenario.title,
        counterpart: scenario.isCustom ? undefined : scenario.counterpart,
        category: scenario.category,
        difficulty,
        persona,
        reaction,
        skillIds: [focus.id],
        turnCount: turns.length,
        userTurnCount: mine.length,
        retryCount: 0,
        completed: true,
        startedAt: startedAt.current,
        endedAt: Date.now(),
        contentRetained: false,
      };
      await upsertSession(record);
      if (challengeDay !== null) {
        await markChallengeDayDone(challengeDay);
      }
      emitConversionEvent(id, "plan.ready");
      tap("success");
    } catch (e) {
      safeLog("[rehearse] debrief failed", errorShape(e));
      failConversionBuild(id);
    }
  }, [scenario, turns, difficulty, reaction, outcome, upsertSession, router, challengeDay, markChallengeDayDone, persona, themName, params.entry, activePracticeSession, saveActivePracticeSession]);

  const exitRehearsal = useCallback(async (): Promise<void> => {
    await resetSpeech().catch(() => {});
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
  }, [activePracticeSession?.id, params.entry, params.practiceSessionId, router, saveActivePracticeSession]);

  const leave = useCallback(() => {
    const act = (): void => {
      void exitRehearsal();
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
    if (pending.length > 0) return "composing";
    if (thinking) return "waiting";
    if (audioBusy) return "speaking";
    if (canRetry) return "connection-lost";
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
    pending,
    thinking,
    audioBusy,
    canRetry,
    speech.phase,
    hasReachedTurnCap,
    mode,
    dictation.status,
  ]);

  const micState: MicState = micDisabled
    ? "disabled"
    : dictation.status === "recording"
      ? "listening"
      : dictation.status === "transcribing"
        ? "detected"
        : dictation.status === "denied" || dictation.status === "error"
          ? "error"
          : "ready";

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
          <View style={styles.headerCenter}>
            <Text style={[eyebrow, styles.headerMeta]}>{turnCap !== null ? "FREE REHEARSAL" : "LIVE REHEARSAL"}</Text>
            <Text style={styles.headerName} numberOfLines={1}>{themName}</Text>
          </View>
          <PressCard onPress={leave} disabled={closing} accessibilityLabel="End rehearsal">
            <View style={styles.endBtn}>
              <Text style={styles.endText}>End rep</Text>
            </View>
          </PressCard>
        </View>

        {turns.length > 0 ? <View style={styles.tensionWrap}>
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
          {turns.length === 0 && initial.waitingForUserOpening ? (
            <RehearsalBriefing
              entryRoute={activePracticeSession?.entryRoute}
              counterpart={themName}
              situation={scenario.situation}
              desiredOutcome={outcome ?? scenario.goal}
              expectedReaction={expectedReactionLabel(reaction ?? activePracticeSession?.expectedReaction ?? "not-sure")}
              behavioralGoal={activePracticeSession?.behavioralGoal ?? "Say what you need clearly and ask for a concrete next step."}
            />
          ) : null}

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
          {thinking ? (
            <View style={styles.themWrap}>
              <Text style={styles.speaker}>{themName}</Text>
              <Thinking />
            </View>
          ) : null}

          {error.length > 0 && !canRetry ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <StateDock bottomInset={insets.bottom}>
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

          {dockState === "connection-lost" ? (
            <View style={styles.recoveryRow}>
              <PressCard
                onPress={retryTurn}
                containerStyle={styles.flexWide}
                accessibilityLabel="Retry sending"
              >
                <View style={styles.analyzeBtn}>
                  <RotateCcw size={18} color={C.onAccent} strokeWidth={1.7} />
                  <Text style={styles.analyzeText}>Retry sending</Text>
                </View>
              </PressCard>
            </View>
          ) : dockState === "mic-blocked" || dockState === "mic-error" ? (
            <View style={styles.row}>
              <PressCard onPress={switchToText} containerStyle={styles.flexOne}>
                <View style={styles.secondaryBtn}>
                  <Keyboard size={18} color={C.textSoft} strokeWidth={1.7} />
                  <Text style={styles.secondaryText}>Type instead</Text>
                </View>
              </PressCard>
              <PressCard
                onPress={
                  dockState === "mic-blocked"
                    ? () => Linking.openSettings().catch(() => switchToText())
                    : onMicTap
                }
                containerStyle={styles.flexWide}
              >
                <View style={styles.analyzeBtn}>
                  {dockState === "mic-blocked" ? (
                    <Settings size={18} color={C.onAccent} strokeWidth={1.7} />
                  ) : (
                    <RotateCcw size={18} color={C.onAccent} strokeWidth={1.7} />
                  )}
                  <Text style={styles.analyzeText}>
                    {dockState === "mic-blocked" ? "Open Settings" : "Try mic again"}
                  </Text>
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
                onPress={finish}
                disabled={audioBusy || closing}
                haptic="medium"
                accessibilityLabel="Analyze your rep"
              >
                <View style={styles.analyzeBtn}>
                  <Text style={styles.analyzeText}>Analyze your rep</Text>
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
                  }}
                  containerStyle={styles.flexOne}
                >
                  <View style={styles.secondaryBtn}>
                    <Text style={styles.secondaryText}>Say it again</Text>
                  </View>
                </PressCard>
                <PressCard
                  onPress={() => submitText(pending)}
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
                      Send it
                    </Text>
                  </View>
                </PressCard>
              </View>
            </View>
          ) : dockState === "waiting" ? (
            // The mic is swapped out entirely while the counterpart is thinking.
            <View style={styles.playbackRow}>
              <Thinking />
            </View>
          ) : dockState === "speaking" ? (
            // Analyze remains visibly unavailable until playback finishes. Stop
            // and Mute replace the mic rather than leaving a dead mic on screen.
            <View style={styles.speakingActions}>
              <View style={[styles.analyzeBtn, styles.analyzeBtnWaiting]}>
                <Waveform
                  active
                  subtle={speech.phase === "generating"}
                  tone={C.purple}
                  bars={4}
                  height={16}
                />
                <Text style={[styles.analyzeText, styles.analyzeTextWaiting]}>Analyze</Text>
              </View>
              <View style={styles.row}>
                <PressCard
                  onPress={stopPlayback}
                  containerStyle={styles.flexOne}
                  accessibilityLabel="Stop"
                >
                  <View style={styles.secondaryBtn}>
                    <Square size={17} color={C.textSoft} fill={C.textSoft} />
                    <Text style={styles.secondaryText}>Stop</Text>
                  </View>
                </PressCard>
                <PressCard
                  onPress={mutePlayback}
                  containerStyle={styles.flexOne}
                  accessibilityLabel={`Mute ${themName}`}
                >
                  <View style={styles.secondaryBtn}>
                    <VolumeX size={18} color={C.textSoft} strokeWidth={1.7} />
                    <Text style={styles.secondaryText}>Mute</Text>
                  </View>
                </PressCard>
              </View>
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
              <PressCard onPress={send} disabled={draft.trim().length === 0 || thinking}>
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
            <View style={styles.micRow}>
              <Pressable
                onPress={() => {
                  tap("light");
                  setMode("text");
                }}
                hitSlop={10}
                style={styles.iconHit}
                accessibilityRole="button"
                accessibilityLabel="Type instead"
              >
                <Keyboard size={20} color={C.dim} strokeWidth={1.7} />
              </Pressable>

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

              <Pressable
                onPress={toggleSpeaker}
                hitSlop={10}
                style={styles.iconHit}
                accessibilityRole="button"
                accessibilityLabel={speakerLabel(speakerState, themName)}
              >
                {speakerState === "muted" ? (
                  <VolumeX size={20} color={C.dim} strokeWidth={1.7} />
                ) : (
                  <Volume2 size={20} color={C.textSoft} strokeWidth={1.7} />
                )}
              </Pressable>
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
  "connection-lost": C.clay,
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
    help: "Edit it if we misheard. Nothing is sent until you tap Send it.",
  }),
  "connection-lost": (_them, _counterpart, h) => ({
    label: "Connection lost",
    help: h.dictation ?? "Your line is safe. Retry when you're ready.",
  }),
  "mic-blocked": () => ({
    label: "Microphone is off",
    help: "Allow microphone access in Settings, or type this turn instead.",
  }),
  "mic-error": (_them, _counterpart, h) => ({
    label: "Microphone unavailable",
    help: h.dictation ?? "Try the microphone again, or type this turn instead.",
  }),
  "playback-failed": (_them, counterpart) => ({
    label: "Voice unavailable",
    help: audioFailureMessage(counterpart),
  }),
  waiting: (them) => ({ label: them, help: `${them} is thinking…` }),
  speaking: (them, _counterpart, h) => ({
    label: them,
    help: h.generating ? `Preparing ${them.toLowerCase()}'s voice…` : `${them} is speaking.`,
  }),
  listening: () => ({ label: "Listening", help: "Tap again when you've finished the line." }),
  text: () => ({ label: "Your turn", help: "Return adds a line — it never sends." }),
  ready: (_them, _counterpart, h) => ({
    label: "Your turn",
    help: h.dictation ?? h.micHint ?? h.muted ?? "Tap the mic and say your line out loud.",
  }),
};

/**
 * A spoken line. Weight and size mark who is speaking — the counterpart reads
 * larger and heavier, the user's own words sit quieter — so no container is
 * needed to tell them apart.
 */
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
  const arrival = useRef(new Animated.Value(mine && !isReduced ? 0 : 1)).current;
  useEffect(() => {
    if (!mine || isReduced) {
      arrival.setValue(1);
      return;
    }
    const animation = Animated.spring(arrival, {
      toValue: 1,
      speed: 15,
      bounciness: 5,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [arrival, isReduced, mine]);
  if (!mine && beatLine === null && body.length === 0) return null;
  return (
    <Animated.View
      style={[
        mine ? styles.mineWrap : styles.themWrap,
        mine
          ? {
              opacity: arrival,
              transform: [
                { translateY: arrival.interpolate({ inputRange: [0, 1], outputRange: [72, 0] }) },
                { scale: arrival.interpolate({ inputRange: [0, 1], outputRange: [0.985, 1] }) },
              ],
            }
          : null,
      ]}
    >
      <Text style={styles.speaker}>{speaker}</Text>
      {beatLine ? <Text style={styles.beat}>{beatLine}</Text> : null}
      {body.length > 0 ? (
        streaming ? (
          <FadingWords text={body} />
        ) : (
          <Text style={mine ? styles.mineText : styles.themText}>{body}</Text>
        )
      ) : null}
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

  header: {
    paddingHorizontal: GUTTER,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 48 },
  iconHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "flex-start", gap: 2, minWidth: 0 },
  headerName: { ...T.support, fontFamily: font.semi, color: C.text },
  headerMeta: { ...T.caption, color: C.dim },
  endBtn: {
    borderWidth: 1,
    borderColor: C.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  endText: { ...T.caption, fontFamily: font.semi, color: C.textSoft },
  tensionWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  tensionLabel: { ...eyebrow, color: C.dim },

  transcript: { paddingHorizontal: GUTTER, paddingTop: 14, paddingBottom: 20 },

  themWrap: { marginBottom: 22 },
  mineWrap: { marginBottom: 22 },
  speaker: { ...eyebrow, color: C.dim, marginBottom: 7 },
  /** The counterpart reads largest — it is the thing to react to. */
  themText: { ...T.title, fontSize: 20, lineHeight: 30, fontFamily: font.medium },
  /** The user's own line sits quieter, in body ink. */
  mineText: { ...T.body, color: C.textSoft },
  beat: { ...T.caption, fontStyle: "italic", marginBottom: 6 },
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

  micRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
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
  speakingActions: { gap: 10, marginTop: 12 },
  composeWrap: { gap: 12, marginTop: 10 },
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
