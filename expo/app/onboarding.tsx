import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Backdrop, PressCard, PrimaryButton, Reveal, SelectionWipe, tap } from "@/components/ui";
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
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
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
  const [footerHeight, setFooterHeight] = useState<number>(96);

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
    setReaction(null);
    setStep(1);
  }, []);

  const useOwnConversation = useCallback((): void => {
    tap("light");
    setEntryRoute("real_conversation");
    setApprovedScenarioId(null);
    setStep(1);
  }, []);

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
    setStep(2);
  }, []);

  const chooseScenario = useCallback((id: ApprovedOnboardingScenarioId): void => {
    tap("light");
    setApprovedScenarioId(id);
    setPersona(null);
    setReaction(null);
    setStep(3);
  }, []);

  const chooseFocus = useCallback((value: CategoryId): void => {
    tap("light");
    setFocus(value);
    setCommunication("");
    setOutcome("");
    setPersona(null);
    setReaction(null);
    setStep(4);
  }, []);

  const choosePersona = useCallback((value: PersonaVoice): void => {
    tap("light");
    setPersona(value);
    setReaction(null);
    setStep(isReal ? 7 : 4);
  }, [isReal]);

  const chooseReaction = useCallback((value: ReactionPattern): void => {
    tap("light");
    setReaction(value);
    void finish(value);
  }, [finish]);

  const next = (): void => {
    if (!canContinue) return;
    Keyboard.dismiss();
    setStep((value) => value + 1);
  };

  const requiresContinue = isReal && step >= 1 && step <= 5;
  const showsFooter = requiresContinue || building;

  return (
    <View style={styles.root}>
      <Backdrop />
      {step === -1 ? (
        <LinearGradient
          colors={["#F7F2FC", "#EADFF6", "#DDC9EE"]}
          locations={[0, 0.52, 1]}
          start={{ x: 0.08, y: 0 }}
          end={{ x: 0.92, y: 1 }}
          style={styles.openingTint}
          pointerEvents="none"
        />
      ) : null}
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {step >= 0 ? <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                if (step === 0) {
                  setStep(-1);
                  return;
                }
                setStep((value) => Math.max(0, value - 1));
              }}
              disabled={step === 0 && !profile}
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

        <ScrollView contentContainerStyle={[styles.scroll, step < 0 && styles.openingScroll, { paddingBottom: footerHeight + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {step === -1 ? <Reveal><View style={styles.opening}><ConversationMark /><Text style={styles.openingTitle}>Build the qualities of world-class communicators.</Text><Text style={styles.openingBody}>Learn to communicate with Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.</Text><PrimaryButton label="Build my communication skills" onPress={() => setStep(0)} style={styles.openingButton} /></View></Reveal> : null}
          {step === 0 ? <Reveal><Text style={styles.title}>What brought you here?</Text><Text style={styles.lede}>Choose the closest answer. Every path includes a real rehearsal before any recommendation.</Text><View style={styles.options}>{ENTRY_CHOICES.map((choice) => <Choice key={choice.id} title={choice.label} note={choice.note} selected={entryRoute === choice.id} onPress={() => chooseEntry(choice.id)} />)}</View></Reveal> : null}

          {!isReal && step === 1 ? <Reveal><Text style={styles.title}>{entryRoute === "desired_skill" ? "What do you want to get better at?" : "What keeps happening?"}</Text><Text style={styles.lede}>Choose the closest fit.</Text><View style={styles.options}>{diagnosisOptions.map((option) => <Choice key={option.label} title={option.label} selected={provisionalModuleId === option.moduleId} onPress={() => chooseDiagnosis(option.moduleId, option.label)} />)}</View></Reveal> : null}

          {!isReal && step === 2 ? <Reveal><Text style={styles.title}>Pick a situation to practice</Text><Text style={styles.lede}>{entryRoute === "desired_skill" ? "Choose a ready-made situation. You’ll practice your selected skill inside it." : "Choose a ready-made situation. You’ll see how your communication pattern shows up inside it."}</Text><View style={styles.options}>{APPROVED_ONBOARDING_SCENARIOS.map((scenario) => <ScenarioChoice key={scenario.id} context={scenario.contextLabel} title={scenario.title} preview={scenario.preview} selected={approvedScenarioId === scenario.id} onPress={() => chooseScenario(scenario.id)} />)}</View><Pressable onPress={useOwnConversation} style={styles.ownLink} accessibilityRole="link" accessibilityLabel="Use your own conversation"><Text style={styles.ownLinkText}>Have something specific in mind? Use your own conversation</Text></Pressable></Reveal> : null}

          {isReal && step === 1 ? <Reveal><Text style={styles.title}>What happened or needs to be discussed?</Text><Text style={styles.lede}>No identifying details beyond what the rehearsal needs.</Text><Input value={situation} onChangeText={(value) => { setSituation(value); setCounterpart(""); setFocus(null); setCommunication(""); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="My manager added another deadline when I’m already at capacity." accessibilityLabel="Conversation situation" /></Reveal> : null}
          {isReal && step === 2 ? <Reveal><Text style={styles.title}>Who are you talking to?</Text><Text style={styles.lede}>Use their first name if helpful, or a specific relationship such as “my manager.”</Text><Input value={counterpart} onChangeText={(value) => { setCounterpart(value); setFocus(null); setCommunication(""); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="Jordan, my manager" maxLength={80} accessibilityLabel="Counterpart name or relationship" /></Reveal> : null}
          {isReal && step === 3 ? <Reveal><Text style={styles.title}>What kind of relationship is this?</Text><Text style={styles.lede}>This shapes the rehearsal without saving a contact.</Text><View style={styles.pills}>{CATEGORIES.map((category) => <Pill key={category.id} label={category.label} selected={focus === category.id} onPress={() => chooseFocus(category.id)} />)}</View></Reveal> : null}
          {isReal && step === 4 ? <Reveal><Text style={styles.title}>What do you want to communicate?</Text><Text style={styles.lede}>Write the main point you do not want to lose.</Text><Input value={communication} onChangeText={(value) => { setCommunication(value); setOutcome(""); setPersona(null); setReaction(null); }} placeholder="I need us to decide what moves before I accept more work." accessibilityLabel="What you want to communicate" /></Reveal> : null}
          {isReal && step === 5 ? <Reveal><Text style={styles.title}>What would be useful to leave with?</Text><Text style={styles.lede}>Name one outcome you can influence.</Text><Input value={outcome} onChangeText={(value) => { setOutcome(value); setPersona(null); setReaction(null); }} placeholder="A clear priority decision and next step." maxLength={160} accessibilityLabel="Desired outcome" /></Reveal> : null}

          {((isReal && step === 6) || (!isReal && step === 3)) ? <Reveal><Text style={styles.title}>Choose the rehearsal voice</Text><Text style={styles.lede}>This voice plays the person in your practice.</Text><View style={styles.options}>{PERSONAS.map((item) => <Choice key={item.id} title={item.id === "woman-hope" ? "Woman’s voice" : "Man’s voice"} selected={persona === item.id} onPress={() => choosePersona(item.id)} />)}</View></Reveal> : null}
          {((isReal && step === 7) || (!isReal && step === 4)) ? <Reveal><Text style={styles.title}>How might they respond?</Text><Text style={styles.lede}>Choose the closest response style for this rehearsal.</Text><View style={styles.pills}>{ONBOARDING_REACTIONS.map((item) => <Pill key={item.id} label={item.label} selected={reaction === item.id} onPress={() => chooseReaction(item.id)} />)}</View></Reveal> : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {showsFooter ? <BlurView intensity={Platform.OS === "web" ? 0 : 30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + 18 }]} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}><PrimaryButton label={building ? "Setting up your rehearsal…" : "Continue"} disabled={!canContinue || building} onPress={next} />{building ? <ActivityIndicator color={C.purple} style={styles.spinner} accessibilityLabel="Setting up your rehearsal" /> : null}</BlurView> : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function Choice({ title, note, selected, onPress }: { title: string; note?: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={title}><View style={[styles.choice, selected && styles.choiceOn]}><SelectionWipe selected={selected} /><View style={styles.choiceCopy}><Text style={[styles.choiceTitle, selected && styles.choiceTextOn]}>{title}</Text>{note ? <Text style={[styles.choiceNote, selected && styles.choiceTextOn]}>{note}</Text> : null}</View></View></PressCard>;
}

function ScenarioChoice({ context, title, preview, selected, onPress }: { context: string; title: string; preview: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={`${context}: ${title}. ${preview}`}><View style={[styles.scenarioChoice, selected && styles.choiceOn]}><SelectionWipe selected={selected} /><View style={styles.choiceCopy}><Text style={[styles.contextLabel, selected && styles.choiceTextOn]}>{context}</Text><Text style={[styles.choiceTitle, selected && styles.choiceTextOn]}>{title}</Text><Text style={[styles.choiceNote, selected && styles.choiceTextOn]}>{preview}</Text></View></View></PressCard>;
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={label}><View style={[styles.pill, selected && styles.pillOn]}><SelectionWipe selected={selected} /><Text style={[styles.pillText, selected && styles.choiceTextOn]}>{label}</Text></View></PressCard>;
}

function Input({ value, onChangeText, placeholder, maxLength = 500, accessibilityLabel }: { value: string; onChangeText: (value: string) => void; placeholder: string; maxLength?: number; accessibilityLabel: string }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.dim} multiline maxLength={maxLength} style={styles.input} textAlignVertical="top" accessibilityLabel={accessibilityLabel} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 }, openingTint: { ...StyleSheet.absoluteFillObject },
  header: { paddingHorizontal: GUTTER, paddingBottom: 14, gap: 10 }, headerRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backHit: { minWidth: 60, minHeight: 44, justifyContent: "center" }, backText: { fontFamily: font.semi, fontSize: 17, color: C.textSoft }, hidden: { color: "transparent" }, counter: { ...eyebrow, color: C.dim },
  track: { height: 3, borderRadius: 2, backgroundColor: C.line, overflow: "hidden" }, fill: { height: 3, backgroundColor: C.purple },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, openingScroll: { flexGrow: 1, justifyContent: "center" }, opening: { alignItems: "center", gap: 18, paddingHorizontal: 10 }, mark: { width: 180, height: 92, marginBottom: 12 }, openingTitle: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.7, color: C.text, textAlign: "center" }, openingBody: { ...T.body, color: C.textSoft, textAlign: "center", lineHeight: 27 }, openingButton: { width: "100%", marginTop: 18 }, title: { ...T.display }, lede: { ...T.body, color: C.textSoft, lineHeight: 27, marginTop: 12 }, options: { gap: 10, marginTop: 24 },
  choice: { minHeight: 70, flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow.layer }, scenarioChoice: { minHeight: 112, flexDirection: "row", alignItems: "center", padding: 16, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow.layer }, choiceOn: { borderColor: C.purple }, choiceCopy: { flex: 1, zIndex: 1, gap: 4 }, contextLabel: { ...eyebrow, color: C.purple }, choiceTitle: { fontFamily: font.semi, fontSize: 17, lineHeight: 23, color: C.text }, choiceNote: { ...T.caption }, choiceTextOn: { color: C.onAccent, zIndex: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 }, pill: { minHeight: 52, justifyContent: "center", paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: "hidden" }, pillOn: { borderColor: C.purple }, pillText: { fontFamily: font.semi, fontSize: 16, color: C.text, zIndex: 1 },
  ownLink: { minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 14, paddingHorizontal: 8 }, ownLinkText: { ...T.caption, color: C.purple, textAlign: "center", fontFamily: font.semi },
  input: { ...T.body, minHeight: 148, marginTop: 24, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, color: C.text, ...shadow.layer },
  error: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 18 }, footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.barEdge, backgroundColor: Platform.OS === "web" ? C.barSolid : C.bar }, spinner: { marginTop: 8 },
});
