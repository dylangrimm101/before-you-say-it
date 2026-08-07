import { useRouter } from "expo-router";
import { ArrowRight, Check, Crown, Sparkles } from "lucide-react-native";
import React, { useCallback, useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Backdrop, Eyebrow, PressCard, Reveal, tap } from "@/components/ui";
import { CURRICULUM_MODULES, curriculumModule, type CurriculumModule, type ModuleId } from "@/constants/modules";
import { C, GUTTER, T, eyebrow, font, radius, shadow } from "@/constants/theme";
import { useStore } from "@/providers/store";

export default function CurriculumHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { modularDoneIds, access, activePracticeSession } = useStore();
  const recommendedId: ModuleId = activePracticeSession?.recommendation?.moduleId ?? "get_to_the_point";
  const recommended = curriculumModule(recommendedId) ?? CURRICULUM_MODULES[0];
  const doneCount = useMemo(() => CURRICULUM_MODULES.filter((module) => modularDoneIds.has(module.id)).length, [modularDoneIds]);

  const openModule = useCallback((module: CurriculumModule): void => {
    tap("light");
    if (access.entitlement !== "pro") {
      router.push({ pathname: "/paywall", params: { gate: "program", moduleId: module.id } });
      return;
    }
    router.push({ pathname: "/module/[day]", params: { day: module.id } });
  }, [access.entitlement, router]);

  return (
    <View style={styles.root}>
      <Backdrop />
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 18, paddingHorizontal: GUTTER, paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
        <Reveal><Eyebrow color={C.dim}>Your curriculum</Eyebrow><Text style={styles.title}>Build the move you need next.</Text><Text style={styles.lede}>{doneCount} of {CURRICULUM_MODULES.length} module practices complete. Practice when it helps—nothing locks when you miss a day.</Text></Reveal>

        <Reveal index={1}>
          <PressCard onPress={() => openModule(recommended)} haptic="medium" accessibilityLabel={`Open recommended module ${recommended.name}`}>
            <View style={styles.hero}>
              <View style={styles.heroTop}><View style={styles.spark}><Sparkles size={18} color={C.onAccent} /></View><Text style={styles.heroEyebrow}>RECOMMENDED START</Text></View>
              <Text style={styles.heroTitle}>{recommended.name}</Text>
              <Text style={styles.heroBody}>Your intake formed a hypothesis. Your rehearsal selected this starting point from what you actually said.</Text>
              <View style={styles.heroAction}><Text style={styles.heroActionText}>{access.entitlement === "pro" ? "Open module" : "See recommended path"}</Text><ArrowRight size={18} color={C.text} /></View>
            </View>
          </PressCard>
        </Reveal>

        {([1, 2, 3, 4] as const).map((block, blockIndex) => {
          const modules = CURRICULUM_MODULES.filter((module) => module.block === block);
          return <Reveal key={block} index={blockIndex + 2} style={styles.block}><View style={styles.blockHead}><Text style={styles.blockNumber}>BLOCK {block}</Text><Text style={styles.blockTitle}>{modules[0]?.blockName}</Text></View><View style={styles.moduleList}>{modules.map((module) => { const done = modularDoneIds.has(module.id); return <PressCard key={module.id} onPress={() => openModule(module)} accessibilityLabel={`Open ${module.name}`}><View style={[styles.moduleRow, module.id === recommendedId && styles.moduleRecommended]}><View style={[styles.number, done && styles.numberDone]}>{done ? <Check size={15} color={C.onAccent} strokeWidth={3} /> : <Text style={styles.numberText}>{module.number}</Text>}</View><View style={styles.moduleCopy}><Text style={styles.moduleName}>{module.name}</Text><Text style={styles.moduleMeta}>{done ? "Practice complete · revisit anytime" : module.id === recommendedId ? "Recommended starting point" : "Available to browse"}</Text></View><ArrowRight size={17} color={C.dim} /></View></PressCard>; })}</View></Reveal>;
        })}

        {access.entitlement !== "pro" ? <Reveal index={7}><PressCard onPress={() => router.push({ pathname: "/paywall", params: { moduleId: recommendedId } })}><View style={styles.unlock}><Crown size={19} color={C.purple} /><View style={styles.unlockCopy}><Text style={styles.unlockTitle}>Unlock the practice path</Text><Text style={styles.unlockBody}>Hope teaches. Adam responds. You retry one observable move.</Text></View><ArrowRight size={17} color={C.dim} /></View></PressCard></Reveal> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, title: { ...T.display, marginTop: 8 }, lede: { ...T.body, color: C.textSoft, marginTop: 12 },
  hero: { marginTop: 28, borderRadius: radius.lg, backgroundColor: C.purple, padding: 22, overflow: "hidden", ...shadow.hero }, heroTop: { flexDirection: "row", alignItems: "center", gap: 9 }, spark: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" }, heroEyebrow: { ...eyebrow, color: "rgba(255,255,255,0.76)" }, heroTitle: { ...T.title, color: C.onAccent, fontSize: 27, lineHeight: 33, marginTop: 18 }, heroBody: { ...T.support, color: "rgba(255,255,255,0.82)", marginTop: 9 }, heroAction: { height: 52, marginTop: 20, borderRadius: radius.pill, backgroundColor: C.onAccent, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 }, heroActionText: { fontFamily: font.semi, fontSize: 16, color: C.text },
  block: { marginTop: 32 }, blockHead: { gap: 5, marginBottom: 12 }, blockNumber: { ...eyebrow, color: C.purple }, blockTitle: { ...T.title, fontSize: 20, lineHeight: 26 }, moduleList: { gap: 9 }, moduleRow: { minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, padding: 15, borderRadius: radius.lg, borderWidth: 1, borderColor: C.glassEdge, backgroundColor: C.surface, ...shadow.layer }, moduleRecommended: { borderColor: `${C.purple}66`, backgroundColor: C.purpleSoft }, number: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: C.purpleSoft }, numberDone: { backgroundColor: C.sage }, numberText: { fontFamily: font.semi, color: C.purple }, moduleCopy: { flex: 1 }, moduleName: { fontFamily: font.semi, fontSize: 16.5, lineHeight: 22, color: C.text }, moduleMeta: { ...T.caption, marginTop: 3 },
  unlock: { marginTop: 30, minHeight: 76, flexDirection: "row", alignItems: "center", gap: 13, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: `${C.purple}44`, backgroundColor: C.surface }, unlockCopy: { flex: 1 }, unlockTitle: { fontFamily: font.semi, fontSize: 16, color: C.text }, unlockBody: { ...T.caption, marginTop: 3 },
});
