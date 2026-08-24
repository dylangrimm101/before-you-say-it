import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScenarioPaidPractice } from "@/components/ScenarioPaidPractice";
import { Backdrop, GlassCard, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { conversionRuntimeEnabled, M1_L1_CONVERSION } from "@/lib/convertedLesson";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import { useStore } from "@/providers/store";

export default function ApprovedRehearsalRoute(): React.JSX.Element {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activeScenarioRun, saveActiveScenarioRun } = useStore();
  const isAvailable = conversionRuntimeEnabled(params.lessonId);
  const resumable = isAvailable
    && activeScenarioRun?.run.practiceId === M1_L1_CONVERSION.practiceId
    && activeScenarioRun.run.contentVersion === M1_L1_CONVERSION.contentVersion
    && activeScenarioRun.run.state !== "complete";
  const hasVersionMismatch = isAvailable
    && activeScenarioRun?.run.practiceId === M1_L1_CONVERSION.practiceId
    && activeScenarioRun.run.contentVersion !== M1_L1_CONVERSION.contentVersion;
  const [step, setStep] = useState<"safety" | "different-route" | "scene" | "runtime">(resumable ? "runtime" : "safety");

  const startRuntime = useCallback(async (): Promise<void> => {
    if (!isAvailable) return;
    if (!resumable) {
      const created = createScenarioPracticeRun(M1_L1_CONVERSION.scenario, "steady", "defensive", `lesson-${M1_L1_CONVERSION.lessonId}-${Date.now().toString(36)}`);
      await saveActiveScenarioRun({
        ...created,
        run: {
          ...created.run,
          moduleId: "get_to_the_point",
          practiceId: M1_L1_CONVERSION.practiceId,
          contentVersion: M1_L1_CONVERSION.contentVersion,
        },
      });
    }
    setStep("runtime");
  }, [isAvailable, resumable, saveActiveScenarioRun]);

  const runtimeKey = useMemo(() => activeScenarioRun?.run.id ?? "new-run", [activeScenarioRun?.run.id]);

  if (!isAvailable) return <Unavailable />;
  if (step === "runtime") {
    return (
      <ScenarioPaidPractice
        key={runtimeKey}
        scenario={M1_L1_CONVERSION.scenario}
        requestedRunId={activeScenarioRun?.run.id}
        convertedLesson={M1_L1_CONVERSION}
        onReturnToDeck={() => router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: M1_L1_CONVERSION.lessonId, returnFromRehearsal: "1" } })}
        onDiscard={async () => { await saveActiveScenarioRun(null); router.back(); }}
        onSafetyExit={() => setStep("different-route")}
      />
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to lesson">
          <ArrowLeft size={21} color={C.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Internal rehearsal QA</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]} showsVerticalScrollIndicator={false}>
        {hasVersionMismatch ? (
          <GlassCard style={styles.card}>
            <Text style={styles.eyebrow}>CONTENT UPDATED</Text>
            <Text style={styles.title}>Restart on the current lesson version.</Text>
            <Text style={styles.body}>This saved rehearsal belongs to different lesson content. It will not be combined with the current pressure turn or coaching rule.</Text>
            <PrimaryButton label="Discard old run and restart" onPress={async () => { await saveActiveScenarioRun(null); setStep("safety"); }} containerStyle={styles.action} />
          </GlassCard>
        ) : step === "safety" ? (
          <GlassCard style={styles.card}>
            <Text style={styles.eyebrow}>BEFORE YOU PRACTICE</Text>
            <Text style={styles.title}>Is there any reason bringing this up directly could put you at risk, lead to retaliation, or make the situation less safe?</Text>
            <Choice label="No. Direct conversation feels appropriate." onPress={() => setStep("scene")} />
            <Choice label="I'm not sure." onPress={() => setStep("different-route")} />
            <Choice label="Yes." onPress={() => setStep("different-route")} />
            <Choice label="I'd rather not answer." onPress={() => router.back()} />
          </GlassCard>
        ) : step === "different-route" ? (
          <GlassCard style={styles.card}>
            <ShieldCheck size={28} color={C.sage} />
            <Text style={styles.eyebrow}>A DIFFERENT ROUTE MAY FIT BETTER</Text>
            <Text style={styles.title}>You do not have to practice a direct conversation first.</Text>
            <Text style={styles.body}>You can review support, documentation, reporting, or safety options instead.</Text>
            <PrimaryButton label="See other options" onPress={() => router.push("/safety")} containerStyle={styles.action} />
            <Choice label="Return to the lesson" onPress={() => router.back()} />
            <Choice label="Leave this practice" onPress={() => router.replace("/(tabs)")} />
          </GlassCard>
        ) : (
          <GlassCard style={styles.card}>
            <Text style={styles.eyebrow}>THE SCENE</Text>
            <Text style={styles.title}>{M1_L1_CONVERSION.title}</Text>
            <Text style={styles.body}>Sunday evening, kitchen. Dishes done, kid finally asleep. You’ve wanted to say this for two weeks. Your partner is on the couch, half looking at their phone. Not hostile. Tired.</Text>
            <View style={styles.sceneInset}>
              <Text style={styles.sceneLabel}>WHAT HAPPENS</Text>
              <Text style={styles.body}>You open. Adam pushes back twice. The second one is “You’re acting like this happens all the time.” Then Hope names one change and hands the same moment back to you.</Text>
            </View>
            <PrimaryButton label="Start rehearsal" onPress={() => void startRuntime()} containerStyle={styles.action} />
            <Choice label="Not now" onPress={() => router.back()} />
          </GlassCard>
        )}
      </ScrollView>
    </View>
  );
}

function Choice({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return <Pressable onPress={onPress} style={styles.choice} accessibilityRole="button"><Text style={styles.choiceText}>{label}</Text></Pressable>;
}

function Unavailable(): React.JSX.Element {
  return <View style={[styles.root, styles.unavailable]}><ShieldCheck size={30} color={C.sage} /><Text style={styles.title}>This rehearsal is unavailable.</Text><Text style={styles.body}>The converted lesson runtime is restricted to internal development QA.</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  header: { minHeight: 68, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 16, color: C.text },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 16 }, card: { padding: 20, gap: 14 }, eyebrow: { ...eyebrow, color: C.purple }, title: { ...T.title }, body: { ...T.support }, action: { marginTop: 4 },
  choice: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceHigh, paddingHorizontal: 16, justifyContent: "center" }, choiceText: { ...T.support, color: C.text, fontFamily: font.medium },
  sceneInset: { padding: 16, borderRadius: radius.md, backgroundColor: C.purpleSoft, gap: 7 }, sceneLabel: { ...eyebrow, color: C.purple },
});
