import { useLocalSearchParams, useRouter } from "expo-router";
import { ShieldCheck } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, View } from "react-native";

import { ScenarioPaidPractice } from "@/components/ScenarioPaidPractice";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import { Backdrop } from "@/components/ui";
import { C, GUTTER, T } from "@/constants/theme";
import { approvedRehearsalConfig, approvedRehearsalRuntimeEnabled } from "@/lib/approvedRehearsals";
import { conversionRuntimeEnabled, isAcceptedM1L1ResumeRun, M1_L1_CONVERSION } from "@/lib/convertedLesson";
import { createScenarioPracticeRun, initializeApprovedRehearsalRun, initializeM1L1Run } from "@/lib/scenarioPractice";
import { useStore } from "@/providers/store";

export default function ApprovedRehearsalRoute(): React.JSX.Element {
  const params = useLocalSearchParams<{ lessonId?: string }>();
  const router = useRouter();
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
      && run.counterpartIdentity === config.counterpartId
      && Boolean(run.approvedRehearsal));
  const resumable = isAvailable && isAcceptedIdentity && run?.state !== "complete";
  const hasConflict = isAvailable && Boolean(activeScenarioRun) && !resumable;
  const preservationStarted = useRef<boolean>(false);
  const startupStarted = useRef<boolean>(false);
  const [step, setStep] = useState<"preserving" | "starting" | "runtime">(resumable ? "runtime" : hasConflict ? "preserving" : "starting");

  const createAcceptedRun = useCallback(async (): Promise<void> => {
    if (!config) throw new Error("Approved rehearsal config is unavailable");
    const base = createScenarioPracticeRun(config.scenario, "steady", "defensive", `lesson-${config.lessonId}-${Date.now().toString(36)}`);
    const created = isM1L1 ? initializeM1L1Run(base, Date.now()) : initializeApprovedRehearsalRun(base, Date.now());
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
      Alert.alert("We couldn’t start this rehearsal", "No existing rehearsal was overwritten.", [
        { text: "Back", style: "cancel", onPress: () => router.back() },
        { text: "Try again", onPress: () => router.replace({ pathname: "/approved-rehearsal/[lessonId]", params: { lessonId: config?.lessonId ?? "" } }) },
      ]);
    }
  }, [config?.lessonId, createAcceptedRun, isAvailable, resumable, router]);

  useEffect(() => {
    if (step !== "preserving" || preservationStarted.current) return;
    preservationStarted.current = true;
    const preserveAndContinue = async (): Promise<void> => {
      try {
        const expected = activeRunRevision(activeScenarioRun);
        if (!expected) throw new Error("Active rehearsal is missing");
        await archiveActiveScenarioRunStrict(expected);
        setStep("starting");
      } catch {
        Alert.alert("We couldn’t preserve the saved rehearsal", "The existing rehearsal remains active. Nothing was overwritten.", [
          { text: "OK", onPress: () => router.back() },
        ]);
      }
    };
    void preserveAndContinue();
  }, [activeScenarioRun, archiveActiveScenarioRunStrict, router, step]);

  useEffect(() => {
    if (step !== "starting" || startupStarted.current) return;
    startupStarted.current = true;
    void startRuntime();
  }, [startRuntime, step]);

  const runtimeKey = useMemo(() => activeScenarioRun?.run.id ?? "new-run", [activeScenarioRun?.run.id]);

  if (!isAvailable) return <Unavailable />;
  if (step === "preserving" || step === "starting") {
    const loadingLabel = step === "preserving" ? "Saving existing rehearsal" : "Starting rehearsal";
    return <View style={[styles.root, styles.loading]}><Backdrop /><ActivityIndicator size="small" color={C.purple} accessibilityLabel={loadingLabel} /></View>;
  }
  if (step === "runtime" && activeScenarioRun?.run.id) {
    return <ScenarioPaidPractice
      key={runtimeKey}
      scenario={config!.scenario}
      requestedRunId={activeScenarioRun.run.id}
      {...(isM1L1 ? { convertedLesson: M1_L1_CONVERSION } : { approvedRehearsal: approvedConfig! })}
      onReturnToDeck={(runId) => router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: config!.lessonId, returnFromRehearsal: "1", runId } })}
      onDiscard={async () => { const expected = activeRunRevision(activeScenarioRun); if (!expected) throw new Error("Active rehearsal is missing"); await clearActiveScenarioRunStrict(expected); router.back(); }}
    />;
  }

  return <View style={[styles.root, styles.loading]}><Backdrop /><ActivityIndicator size="small" color={C.purple} accessibilityLabel="Starting rehearsal" /></View>;
}

function Unavailable(): React.JSX.Element {
  return <View style={[styles.root, styles.unavailable]}><ShieldCheck size={30} color={C.sage} /><Text style={styles.title}>This rehearsal is unavailable.</Text><Text style={styles.body}>The converted lesson runtime is restricted to internal development QA.</Text></View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, loading: { alignItems: "center", justifyContent: "center" }, unavailable: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER }, title: { ...T.title }, body: { ...T.support },
});
