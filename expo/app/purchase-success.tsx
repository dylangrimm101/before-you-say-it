import { useLocalSearchParams, useRouter } from "expo-router";
import { Check, LockOpen, Mic2 } from "lucide-react-native";
import React, { useCallback } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, GlassCard, PrimaryButton, Reveal, StateDock, tap } from "@/components/ui";
import { curriculumModule, isModuleId, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, font, radius, shadow } from "@/constants/theme";
import { useStore } from "@/providers/store";

export default function PurchaseSuccess() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ moduleId?: string }>();
  const { activePracticeSession } = useStore();
  const moduleId: ModuleId = isModuleId(params.moduleId)
    ? params.moduleId
    : activePracticeSession?.recommendation?.moduleId ?? "get_to_the_point";
  const module = curriculumModule(moduleId);

  const startModule = useCallback((): void => {
    tap("medium");
    router.replace({ pathname: "/module/[day]", params: { day: moduleId } });
  }, [moduleId, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 46, paddingBottom: insets.bottom + 156 }]} showsVerticalScrollIndicator={false}>
        <Reveal><View style={styles.confirmationMark} accessibilityRole="image" accessibilityLabel="Subscription activated"><View style={styles.confirmationInner}><Check size={34} color={C.onAccent} strokeWidth={2.8} /></View></View></Reveal>
        <Reveal index={1} style={styles.heroCopy}><Eyebrow color={C.sage}>Subscription active</Eyebrow><Text style={styles.title}>Your practice path is unlocked.</Text><Text style={styles.body}>Start at the module your rehearsal identified. You can browse every module at any time.</Text></Reveal>
        <Reveal index={2}><GlassCard style={styles.moduleCard}><View style={styles.moduleHeader}><View style={styles.moduleIcon}><Mic2 size={20} color={C.purple} strokeWidth={2} /></View><View style={styles.moduleHeading}><Text style={styles.moduleLabel}>Recommended starting module</Text><Text style={styles.moduleTitle}>{module?.name ?? "Get to the Point"}</Text></View></View><View style={styles.divider} /><View style={styles.unlockedRow}><LockOpen size={16} color={C.sage} strokeWidth={2.2} /><Text style={styles.unlockedText}>Ready when you are</Text></View></GlassCard></Reveal>
        <Reveal index={3}><Text style={styles.note}>Your free rehearsal stays separate. The curriculum begins with teaching and a new practice choice—not a forced replay of onboarding.</Text></Reveal>
      </ScrollView>
      <StateDock bottomInset={insets.bottom}><PrimaryButton label={`Open ${module?.name ?? "recommended module"}`} onPress={startModule} /></StateDock>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, content: { paddingHorizontal: GUTTER },
  confirmationMark: { width: 94, height: 94, borderRadius: 47, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: C.sageSoft, borderWidth: 1, borderColor: "rgba(92,138,110,0.22)" },
  confirmationInner: { width: 68, height: 68, borderRadius: 34, alignItems: "center", justifyContent: "center", backgroundColor: C.purple, ...shadow.hero },
  heroCopy: { alignItems: "center", marginTop: 27 }, title: { ...T.display, textAlign: "center", marginTop: 9 }, body: { ...T.body, color: C.textSoft, textAlign: "center", marginTop: 12 },
  moduleCard: { marginTop: 30, padding: 18, borderRadius: radius.lg }, moduleHeader: { flexDirection: "row", alignItems: "center", gap: 13 }, moduleIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center", backgroundColor: C.purpleSoft }, moduleHeading: { flex: 1 }, moduleLabel: { ...T.caption, color: C.purple, fontFamily: font.semi }, moduleTitle: { ...T.title, fontSize: 18, lineHeight: 24, marginTop: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: C.line, marginVertical: 16 }, unlockedRow: { flexDirection: "row", alignItems: "center", gap: 8 }, unlockedText: { ...T.support, color: C.sage, fontFamily: font.semi }, note: { ...T.caption, color: C.dim, textAlign: "center", marginTop: 18, paddingHorizontal: 8 },
});
