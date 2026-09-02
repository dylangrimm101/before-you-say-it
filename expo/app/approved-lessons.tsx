import { useRouter } from "expo-router";
import { BookOpen, ChevronRight, Layers3 } from "lucide-react-native";
import React from "react";
import { Image, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { APPROVED_LESSON_DECKS, type ApprovedLessonDeck } from "@/constants/approvedLessons";
import { C, GUTTER, T, font, radius } from "@/constants/theme";

/** Internal-only catalog for reviewing the approved Modules 1 and 2 source decks. */
export default function ApprovedLessonsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  if (!__DEV__) {
    return (
      <View style={[styles.root, styles.closed]}>
        <Backdrop />
        <BookOpen size={30} color={C.sage} />
        <Text style={styles.closedTitle}>Lesson review is unavailable.</Text>
        <Text style={styles.closedBody}>Approved source decks are available only in internal development builds.</Text>
        <PrimaryButton label="Back to Today" onPress={() => router.replace("/(tabs)")} containerStyle={{ alignSelf: "stretch", marginTop: 24 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={{ paddingTop: insets.top }}><PaidHeader title="Approved decks" onBack={() => router.back()} /></View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
        <Reveal>
          <StatusPill label="Internal QA · source builds" tone="amber" />
          <Text style={styles.title}>Modules 1 and 2</Text>
          <Text style={styles.intro}>Review the approved card anatomy and interactions exactly as handed off. Lessons stop at rehearsal; close decks stop before persistence content.</Text>
        </Reveal>
        {[1, 2].map((moduleNumber) => (
          <Reveal key={moduleNumber} style={styles.section}>
            <SectionLabel>Module {moduleNumber}</SectionLabel>
            <View style={styles.list}>
              {APPROVED_LESSON_DECKS.filter((lesson) => lesson.module === moduleNumber).map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  onPress={() => router.push({ pathname: "/approved-lesson/[lessonId]", params: { lessonId: lesson.id } })}
                />
              ))}
            </View>
          </Reveal>
        ))}
      </ScrollView>
    </View>
  );
}

function LessonRow({ lesson, onPress }: { lesson: ApprovedLessonDeck; onPress: () => void }) {
  return (
    <PressCard onPress={onPress} accessibilityLabel={`Open ${lesson.title} approved source deck`}>
      <View style={styles.row}>
        <View style={styles.thumb}>
          {lesson.thumbnail ? (
            <Image source={lesson.thumbnail} style={styles.thumbImage} resizeMode="contain" accessibilityLabel={`${lesson.shortName} approved summary thumbnail`} />
          ) : (
            <Layers3 size={22} color={C.purple} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.kicker}>{lesson.lesson === "close" ? "MODULE CLOSE" : `LESSON ${lesson.lesson}`}</Text>
          <Text style={styles.rowTitle}>{lesson.title}</Text>
          <Text style={styles.rowDetail}>{lesson.isCloseDeck ? `Cards 1–${lesson.reviewThroughCard} available for QA` : `${lesson.cardCount} cards · review through rehearsal handoff`}</Text>
        </View>
        <ChevronRight size={19} color={C.purple} />
      </View>
    </PressCard>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  closed: { alignItems: "center", justifyContent: "center", paddingHorizontal: GUTTER },
  closedTitle: { ...T.title, marginTop: 16, textAlign: "center" },
  closedBody: { ...T.support, marginTop: 8, textAlign: "center" },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 16 },
  title: { ...T.display, marginTop: 14 },
  intro: { ...T.support, marginTop: 10 },
  section: { marginTop: 28, gap: 10 },
  list: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.72)", borderWidth: 1, borderColor: C.line, overflow: "hidden" },
  row: { minHeight: 104, paddingHorizontal: 12, paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  thumb: { width: 84, height: 58, borderRadius: 11, backgroundColor: "#F2EDE4", borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  thumbImage: { width: 84, height: 58 },
  copy: { flex: 1 },
  kicker: { fontFamily: font.bold, fontSize: 9, letterSpacing: 1.2, color: C.purple },
  rowTitle: { ...T.support, fontFamily: font.semi, color: C.text, marginTop: 5 },
  rowDetail: { ...T.caption, marginTop: 4 },
});
