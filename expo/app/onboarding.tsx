import { BlurView } from "expo-blur";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Keyboard, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, PressCard, PrimaryButton, Reveal, SelectionWipe, tap } from "@/components/ui";
import { DESIRED_SKILLS, RECURRING_PROBLEMS, type ModuleId, type OnboardingEntryRoute } from "@/constants/modules";
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
  { id: "recurring_problem", label: "The same communication problem keeps happening", note: "Start with the pattern, then test it in a conversation." },
  { id: "desired_skill", label: "I know what I want to get better at", note: "Choose the skill, then try it before we recommend a path." },
];

const REACTIONS: readonly { id: ReactionPattern; label: string }[] = [
  { id: "defensive", label: "Gets defensive" },
  { id: "hears-criticism", label: "Hears criticism" },
  { id: "minimizes", label: "Minimizes it" },
  { id: "quiet", label: "Goes quiet" },
  { id: "louder", label: "Gets louder" },
  { id: "turns-back", label: "Turns it back on me" },
  { id: "agrees-without-changing", label: "Agrees without changing" },
  { id: "not-sure", label: "I’m not sure" },
];

const DIFFICULTY: Difficulty = "steady";

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, saveProfile, addCustomScenario, anonymousUserId, saveActivePracticeSession } = useStore();
  const [step, setStep] = useState<number>(0);
  const [entryRoute, setEntryRoute] = useState<OnboardingEntryRoute | null>(null);
  const [provisionalModuleId, setProvisionalModuleId] = useState<ModuleId | null>(null);
  const [diagnosisLabel, setDiagnosisLabel] = useState<string>("");
  const [focus, setFocus] = useState<CategoryId | null>(null);
  const [persona, setPersona] = useState<PersonaVoice | null>(null);
  const [reaction, setReaction] = useState<ReactionPattern | null>(null);
  const [situation, setSituation] = useState<string>("");
  const [outcome, setOutcome] = useState<string>("");
  const [building, setBuilding] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [footerHeight, setFooterHeight] = useState<number>(96);

  const totalSteps = entryRoute === "real_conversation" ? 6 : 5;
  const diagnosisOptions = entryRoute === "desired_skill" ? DESIRED_SKILLS : RECURRING_PROBLEMS;

  const canContinue = useMemo((): boolean => {
    if (step === 0) return entryRoute !== null;
    if (entryRoute === "real_conversation") {
      if (step === 1) return situation.trim().length >= 8;
      if (step === 2) return focus !== null;
      if (step === 3) return persona !== null;
      if (step === 4) return reaction !== null;
      if (step === 5) return outcome.trim().length >= 3;
    } else {
      if (step === 1) return provisionalModuleId !== null;
      if (step === 2) return focus !== null;
      if (step === 3) return persona !== null;
      if (step === 4) return reaction !== null;
    }
    return false;
  }, [entryRoute, focus, outcome, persona, provisionalModuleId, reaction, situation, step]);

  const chooseEntry = useCallback((value: OnboardingEntryRoute): void => {
    tap("light");
    Keyboard.dismiss();
    setEntryRoute(value);
    setProvisionalModuleId(null);
    setDiagnosisLabel("");
    setStep(1);
  }, []);

  const finish = useCallback(async (): Promise<void> => {
    if (!entryRoute || !focus || !persona || !reaction || building) return;
    setBuilding(true);
    setError("");
    const body = entryRoute === "real_conversation" ? situation.trim() : diagnosisLabel;
    const goal = entryRoute === "real_conversation" ? outcome.trim() : "Practice this moment and see which skill should come first.";
    try {
      await saveProfile({
        focus,
        persona,
        reaction,
        outcome: goal,
        dread: body,
        pattern: "avoid",
        win: "heard",
        createdAt: Date.now(),
      });
      const form = { focus, persona, reaction, outcome: goal, difficulty: DIFFICULTY };
      let draft: Omit<Scenario, "id" | "isCustom">;
      try {
        draft = await buildCustomScenario(body, focus, form);
      } catch (caught) {
        safeLog("[onboarding] using rehearsal fallback", errorShape(caught));
        draft = fallbackCustomScenario(body, focus, form);
      }
      const scenario: Scenario = {
        ...draft,
        category: focus,
        id: `onboarding-${Date.now().toString(36)}`,
        isCustom: true,
      };
      await addCustomScenario(scenario);
      const practiceSessionId = createPracticeSessionId();
      await saveActivePracticeSession(createOnboardingPracticeSession(
        practiceSessionId,
        anonymousUserId,
        scenario,
        goal,
        reaction,
        Date.now(),
        {
          entryRoute,
          ...(provisionalModuleId ? { provisionalModuleId } : {}),
          persona,
        },
      ));
      tap("success");
      router.replace({
        pathname: "/safety-check",
        params: {
          id: scenario.id,
          difficulty: DIFFICULTY,
          reaction,
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
  }, [addCustomScenario, anonymousUserId, building, diagnosisLabel, entryRoute, focus, outcome, persona, provisionalModuleId, reaction, router, saveActivePracticeSession, saveProfile, situation]);

  const isLast = step === totalSteps - 1;
  const next = (): void => {
    if (!canContinue) return;
    Keyboard.dismiss();
    if (isLast) void finish();
    else setStep((value) => value + 1);
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => {
                Keyboard.dismiss();
                if (step === 0) {
                  if (profile) router.back();
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
        </View>

        <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: footerHeight + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" showsVerticalScrollIndicator={false}>
          {step === 0 ? (
            <Reveal>
              <Text style={styles.title}>What brought you here?</Text>
              <Text style={styles.lede}>Choose the closest answer. Every path includes a real rehearsal before any recommendation.</Text>
              <View style={styles.options}>
                {ENTRY_CHOICES.map((choice) => <Choice key={choice.id} title={choice.label} note={choice.note} selected={entryRoute === choice.id} onPress={() => chooseEntry(choice.id)} />)}
              </View>
            </Reveal>
          ) : null}

          {entryRoute === "real_conversation" && step === 1 ? (
            <Reveal><Text style={styles.title}>What conversation do you need to have?</Text><Text style={styles.lede}>No names or identifying details. Describe only what the rehearsal needs.</Text><Input value={situation} onChangeText={setSituation} placeholder="I need to ask my roommate to agree to a payment date." /></Reveal>
          ) : null}

          {entryRoute !== "real_conversation" && step === 1 ? (
            <Reveal><Text style={styles.title}>{entryRoute === "desired_skill" ? "What do you want to get better at?" : "What keeps happening?"}</Text><Text style={styles.lede}>This creates a starting hypothesis. Your spoken rehearsal can confirm or change it.</Text><View style={styles.options}>{diagnosisOptions.map((option) => <Choice key={option.label} title={option.label} selected={provisionalModuleId === option.moduleId} onPress={() => { setProvisionalModuleId(option.moduleId); setDiagnosisLabel(option.label); }} />)}</View></Reveal>
          ) : null}

          {((entryRoute === "real_conversation" && step === 2) || (entryRoute !== "real_conversation" && step === 2)) ? (
            <Reveal><Text style={styles.title}>Who is this conversation with?</Text><Text style={styles.lede}>Choose the context. It shapes the role, not a saved contact.</Text><View style={styles.pills}>{CATEGORIES.map((category) => <Pill key={category.id} label={category.label} selected={focus === category.id} onPress={() => setFocus(category.id)} />)}</View></Reveal>
          ) : null}

          {((entryRoute === "real_conversation" && step === 3) || (entryRoute !== "real_conversation" && step === 3)) ? (
            <Reveal><Text style={styles.title}>Choose the rehearsal voice</Text><Text style={styles.lede}>This selected counterpart stays with you for both replies. It is not the paid curriculum counterpart.</Text><View style={styles.options}>{PERSONAS.map((item) => <Choice key={item.id} title={item.id === "woman-hope" ? "Woman’s voice" : "Man’s voice"} note="Used by your contextual counterpart in the free rehearsal." selected={persona === item.id} onPress={() => setPersona(item.id)} />)}</View></Reveal>
          ) : null}

          {((entryRoute === "real_conversation" && step === 4) || (entryRoute !== "real_conversation" && step === 4)) ? (
            <Reveal><Text style={styles.title}>How might they respond?</Text><Text style={styles.lede}>Choose a response style for this private rehearsal.</Text><View style={styles.pills}>{REACTIONS.map((item) => <Pill key={item.id} label={item.label} selected={reaction === item.id} onPress={() => setReaction(item.id)} />)}</View></Reveal>
          ) : null}

          {entryRoute === "real_conversation" && step === 5 ? (
            <Reveal><Text style={styles.title}>What would be useful to leave with?</Text><Text style={styles.lede}>Name one outcome you can influence, not a prediction about the other person.</Text><Input value={outcome} onChangeText={setOutcome} placeholder="A clear request and a next step." maxLength={160} /></Reveal>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
        </ScrollView>

        {step > 0 ? (
          <BlurView intensity={Platform.OS === "web" ? 0 : 30} tint="light" style={[styles.footer, { paddingBottom: insets.bottom + 18 }]} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
            <PrimaryButton label={building ? "Setting up your rehearsal…" : isLast ? "Continue to private safety check" : "Continue"} disabled={!canContinue || building} onPress={next} />
            {building ? <ActivityIndicator color={C.purple} style={styles.spinner} /> : null}
          </BlurView>
        ) : null}
      </KeyboardAvoidingView>
    </View>
  );
}

function Choice({ title, note, selected, onPress }: { title: string; note?: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={title}><View style={[styles.choice, selected && styles.choiceOn]}><SelectionWipe selected={selected} /><View style={styles.choiceCopy}><Text style={[styles.choiceTitle, selected && styles.choiceTextOn]}>{title}</Text>{note ? <Text style={[styles.choiceNote, selected && styles.choiceTextOn]}>{note}</Text> : null}</View>{selected ? <Text style={styles.selected}>Selected</Text> : null}</View></PressCard>;
}

function Pill({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <PressCard onPress={onPress} accessibilityLabel={label}><View style={[styles.pill, selected && styles.pillOn]}><SelectionWipe selected={selected} /><Text style={[styles.pillText, selected && styles.choiceTextOn]}>{label}</Text></View></PressCard>;
}

function Input({ value, onChangeText, placeholder, maxLength = 500 }: { value: string; onChangeText: (value: string) => void; placeholder: string; maxLength?: number }) {
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.dim} multiline maxLength={maxLength} style={styles.input} textAlignVertical="top" />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, flex: { flex: 1 },
  header: { paddingHorizontal: GUTTER, paddingBottom: 14, gap: 10 }, headerRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, backHit: { minWidth: 60, minHeight: 44, justifyContent: "center" }, backText: { fontFamily: font.semi, fontSize: 17, color: C.textSoft }, hidden: { color: "transparent" }, counter: { ...eyebrow, color: C.dim },
  track: { height: 3, borderRadius: 2, backgroundColor: C.line, overflow: "hidden" }, fill: { height: 3, backgroundColor: C.purple },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display }, lede: { ...T.body, color: C.textSoft, lineHeight: 27, marginTop: 12 }, options: { gap: 10, marginTop: 24 },
  choice: { minHeight: 74, flexDirection: "row", alignItems: "center", gap: 12, padding: 17, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, borderRadius: radius.lg, overflow: "hidden", ...shadow.layer }, choiceOn: { borderColor: C.purple }, choiceCopy: { flex: 1, zIndex: 1, gap: 4 }, choiceTitle: { fontFamily: font.semi, fontSize: 17, lineHeight: 23, color: C.text }, choiceNote: { ...T.caption }, choiceTextOn: { color: C.onAccent, zIndex: 1 }, selected: { ...eyebrow, color: C.onAccent, zIndex: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 24 }, pill: { minHeight: 52, justifyContent: "center", paddingHorizontal: 20, borderRadius: radius.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.surface, overflow: "hidden" }, pillOn: { borderColor: C.purple }, pillText: { fontFamily: font.semi, fontSize: 16, color: C.text, zIndex: 1 },
  input: { ...T.body, minHeight: 180, marginTop: 24, padding: 18, borderRadius: radius.lg, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, color: C.text, ...shadow.layer },
  error: { ...T.caption, color: C.clay, textAlign: "center", marginTop: 18 }, footer: { paddingHorizontal: GUTTER, paddingTop: 12, borderTopWidth: 1, borderTopColor: C.barEdge, backgroundColor: Platform.OS === "web" ? C.barSolid : C.bar }, spinner: { marginTop: 8 },
});
