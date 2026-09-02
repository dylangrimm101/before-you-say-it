import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Backdrop, PressCard, PrimaryButton, tap, useReducedMotion } from "@/components/ui";
import { DESIRED_SHIFTS, DESIRED_SKILLS, PRESSURE_CONDITIONS, RECURRING_PROBLEMS, type ModuleId, type OnboardingEntryRoute } from "@/constants/modules";
import { approvedScenarioForContext, behavioralGoal, personaForContext, scenarioFromApproved } from "@/constants/onboardingScenarios";
import { C, GUTTER, T, eyebrow, font } from "@/constants/theme";
import { buildCustomScenario, fallbackCustomScenario } from "@/lib/ai";
import { createOnboardingPracticeSession, createPracticeSessionId } from "@/lib/practiceSession";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";
import type { CategoryId, Difficulty, ReactionPattern, Scenario } from "@/types/convo";

const ENTRY_CHOICES: readonly { id: OnboardingEntryRoute; label: string; note: string }[] = [
  { id: "real_conversation", label: "I have a conversation I need to prepare for", note: "Build a private rehearsal around the moment ahead." },
  { id: "recurring_problem", label: "The same communication problem keeps happening", note: "Find the pattern, then practice a ready-made situation." },
  { id: "desired_skill", label: "I know what I want to get better at", note: "Choose the skill and the pressure that makes it difficult." },
];

const CONTEXTS: readonly { label: string; category: CategoryId }[] = [
  { label: "Partner or co-parent", category: "partner" },
  { label: "Family member", category: "family" },
  { label: "Friend", category: "friends" },
  { label: "Work", category: "work" },
];

const SUCCESS_TARGETS: readonly string[] = [
  "Say the request clearly",
  "Stay with the point after pushback",
  "Hear their concern before responding",
  "Set a limit without escalating",
];

export const ONBOARDING_REACTIONS: readonly { id: ReactionPattern; label: string }[] = [
  { id: "defensive", label: "Gets defensive" },
  { id: "minimizes", label: "Minimizes the problem" },
  { id: "quiet", label: "Avoids or shuts down" },
  { id: "turns-back", label: "Turns it back on me" },
  { id: "agrees-without-changing", label: "Agrees in the moment, but nothing changes" },
  { id: "not-sure", label: "I’m not sure. Surprise me" },
];

const DIFFICULTY: Difficulty = "steady";
const DECK_DURATION = 430;
const SELECTION_CONFIRMATION_MS = 140;
const DECK_EASING = Easing.bezier(0.22, 0.9, 0.28, 1);

type DeckTransition = { direction: "forward" | "back"; from: number; to: number };

export default function Onboarding(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isReduced = useReducedMotion();
  const { saveProfile, addCustomScenario, anonymousUserId, saveActivePracticeSession } = useStore();
  const [step, setStep] = useState<number>(0);
  const [entryRoute, setEntryRoute] = useState<OnboardingEntryRoute | null>(null);
  const [moduleId, setModuleId] = useState<ModuleId | null>(null);
  const [selectionLabel, setSelectionLabel] = useState<string>("");
  const [focus, setFocus] = useState<CategoryId | null>(null);
  const [reaction, setReaction] = useState<ReactionPattern | null>(null);
  const [situation, setSituation] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [transition, setTransition] = useState<DeckTransition | null>(null);
  const transitionProgress = useRef<Animated.Value>(new Animated.Value(1)).current;
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReal = entryRoute === "real_conversation";
  const totalSteps = isReal ? 5 : 4;
  const canContinue = useMemo((): boolean => isReal && step === 2 && situation.trim().length >= 8, [isReal, situation, step]);

  useEffect(() => () => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    transitionProgress.stopAnimation();
  }, [transitionProgress]);

  const animateTo = useCallback((nextStep: number, direction: "forward" | "back"): void => {
    const from = step;
    if (isReduced) {
      setStep(nextStep);
      setTransition(null);
      setIsAdvancing(false);
      return;
    }
    transitionProgress.setValue(0);
    setTransition({ direction, from, to: nextStep });
    if (direction === "forward") setStep(nextStep);
    Animated.timing(transitionProgress, { toValue: 1, duration: DECK_DURATION, easing: DECK_EASING, useNativeDriver: true }).start(({ finished }) => {
      if (finished && direction === "back") setStep(nextStep);
      setTransition(null);
      setIsAdvancing(false);
    });
  }, [isReduced, step, transitionProgress]);

  const confirmAndAdvance = useCallback((nextStep: number): void => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    selectionTimer.current = setTimeout(() => animateTo(nextStep, "forward"), isReduced ? 0 : SELECTION_CONFIRMATION_MS);
  }, [animateTo, isAdvancing, isReduced]);

  const clearAfterEntry = (): void => {
    setModuleId(null); setSelectionLabel(""); setFocus(null); setReaction(null); setSituation(""); setOutcome(""); setError("");
  };

  const chooseEntry = (value: OnboardingEntryRoute): void => {
    tap("light");
    clearAfterEntry();
    setEntryRoute(value);
    confirmAndAdvance(1);
  };

  const finish = useCallback(async (selectedFocus: CategoryId, selectedReaction: ReactionPattern): Promise<void> => {
    if (!entryRoute || building) return;
    if (isReal && situation.trim().length < 8) return;
    const persona = personaForContext(selectedFocus);
    const approved = isReal ? null : approvedScenarioForContext(selectedFocus);
    if (!isReal && !approved) return;
    setBuilding(true);
    setError("");
    const selectedOutcome = approved?.desiredOutcome ?? outcome.trim();
    const counterpart = persona === "man-adam" ? "Adam" : "Hope";
    const selectedGoal = behavioralGoal(entryRoute, moduleId ?? undefined, selectedOutcome);

    try {
      await saveProfile({ focus: selectedFocus, persona, reaction: selectedReaction, outcome: selectedOutcome, dread: approved?.situation ?? situation.trim(), pattern: "avoid", win: "heard", createdAt: Date.now() });
      let scenario: Scenario;
      if (approved) {
        scenario = scenarioFromApproved(approved, persona);
      } else {
        const form = { focus: selectedFocus, persona, reaction: selectedReaction, outcome: selectedOutcome, difficulty: DIFFICULTY };
        let draft: Omit<Scenario, "id" | "isCustom">;
        try {
          draft = await buildCustomScenario(situation.trim(), selectedFocus, form);
        } catch (caught) {
          safeLog("[onboarding] using rehearsal fallback", errorShape(caught));
          draft = fallbackCustomScenario(situation.trim(), selectedFocus, form);
        }
        scenario = { ...draft, id: `onboarding-${Date.now().toString(36)}`, category: selectedFocus, title: "Your conversation", counterpart, situation: situation.trim(), goal: selectedOutcome, opensWith: "user", isCustom: true };
      }
      await addCustomScenario(scenario);
      const practiceSessionId = createPracticeSessionId();
      await saveActivePracticeSession(createOnboardingPracticeSession(practiceSessionId, anonymousUserId, scenario, selectedOutcome, selectedReaction, Date.now(), {
        entryRoute,
        ...(moduleId ? { provisionalModuleId: moduleId } : {}),
        ...(selectionLabel ? { selectionLabel } : {}),
        scenarioSource: approved ? "approved_authored" : "user_supplied",
        scenarioTitle: scenario.title,
        counterpartRelationship: approved?.counterpartRelationship ?? CONTEXTS.find((item) => item.category === selectedFocus)?.label ?? "Conversation partner",
        counterpartDisplayLabel: counterpart,
        behavioralGoal: selectedGoal,
        persona,
      }));
      tap("success");
      router.replace({ pathname: "/rehearse/[id]", params: { id: scenario.id, difficulty: DIFFICULTY, reaction: selectedReaction, entry: "onboarding", persona, practiceSessionId } });
    } catch (caught) {
      safeLog("[onboarding] rehearsal handoff failed", errorShape(caught));
      setBuilding(false);
      setError("We couldn't set up your rehearsal. Check your connection and try again.");
    }
  }, [addCustomScenario, anonymousUserId, building, entryRoute, isReal, moduleId, outcome, router, saveActivePracticeSession, saveProfile, selectionLabel, situation]);

  const chooseDiagnosis = (nextModuleId: ModuleId, label: string): void => {
    tap("light");
    setModuleId(nextModuleId); setSelectionLabel(label); setReaction(null); setFocus(null);
    confirmAndAdvance(2);
  };

  const chooseSecondary = (nextModuleId: ModuleId | null, nextReaction: ReactionPattern | null, label: string): void => {
    tap("light");
    if (nextModuleId) setModuleId(nextModuleId);
    setSelectionLabel(label);
    setReaction(nextReaction);
    setFocus(null);
    confirmAndAdvance(3);
  };

  const chooseContext = (value: CategoryId): void => {
    tap("light");
    setFocus(value);
    if (isReal) {
      setSituation(""); setOutcome(""); setReaction(null);
      confirmAndAdvance(2);
      return;
    }
    if (isAdvancing) return;
    setIsAdvancing(true);
    selectionTimer.current = setTimeout(() => { void finish(value, reaction ?? "not-sure"); setIsAdvancing(false); }, isReduced ? 0 : SELECTION_CONFIRMATION_MS);
  };

  const chooseOutcome = (value: string): void => {
    tap("light");
    setOutcome(value); setReaction(null);
    confirmAndAdvance(4);
  };

  const chooseReaction = (value: ReactionPattern): void => {
    if (!focus || isAdvancing) return;
    tap("light"); setReaction(value); setIsAdvancing(true);
    selectionTimer.current = setTimeout(() => { void finish(focus, value); setIsAdvancing(false); }, isReduced ? 0 : SELECTION_CONFIRMATION_MS);
  };

  const goBack = (): void => {
    if (isAdvancing) return;
    Keyboard.dismiss();
    if (step === 0) { router.replace("/entry"); return; }
    setIsAdvancing(true);
    animateTo(Math.max(0, step - 1), "back");
  };

  const next = (): void => { if (canContinue) { Keyboard.dismiss(); confirmAndAdvance(3); } };
  const showsFooter = (isReal && step === 2) || building;

  const cardMotion = (cardStep: number): object => {
    if (transition?.direction === "forward" && cardStep === transition.to) return { transform: [{ translateY: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [screenHeight * 0.92, 0] }) }] };
    if (transition?.direction === "back" && cardStep === transition.from) return { transform: [{ translateY: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, screenHeight * 0.96] }) }] };
    return { transform: [{ scale: cardStep < step ? 0.988 : 1 }] };
  };

  const renderQuestion = (cardStep: number, disabled: boolean): React.ReactNode => {
    const contextChoices = CONTEXTS.map((item) => <Choice key={item.category} title={item.label} selected={focus === item.category} disabled={disabled} onPress={() => chooseContext(item.category)} />);
    return <>
      <Text style={styles.cardEyebrow}>{`Question ${cardStep + 1} of ${totalSteps}`}</Text>
      {cardStep === 0 ? <Question title="What brought you here?" lede="Choose the closest answer. Every path includes a real rehearsal before any recommendation.">{ENTRY_CHOICES.map((choice) => <Choice key={choice.id} title={choice.label} note={choice.note} selected={entryRoute === choice.id} disabled={disabled} onPress={() => chooseEntry(choice.id)} />)}</Question> : null}
      {isReal && cardStep === 1 ? <Question title="Who is this with?" lede="Choose the relationship context.">{contextChoices}</Question> : null}
      {isReal && cardStep === 2 ? <Question title="What’s the conversation about?" lede="A sentence or two is enough. Include what happened and what you need to say."><Input value={situation} disabled={disabled} onChangeText={(value) => { setSituation(value); setOutcome(""); setReaction(null); }} /></Question> : null}
      {isReal && cardStep === 3 ? <Question title="What would a useful outcome be?" lede="Choose the result you most want to practice.">{SUCCESS_TARGETS.map((label) => <Choice key={label} title={label} selected={outcome === label} disabled={disabled} onPress={() => chooseOutcome(label)} />)}</Question> : null}
      {isReal && cardStep === 4 ? <Question title="How do they usually respond?" lede="Choose the closest pattern.">{ONBOARDING_REACTIONS.map((item) => <Choice key={item.id} title={item.label} selected={reaction === item.id} disabled={disabled} onPress={() => chooseReaction(item.id)} />)}</Question> : null}
      {!isReal && cardStep === 1 ? <Question title={entryRoute === "desired_skill" ? "What do you want to get better at?" : "What keeps happening?"} lede="Choose the closest fit.">{(entryRoute === "desired_skill" ? DESIRED_SKILLS : RECURRING_PROBLEMS).map((item) => <Choice key={item.label} title={item.label} selected={moduleId === item.moduleId && selectionLabel === item.label} disabled={disabled} onPress={() => chooseDiagnosis(item.moduleId, item.label)} />)}</Question> : null}
      {!isReal && cardStep === 2 && entryRoute === "recurring_problem" ? <Question title="When this pattern starts, what would you most like to do differently?" lede="Choose the shift that would help most.">{DESIRED_SHIFTS.map((item) => <Choice key={item.label} title={item.label} selected={selectionLabel === item.label} disabled={disabled} onPress={() => chooseSecondary(item.moduleId, null, item.label)} />)}</Question> : null}
      {!isReal && cardStep === 2 && entryRoute === "desired_skill" ? <Question title="What usually makes that hardest?" lede="Choose the pressure that most often changes what you say.">{PRESSURE_CONDITIONS.map((item) => <Choice key={item.label} title={item.label} selected={selectionLabel === item.label} disabled={disabled} onPress={() => chooseSecondary(null, item.reaction as ReactionPattern, item.label)} />)}</Question> : null}
      {!isReal && cardStep === 3 ? <Question title="Where would this skill help most?" lede="We’ll choose the matching authored situation automatically.">{contextChoices}</Question> : null}
      {cardStep === step && error ? <Text style={styles.error}>{error}</Text> : null}
    </>;
  };

  return <View style={styles.root}><Backdrop /><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <View style={[styles.header, { paddingTop: insets.top + 6 }]}><View style={styles.headerRow}><Pressable onPress={goBack} disabled={isAdvancing} style={styles.backHit}><Text style={styles.backText}>‹ Back</Text></Pressable><Text style={styles.counter}>{`Step ${step + 1} of ${totalSteps}`}</Text></View><View style={styles.track}><View style={[styles.fill, { width: `${((step + 1) / totalSteps) * 100}%` }]} /></View></View>
    <View style={[styles.questionDeck, { marginBottom: showsFooter ? 20 : insets.bottom + 20 }]}>{Array.from({ length: step + 1 }, (_, cardStep) => { const active = cardStep === step; const disabled = !active || isAdvancing || building; return <Animated.View key={cardStep} style={[styles.questionCard, { top: 6 + cardStep * 12, zIndex: (cardStep + 1) * 10 }, cardMotion(cardStep)]} pointerEvents={disabled ? "none" : "auto"}><ScrollView style={styles.cardScroller} contentContainerStyle={styles.cardContent} scrollEnabled={!disabled} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>{renderQuestion(cardStep, disabled)}</ScrollView></Animated.View>; })}</View>
    {showsFooter ? <BlurView intensity={Platform.OS === "web" ? 0 : 30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}><PrimaryButton label={building ? "Setting up your rehearsal…" : "Continue"} disabled={!canContinue || building} onPress={next} />{building ? <ActivityIndicator color={C.purple} style={styles.spinner} /> : null}</BlurView> : null}
  </KeyboardAvoidingView></View>;
}

function Question({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }): React.JSX.Element { return <><Text style={styles.title}>{title}</Text><Text style={styles.lede}>{lede}</Text><View style={styles.options}>{children}</View></>; }
function Choice({ title, note, selected, disabled, onPress }: { title: string; note?: string; selected: boolean; disabled: boolean; onPress: () => void }): React.JSX.Element { return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={title} accessibilityRole="radio" accessibilityState={{ selected }}><View style={[styles.choice, selected && styles.choiceOn]}><View style={[styles.marker, selected && styles.markerSelected]}>{selected ? <Text style={styles.markerCheck}>✓</Text> : null}</View><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{title}</Text>{note ? <Text style={styles.choiceNote}>{note}</Text> : null}</View></View></PressCard>; }
function Input({ value, onChangeText, disabled }: { value: string; onChangeText: (value: string) => void; disabled: boolean }): React.JSX.Element { return <TextInput value={value} onChangeText={onChangeText} editable={!disabled} placeholder="My colleague keeps challenging me in meetings, and I need to address it directly." placeholderTextColor={C.dim} multiline maxLength={500} style={styles.input} textAlignVertical="top" accessibilityLabel="Conversation situation" />; }

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, questionDeck: { flex: 1, position: "relative", marginHorizontal: 20 }, questionCard: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 28, borderWidth: 1, borderColor: "rgba(81,40,136,0.16)", backgroundColor: C.onAccent, overflow: "hidden", boxShadow: "0 10px 30px rgba(40,26,66,0.12)", elevation: 8 }, cardScroller: { flex: 1 }, cardContent: { padding: 22, paddingBottom: 28 }, cardEyebrow: { ...eyebrow, color: C.dim, marginBottom: 10 }, header: { paddingHorizontal: GUTTER, paddingBottom: 12, gap: 10 }, headerRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backHit: { minWidth: 60, minHeight: 44, justifyContent: "center" }, backText: { fontFamily: font.medium, fontSize: 15, color: C.textSoft }, counter: { ...eyebrow, color: C.dim }, track: { height: 3, borderRadius: 2, backgroundColor: C.line, overflow: "hidden" }, fill: { height: 3, backgroundColor: C.purple }, title: { fontFamily: font.bold, fontSize: 25, lineHeight: 30, letterSpacing: -0.45, color: C.text }, lede: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: C.textSoft, marginTop: 7 }, options: { gap: 9, marginTop: 20 }, choice: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)" }, choiceOn: { borderColor: "rgba(81,40,136,0.32)", backgroundColor: C.purpleSoft }, marker: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(23,26,31,0.22)", alignItems: "center", justifyContent: "center", marginRight: 11 }, markerSelected: { borderColor: C.purple, backgroundColor: C.purple }, markerCheck: { fontFamily: font.bold, fontSize: 10, color: C.onAccent }, choiceCopy: { flex: 1, gap: 3 }, choiceTitle: { fontFamily: font.medium, fontSize: 15, lineHeight: 20, color: C.text }, choiceNote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: C.textSoft }, input: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, minHeight: 132, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)", color: C.text }, error: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 18 }, footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.barEdge, backgroundColor: Platform.OS === "web" ? C.barSolid : C.bar }, spinner: { marginTop: 8 },
});
