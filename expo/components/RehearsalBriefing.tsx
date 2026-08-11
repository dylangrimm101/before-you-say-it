import { useRouter } from "expo-router";
import { ArrowDown, ArrowRight } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { C, T, eyebrow, font, radius } from "@/constants/theme";
import type { OnboardingEntryRoute } from "@/constants/modules";

interface RehearsalBriefingProps {
  entryRoute?: OnboardingEntryRoute;
  counterpart: string;
  situation: string;
  desiredOutcome: string;
  expectedReaction: string;
  behavioralGoal: string;
}

/** The standalone context review shown before microphone permission or capture. */
export function RehearsalBriefing({
  entryRoute,
  counterpart,
  situation,
  desiredOutcome,
  expectedReaction,
  behavioralGoal,
}: RehearsalBriefingProps) {
  const router = useRouter();
  const sourceLabel = entryRoute === "real_conversation" ? "Your real conversation" : "Practice scenario";
  return (
    <View style={styles.wrap} accessibilityLabel={`${sourceLabel}. Talking to ${counterpart}.`}>
      <Text style={styles.title}>Start it the way you naturally would.</Text>

      <View style={styles.mapCard}>
        <View style={styles.topRow}>
          <MapBlock label="You" value="Your first instinct" />
          <ArrowRight size={17} color={C.dim} strokeWidth={1.6} />
          <MapBlock label={counterpart} value={situation} />
        </View>

        <View style={styles.downPath}>
          <ArrowDown size={15} color={C.dim} strokeWidth={1.5} />
          <ArrowDown size={15} color={C.dim} strokeWidth={1.5} />
        </View>

        <View style={styles.goalBlock}>
          <Text style={styles.mapLabel}>Your goal</Text>
          <Text style={styles.goalText}>{behavioralGoal}</Text>
        </View>

      </View>

      <Text style={styles.trust}>You control when recording starts, and you can correct the transcript before it is analyzed.</Text>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" accessibilityLabel="Privacy and details" onPress={() => router.push("/privacy")}><Text style={styles.link}>Privacy &amp; details</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="This does not feel safe" onPress={() => router.push({ pathname: "/safety", params: { returnTo: "rehearsal" } })}><Text style={styles.safetyLink}>This doesn’t feel safe</Text></Pressable>
      </View>
      <Text style={styles.contextNote} accessibilityElementsHidden>{sourceLabel} · {desiredOutcome} · {expectedReaction}</Text>
    </View>
  );
}

function MapBlock({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mapBlock}>
      <Text style={styles.mapLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.mapValue} numberOfLines={4}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  title: { ...T.display, fontSize: 27, lineHeight: 32, color: C.text, maxWidth: 330 },
  mapCard: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.lg, padding: 18, gap: 12, shadowColor: "#241633", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.09, shadowRadius: 24, elevation: 3 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  mapBlock: { flex: 1, alignSelf: "stretch", minHeight: 116, borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(81,40,136,0.16)", backgroundColor: "rgba(81,40,136,0.055)", padding: 14 },
  mapLabel: { ...eyebrow, color: C.purple, marginBottom: 7 },
  mapValue: { ...T.caption, fontFamily: font.medium, color: C.text, lineHeight: 20 },
  downPath: { alignItems: "center", gap: 2, marginVertical: -3 },
  goalBlock: { borderRadius: radius.md, borderWidth: 1, borderColor: "rgba(81,40,136,0.18)", backgroundColor: C.purpleSoft, paddingHorizontal: 14, paddingVertical: 13 },
  goalText: { ...T.caption, fontFamily: font.medium, color: C.text, lineHeight: 20 },
  trust: { ...T.caption, color: C.textSoft, lineHeight: 21 },
  links: { flexDirection: "row", flexWrap: "wrap", gap: 18, marginTop: -9 },
  link: { ...T.caption, fontFamily: font.semi, color: C.purple, minHeight: 44, textAlignVertical: "center" },
  safetyLink: { ...T.caption, fontFamily: font.semi, color: C.textSoft, minHeight: 44, textAlignVertical: "center" },
  contextNote: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
