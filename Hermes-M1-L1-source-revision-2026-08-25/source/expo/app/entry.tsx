import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { Backdrop, GhostButton, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font } from "@/constants/theme";
import { useStore } from "@/providers/store";

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
  const { beginNativeJourney } = useStore();

  const signUp = useCallback(async (): Promise<void> => {
    await beginNativeJourney();
    router.replace("/onboarding");
  }, [beginNativeJourney, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 34, paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
        <Reveal style={styles.content}>
          <ConversationMark />
          <Text style={styles.title}>Build the qualities of world-class communicators.</Text>
          <Text style={styles.body}>Learn to communicate with Obama’s clarity, Oprah’s connection, Jobs’ storytelling, and Voss’s calm under pressure.</Text>
          <View style={styles.actions}>
            <PrimaryButton label="Sign up now" onPress={signUp} />
            <GhostButton label="Log in" onPress={() => router.push("/continue-from-web")} />
          </View>
          <Text style={styles.accountNote}>Already have an account or paid on the web? Log in to connect your access.</Text>
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
