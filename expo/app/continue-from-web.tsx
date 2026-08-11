import { useRouter } from "expo-router";
import { ArrowLeft, CloudOff, LockKeyhole } from "lucide-react-native";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GhostButton, GlassCard, PressCard, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius } from "@/constants/theme";

export default function ContinueFromWebScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.content, { paddingTop: insets.top + 10, paddingBottom: insets.bottom + 22 }]}>
        <PressCard onPress={() => router.back()} style={styles.back} accessibilityLabel="Back"><ArrowLeft size={21} color={C.textSoft} /></PressCard>
        <Reveal>
          <Eyebrow color={C.purple}>Account continuation</Eyebrow>
          <Text style={styles.title}>Continue from web is not connected yet.</Text>
          <Text style={styles.lede}>Authentication and verified web-to-app activation will arrive in a separate phase. This build will not accept a code or pretend an account is connected.</Text>
        </Reveal>
        <Reveal index={1}>
          <GlassCard style={styles.card}>
            <View style={styles.icon}><CloudOff size={24} color={C.purple} /></View>
            <Text style={styles.cardTitle}>Nothing has been changed</Text>
            <Text style={styles.cardBody}>No identity was created, no purchase was inferred, and no web data was hydrated.</Text>
            <View style={styles.rule} />
            <View style={styles.row}><LockKeyhole size={16} color={C.sage} /><Text style={styles.rowText}>Your local rehearsal remains available on this device.</Text></View>
          </GlassCard>
        </Reveal>
        <View style={styles.spacer} />
        <GhostButton label="Back to Entry" onPress={() => router.replace("/entry")} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, content: { flex: 1, paddingHorizontal: GUTTER },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginLeft: -10, marginBottom: 26 },
  title: { ...T.display, marginTop: 10 }, lede: { ...T.body, color: C.textSoft, marginTop: 14 },
  card: { marginTop: 30, borderRadius: radius.lg, padding: 22 }, icon: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  cardTitle: { ...T.title, marginTop: 18 }, cardBody: { ...T.support, marginTop: 8 }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 18 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" }, rowText: { ...T.caption, fontFamily: font.medium, flex: 1 }, spacer: { flex: 1 },
});
