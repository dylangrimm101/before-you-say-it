import { useRouter } from "expo-router";
import { ArrowRight, MessageCircleMore, Sparkles } from "lucide-react-native";
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GhostButton, HeroSurface, PrimaryButton, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { useStore } from "@/providers/store";

export default function EntryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { beginNativeJourney } = useStore();

  const start = useCallback(async (): Promise<void> => {
    await beginNativeJourney();
    router.replace("/onboarding");
  }, [beginNativeJourney, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.content, { paddingTop: insets.top + 42, paddingBottom: insets.bottom + 22 }]}>
        <Reveal>
          <View style={styles.mark}><MessageCircleMore size={27} color={C.onAccent} strokeWidth={1.8} /></View>
          <Eyebrow color={C.purple} style={styles.eyebrow}>Before You Say It</Eyebrow>
          <Text style={styles.title}>Practice the conversation before it happens.</Text>
          <Text style={styles.lede}>One private rehearsal. One moment to notice. One clear place to begin.</Text>
        </Reveal>

        <Reveal index={1} style={styles.heroWrap}>
          <HeroSurface style={styles.hero}>
            <View style={styles.heroTop}><Sparkles size={18} color="rgba(255,255,255,0.86)" /><Text style={styles.heroLabel}>YOUR FIRST REHEARSAL</Text></View>
            <Text style={styles.heroTitle}>Bring the conversation that is already on your mind.</Text>
            <View style={styles.heroRule} />
            <Text style={styles.heroBody}>No account required to start. You approve every word before feedback.</Text>
            <ArrowRight size={22} color={C.onAccent} style={styles.arrow} />
          </HeroSurface>
        </Reveal>

        <View style={styles.spacer} />
        <Reveal index={2}>
          <PrimaryButton label="Start my free rehearsal" onPress={start} />
          <GhostButton label="Sign in or continue from web" onPress={() => router.push("/continue-from-web")} style={styles.secondary} />
          <Text style={styles.trust}>Your free rehearsal stays on this device. Account continuation is not available in this build yet.</Text>
        </Reveal>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  content: { flex: 1, paddingHorizontal: GUTTER },
  mark: { width: 52, height: 52, borderRadius: 18, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
  eyebrow: { marginTop: 24 },
  title: { ...T.display, fontSize: 38, lineHeight: 43, letterSpacing: -1, marginTop: 10, maxWidth: 350 },
  lede: { ...T.body, color: C.textSoft, marginTop: 16, maxWidth: 330 },
  heroWrap: { marginTop: 30 },
  hero: { borderRadius: radius.lg },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  heroLabel: { fontFamily: font.semi, fontSize: 11, letterSpacing: 1.6, color: "rgba(255,255,255,0.76)" },
  heroTitle: { fontFamily: font.semi, fontSize: 22, lineHeight: 29, color: C.onAccent, marginTop: 18 },
  heroRule: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.24)", marginVertical: 18 },
  heroBody: { ...T.support, color: "rgba(255,255,255,0.82)", paddingRight: 28 },
  arrow: { alignSelf: "flex-end", marginTop: 12 },
  spacer: { flex: 1, minHeight: 24 },
  secondary: { marginTop: 10 },
  trust: { ...T.caption, textAlign: "center", marginTop: 12, paddingHorizontal: 10 },
});
