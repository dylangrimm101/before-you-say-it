import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Backdrop, GhostButton, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font } from "@/constants/theme";
import { useStore } from "@/providers/store";
import { useAuth } from "@/providers/auth";
import { AccountLogout } from "@/components/AccountLogout";

function ConversationMark(): React.JSX.Element {
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

export default function EntryScreen(): React.JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { beginNativeJourney, activePracticeSession } = useStore();
  const { startNativeSession, isAuthLoading, session } = useAuth();
  const [isStarting, setIsStarting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const starting = useRef(false);

  const signUp = useCallback(async (): Promise<void> => {
    if (starting.current || isAuthLoading) return;
    starting.current = true;
    setIsStarting(true);
    setAuthError(null);
    try {
      if (activePracticeSession?.userId && activePracticeSession.userId !== session?.user.id) {
        setAuthError("This device has account-owned practice. Log in to that account to continue.");
        return;
      }
      if (!session) {
        router.push({ pathname: "/continue-from-web", params: { mode: "signup" } });
        return;
      }
      const result = await startNativeSession();
      if (!result.success) {
        setAuthError(result.message);
        return;
      }
      await beginNativeJourney();
      router.replace("/onboarding");
    } catch {
      setAuthError("We couldn’t start your practice. Please try again.");
    } finally {
      starting.current = false;
      setIsStarting(false);
    }
  }, [beginNativeJourney, router, startNativeSession, isAuthLoading, activePracticeSession, session]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Reveal style={styles.content}>
          <ConversationMark />
          <Text style={styles.title}>Build the qualities of world-class communicators.</Text>
          <Text style={styles.body}>Learn to communicate with Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.</Text>
          <View style={styles.actions}>
            <PrimaryButton label="Sign up now" onPress={signUp} disabled={isAuthLoading || isStarting} />
            {isStarting ? <Text style={styles.accountNote} accessibilityLiveRegion="polite">Setting up…</Text> : null}
            <GhostButton label="Log in" disabled={isStarting} onPress={() => router.push("/continue-from-web")} />
            {authError ? <Text style={styles.accountNote} accessibilityRole="alert" accessibilityLiveRegion="polite">{authError}</Text> : null}
            <AccountLogout />
          </View>
          <Text style={styles.accountNote}>Already have an account? Log in with your password. Web purchases can’t be activated in this build. Don’t purchase again if you already paid on the web.</Text>
        </Reveal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: "center", paddingHorizontal: GUTTER },
  content: { alignItems: "center", paddingHorizontal: 10 },
  mark: { width: 180, height: 92, marginBottom: 38 },
  title: { fontFamily: font.bold, fontSize: 32, lineHeight: 38, letterSpacing: -0.7, color: C.text, textAlign: "center" },
  body: { ...T.body, color: C.textSoft, textAlign: "center", lineHeight: 27, marginTop: 18 },
  actions: { width: "100%", gap: 10, marginTop: 42 },
  accountNote: { ...T.caption, textAlign: "center", marginTop: 14, paddingHorizontal: 12 },
});
