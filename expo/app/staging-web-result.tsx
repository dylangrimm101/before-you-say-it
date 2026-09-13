import React, { useEffect, useState } from "react";
import { AppState, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { PrivateWebResultPresentation } from "@/components/PrivateWebResultPresentation";
import { PrimaryButton } from "@/components/ui";
import { C, T, GUTTER } from "@/constants/theme";
import { useAuth } from "@/providers/auth";
import { AccountLogout } from "@/components/AccountLogout";
import { useStagingWebBridgeState } from "@/lib/useStagingWebBridgeState";
import type { StagingWebBridge } from "@/lib/stagingWebBridge";
import { useStore } from "@/providers/store";
import { nextLaunchDeck } from "@/lib/launchCurriculum";
import { useStagingPracticeAdmission } from "@/lib/useStagingPracticeAdmission";
import { StagingPracticeGate } from "@/components/StagingPracticeGate";

export default function StagingWebResultScreen() {
  const { stagingWebBridge, user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return <ScrollView contentContainerStyle={[styles.root, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
    <Text style={T.title}>Staging web result</Text>
    {!__DEV__ || !stagingWebBridge ? <Text style={T.body}>Web activation and result restoration are unavailable: no reviewed account endpoints are configured for this build. If you paid on the web, don’t purchase again.</Text>
      : !user ? <><Text style={T.body}>Log in to the verified account that owns your web purchase first.</Text><PrimaryButton label="Log in" onPress={() => router.replace("/continue-from-web")} /></>
        : <ResultControls key={user.id} bridge={stagingWebBridge} />}
    <AccountLogout />
    <PrimaryButton label="Back" onPress={() => router.canGoBack() ? router.back() : router.replace("/entry")} />
  </ScrollView>;
}
function ResultControls({ bridge }: { bridge: NonNullable<StagingWebBridge> }) {
  const state = useStagingWebBridgeState(bridge);
  const [token, setToken] = useState("");
  const { convertedLessonProgress, moduleCloseProgress, hydrated } = useStore();
  const router = useRouter();
  const admission = useStagingPracticeAdmission(false);
  const next = nextLaunchDeck(convertedLessonProgress, moduleCloseProgress);
  const continuePractice = async () => {
    if (!hydrated || !next || !admission.access) return;
    if (await admission.access.verify()) router.replace({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: next } });
  };
  useEffect(() => {
    const subscription = AppState.addEventListener("change", next => {
      if (next !== "active") { setToken(""); bridge.clear(); }
      else if (bridge.discoveryEnabled) void bridge.discover();
    });
    return () => { subscription.remove(); };
  }, [bridge]);
  const activate = () => { const value = token; setToken(""); void bridge.activate(value); };
  return <View style={styles.section}>
    <Text style={T.body}>Internal staging only. Activate a new purchase once; already-owned results are discovered automatically when configured. Nothing is imported into practice history.</Text>
    <TextInput accessibilityLabel="Staging activation token" secureTextEntry autoCapitalize="none" autoCorrect={false} value={token} onChangeText={setToken} style={styles.input} />
    <PrimaryButton label="Activate and restore" disabled={state.status === "loading" || !token} onPress={activate} />
    {bridge.discoveryEnabled ? <PrimaryButton label="Find my latest saved result" disabled={state.status === "loading"} onPress={() => { void bridge.discover(); }} /> : <Text>Automatic discovery is not deployed for this build. Activation remains available; no session ID entry is required here.</Text>}
    {state.status === "empty" ? <Text>No unexpired saved private result was found for this account. This does not establish purchase status. Don’t purchase again if you already paid on the web.</Text> : null}
    {state.status === "loading" ? <Text>Checking the current account…</Text> : null}
    {state.status === "unavailable" ? <Text accessibilityRole="alert">Couldn’t verify this result. Activation may have completed before a timeout. Do not retry a one-use token automatically; use “Find my latest saved result” when available or contact support. Don’t purchase again.</Text> : null}
    {state.status === "ready" ? <>
      <Text>{bridge.suppressPurchasePrompt() ? "Verified staging web subscription. No second purchase is needed. Practice access is checked separately with the server." : "Web subscription access is not currently verified. This saved result does not grant paid native access."}</Text>
      {state.record.privateResult ? <PrivateWebResultPresentation record={state.record.privateResult} Container={ResultSection} Text={ResultText} /> : <Text>No saved private result is available.</Text>}
      <Text>The saved recommendation above is unchanged. Continue with your next available lesson in the app’s launch curriculum; no completed practice or measured improvement is imported.</Text>
      {next ? <PrimaryButton label="Continue to next practice" disabled={!hydrated || !admission.access || admission.state.status === "checking"} onPress={() => { void continuePractice(); }} /> : <Text>You’ve reached the end of the current launch curriculum.</Text>}
      {!admission.access ? <Text>Server-paid practice verification is not configured for this build. Don’t purchase again.</Text> : admission.state.status === "denied" || admission.state.status === "unavailable" ? <StagingPracticeGate admission={admission} /> : null}
      <PrimaryButton label="Check web subscription again" onPress={() => { void bridge.restore(state.record.sessionId); }} />
      <PrimaryButton label="Clear saved result from this screen" onPress={bridge.clear} />
    </> : null}
  </View>;
}
function ResultSection({ children }: { children?: React.ReactNode }) { return <View style={styles.section}>{children}</View>; }
function ResultText({ children }: { children?: React.ReactNode }) { return <Text style={T.body}>{children}</Text>; }
const styles = StyleSheet.create({ root: { paddingHorizontal: GUTTER, gap: 20, backgroundColor: C.bg }, section: { gap: 14 }, input: { minHeight: 48, borderWidth: 1, borderColor: C.line, padding: 12, color: C.text } });
