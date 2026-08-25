import { ArrowLeft, Check } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";

export function PaidHeader({ title, onBack, closeLabel = "Back" }: { title?: string; onBack: () => void; closeLabel?: string }) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} style={styles.back} accessibilityRole="button" accessibilityLabel={closeLabel}>
        <ArrowLeft size={20} color={C.textSoft} />
        <Text style={styles.backLabel}>{closeLabel}</Text>
      </Pressable>
      {title ? <Text style={styles.headerTitle}>{title}</Text> : null}
      <View style={styles.balance} />
    </View>
  );
}

export function ProductCard({ children, style, accent = false }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; accent?: boolean }) {
  return <View style={[styles.card, accent && styles.cardAccent, style]}>{children}</View>;
}

export function SectionLabel({ children, tone = C.dim }: { children: React.ReactNode; tone?: string }) {
  return <Text style={[styles.sectionLabel, { color: tone }]}>{children}</Text>;
}

export function StatusPill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "purple" | "green" | "amber" }) {
  const palette = tone === "purple" ? styles.pillPurple : tone === "green" ? styles.pillGreen : tone === "amber" ? styles.pillAmber : styles.pillNeutral;
  return <View style={[styles.pill, palette]}><Text style={[styles.pillText, tone === "purple" && styles.pillTextPurple, tone === "green" && styles.pillTextGreen, tone === "amber" && styles.pillTextAmber]}>{label}</Text></View>;
}

export function StepList({ items, completed = false }: { items: readonly string[]; completed?: boolean }) {
  return <View style={styles.stepList}>{items.map((item, index) => <View key={`${item}-${index}`} style={styles.stepRow}><View style={[styles.stepMark, completed && styles.stepMarkDone]}>{completed ? <Check size={10} color={C.onAccent} strokeWidth={3} /> : <Text style={styles.stepNumber}>{index + 1}</Text>}</View><Text style={styles.stepText}>{item}</Text></View>)}</View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 52, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  back: { minWidth: 76, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6 },
  backLabel: { fontFamily: font.semi, fontSize: 14, color: C.textSoft },
  headerTitle: { ...T.support, fontFamily: font.semi, color: C.text, textAlign: "center", flex: 1 },
  balance: { width: 76 },
  card: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: C.line, padding: 20, gap: 10, ...shadow.layer },
  cardAccent: { borderColor: "rgba(81,40,136,0.24)", backgroundColor: "rgba(255,255,255,0.84)" },
  sectionLabel: { ...eyebrow },
  pill: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start", borderWidth: 1 },
  pillNeutral: { backgroundColor: "rgba(23,26,31,0.04)", borderColor: C.line },
  pillPurple: { backgroundColor: C.purpleSoft, borderColor: "rgba(81,40,136,0.22)" },
  pillGreen: { backgroundColor: C.sageSoft, borderColor: "rgba(92,138,110,0.24)" },
  pillAmber: { backgroundColor: "rgba(180,130,63,0.10)", borderColor: "rgba(180,130,63,0.26)" },
  pillText: { fontFamily: font.semi, fontSize: 11, color: C.dim },
  pillTextPurple: { color: C.purple }, pillTextGreen: { color: C.sage }, pillTextAmber: { color: "#8A6420" },
  stepList: { gap: 12 }, stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 11 },
  stepMark: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepMarkDone: { backgroundColor: C.purple, borderColor: C.purple }, stepNumber: { fontFamily: font.semi, fontSize: 10, color: C.dim }, stepText: { ...T.support, color: C.text, flex: 1 },
});
