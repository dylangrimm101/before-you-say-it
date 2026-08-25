import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, Sparkles, X } from "lucide-react-native";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Backdrop,
  Eyebrow,
  PressCard,
  PrimaryButton,
  Reveal,
  StateDock,
  tap,
} from "@/components/ui";
import { CATEGORIES } from "@/constants/scenarios";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { buildCustomScenario } from "@/lib/ai";
import { errorShape, safeLog } from "@/lib/redact";
import { useKeyboardReveal } from "@/lib/useKeyboardReveal";
import { useStore } from "@/providers/store";
import type {
  CategoryId,
  Difficulty,
  OnboardingForm,
  PersonaVoice,
  ReactionPattern,
  Scenario,
} from "@/types/convo";

const EXAMPLES: string[] = [
  "I need to tell my mum she can't just show up at our flat anymore",
  "I have to tell my manager I'm at breaking point without sounding weak",
  "I want to ask my partner why they've stopped talking to me",
];

const REACTIONS: { id: ReactionPattern; label: string }[] = [
  { id: "defensive", label: "Gets defensive" },
  { id: "hears-criticism", label: "Hears criticism" },
  { id: "minimizes", label: "Minimizes it" },
  { id: "quiet", label: "Goes quiet" },
  { id: "louder", label: "Gets louder" },
  { id: "turns-back", label: "Turns it back on me" },
  { id: "agrees-without-changing", label: "Agrees without changing" },
  { id: "not-sure", label: "I’m not sure" },
];

const DIFFICULTIES: { id: Difficulty; label: string; note: string }[] = [
  { id: "gentle", label: "Gentle", note: "They listen, but they still feel" },
  { id: "steady", label: "Steady", note: "They deflect and push back" },
  { id: "challenging", label: "Challenging", note: "They escalate fast" },
];

export default function CustomScenario() {
  const params = useLocalSearchParams<{
    focus?: CategoryId;
    persona?: PersonaVoice;
    reaction?: ReactionPattern;
    challengeDay?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { profile, addCustomScenario, consent } = useStore();

  const [text, setText] = useState<string>(profile?.dread ?? "");
  const [category, setCategory] = useState<CategoryId>(
    (params.focus as CategoryId) ?? profile?.focus ?? "partner",
  );
  const [reaction, setReaction] = useState<ReactionPattern>(
    (params.reaction as ReactionPattern) ?? profile?.reaction ?? "not-sure",
  );
  const [outcome, setOutcome] = useState<string>(profile?.outcome ?? "");
  const [difficulty, setDifficulty] = useState<Difficulty>("steady");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [footerHeight, setFooterHeight] = useState<number>(96);

  const form = useCallback(
    (): Partial<OnboardingForm> => ({
      focus: category,
      persona: profile?.persona,
      reaction,
      outcome,
      difficulty,
    }),
    [category, profile?.persona, reaction, outcome, difficulty],
  );

  const build = useCallback(async (): Promise<void> => {
    const body = text.trim();
    if (body.length < 8) {
      setError("Give me a sentence or two so I can cast the other person.");
      return;
    }
    setError("");
    setBusy(true);
    tap("medium");
    try {
      const draft = await buildCustomScenario(body, category, form());
      const scenario: Scenario = {
        ...draft,
        category,
        id: `custom-${Date.now().toString(36)}`,
        isCustom: true,
      };
      await addCustomScenario(scenario);
      tap("success");
      router.replace({
        pathname: "/scenario/[id]",
        params: {
          id: scenario.id,
          level: difficulty,
          reaction,
          ...(params.challengeDay ? { challengeDay: params.challengeDay } : {}),
        },
      });
    } catch (caught) {
      safeLog("[custom] build failed", errorShape(caught));
      setBusy(false);
      setError("Couldn't build that one. Try rephrasing it and go again.");
    }
  }, [text, category, form, difficulty, reaction, addCustomScenario, router, params.challengeDay]);

  const { scrollRef, onScroll, trackFocus } = useKeyboardReveal();
  const textCard = useRef<View>(null);
  const outcomeCard = useRef<View>(null);

  return (
    <View style={styles.root}>
      <Backdrop />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeHit}
            accessibilityRole="button"
            accessibilityLabel="Close custom scenario"
          >
            <X size={22} color={C.textSoft} strokeWidth={1.8} />
          </Pressable>
          <Eyebrow style={styles.topLabel}>Private practice</Eyebrow>
          <View style={styles.closeHit} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scroll, { paddingBottom: footerHeight + 32 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScroll={onScroll}
        >
          <Reveal index={0} style={styles.introBlock}>
            <Text style={styles.display}>Build a rehearsal around the real thing.</Text>
            <Text style={styles.support}>
              Use ordinary language. Leave out names and details that could identify someone.
            </Text>
            <Text style={styles.privacyNote}>
              {consent.saveCustomScenarioText
                ? "Your description is saved on this device because you enabled that in Privacy & Data."
                : "Your description is used to build this rehearsal, then discarded instead of being saved on this device."}
            </Text>
          </Reveal>

          <Reveal index={1}>
            <Text style={styles.sectionLabel}>What do you need to talk about?</Text>
            <View ref={textCard} style={styles.inputCard}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder="Bedtime keeps defaulting to me, and I need us to share it."
                placeholderTextColor={C.dim}
                multiline
                maxLength={600}
                style={[styles.input, styles.situationInput]}
                editable={!busy}
                onFocus={() => trackFocus(textCard.current)}
              />
              <Text style={styles.counter}>{text.length} / 600</Text>
            </View>
          </Reveal>

          <Reveal index={2}>
            <Text style={styles.sectionLabel}>Who are you talking with?</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipScroller}
              contentContainerStyle={styles.chipRow}
            >
              {CATEGORIES.map((item) => {
                const isSelected = item.id === category;
                return (
                  <PressCard key={item.id} onPress={() => setCategory(item.id)}>
                    <View style={[styles.chip, isSelected && styles.chipSelected]}>
                      <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                        {item.label}
                      </Text>
                    </View>
                  </PressCard>
                );
              })}
            </ScrollView>
          </Reveal>

          <Reveal index={3}>
            <Text style={styles.sectionLabel}>How do they usually react?</Text>
            <View style={styles.reactionGrid}>
              {REACTIONS.map((item) => {
                const isSelected = item.id === reaction;
                return (
                  <PressCard
                    key={item.id}
                    onPress={() => setReaction(item.id)}
                    containerStyle={styles.reactionHit}
                  >
                    <View style={[styles.reactionChip, isSelected && styles.optionSelected]}>
                      <Text style={[styles.reactionText, isSelected && styles.optionTextSelected]}>
                        {item.label}
                      </Text>
                      {isSelected ? <Check size={16} color={C.purple} strokeWidth={2.2} /> : null}
                    </View>
                  </PressCard>
                );
              })}
            </View>
          </Reveal>

          <Reveal index={4}>
            <Text style={styles.sectionLabel}>What would a useful outcome be?</Text>
            <View ref={outcomeCard} style={styles.inputCard}>
              <TextInput
                value={outcome}
                onChangeText={setOutcome}
                placeholder="Agree on who handles bedtime each night."
                placeholderTextColor={C.dim}
                multiline
                maxLength={140}
                style={[styles.input, styles.outcomeInput]}
                editable={!busy}
                onFocus={() => trackFocus(outcomeCard.current)}
              />
              <Text style={styles.counter}>{outcome.length} / 140</Text>
            </View>
          </Reveal>

          <Reveal index={5}>
            <Text style={styles.sectionLabel}>Practice difficulty</Text>
            <View style={styles.diffCol}>
              {DIFFICULTIES.map((item) => {
                const isSelected = item.id === difficulty;
                return (
                  <PressCard key={item.id} onPress={() => setDifficulty(item.id)}>
                    <View style={[styles.difficulty, isSelected && styles.optionSelected]}>
                      <View style={styles.difficultyCopy}>
                        <Text style={[styles.difficultyTitle, isSelected && styles.optionTextSelected]}>
                          {item.label}
                        </Text>
                        <Text style={styles.difficultyNote}>{item.note}</Text>
                      </View>
                      {isSelected ? <Check size={18} color={C.purple} strokeWidth={2.2} /> : null}
                    </View>
                  </PressCard>
                );
              })}
            </View>
          </Reveal>

          <Reveal index={6}>
            <Text style={styles.sectionLabel}>Need a starting point?</Text>
            <View style={styles.examples}>
              {EXAMPLES.map((example) => (
                <PressCard key={example} onPress={() => setText(example)}>
                  <View style={styles.example}>
                    <Sparkles size={16} color={C.purple} strokeWidth={1.8} />
                    <Text style={styles.exampleText}>{example}</Text>
                  </View>
                </PressCard>
              ))}
            </View>
          </Reveal>

          {error.length > 0 ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}>
          <StateDock bottomInset={insets.bottom}>
            {busy ? (
              <View style={styles.busy}>
                <ActivityIndicator color={C.purple} />
                <View style={styles.busyCopy}>
                  <Text style={styles.busyTitle}>Building your rehearsal</Text>
                  <Text style={styles.busySupport}>Casting the counterpart and opening moment…</Text>
                </View>
              </View>
            ) : (
              <PrimaryButton label="Build the rehearsal" tone={C.purple} onPress={build} />
            )}
          </StateDock>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },
  topBar: {
    minHeight: 60,
    paddingHorizontal: GUTTER,
    paddingBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  closeHit: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  topLabel: { flex: 1, alignItems: "center" },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 16 },
  introBlock: { gap: 12, marginBottom: 8 },
  display: { ...T.display },
  support: { ...T.support },
  privacyNote: { ...T.caption },
  sectionLabel: { ...eyebrow, color: C.dim, marginTop: 32, marginBottom: 12 },
  inputCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surfaceHigh,
    padding: 18,
    ...shadow.layer,
  },
  input: { ...T.body, textAlignVertical: "top", padding: 0 },
  situationInput: { minHeight: 132 },
  outcomeInput: { minHeight: 82 },
  counter: { ...T.caption, alignSelf: "flex-end", marginTop: 8 },
  chipScroller: { marginHorizontal: -GUTTER },
  chipRow: { paddingHorizontal: GUTTER, gap: 8 },
  chip: {
    minHeight: 44,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chipSelected: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  chipText: { fontFamily: font.semi, fontSize: 13, color: C.textSoft },
  chipTextSelected: { color: C.purple },
  reactionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reactionHit: { width: "48.5%" },
  reactionChip: {
    minHeight: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  reactionText: { ...T.caption, flex: 1, fontFamily: font.medium, color: C.textSoft },
  optionSelected: { borderColor: C.purple, backgroundColor: C.surfaceHigh },
  optionTextSelected: { color: C.purple },
  diffCol: { gap: 10 },
  difficulty: {
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  difficultyCopy: { flex: 1, gap: 3 },
  difficultyTitle: { ...T.body, fontFamily: font.semi },
  difficultyNote: { ...T.caption },
  examples: { gap: 8 },
  example: {
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  exampleText: { ...T.support, flex: 1 },
  errorBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: `${C.clay}66`,
    backgroundColor: C.claySoft,
    padding: 14,
    marginTop: 18,
  },
  errorText: { ...T.caption, color: C.clay },
  busy: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 14 },
  busyCopy: { flex: 1, gap: 2 },
  busyTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  busySupport: { ...T.caption },
});
