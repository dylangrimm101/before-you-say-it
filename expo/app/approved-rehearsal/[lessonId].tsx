import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScenarioPaidPractice } from "@/components/ScenarioPaidPractice";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { Backdrop, GlassCard, PrimaryButton } from "@/components/ui";
import { C, GUTTER, T, eyebrow, font, radius } from "@/constants/theme";
import { approvedRehearsalConfig, approvedRehearsalRuntimeEnabled } from "@/lib/approvedRehearsals";
import { conversionRuntimeEnabled, isAcceptedM1L1ResumeRun, M1_L1_CONVERSION } from "@/lib/convertedLesson";
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
  const isM1L1 = conversionRuntimeEnabled(params.lessonId);
  const approvedConfig = approvedRehearsalConfig(params.lessonId);
  const isAvailable = isM1L1 || approvedRehearsalRuntimeEnabled(params.lessonId);
  const config = isM1L1 ? M1_L1_CONVERSION : approvedConfig;
  const run = activeScenarioRun?.run;
  const isAcceptedIdentity = isM1L1
    ? isAcceptedM1L1ResumeRun(run)
    : Boolean(config && run
      && run.convertedModuleId === config.moduleId
      && run.practiceId === config.practiceId
      && run.contentVersion === config.contentVersion
      && run.scenarioContext?.scenarioId === config.scenario.id
      && run.scenarioContext.counterpartId === config.counterpartId
      && run.counterpartIdentity === config.counterpartId);
  const resumable = isAvailable && isAcceptedIdentity && run?.state !== "complete";
  const hasConflict = isAvailable && Boolean(activeScenarioRun) && !resumable;
  const preservationStarted = useRef<boolean>(false);
  const [step, setStep] = useState<"preserving" | "different-route" | "scene" | "runtime">(resumable ? "runtime" : hasConflict ? "preserving" : "scene");

  const createAcceptedRun = useCallback(async (): Promise<void> => {
    if (!config) throw new Error("Approved rehearsal config is unavailable");
    const base = createScenarioPracticeRun(config.scenario, "steady", "defensive", `lesson-${config.lessonId}-${Date.now().toString(36)}`);
    const created = isM1L1 ? initializeM1L1Run(base, Date.now()) : base;
    const context = created.run.scenarioContext;
    if (!context) throw new Error("Approved rehearsal context is unavailable");
    await replaceActiveScenarioRunStrict({
      ...created,
      run: {
        ...created.run,
        convertedModuleId: config.moduleId,
        practiceId: config.practiceId,
        contentVersion: config.contentVersion,
        counterpartIdentity: config.counterpartId,
        scenarioContext: {
          ...context,
          counterpartId: config.counterpartId,
          ...(isM1L1 ? {
            category: M1_L1_CONVERSION.context,
            counterpartName: "Adam",
            counterpartLabel: M1_L1_CONVERSION.scenario.counterpart,
            counterpartRole: "your colleague",
          } : {}),
        },
      },
    }, null);
    setStep("runtime");
  }, [config, isM1L1, replaceActiveScenarioRunStrict]);

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

  useEffect(() => {
    if (step !== "preserving" || preservationStarted.current) return;
    preservationStarted.current = true;
    const preserveAndContinue = async (): Promise<void> => {
      try {
        const expected = activeRunRevision(activeScenarioRun);
        if (!expected) throw new Error("Active rehearsal is missing");
        await archiveActiveScenarioRunStrict(expected);
        setStep("scene");
      } catch {
        Alert.alert("We couldn’t preserve the saved rehearsal", "The existing rehearsal remains active. Nothing was overwritten.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    };
    void preserveAndContinue();
  }, [activeScenarioRun, archiveActiveScenarioRunStrict, router, step]);

  const runtimeKey = useMemo(() => activeScenarioRun?.run.id ?? "new-run", [activeScenarioRun?.run.id]);

  if (!isAvailable) return <Unavailable />;
  if (step === "preserving") {
    return <View style={[styles.root, styles.preserving]}><Backdrop /><ActivityIndicator size="small" color={C.purple} accessibilityLabel="Saving existing rehearsal" /></View>;
  }
  if (step === "runtime" && activeScenarioRun?.run.id) {
    return <ScenarioPaidPractice
      key={runtimeKey}
      scenario={config!.scenario}
      requestedRunId={activeScenarioRun.run.id}
      {...(isM1L1 ? { convertedLesson: M1_L1_CONVERSION } : { approvedRehearsal: approvedConfig! })}
      onReturnToDeck={(runId) => router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: config!.lessonId, returnFromRehearsal: "1", runId } })}
      onDiscard={async () => { const expected = activeRunRevision(activeScenarioRun); if (!expected) throw new Error("Active rehearsal is missing"); await clearActiveScenarioRunStrict(expected); router.back(); }}
      onSafetyExit={() => setStep("different-route")}
    />;
  }

  return <View style={styles.root}><Backdrop />
    <View style={[styles.header, { paddingTop: insets.top + 8 }]}><Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to lesson"><ArrowLeft size={21} color={C.text} /></Pressable><Text style={styles.headerTitle}>Internal {config?.lessonId.toUpperCase()} rehearsal QA</Text><View style={styles.back} /></View>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 30 }]}>
      {step === "different-route" ? <GlassCard style={styles.card}>
        <ShieldCheck size={28} color={C.sage} /><Text style={styles.eyebrow}>A DIFFERENT ROUTE MAY FIT BETTER</Text><Text style={styles.title}>You do not have to practice a direct conversation first.</Text><Text style={styles.body}>You can review support, documentation, reporting, or safety options instead. Your answer was not stored.</Text><PrimaryButton label="See other options" onPress={() => router.push("/safety")} containerStyle={styles.action} /><Choice label="Return to the lesson" onPress={() => router.back()} /><Choice label="Leave this practice" onPress={() => router.replace("/(tabs)")} />
      </GlassCard> : <GlassCard style={styles.card}>
        <Text style={styles.eyebrow}>THE {config?.scenario.category.toUpperCase()} SCENE</Text><Text style={styles.title}>{config?.scenario.title}</Text><Text style={styles.body}>{config?.scenario.situation}</Text><View style={styles.sceneInset}><Text style={styles.sceneLabel}>WHAT HAPPENS</Text><Text style={styles.body}>{isM1L1 ? "You open. Adam, your colleague, uses two authored pressure turns. Hope coaches one observed Point → Proof → Move behavior, then replays only that exact moment." : `You open. ${config?.scenario.counterpart} uses the deck’s exact authored pressure. Hope checks only “${approvedConfig?.namedMove},” then gives you the same moment to retry.`}</Text></View><PrimaryButton label="Start rehearsal" onPress={() => void startRuntime()} containerStyle={styles.action} /><Choice label="Not now" onPress={() => router.back()} />
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
  root: { flex: 1, backgroundColor: C.bg }, preserving: { alignItems: "center", justifyContent: "center" }, unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER }, header: { minHeight: 68, paddingHorizontal: GUTTER, paddingBottom: 8, flexDirection: "row", alignItems: "center" }, back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, headerTitle: { flex: 1, textAlign: "center", fontFamily: font.bold, fontSize: 16, color: C.text }, scroll: { paddingHorizontal: GUTTER, paddingTop: 16 }, card: { padding: 20, gap: 14 }, eyebrow: { ...eyebrow, color: C.purple }, title: { ...T.title }, body: { ...T.support }, action: { marginTop: 4 }, choice: { minHeight: 52, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: C.surfaceHigh, paddingHorizontal: 16, justifyContent: "center" }, choiceText: { ...T.support, color: C.text, fontFamily: font.medium }, sceneInset: { padding: 16, borderRadius: radius.md, backgroundColor: C.purpleSoft, gap: 7 }, sceneLabel: { ...eyebrow, color: C.purple },
});
