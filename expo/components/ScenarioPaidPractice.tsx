import { useRouter } from "expo-router";
import { Mic, Square, X } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, MicControl, PrimaryButton, Reveal, StateDock } from "@/components/ui";
import { DIFFICULTY } from "@/constants/scenarios";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { generateDebrief, nextCounterpartTurn } from "@/lib/ai";
import {
  attachScenarioCoaching,
  attachScenarioCounterpartTurn,
  completeScenarioComparison,
  preserveScenarioAttempt,
  scenarioPracticePresentation,
  scenarioRunForRoute,
  transitionScenarioPracticeRun,
  type PersistedScenarioPracticeRun,
  type ScenarioCounterpartPresentation,
} from "@/lib/scenarioPractice";
import { useDictation } from "@/lib/useDictation";
import { useStore } from "@/providers/store";
import type { Scenario, Turn } from "@/types/convo";
import { SESSION_SCHEMA_VERSION, type SessionRecord } from "@/types/privacy";

interface ScenarioPaidPracticeProps {
  scenario: Scenario;
  requestedRunId?: string;
}

function turn(id: string, role: Turn["role"], text: string): Turn {
  return { id, role, text };
}

/** Scenario entry surface backed by the same PilotDayRun transitions and immutable attempts as paid modules. */
export function ScenarioPaidPractice({ scenario, requestedRunId }: ScenarioPaidPracticeProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeScenarioRun, saveActiveScenarioRun, upsertSession } = useStore();
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
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const dictation = useDictation();
  const cancelDictation = dictation.cancel;

  useEffect(() => () => { cancelDictation().catch(() => {}); }, [cancelDictation]);

  const persist = useCallback(async (next: PersistedScenarioPracticeRun): Promise<void> => {
    setValue(next);
    await saveActiveScenarioRun(next);
  }, [saveActiveScenarioRun]);

  const run = value?.run;
  const context = run?.scenarioContext;
  const state = run?.state;
  const pressure = run?.counterpartTurn;
  const presentation = scenarioPracticePresentation(value);
  const counterpartPresentation = presentation.isAvailable ? presentation.counterpart : undefined;
  const difficultyLabel = context ? DIFFICULTY[context.difficulty].label : "";

  const startRecording = useCallback(async (kind: "opener" | "response" | "retry"): Promise<void> => {
    if (!value) return;
    setDraft("");
    setError("");
    const nextState = kind === "opener" ? "listening_attempt" : kind === "response" ? "listening_response" : "listening_retry";
    await persist(transitionScenarioPracticeRun(value, nextState, Date.now()));
    await dictation.start();
  }, [dictation, persist, value]);

  const stopRecording = useCallback(async (): Promise<void> => {
    if (!value) return;
    const text = await dictation.stop();
    if (text) setDraft(text);
    const review = state === "listening_attempt" ? "confirm_attempt_transcript" : state === "listening_response" ? "confirm_response_transcript" : "confirm_retry_transcript";
    await persist(transitionScenarioPracticeRun(value, review, Date.now()));
  }, [dictation, persist, state, value]);

  const openTypedReview = useCallback(async (review: "confirm_attempt_transcript" | "confirm_response_transcript" | "confirm_retry_transcript"): Promise<void> => {
    if (!value) return;
    await persist(transitionScenarioPracticeRun(value, review, Date.now()));
  }, [persist, value]);

  const confirmOpening = useCallback(async (): Promise<void> => {
    if (!value || !context || draft.trim().length < 2) return;
    setBusy(true);
    setError("");
    const approved = preserveScenarioAttempt(value, "opener", draft, Date.now());
    await persist(approved);
    try {
      const result = await nextCounterpartTurn(
        scenario,
        context.difficulty,
        [turn(approved.run.attempt?.id ?? `${approved.run.id}-opener`, "user", approved.run.attempt?.transcript ?? draft.trim())],
        context.reaction,
        context.objective,
      );
      const withPressure = attachScenarioCounterpartTurn(approved, {
        id: `${approved.run.id}-counterpart-turn-1`,
        text: result.reply,
        source: "provider",
      }, Date.now());
      setDraft("");
      await persist(transitionScenarioPracticeRun(withPressure, "ready_for_response", Date.now()));
    } catch {
      setError(`${context.counterpartName}'s response did not come through. Your approved transcript is saved.`);
      await persist(transitionScenarioPracticeRun(approved, "network_error", Date.now()));
    } finally {
      setBusy(false);
    }
  }, [context, draft, persist, scenario, value]);

  const confirmResponse = useCallback(async (): Promise<void> => {
    if (!value || !context || !pressure || draft.trim().length < 2) return;
    setBusy(true);
    setError("");
    const approved = preserveScenarioAttempt(value, "response", draft, Date.now());
    await persist(approved);
    try {
      const response = approved.run.responseAttempt?.transcript ?? draft.trim();
      const debrief = await generateDebrief(scenario, context.difficulty, [
        turn(approved.run.attempt?.id ?? `${approved.run.id}-opener`, "user", approved.run.attempt?.transcript ?? ""),
        turn(pressure.id, "them", pressure.text),
        turn(approved.run.responseAttempt?.id ?? `${approved.run.id}-response`, "user", response),
      ], context.reaction, context.objective);
      const flag = debrief.flags[0];
      const coached = attachScenarioCoaching(
        approved,
        flag?.quote ? `In “${flag.quote},” ${flag.issue}` : debrief.headline,
        flag?.reframe || debrief.nextRep || "Answer the same pressure again with one concrete next step.",
        "pushback_response",
        Date.now(),
      );
      setDraft("");
      await persist(coached);
    } catch {
      setError("Hope could not finish the feedback. Your approved transcripts are saved.");
      await persist(transitionScenarioPracticeRun(approved, "model_error", Date.now()));
    } finally {
      setBusy(false);
    }
  }, [context, draft, persist, pressure, scenario, value]);

  const confirmRetry = useCallback(async (): Promise<void> => {
    if (!value || draft.trim().length < 2) return;
    const approved = preserveScenarioAttempt(value, "retry", draft, Date.now());
    const compared = completeScenarioComparison(approved, Date.now());
    setDraft("");
    await persist(compared);
  }, [draft, persist, value]);

  const finish = useCallback(async (): Promise<void> => {
    if (!value || !context || !run?.retryAttempt || !pressure) return;
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
  }, [context, persist, pressure, run, upsertSession, value]);

  if (!value || !context || !run || !presentation.isAvailable) {
    const unavailableTitle = presentation.isAvailable ? "This scenario run is unavailable." : presentation.title;
    const unavailableBody = presentation.isAvailable ? "Return to Scenarios and start a fresh rehearsal. No generic practice fixture was substituted." : presentation.body;
    return <View style={[styles.root, styles.center]}><Backdrop /><Text style={styles.title}>{unavailableTitle}</Text><Text style={styles.body}>{unavailableBody}</Text><PrimaryButton label="Back to Scenarios" onPress={() => router.replace("/(tabs)/library")} containerStyle={styles.action} /></View>;
  }

  const isListening = state === "listening_attempt" || state === "listening_response" || state === "listening_retry";
  const reviewKind = state === "confirm_attempt_transcript" ? "opening" : state === "confirm_response_transcript" ? "response" : "retry";
  const showReview = state === "confirm_attempt_transcript" || state === "confirm_response_transcript" || state === "confirm_retry_transcript";

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
      <Pressable onPress={() => router.back()} style={styles.close} accessibilityRole="button" accessibilityLabel="Save and leave scenario"><X size={21} color={C.textSoft} /></Pressable>
      <View style={styles.headerCopy}><Text style={styles.headerTitle}>{context.counterpartName}</Text><Text style={styles.headerMeta}>{context.counterpartRole} · {difficultyLabel}</Text></View><View style={styles.close} />
    </View>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 150 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <StatusPill label={context.category.toUpperCase()} tone="purple" /><Text style={styles.scenarioTitle}>{context.title}</Text><Text style={styles.context}>{context.situation}</Text>
        <ProductCard style={styles.identityCard}><View><SectionLabel>Counterpart</SectionLabel><Text style={styles.identityValue}>{context.counterpartLabel}</Text></View><View><SectionLabel>Objective</SectionLabel><Text style={styles.identityValue}>{context.objective}</Text></View><View><SectionLabel>Pressure level</SectionLabel><Text style={styles.identityValue}>{difficultyLabel} · {DIFFICULTY[context.difficulty].note}</Text></View></ProductCard>

        {state === "ready_for_attempt" ? <Reveal><Text style={styles.title}>Open the conversation with {context.counterpartName}.</Text><Text style={styles.body}>Say the first thing you want {context.counterpartRole} to hear. You will approve the transcript before {context.counterpartName} responds.</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void startRecording("opener")} onType={() => void openTypedReview("confirm_attempt_transcript")} /></Reveal> : null}
        {isListening ? <View style={styles.listening}><Text style={styles.title}>Recording your {state === "listening_attempt" ? "opening" : state === "listening_response" ? "response" : "retry"}.</Text><MicControl state="listening" level={dictation.level} onPress={() => void stopRecording()} glyph={<Square size={24} color={C.onAccent} fill={C.onAccent} />} accessibilityLabel="Done speaking" /><Text style={styles.body}>Tap when you are done. Nothing advances until you approve the transcript.</Text></View> : null}
        {showReview ? <Reveal><StatusPill label="Transcript review" tone="purple" /><Text style={styles.title}>Approve your {reviewKind}.</Text>{reviewKind !== "opening" && pressure ? <CounterpartCard presentation={counterpartPresentation} /> : null}<TextInput value={draft} onChangeText={setDraft} multiline style={styles.input} accessibilityLabel={`Edit ${reviewKind} transcript`} /><PrimaryButton label="Approve this transcript" disabled={draft.trim().length < 2 || busy} onPress={() => void (reviewKind === "opening" ? confirmOpening() : reviewKind === "response" ? confirmResponse() : confirmRetry())} containerStyle={styles.action} />{busy ? <ActivityIndicator color={C.purple} style={styles.busy} /> : null}</Reveal> : null}
        {state === "ready_for_response" && pressure ? <Reveal><CounterpartCard presentation={counterpartPresentation} /><Text style={styles.title}>Respond to the pressure.</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void startRecording("response")} onType={() => void openTypedReview("confirm_response_transcript")} /></Reveal> : null}
        {state === "hope_coaching" && pressure ? <Reveal><StatusPill label="Hope · coaching" tone="purple" /><CounterpartCard presentation={counterpartPresentation} /><ProductCard accent style={styles.coachCard}><SectionLabel tone={C.purple}>Hope noticed</SectionLabel><Text style={styles.body}>{run.coachNote}</Text><SectionLabel tone={C.purple}>Same-moment retry</SectionLabel><Text style={styles.body}>{run.retryInstruction}</Text></ProductCard><PrimaryButton label={`Retry the same ${context.counterpartName} moment`} onPress={() => void persist(transitionScenarioPracticeRun(value, "ready_for_retry", Date.now()))} containerStyle={styles.action} /></Reveal> : null}
        {state === "ready_for_retry" && pressure ? <Reveal><StatusPill label="Same-moment retry" tone="purple" /><CounterpartCard presentation={counterpartPresentation} /><Text style={styles.title}>Answer the exact same turn again.</Text><Text style={styles.body}>{run.retryInstruction}</Text><CaptureActions value={draft} onChange={setDraft} onRecord={() => void startRecording("retry")} onType={() => void openTypedReview("confirm_retry_transcript")} /></Reveal> : null}
        {state === "attempt_comparison" && pressure && run.responseAttempt && run.retryAttempt && run.comparison ? <Reveal><StatusPill label="Review · same moment" tone="purple" /><Text style={styles.title}>Compare your two responses.</Text><CounterpartCard presentation={counterpartPresentation} /><Comparison label="First approved response" text={run.responseAttempt.transcript} /><Comparison label="Retry approved response" text={run.retryAttempt.transcript} /><Text style={styles.body}>{run.comparison.text}</Text><PrimaryButton label="Continue" onPress={() => void persist(transitionScenarioPracticeRun(value, "transfer_cue", Date.now()))} containerStyle={styles.action} /></Reveal> : null}
        {state === "transfer_cue" ? <Reveal><StatusPill label="Hope · wrap-up" tone="purple" /><Text style={styles.title}>Take the clearer wording into the real conversation.</Text><Text style={styles.body}>This completion belongs to {context.title}, with {context.counterpartName} as {context.counterpartRole}. No unrelated practice fixture was used.</Text><PrimaryButton label="Complete scenario" onPress={() => void finish()} containerStyle={styles.action} /></Reveal> : null}
        {state === "complete" ? <Reveal><StatusPill label="Scenario complete" tone="green" /><Text style={styles.title}>{context.title} is complete.</Text><Text style={styles.body}>You practiced one {context.counterpartName} pressure moment twice at {difficultyLabel.toLowerCase()} difficulty.</Text><PrimaryButton label="Back to Scenarios" onPress={() => router.replace("/(tabs)/library")} containerStyle={styles.action} /></Reveal> : null}
        {state === "network_error" || state === "model_error" ? <Reveal><StatusPill label="Saved checkpoint" tone="amber" /><Text style={styles.title}>{error}</Text><PrimaryButton label="Return to this scenario" onPress={() => void persist(transitionScenarioPracticeRun(value, state === "network_error" ? "confirm_attempt_transcript" : "confirm_response_transcript", Date.now()))} containerStyle={styles.action} /></Reveal> : null}
      </ScrollView>
    </KeyboardAvoidingView>
    {busy ? <StateDock bottomInset={insets.bottom}><View style={styles.processing}><ActivityIndicator color={C.purple} /><Text style={styles.body}>{state === "confirm_attempt_transcript" ? `${context.counterpartName} is responding` : "Hope is reviewing your approved words"}</Text></View></StateDock> : null}
  </View>;
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
  title: { ...T.title, marginTop: 22 }, body: { ...T.support, marginTop: 8 }, action: { marginTop: 18 }, capture: { alignItems: "center", marginTop: 22 }, or: { ...T.caption, marginVertical: 16 }, input: { ...T.body, minHeight: 108, width: "100%", backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.md, padding: 16, textAlignVertical: "top" },
  listening: { alignItems: "center", gap: 20, paddingTop: 36 }, busy: { marginTop: 14 }, processing: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 }, counterpartCard: { marginTop: 18 }, counterpartText: { ...T.body, marginTop: 10 }, continuityLabel: { ...T.caption, marginTop: 12 }, coachCard: { marginTop: 14, gap: 8 }, comparison: { marginTop: 10 },
});
