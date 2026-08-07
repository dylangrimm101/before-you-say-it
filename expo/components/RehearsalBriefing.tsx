import React from "react";
import { StyleSheet, Text, View } from "react-native";

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

/** Shared, concrete context shown before the first turn of every onboarding rehearsal. */
export function RehearsalBriefing({
  entryRoute,
  counterpart,
  situation,
  desiredOutcome,
  expectedReaction,
  behavioralGoal,
}: RehearsalBriefingProps) {
  const sourceLabel = entryRoute === "real_conversation" ? "Your real conversation" : "Practice scenario";
  return (
    <View style={styles.wrap} accessibilityLabel={`${sourceLabel}. Talking to ${counterpart}.`}>
      <Text style={styles.source}>{sourceLabel}</Text>
      <Text style={styles.counterpart}>{counterpart}</Text>
      <Text style={styles.situation}>{situation}</Text>
      <View style={styles.details}>
        <Detail label="You want" value={desiredOutcome} />
        <Detail label="You expect" value={expectedReaction} />
        <Detail label="Practice goal" value={behavioralGoal} />
      </View>
      <Text style={styles.prompt}>How would you start?</Text>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 9 },
  source: { ...eyebrow, alignSelf: "flex-start", color: C.purple, backgroundColor: C.purpleSoft, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  counterpart: { ...T.title, fontFamily: font.bold, color: C.text },
  situation: { ...T.body, color: C.textSoft, lineHeight: 24 },
  details: { gap: 7, paddingTop: 3 },
  detail: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  label: { ...eyebrow, width: 82, paddingTop: 3, color: C.dim },
  value: { ...T.caption, flex: 1, color: C.textSoft, lineHeight: 20 },
  prompt: { ...T.title, marginTop: 5, color: C.text },
});
