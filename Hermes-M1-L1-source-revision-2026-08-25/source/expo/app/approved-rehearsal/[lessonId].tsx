import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScenarioPaidPractice } from "@/components/ScenarioPaidPractice";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { Backdrop, GlassCard, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { conversionRuntimeEnabled, isAcceptedM1L1ResumeRun, M1_L1_CONVERSION, routeForM1L1Safety, type SafetyChoice } from "@/lib/convertedLesson";
import { createScenarioPracticeRun, initializeM1L1Run } from "@/lib/scenarioPractice";
import { useStore } from "@/providers/store";

export default function ApprovedRehearsalRoute(): React.JSX.Element {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    activeScenarioRun,
    archiveActiveScenarioRunStrict,
    clearActiveScenarioRunStrict,
    replaceActiveScenarioRunStrict,
  } = useStore();
  const isAvailable = conversionRuntimeEnabled(params.lessonId);
  const run = activeScenarioRun?.run;
  const isAcceptedIdentity = isAcceptedM1L1ResumeRun(run);
  const resumable = isAvailable && isAcceptedIdentity && run?.state !== "complete";
  const hasConflict = isAvailable && Boolean(activeScenarioRun) && !resumable;
  const hasVersionMismatch = run?.practiceId === M1_L1_CONVERSION.practiceId && run.contentVersion !== M1_L1_CONVERSION.contentVersion;
  const [step, setStep] = useState<"conflict" | "safety" | "different-route" | "scene" | "runtime">(resumable ? "runtime" : hasConflict ? "conflict" : "safety");

  const createAcceptedRun = useCallback(async (): Promise<void> => {
    const created = initializeM1L1Run(
      createScenarioPracticeRun(M1_L1_CONVERSION.scenario, "steady", "defensive", `lesson-${M1_L1_CONVERSION.lessonId}-${Date.now().toString(36)}`),
      Date.now(),
    );
    const context = created.run.scenarioContext;
    if (!context) throw new Error("M1 L1 work context is unavailable");
    await replaceActiveScenarioRunStrict({
      ...created,
      run: {
        ...created.run,
        convertedModuleId: M1_L1_CONVERSION.moduleId,
        practiceId: M1_L1_CONVERSION.practiceId,
        contentVersion: M1_L1_CONVERSION.contentVersion,
        counterpartIdentity: M1_L1_CONVERSION.counterpartId,
        scenarioContext: {
          ...context,
          category: M1_L1_CONVERSION.context,
          counterpartId: M1_L1_CONVERSION.counterpartId,
          counterpartName: "Adam",
          counterpartLabel: M1_L1_CONVERSION.scenario.counterpart,
          counterpartRole: "your colleague",
        },
      },
    }, null);
    setStep("runtime");
  }, [replaceActiveScenarioRunStrict]);

  const startRuntime = useCallback(async (): Promise<void> => {
    if (!isAvailable) return;
    if (resumable) {
      setStep("runtime");
      return;
    }
    try {
      await createAcceptedRun();
    } catch {
      Alert.alert("We couldn’t start this rehearsal", "No existing rehearsal was overwritten. Try again.");
    }
  }, [createAcceptedRun, isAvailable, resumable]);

  const preserveAndRestart = useCallback(async (): Promise<void> => {
    try {
      const expected = activeRunRevision(activeScenarioRun);
      if (!expected) throw new Error("Active rehearsal is missing");
      await archiveActiveScenarioRunStrict(expected);
      setStep("safety");
    } catch {
      Alert.alert("We couldn’t preserve the saved rehearsal", "The existing rehearsal remains active. Nothing was overwritten.");
    }
  }, [activeScenarioRun, archiveActiveScenarioRunStrict]);

  const discardAndRestart = useCallback(async (): Promise<void> => {
    try {
      const expected = activeRunRevision(activeScenarioRun);
      if (!expected) throw new Error("Active rehearsal is missing");
      await clearActiveScenarioRunStrict(expected);
      setStep("safety");
    } catch {
      Alert.alert("We couldn’t delete the saved rehearsal", "It remains active on this device. Nothing new was started.");
    }
  }, [activeScenarioRun, clearActiveScenarioRunStrict]);

  const handleSafetyChoice = useCallback((choice: SafetyChoice): void => {
    setStep(routeForM1L1Safety(choice));
  }, []);

  const runtimeKey = useMemo(() => activeScenarioRun?.run.id ?? "new-run", [activeScenarioRun?.run.id]);

  if (!isAvailable) return <Unavailable />;
  if (step === "runtime" && activeScenarioRun?.run.id) {
    return <ScenarioPaidPractice
      key={runtimeKey}
      scenario={M1_L1_CONVERSION.scenario}
      requestedRunId={activeScenarioRun.run.id}
      convertedLesson={M1_L1_CONVERSION}
      onReturnToDeck={(runId) => router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: M1_L1_CONVERSION.lessonId, returnFromRehearsal: "1", runId } })}
      onDiscard={async () => { const expected = activeRunRevision(activeScenarioRun); if (!expected) throw new Error("Active rehearsal is missing"); await clearActiveScenarioRunStrict(expected); router.back(); }}
      onSafetyExit={() => setStep("different-route")}
    />;
  }

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}><Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to lesson"><ArrowLeft size={21} color={C.text} /></Pressable><Text style={styles.headerTitle}>Internal M1 L1 rehearsal QA</Text><View style={styles.back} /></View>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
      {step === "conflict" ? <GlassCard style={styles.card}>
        <Text style={styles.eyebrow}>{hasVersionMismatch ? "CONTENT UPDATED" : "SAVED REHEARSAL FOUND"}</Text>
        <Text style={styles.title}>{hasVersionMismatch ? "Start the accepted version without mixing content." : "Choose what happens to the existing rehearsal."}</Text>
        <Text style={styles.body}>{hasVersionMismatch ? "The old run can be preserved, but its pressure and rubric cannot be combined with this version." : "A different practice is active. It will never be overwritten silently."}</Text>
        <PrimaryButton label="Preserve it and start M1 L1" onPress={() => void preserveAndRestart()} containerStyle={styles.action} />
        <Choice label="Resume the existing rehearsal" onPress={() => run?.scenarioContext?.scenarioId ? router.push({ pathname: "/rehearse/[id]", params: { id: run.scenarioContext.scenarioId, scenarioRunId: run.id } }) : router.back()} />
        <Choice label="Save and leave" onPress={() => router.back()} />
        <Choice label="Discard it, then start M1 L1" onPress={() => void discardAndRestart()} />
      </GlassCard> : step === "safety" ? <GlassCard style={styles.card}>
        <Text style={styles.eyebrow}>BEFORE YOU PRACTICE</Text><Text style={styles.title}>Is there any reason bringing this up directly could put you at risk, lead to retaliation, or make the situation less safe?</Text>
        <Choice label="No. Direct conversation feels appropriate." onPress={() => handleSafetyChoice("direct")} />
        <Choice label="I'm not sure." onPress={() => handleSafetyChoice("unsure")} />
        <Choice label="Yes." onPress={() => handleSafetyChoice("yes")} />
        <Choice label="I'd rather not answer." onPress={() => handleSafetyChoice("prefer_not")} />
      </GlassCard> : step === "different-route" ? <GlassCard style={styles.card}>
        <ShieldCheck size={28} color={C.sage} /><Text style={styles.eyebrow}>A DIFFERENT ROUTE MAY FIT BETTER</Text><Text style={styles.title}>You do not have to practice a direct conversation first.</Text><Text style={styles.body}>You can review support, documentation, reporting, or safety options instead. Your answer was not stored.</Text><PrimaryButton label="See other options" onPress={() => router.push("/safety")} containerStyle={styles.action} /><Choice label="Return to the lesson" onPress={() => router.back()} /><Choice label="Leave this practice" onPress={() => router.replace("/(tabs)")} />
      </GlassCard> : <GlassCard style={styles.card}>
        <Text style={styles.eyebrow}>THE WORK SCENE</Text><Text style={styles.title}>{M1_L1_CONVERSION.title}</Text><Text style={styles.body}>{M1_L1_CONVERSION.scenario.situation}</Text><View style={styles.sceneInset}><Text style={styles.sceneLabel}>WHAT HAPPENS</Text><Text style={styles.body}>You open. Adam, your colleague, uses two authored pressure turns. Hope coaches one observed Point → Proof → Move behavior, then replays only that exact moment.</Text></View><PrimaryButton label="Start rehearsal" onPress={() => void startRuntime()} containerStyle={styles.action} /><Choice label="Not now" onPress={() => router.back()} />
      </GlassCard>}
    </ScrollView>
  </View>;
}

function Choice({ label, onPress }: { label: string; onPress: () => void }): React.JSX.Element {
  return <Pressable onPress={onPress} style={styles.choice} accessibilityRole="button"><Text style={styles.choiceText}>{label}</Text></Pressable>;
}

function Unavailable(): React.JSX.Element {
  return <View style={[styles.root, styles.unavailable]}><ShieldCheck size={30} color={C.sage} /><Text style={styles.title}>This rehearsal is unavailable.</Text><Text style={styles.body}>The converted lesson runtime is restricted to internal development QA.</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER }, header: { minHeight: 68, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 16, color: C.text }, scroll: { paddingHorizontal: GUTTER, paddingTop: 16 }, card: { padding: 20, gap: 14 }, eyebrow: { ...eyebrow, color: C.purple }, title: { ...T.title }, body: { ...T.support }, action: { marginTop: 4 }, choice: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceHigh, paddingHorizontal: 16, justifyContent: "center" }, choiceText: { ...T.support, color: C.text, fontFamily: font.medium }, sceneInset: { padding: 16, borderRadius: radius.md, backgroundColor: C.purpleSoft, gap: 7 }, sceneLabel: { ...eyebrow, color: C.purple },
});
