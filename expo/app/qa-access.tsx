import { useRouter } from "expo-router";
import { BookOpen, Check, ChevronRight, CreditCard, FlaskConical, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaidHeader, ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, Reveal, tap } from "@/components/ui";
import { CURRICULUM_MODULES, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, font, radius } from "@/constants/theme";
import { useStore } from "@/providers/store";

/** Development-only access controls for reviewing paid content without fabricating a store entitlement. */
export default function QaAccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePracticeSession, devProEnabled, forceDevUnpaid, toggleDevPro } = useStore();
  const recommendedModuleId = activePracticeSession?.sharedResult?.first_focus?.recommended_module_id ?? null;

  if (!__DEV__) {
    return (
      <View style={[styles.root, styles.closed]}>
        <Backdrop />
        <ShieldCheck size={30} color={C.sage} />
        <Text style={styles.closedTitle}>QA access is unavailable.</Text>
        <Text style={styles.closedBody}>Production access continues to require an active trial or subscription.</Text>
      </View>
    );
  }

  const setQaAccess = async (enabled: boolean): Promise<void> => {
    tap("light");
    if (enabled) await toggleDevPro(true);
    else await forceDevUnpaid();
  };

  const openModule = async (moduleId: ModuleId): Promise<void> => {
    if (!devProEnabled) await toggleDevPro(true);
    router.push({ pathname: "/module/[day]", params: { day: moduleId } });
  };

  const previewUnpaidPaywall = async (): Promise<void> => {
    await forceDevUnpaid();
    router.push({
      pathname: "/paywall",
      params: {
        gate: "program",
        ...(recommendedModuleId ? { moduleId: recommendedModuleId } : {}),
      },
    });
  };

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={{ paddingTop: insets.top }}>
        <PaidHeader title="Internal QA" onBack={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
        <Reveal>
          <StatusPill label="Development build only" tone="amber" />
          <Text style={styles.title}>Review paid content safely.</Text>
          <Text style={styles.intro}>This local override changes app access checks only. It never creates a purchase, trial, or RevenueCat entitlement.</Text>
        </Reveal>

        <Reveal index={1}>
          <ProductCard accent style={styles.modeCard}>
            <View style={styles.modeIcon}>{devProEnabled ? <Sparkles size={22} color={C.purple} /> : <LockKeyhole size={21} color={C.dim} />}</View>
            <View style={styles.modeCopy}>
              <SectionLabel tone={devProEnabled ? C.purple : C.dim}>Access simulation</SectionLabel>
              <Text style={styles.modeTitle}>{devProEnabled ? "QA modules unlocked" : "Simulating unpaid"}</Text>
              <Text style={styles.modeBody}>{devProEnabled ? "Module content and practice reps are locally accessible." : "Paid module entry points should route to the paywall."}</Text>
            </View>
            <Switch
              value={devProEnabled}
              onValueChange={(enabled) => void setQaAccess(enabled)}
              trackColor={{ false: C.track, true: C.purpleLight }}
              thumbColor={devProEnabled ? C.purple : C.elevated}
              accessibilityLabel="Toggle QA module access"
            />
          </ProductCard>
        </Reveal>

        <Reveal index={2} style={styles.section}>
          <SectionLabel>Boundary checks</SectionLabel>
          <View style={styles.actionGroup}>
            <QaAction
              icon={<CreditCard size={18} color={C.purple} />}
              title="Preview unpaid paywall"
              detail="Turns QA access off, then opens the real offer flow"
              onPress={() => void previewUnpaidPaywall()}
            />
            <QaAction
              icon={<FlaskConical size={18} color={C.purple} />}
              title="Open practice path"
              detail="Review recommendation order and every module card"
              onPress={() => router.push("/path")}
            />
            <QaAction
              icon={<BookOpen size={18} color={C.purple} />}
              title="Open approved lesson decks"
              detail="Review the twelve source decks for Modules 1 and 2"
              onPress={() => router.push("/approved-lessons")}
              last
            />
          </View>
        </Reveal>

        <Reveal index={3} style={styles.section}>
          <SectionLabel>Open module content directly</SectionLabel>
          {recommendedModuleId ? (
            <Text style={styles.recommendationNote}>The highlighted module comes from the current rehearsal and debrief.</Text>
          ) : (
            <Text style={styles.recommendationNote}>Complete a rehearsal to test recommendation continuity. Modules remain available for content review.</Text>
          )}
          <View style={styles.moduleList}>
            {CURRICULUM_MODULES.map((module) => {
              const isRecommended = module.id === recommendedModuleId;
              return (
                <PressCard key={module.id} onPress={() => void openModule(module.id)} accessibilityLabel={`Open ${module.name} in QA mode`}>
                  <View style={[styles.moduleRow, isRecommended && styles.moduleRecommended]}>
                    <View style={[styles.moduleNumber, isRecommended && styles.moduleNumberRecommended]}>
                      {isRecommended ? <Sparkles size={13} color={C.purple} /> : <Text style={styles.moduleNumberText}>{module.number}</Text>}
                    </View>
                    <View style={styles.moduleCopy}>
                      <Text style={styles.moduleTitle}>{module.name}</Text>
                      <Text style={styles.moduleDetail} numberOfLines={2}>{module.promise}</Text>
                      {isRecommended ? <View style={styles.recommendedLine}><Check size={11} color={C.sage} /><Text style={styles.recommendedText}>Recommended from current debrief</Text></View> : null}
                    </View>
                    <ChevronRight size={18} color={C.purple} />
                  </View>
                </PressCard>
              );
            })}
          </View>
        </Reveal>
      </ScrollView>
    </View>
  );
}

function QaAction({ icon, title, detail, onPress, last = false }: { icon: React.ReactNode; title: string; detail: string; onPress: () => void; last?: boolean }) {
  return (
    <PressCard onPress={onPress} accessibilityLabel={`${title}. ${detail}`}>
      <View style={[styles.actionRow, last && styles.actionRowLast]}>
        <View style={styles.actionIcon}>{icon}</View>
        <View style={styles.actionCopy}><Text style={styles.actionTitle}>{title}</Text><Text style={styles.actionDetail}>{detail}</Text></View>
        <ChevronRight size={18} color={C.dim} />
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
  modeCard: { marginTop: 24, flexDirection: "row", alignItems: "center", gap: 12 },
  modeIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  modeCopy: { flex: 1 },
  modeTitle: { ...T.title, fontSize: 17, marginTop: 4 },
  modeBody: { ...T.caption, marginTop: 3 },
  section: { marginTop: 28, gap: 10 },
  actionGroup: { borderRadius: radius.lg, backgroundColor: "rgba(255,255,255,0.68)", borderWidth: 1, borderColor: C.line, paddingHorizontal: 16, overflow: "hidden" },
  actionRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  actionRowLast: { borderBottomWidth: 0 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1 },
  actionTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  actionDetail: { ...T.caption, marginTop: 3 },
  recommendationNote: { ...T.caption, color: C.textSoft },
  moduleList: { gap: 8 },
  moduleRow: { minHeight: 96, borderRadius: radius.md, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.66)", padding: 14, flexDirection: "row", alignItems: "center", gap: 12 },
  moduleRecommended: { borderColor: "rgba(81,40,136,0.34)", backgroundColor: "rgba(255,255,255,0.86)" },
  moduleNumber: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: C.lineStrong, alignItems: "center", justifyContent: "center" },
  moduleNumberRecommended: { borderColor: C.purple, backgroundColor: C.purpleSoft },
  moduleNumberText: { fontFamily: font.semi, fontSize: 11, color: C.dim },
  moduleCopy: { flex: 1 },
  moduleTitle: { ...T.support, fontFamily: font.semi, color: C.text },
  moduleDetail: { ...T.caption, marginTop: 4 },
  recommendedLine: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 7 },
  recommendedText: { fontFamily: font.semi, fontSize: 10, color: C.sage },
});
