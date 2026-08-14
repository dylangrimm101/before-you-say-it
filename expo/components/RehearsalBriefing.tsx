import { useRouter } from "expo-router";
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

/** Context and consent review shown before microphone permission or capture. */
export function RehearsalBriefing({ entryRoute, counterpart, situation, desiredOutcome, expectedReaction, behavioralGoal }: RehearsalBriefingProps): React.JSX.Element {
  const router = useRouter();
  const reflection = entryRoute === "real_conversation"
    ? "You’re practicing the moment where a real need usually turns vague."
    : "You’re practicing the moment where a familiar pattern usually takes over.";
  return (
    <View style={styles.wrap} accessibilityLabel={`Before we start. Rehearsing with ${counterpart}.`}>
      <Text style={styles.eyebrow}>BEFORE WE START</Text>
      <Text style={styles.title}>Start it the way you naturally would.</Text>
      <View style={styles.mapCard}>
        <Field label="Context" value={counterpart} />
        <Field label="Situation" value={situation} />
        <Field label="Your goal" value={desiredOutcome || behavioralGoal} />
        <Field label="Likely pressure" value={expectedReaction} />
      </View>
      <Text style={styles.reflection}>{reflection}</Text>
      <View style={styles.commitment}>
        <Text style={styles.commitmentLabel}>BEFORE YOU ANSWER</Text>
        <Text style={styles.commitmentText}>Give the real answer, not the polished one. The result is only useful if it is built from what you would actually say.</Text>
      </View>
      <Text style={styles.trust}>You control when recording starts, and you can correct the transcript before it is analyzed.</Text>
      <Text style={styles.footnote}>Microphone requested only after you start.</Text>
      <View style={styles.links}>
        <Pressable accessibilityRole="link" accessibilityLabel="Privacy and details" onPress={() => router.push("/privacy")}><Text style={styles.link}>Privacy &amp; details</Text></Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="This does not feel safe" onPress={() => router.push({ pathname: "/safety", params: { returnTo: "rehearsal" } })}><Text style={styles.safetyLink}>This doesn’t feel safe</Text></Pressable>
      </View>
    </View>
  );
}

function Field({ label, value }: { label: string; value: string }): React.JSX.Element {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><Text style={styles.fieldValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  eyebrow: { ...eyebrow, color: C.purple },
  title: { ...T.display, fontSize: 27, lineHeight: 32, color: C.text, maxWidth: 330 },
  mapCard: { backgroundColor: C.surfaceHigh, borderWidth: 1, borderColor: C.glassEdge, borderRadius: radius.lg, padding: 18, gap: 0, shadowColor: "#241633", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.09, shadowRadius: 24, elevation: 3 },
  field: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  fieldLabel: { ...eyebrow, color: C.purple, marginBottom: 5 },
  fieldValue: { ...T.caption, fontFamily: font.medium, color: C.text, lineHeight: 20 },
  reflection: { ...T.support, color: C.textSoft, fontFamily: font.medium },
  commitment: { borderRadius: radius.md, backgroundColor: C.purpleSoft, padding: 16, gap: 7 },
  commitmentLabel: { ...eyebrow, color: C.purple },
  commitmentText: { ...T.caption, color: C.text, lineHeight: 20 },
  trust: { ...T.caption, color: C.textSoft, lineHeight: 21, textAlign: "center" },
  footnote: { ...T.caption, color: C.dim, textAlign: "center", marginTop: -8 },
  links: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 18, marginTop: -8 },
  link: { ...T.caption, fontFamily: font.semi, color: C.purple, minHeight: 44, textAlign: "center", textAlignVertical: "center" },
  safetyLink: { ...T.caption, fontFamily: font.semi, color: C.textSoft, minHeight: 44, textAlign: "center", textAlignVertical: "center" },
});
