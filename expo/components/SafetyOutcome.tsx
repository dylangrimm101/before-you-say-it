import { LifeBuoy, ShieldCheck } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, Reveal } from "@/components/ui";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { allowsOrdinaryPractice, type SafetyOutcome as Outcome } from "@/lib/safety";

/** Shared result screen so every safety gate offers the same support route. */
export function SafetyOutcomeView({
  outcome,
  children,
}: {
  outcome: Outcome;
  children?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const canPractice = allowsOrdinaryPractice(outcome.route);
  const tone = canPractice ? C.sage : C.clay;

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <Reveal index={0} style={styles.intro}>
          <View style={[styles.iconWrap, { backgroundColor: `${tone}14` }]}>
            {canPractice ? (
              <ShieldCheck size={24} color={tone} strokeWidth={1.9} />
            ) : (
              <LifeBuoy size={24} color={tone} strokeWidth={1.9} />
            )}
          </View>
          <Eyebrow color={tone}>{canPractice ? "Clear to practice" : "A safer next step"}</Eyebrow>
          <Text style={styles.display}>{outcome.title}</Text>
          <Text style={styles.support}>{outcome.body}</Text>
        </Reveal>

        {outcome.actions.length > 0 ? (
          <Reveal index={1}>
            <View style={styles.actionCard}>
              <Text style={styles.cardTitle}>What to do now</Text>
              {outcome.actions.map((action, index) => (
                <View key={action} style={[styles.actionRow, index > 0 && styles.divided]}>
                  <View style={[styles.actionNumber, { backgroundColor: `${tone}14` }]}>
                    <Text style={[styles.actionNumberText, { color: tone }]}>{index + 1}</Text>
                  </View>
                  <Text style={styles.actionText}>{action}</Text>
                </View>
              ))}
            </View>
          </Reveal>
        ) : null}

        <Reveal index={2} style={styles.actions}>{children}</Reveal>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { paddingHorizontal: GUTTER },
  intro: { gap: 12 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  display: { ...T.display },
  support: { ...T.support },
  actionCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: C.glassEdge,
    backgroundColor: C.surface,
    paddingHorizontal: 18,
    paddingTop: 18,
    marginTop: 24,
    ...shadow.layer,
  },
  cardTitle: { ...T.title, marginBottom: 4 },
  actionRow: { flexDirection: "row", gap: 12, paddingVertical: 16, alignItems: "flex-start" },
  actionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionNumberText: { fontFamily: font.semi, fontSize: 13 },
  actionText: { ...T.support, flex: 1 },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  actions: { marginTop: 28 },
});
