import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Backdrop, PressCard, PrimaryButton, Reveal, tap, useReducedMotion } from "@/components/ui";
import { DESIRED_SKILLS, RECURRING_PROBLEMS, type ModuleId, type OnboardingEntryRoute } from "@/constants/modules";
import {
  APPROVED_ONBOARDING_SCENARIOS,
  approvedOnboardingScenario,
  behavioralGoal,
  scenarioFromApproved,
  type ApprovedOnboardingScenarioId,
} from "@/constants/onboardingScenarios";
import { PERSONAS } from "@/constants/personas";
import { CATEGORIES } from "@/constants/scenarios";
import { C, GUTTER, T, eyebrow, font } from "@/constants/theme";
import { buildCustomScenario, fallbackCustomScenario } from "@/lib/ai";
import { createOnboardingPracticeSession, createPracticeSessionId } from "@/lib/practiceSession";
import { errorShape, safeLog } from "@/lib/redact";
import { useStore } from "@/providers/store";
import type { CategoryId, Difficulty, PersonaVoice, ReactionPattern, Scenario } from "@/types/convo";

const ENTRY_CHOICES: readonly { id: OnboardingEntryRoute; label: string; note: string }[] = [
  { id: "real_conversation", label: "I have a conversation I need to prepare for", note: "Build a private rehearsal around the moment ahead." },
  { id: "recurring_problem", label: "The same communication problem keeps happening", note: "Choose the pattern, then practice it in a ready-made situation." },
  { id: "desired_skill", label: "I know what I want to get better at", note: "Choose the skill, then practice it in a ready-made situation." },
];

export const ONBOARDING_REACTIONS: readonly { id: ReactionPattern; label: string }[] = [
  { id: "defensive", label: "Gets defensive" },
  { id: "minimizes", label: "Minimizes the problem" },
  { id: "quiet", label: "Avoids or shuts down" },
  { id: "turns-back", label: "Turns it back on me" },
  { id: "not-sure", label: "I’m not sure" },
];

const DIFFICULTY: Difficulty = "steady";
const DECK_DURATION = 430;
const SELECTION_CONFIRMATION_MS = 140;
const DECK_EASING = Easing.bezier(0.22, 0.9, 0.28, 1);

type DeckTransition = { direction: "forward" | "back"; from: number; to: number };

function ConversationMark() {
  return (
    <View style={styles.mark} accessibilityRole="image" accessibilityLabel="Two people having a conversation">
      <Svg width="100%" height="100%" viewBox="0 0 180 92">
        <Circle cx="40" cy="27" r="20" fill={C.purple} />
        <Path d="M5 88c1.8-24 15.2-36 35-36s33.2 12 35 36H5Z" fill={C.purple} />
        <Circle cx="140" cy="27" r="20" fill={C.purple} />
        <Path d="M105 88c1.8-24 15.2-36 35-36s33.2 12 35 36h-70Z" fill={C.purple} />
        <Rect x="68" y="4" width="44" height="38" rx="11" fill={C.purple} />
        <Path d="M87 39h17L98 55Z" fill={C.purple} />
      </Svg>
    </View>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const isReduced = useReducedMotion();
  const { profile, saveProfile, addCustomScenario, anonymousUserId, saveActivePracticeSession } = useStore();
  const [step, setStep] = useState<number>(-1);
  const [entryRoute, setEntryRoute] = useState<OnboardingEntryRoute | null>(null);
  const [provisionalModuleId, setProvisionalModuleId] = useState<ModuleId | null>(null);
  const [selectionLabel, setSelectionLabel] = useState<string>("");
  const [approvedScenarioId, setApprovedScenarioId] = useState<ApprovedOnboardingScenarioId | null>(null);
  const [focus, setFocus] = useState<CategoryId | null>(null);
  const [persona, setPersona] = useState<PersonaVoice | null>(null);
  const [reaction, setReaction] = useState<ReactionPattern | null>(null);
  const [situation, setSituation] = useState<string>("");
  const [counterpart, setCounterpart] = useState<string>("");
  const [communication, setCommunication] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [isAdvancing, setIsAdvancing] = useState<boolean>(false);
  const [transition, setTransition] = useState<DeckTransition | null>(null);
  const transitionProgress = useRef<Animated.Value>(new Animated.Value(1)).current;
  const selectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isReal = entryRoute === "real_conversation";
  const totalSteps = isReal ? 8 : 5;
  const diagnosisOptions = entryRoute === "desired_skill" ? DESIRED_SKILLS : RECURRING_PROBLEMS;

  const canContinue = useMemo((): boolean => {
    if (!isReal) return false;
    if (step === 1) return situation.trim().length >= 8;
    if (step === 2) return counterpart.trim().length >= 2;
    if (step === 3) return focus !== null;
    if (step === 4) return communication.trim().length >= 3;
    if (step === 5) return outcome.trim().length >= 3;
    return false;
  }, [communication, counterpart, focus, isReal, outcome, situation, step]);

  useEffect(() => () => {
    if (selectionTimer.current) clearTimeout(selectionTimer.current);
    transitionProgress.stopAnimation();
  }, [transitionProgress]);

  const animateForward = useCallback((nextStep: number): void => {
    const from = step;
    if (isReduced) {
      setStep(nextStep);
      setTransition(null);
      setIsAdvancing(false);
      return;
    }
    transitionProgress.setValue(0);
    setTransition({ direction: "forward", from, to: nextStep });
    setStep(nextStep);
    requestAnimationFrame(() => {
      Animated.timing(transitionProgress, {
        toValue: 1,
        duration: DECK_DURATION,
        easing: DECK_EASING,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setTransition(null);
        setIsAdvancing(false);
      });
    });
  }, [isReduced, step, transitionProgress]);

  const confirmAndAdvance = useCallback((nextStep: number): void => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    selectionTimer.current = setTimeout(() => animateForward(nextStep), isReduced ? 0 : SELECTION_CONFIRMATION_MS);
  }, [animateForward, isAdvancing, isReduced]);

  const advanceImmediately = useCallback((nextStep: number): void => {
    if (isAdvancing) return;
    setIsAdvancing(true);
    animateForward(nextStep);
  }, [animateForward, isAdvancing]);

  const goBack = useCallback((): void => {
    if (isAdvancing) return;
    Keyboard.dismiss();
    if (step === 0) {
      setStep(-1);
      return;
    }
    if (step < 0) return;
    const previous = Math.max(0, step - 1);
    if (isReduced) {
      setStep(previous);
      return;
    }
    setIsAdvancing(true);
    transitionProgress.setValue(0);
    setTransition({ direction: "back", from: step, to: previous });
    Animated.timing(transitionProgress, {
      toValue: 1,
      duration: DECK_DURATION,
      easing: DECK_EASING,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setStep(previous);
      setTransition(null);
      setIsAdvancing(false);
    });
  }, [isAdvancing, isReduced, step, transitionProgress]);

  const chooseEntry = useCallback((value: OnboardingEntryRoute): void => {
    tap("light");
    Keyboard.dismiss();
    setEntryRoute(value);
    setProvisionalModuleId(null);
    setSelectionLabel("");
    setApprovedScenarioId(null);
    setSituation("");
    setCounterpart("");
    setCommunication("");
    setOutcome("");
    setFocus(null);
    setPersona(null);
    setReaction(null);
    confirmAndAdvance(1);
  }, [confirmAndAdvance]);

  const useOwnConversation = useCallback((): void => {
    tap("light");
    setEntryRoute("real_conversation");
    setApprovedScenarioId(null);
    setPersona(null);
    setReaction(null);
    confirmAndAdvance(1);
  }, [confirmAndAdvance]);

  const finish = useCallback(async (selectedReaction: ReactionPattern): Promise<void> => {
    if (!entryRoute || !persona || building) return;
    const approved = approvedOnboardingScenario(approvedScenarioId);
    if (!isReal && !approved) return;
    if (isReal && (!focus || situation.trim().length < 8 || counterpart.trim().length < 2)) return;
    setBuilding(true);
    setError("");

    const selectedFocus = approved?.category ?? focus;
    const selectedOutcome = approved?.desiredOutcome ?? outcome.trim();
    const selectedCounterpart = approved?.counterpartDisplayLabel ?? counterpart.trim();
    const selectedGoal = behavioralGoal(entryRoute, provisionalModuleId ?? undefined, selectedOutcome);
    if (!selectedFocus) return;

    try {
      await saveProfile({
        focus: selectedFocus,
        persona,
        reaction: selectedReaction,
        outcome: selectedOutcome,
        dread: approved?.situation ?? situation.trim(),
        pattern: "avoid",
        win: "heard",
        createdAt: Date.now(),
      });

      let scenario: Scenario;
      if (approved) {
        scenario = scenarioFromApproved(approved, persona);
      } else {
        const description = `${situation.trim()}\nWhat you want to communicate: ${communication.trim()}`;
        const form = { focus: selectedFocus, persona, reaction: selectedReaction, outcome: selectedOutcome, difficulty: DIFFICULTY };
        let draft: Omit<Scenario, "id" | "isCustom">;
        try {
          draft = await buildCustomScenario(description, selectedFocus, form);
        } catch (caught) {
          safeLog("[onboarding] using rehearsal fallback", errorShape(caught));
          draft = fallbackCustomScenario(description, selectedFocus, form);
        }
        scenario = {
          ...draft,
          category: selectedFocus,
          id: `onboarding-${Date.now().toString(36)}`,
          title: "Your conversation",
          counterpart: selectedCounterpart,
          situation: description,
          goal: selectedOutcome,
          opensWith: "user",
          isCustom: true,
        };
      }

      await addCustomScenario(scenario);
      const practiceSessionId = createPracticeSessionId();
      await saveActivePracticeSession(createOnboardingPracticeSession(
        practiceSessionId,
        anonymousUserId,
        scenario,
        selectedOutcome,
        selectedReaction,
        Date.now(),
        {
          entryRoute,
          ...(provisionalModuleId ? { provisionalModuleId } : {}),
          ...(selectionLabel ? { selectionLabel } : {}),
          scenarioSource: approved ? "approved_authored" : "user_supplied",
          scenarioTitle: scenario.title,
          counterpartRelationship: approved?.counterpartRelationship ?? selectedCounterpart,
          counterpartDisplayLabel: selectedCounterpart,
          behavioralGoal: selectedGoal,
          persona,
        },
      ));
      tap("success");
      router.replace({
        pathname: "/rehearse/[id]",
        params: {
          id: scenario.id,
          difficulty: DIFFICULTY,
          reaction: selectedReaction,
          entry: "onboarding",
          persona,
          practiceSessionId,
        },
      });
    } catch (caught) {
      safeLog("[onboarding] rehearsal handoff failed", errorShape(caught));
      setBuilding(false);
      setError("We couldn't set up your rehearsal. Check your connection and try again.");
    }
  }, [addCustomScenario, anonymousUserId, approvedScenarioId, building, communication, counterpart, entryRoute, focus, isReal, outcome, persona, provisionalModuleId, router, saveActivePracticeSession, saveProfile, selectionLabel, situation]);

  const chooseDiagnosis = useCallback((moduleId: ModuleId, label: string): void => {
    tap("light");
    setProvisionalModuleId(moduleId);
    setSelectionLabel(label);
    setApprovedScenarioId(null);
    setPersona(null);
    setReaction(null);
    confirmAndAdvance(2);
  }, [confirmAndAdvance]);

  const chooseScenario = useCallback((id: ApprovedOnboardingScenarioId): void => {
    tap("light");
    setApprovedScenarioId(id);
    setPersona(null);
    setReaction(null);
    confirmAndAdvance(3);
  }, [confirmAndAdvance]);

  const chooseFocus = useCallback((value: CategoryId): void => {
    tap("light");
    setFocus(value);
    setCommunication("");
    setOutcome("");
    setPersona(null);
    setReaction(null);
    confirmAndAdvance(4);
  }, [confirmAndAdvance]);

  const choosePersona = useCallback((value: PersonaVoice): void => {
    tap("light");
    setPersona(value);
    setReaction(null);
    confirmAndAdvance(isReal ? 7 : 4);
  }, [confirmAndAdvance, isReal]);

  const chooseReaction = useCallback((value: ReactionPattern): void => {
    tap("light");
    if (isAdvancing) return;
    setReaction(value);
    setIsAdvancing(true);
    selectionTimer.current = setTimeout(() => {
      void finish(value);
      setIsAdvancing(false);
    }, isReduced ? 0 : SELECTION_CONFIRMATION_MS);
  }, [finish, isAdvancing, isReduced]);

  const next = (): void => {
    if (!canContinue) return;
    Keyboard.dismiss();
    advanceImmediately(step + 1);
  };

  const requiresContinue = isReal && step >= 1 && step <= 5;
  const showsFooter = requiresContinue || building;

  const cardMotion = (cardStep: number): { transform: ({ translateY: Animated.AnimatedInterpolation<number> } | { scale: Animated.AnimatedInterpolation<number> | number })[] } | { transform: { scale: number }[] } => {
    if (transition?.direction === "forward" && cardStep === transition.to) {
      return { transform: [{ translateY: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [screenHeight * 0.92, 0] }) }, { scale: 1 }] };
    }
    if (transition?.direction === "forward" && cardStep === transition.from) {
      return { transform: [{ translateY: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.988] }) }] };
    }
    if (transition?.direction === "back" && cardStep === transition.from) {
      return { transform: [{ translateY: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [0, screenHeight * 0.96] }) }, { scale: 1 }] };
    }
    if (transition?.direction === "back" && cardStep === transition.to) {
      return { transform: [{ scale: transitionProgress.interpolate({ inputRange: [0, 1], outputRange: [0.988, 1] }) }] };
    }
    return { transform: [{ scale: cardStep < step ? 0.988 : 1 }] };
  };

  const renderQuestion = (cardStep: number, disabled: boolean): React.ReactNode => (
    <>
      <Text style={styles.cardEyebrow}>{`Question ${cardStep + 1} of ${totalSteps}`}</Text>
      {cardStep === 0 ? <><Text style={styles.title} numberOfLines={2}>What brought you here?</Text><Text style={styles.lede}>Choose the closest answer. Every path includes a real rehearsal before any recommendation.</Text><View style={styles.options}>{ENTRY_CHOICES.map((choice) => <Choice key={choice.id} title={choice.label} note={choice.note} selected={entryRoute === choice.id} disabled={disabled} onPress={() => chooseEntry(choice.id)} />)}</View></> : null}

      {!isReal && cardStep === 1 ? <><Text style={styles.title} numberOfLines={2}>{entryRoute === "desired_skill" ? "What do you want to get better at?" : "What keeps happening?"}</Text><Text style={styles.lede}>Choose the closest fit.</Text><View style={styles.options}>{diagnosisOptions.map((option) => <Choice key={option.label} title={option.label} selected={provisionalModuleId === option.moduleId} disabled={disabled} onPress={() => chooseDiagnosis(option.moduleId, option.label)} />)}</View></> : null}

      {!isReal && cardStep === 2 ? <><Text style={styles.title} numberOfLines={2}>Pick a situation to practice</Text><Text style={styles.lede}>{entryRoute === "desired_skill" ? "Choose a ready-made situation. You’ll practice your selected skill inside it." : "Choose a ready-made situation. You’ll see how your communication pattern shows up inside it."}</Text><View style={styles.options}>{APPROVED_ONBOARDING_SCENARIOS.map((scenario) => <ScenarioChoice key={scenario.id} context={scenario.contextLabel} title={scenario.title} preview={scenario.preview} selected={approvedScenarioId === scenario.id} disabled={disabled} onPress={() => chooseScenario(scenario.id)} />)}</View><Pressable onPress={useOwnConversation} disabled={disabled} style={styles.ownLink} accessibilityRole="link" accessibilityLabel="Use your own conversation"><Text style={styles.ownLinkText}>Have something specific in mind? Use your own conversation</Text></Pressable></> : null}

      {isReal && cardStep === 1 ? <><Text style={styles.title} numberOfLines={2}>What happened or needs to be discussed?</Text><Text style={styles.lede}>No identifying details beyond what the rehearsal needs.</Text><Input value={situation} disabled={disabled} onChangeText={(value) => { setSituation(value); setCounterpart(""); setFocus(null); setCommunication(""); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="My manager added another deadline when I’m already at capacity." accessibilityLabel="Conversation situation" /></> : null}
      {isReal && cardStep === 2 ? <><Text style={styles.title} numberOfLines={2}>Who are you talking to?</Text><Text style={styles.lede}>Use their first name if helpful, or a specific relationship such as “my manager.”</Text><Input value={counterpart} disabled={disabled} onChangeText={(value) => { setCounterpart(value); setFocus(null); setCommunication(""); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="Jordan, my manager" maxLength={80} accessibilityLabel="Counterpart name or relationship" /></> : null}
      {isReal && cardStep === 3 ? <><Text style={styles.title} numberOfLines={2}>What kind of relationship is this?</Text><Text style={styles.lede}>This shapes the rehearsal without saving a contact.</Text><View style={styles.pills}>{CATEGORIES.map((category) => <Pill key={category.id} label={category.label} selected={focus === category.id} disabled={disabled} onPress={() => chooseFocus(category.id)} />)}</View></> : null}
      {isReal && cardStep === 4 ? <><Text style={styles.title} numberOfLines={2}>What do you want to communicate?</Text><Text style={styles.lede}>Write the main point you do not want to lose.</Text><Input value={communication} disabled={disabled} onChangeText={(value) => { setCommunication(value); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="I need us to decide what moves before I accept more work." accessibilityLabel="What you want to communicate" /></> : null}
      {isReal && cardStep === 5 ? <><Text style={styles.title} numberOfLines={2}>What would be useful to leave with?</Text><Text style={styles.lede}>Name one outcome you can influence.</Text><Input value={outcome} disabled={disabled} onChangeText={(value) => { setOutcome(value); setPersona(null); setReaction(null); }} placeholder="A clear priority decision and next step." maxLength={160} accessibilityLabel="Desired outcome" /></> : null}

      {((isReal && cardStep === 6) || (!isReal && cardStep === 3)) ? <><Text style={styles.title} numberOfLines={2}>Choose the rehearsal voice</Text><Text style={styles.lede}>This voice plays the person in your practice.</Text><View style={styles.options}>{PERSONAS.map((item) => <Choice key={item.id} title={item.id === "woman-hope" ? "Woman’s voice" : "Man’s voice"} selected={persona === item.id} disabled={disabled} onPress={() => choosePersona(item.id)} />)}</View></> : null}
      {((isReal && cardStep === 7) || (!isReal && cardStep === 4)) ? <><Text style={styles.title} numberOfLines={2}>How might they respond?</Text><Text style={styles.lede}>Choose the closest response style for this rehearsal.</Text><View style={styles.pills}>{ONBOARDING_REACTIONS.map((item) => <Pill key={item.id} label={item.label} selected={reaction === item.id} disabled={disabled} onPress={() => chooseReaction(item.id)} />)}</View></> : null}
      {cardStep === step && error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step >= 0 ? <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={goBack}
              disabled={isAdvancing || (step === 0 && !profile)}
              style={styles.backHit}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text style={[styles.backText, step === 0 && !profile && styles.hidden]}>{step === 0 && profile ? "Close" : "‹ Back"}</Text>
            </Pressable>
            <Text style={styles.counter}>{`Step ${step + 1} of ${totalSteps}`}</Text>
          </View>
          <View style={styles.track}><View style={[styles.fill, { width: `${((step + 1) / totalSteps) * 100}%` }]} /></View>
        </View> : null}

        {step < 0 ? (
          <ScrollView contentContainerStyle={[styles.openingScroll, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
            <Reveal><View style={styles.opening}><ConversationMark /><Text style={styles.openingTitle}>Build the qualities of world-class communicators.</Text><Text style={styles.openingBody}>Learn to communicate with Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.</Text><PrimaryButton label="Build my communication skills" onPress={() => advanceImmediately(0)} style={styles.openingButton} /></View></Reveal>
          </ScrollView>
        ) : (
          <View style={[styles.questionDeck, { marginBottom: showsFooter ? 20 : insets.bottom + 20 }]}>
            {Array.from({ length: step + 1 }, (_, cardStep) => {
              const isActive = cardStep === step;
              const disabled = !isActive || isAdvancing || building;
              return (
                <Animated.View
                  key={cardStep}
                  style={[styles.questionCard, { top: 6 + cardStep * 12, zIndex: (cardStep + 1) * 10 }, cardMotion(cardStep)]}
                  pointerEvents={disabled ? "none" : "auto"}
                  aria-hidden={disabled}
                  accessibilityElementsHidden={disabled}
                  importantForAccessibility={disabled ? "no-hide-descendants" : "auto"}
                >
                  <ScrollView
                    style={styles.cardScroller}
                    contentContainerStyle={styles.cardContent}
                    scrollEnabled={!disabled}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="interactive"
                    showsVerticalScrollIndicator={false}
                  >
                    {renderQuestion(cardStep, disabled)}
                  </ScrollView>
                </Animated.View>
              );
            })}
          </View>
        )}

        {showsFooter ? <BlurView intensity={Platform.OS === "web" ? 0 : 30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + 18 }]}><PrimaryButton label={building ? "Setting up your rehearsal…" : "Continue"} disabled={!canContinue || building} onPress={next} />{building ? <ActivityIndicator color={C.purple} style={styles.spinner} accessibilityLabel="Setting up your rehearsal" /> : null}</BlurView> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function SelectionMarker({ selected }: { selected: boolean }): React.JSX.Element {
  return <View style={[styles.marker, selected && styles.markerSelected]}>{selected ? <Text style={styles.markerCheck}>✓</Text> : null}</View>;
}

function Choice({ title, note, selected, disabled, onPress }: { title: string; note?: string; selected: boolean; disabled: boolean; onPress: () => void }): React.JSX.Element {
  return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={title}><View style={[styles.choice, selected && styles.choiceOn]}><SelectionMarker selected={selected} /><View style={styles.choiceCopy}><Text style={styles.choiceTitle}>{title}</Text>{note ? <Text style={styles.choiceNote}>{note}</Text> : null}</View></View></PressCard>;
}

function ScenarioChoice({ context, title, preview, selected, disabled, onPress }: { context: string; title: string; preview: string; selected: boolean; disabled: boolean; onPress: () => void }): React.JSX.Element {
  return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={`${context}: ${title}. ${preview}`}><View style={[styles.scenarioChoice, selected && styles.choiceOn]}><SelectionMarker selected={selected} /><View style={styles.choiceCopy}><Text style={styles.contextLabel}>{context}</Text><Text style={styles.choiceTitle}>{title}</Text><Text style={styles.choiceNote}>{preview}</Text></View></View></PressCard>;
}

function Pill({ label, selected, disabled, onPress }: { label: string; selected: boolean; disabled: boolean; onPress: () => void }): React.JSX.Element {
  return <PressCard onPress={onPress} disabled={disabled} accessibilityLabel={label}><View style={[styles.pill, selected && styles.choiceOn]}><SelectionMarker selected={selected} /><Text style={styles.pillText}>{label}</Text></View></PressCard>;
}

function Input({ value, onChangeText, placeholder, disabled, maxLength = 500, accessibilityLabel }: { value: string; onChangeText: (value: string) => void; placeholder: string; disabled: boolean; maxLength?: number; accessibilityLabel: string }): React.JSX.Element {
  return <TextInput value={value} onChangeText={onChangeText} editable={!disabled} placeholder={placeholder} placeholderTextColor={C.dim} multiline maxLength={maxLength} style={styles.input} textAlignVertical="top" accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  questionDeck: { flex: 1, position: "relative", marginHorizontal: 20 },
  questionCard: { position: "absolute", left: 0, right: 0, bottom: 0, borderRadius: 28, borderWidth: 1, borderColor: "rgba(81,40,136,0.16)", backgroundColor: C.onAccent, overflow: "hidden", boxShadow: "0 1px 2px rgba(40,26,66,0.05), 0 10px 26px rgba(40,26,66,0.10), 0 30px 60px rgba(40,26,66,0.10)", elevation: 8 },
  cardScroller: { flex: 1 },
  cardContent: { padding: 22, paddingBottom: 28 },
  cardEyebrow: { ...eyebrow, color: C.dim, marginBottom: 10 },
  header: { paddingHorizontal: GUTTER, paddingBottom: 12, gap: 10 },
  headerRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backHit: { minWidth: 60, minHeight: 44, justifyContent: "center" },
  backText: { fontFamily: font.medium, fontSize: 15, color: C.textSoft },
  hidden: { color: "transparent" },
  counter: { ...eyebrow, color: C.dim },
  track: { height: 3, borderRadius: 2, backgroundColor: C.line, overflow: "hidden" },
  fill: { height: 3, backgroundColor: C.purple },
  openingScroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: GUTTER },
  opening: { alignItems: "center", gap: 18, paddingHorizontal: 10 },
  mark: { width: 180, height: 92, marginBottom: 12 },
  openingTitle: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.7, color: C.text, textAlign: "center" },
  openingBody: { ...T.body, color: C.textSoft, textAlign: "center", lineHeight: 27 },
  openingButton: { width: "100%", marginTop: 18 },
  title: { fontFamily: font.bold, fontSize: 25, lineHeight: 30, letterSpacing: -0.45, color: C.text },
  lede: { fontFamily: font.regular, fontSize: 14, lineHeight: 21, color: C.textSoft, marginTop: 7 },
  options: { gap: 9, marginTop: 20 },
  choice: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)" },
  scenarioChoice: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)" },
  choiceOn: { borderColor: "rgba(81,40,136,0.32)", backgroundColor: C.purpleSoft },
  marker: { width: 19, height: 19, borderRadius: 10, borderWidth: 1.5, borderColor: "rgba(23,26,31,0.22)", alignItems: "center", justifyContent: "center", marginRight: 11 },
  markerSelected: { borderColor: C.purple, backgroundColor: C.purple },
  markerCheck: { fontFamily: font.bold, fontSize: 10, lineHeight: 12, color: C.onAccent },
  choiceCopy: { flex: 1, gap: 3 },
  contextLabel: { ...eyebrow, color: C.purple },
  choiceTitle: { fontFamily: font.medium, fontSize: 15, lineHeight: 20.25, color: C.text },
  choiceNote: { fontFamily: font.regular, fontSize: 13, lineHeight: 18, color: C.textSoft },
  pills: { gap: 9, marginTop: 20 },
  pill: { flexDirection: "row", alignItems: "center", paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)" },
  pillText: { flex: 1, fontFamily: font.medium, fontSize: 15, lineHeight: 20.25, color: C.text },
  ownLink: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 10, paddingHorizontal: 8 },
  ownLinkText: { ...T.caption, color: C.purple, textAlign: "center", fontFamily: font.semi },
  input: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, minHeight: 132, marginTop: 20, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(23,26,31,0.03)", color: C.text },
  error: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 18 },
  footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.barEdge, backgroundColor: Platform.OS === "web" ? C.barSolid : C.bar },
  spinner: { marginTop: 8 },
});
