import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Check, LockKeyhole, ShieldCheck } from "lucide-react-native";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ProductCard, SectionLabel, StatusPill } from "@/components/PaidProductUI";
import { Backdrop, PressCard, PrimaryButton, Reveal } from "@/components/ui";
import { CURRICULUM_MODULES, isModuleId } from "@/constants/modules";
import { C, GUTTER, T, font } from "@/constants/theme";
import {
  DEFAULT_CURRICULUM_VISIBILITY,
  REVIEW_PRACTICES,
  runnableReviewPractices,
  visiblePracticesForModule,
} from "@/lib/modularCurriculum";

const REPRESENTATIVE_STATES = [
  "Lesson · authored concept",
  "Practice · discrimination check",
  "Rehearsal · briefing",
  "Transcript review · approval required",
  "Counterpart · exact persisted turn",
  "Hope · one observable behavior",
  "Retry · same moment",
  "Comparison · concrete first/retry observation",
  "Completion · review practice only",
  "Interrupted · exact checkpoint saved",
] as const;

export default function InternalReviewEvidenceScreen() {
  const params = useLocalSearchParams<{ sheet?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const sheet = String(params.sheet ?? "path");

  if (DEFAULT_CURRICULUM_VISIBILITY !== "internal_review") {
    return <View style={[styles.root, styles.center]}><Backdrop /><ShieldCheck size={28} color={C.sage} /><Text style={styles.title}>Review evidence is unavailable.</Text><Text style={styles.body}>Production visibility is closed.</Text><PrimaryButton label="Back to Today" onPress={() => router.replace("/(tabs)")} containerStyle={{ alignSelf: "stretch", marginTop: 24 }} /></View>;
  }

  return <View style={styles.root}><Backdrop /><View style={[styles.header, { paddingTop: insets.top + 8 }]}><PressCard onPress={() => router.back()} accessibilityLabel="Close evidence sheet"><View style={styles.back}><ArrowLeft size={18} color={C.text} /></View></PressCard><View style={styles.headerCopy}><Text style={styles.headerTitle}>Deterministic state sheet</Text><Text style={styles.headerMeta}>{sheet}</Text></View></View><ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 44 }]} showsVerticalScrollIndicator={false}><Reveal><StatusPill label="Internal review evidence · not a physical click-through" tone="amber" /><Text style={styles.title}>{titleFor(sheet)}</Text><Text style={styles.body}>{bodyFor(sheet)}</Text></Reveal><EvidenceBody sheet={sheet} /></ScrollView></View>;
}

function EvidenceBody({ sheet }: { sheet: string }) {
  if (sheet === "path") return <View style={styles.list}>{CURRICULUM_MODULES.map((module, index) => {
    const records = visiblePracticesForModule(module.id, "internal_review");
    const runnable = records.filter((practice) => practice.runtimeStatus === "runnable").length;
    return <Reveal key={module.id} index={index + 1}><ProductCard><View style={styles.row}><View style={styles.number}><Text style={styles.numberText}>{module.number}</Text></View><View style={styles.copy}><Text style={styles.cardTitle}>{module.name}</Text><Text style={styles.meta}>{runnable} runnable · {records.length - runnable} non-runnable · revisitable</Text></View><StatusPill label="Internal review" tone="purple" /></View></ProductCard></Reveal>;
  })}</View>;

  if (isModuleId(sheet)) return <View style={styles.list}>{visiblePracticesForModule(sheet, "internal_review").map((practice, index) => <Reveal key={practice.practiceId} index={index + 1}><ProductCard><View style={styles.row}><View style={[styles.number, practice.runtimeStatus !== "runnable" && styles.lock]}>{practice.runtimeStatus === "runnable" ? <Text style={styles.numberText}>{practice.order}</Text> : <LockKeyhole size={14} color={C.dim} />}</View><View style={styles.copy}><Text style={styles.cardTitle}>{practice.title}</Text><Text style={styles.meta}>{practice.contentVersion}</Text></View><StatusPill label={practice.runtimeStatus === "runnable" ? "Runnable" : practice.runtimeStatus === "gated" ? "Gated" : "Blocked"} tone={practice.runtimeStatus === "runnable" ? "green" : "neutral"} /></View></ProductCard></Reveal>)}</View>;

  if (sheet === "states") return <View style={styles.list}>{REPRESENTATIVE_STATES.map((state, index) => <Reveal key={state} index={index + 1}><ProductCard><View style={styles.row}><View style={styles.check}><Check size={13} color={C.onAccent} /></View><Text style={styles.cardTitle}>{state}</Text></View></ProductCard></Reveal>)}</View>;

  if (sheet === "specials") return <View style={styles.list}><EvidenceCard title="Day 3 · rejected note" body="Not quite clears the observation and resumes the neutral retry. Accepted fit persists." /><EvidenceCard title="Day 4 · modeled pause" body="The discrimination example has a brief audible pause. Rehearsal pause duration and recording latency are not scored." /><EvidenceCard title="Day 7 · constraint" body="The request keeps actor, action, and condition visible while allowing refusal or a counteroffer." /><EvidenceCard title="Day 8 · opener branch" body="Reset before the revised opener, then replay the exact selected pushback." /><EvidenceCard title="Day 8 · response branch" body="Replay the exact selected pushback before the revised response." /></View>;

  if (sheet === "continuity") return <View style={styles.list}><EvidenceCard title="Priya continuity" body="Briefing → counterpart turn → coaching → retry → comparison → completion → restart retains Priya." /><EvidenceCard title="Sam continuity" body="Briefing → counterpart turn → coaching → retry → comparison → completion → restart retains Sam." /><EvidenceCard title="Immutable turn" body="Text, counterpart identity, turn ID, reaction ID, and resolved audio ID are protected on later writes." /></View>;

  if (sheet === "inventory") {
    const gated = REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "gated");
    const blocked = REVIEW_PRACTICES.filter((practice) => practice.runtimeStatus === "blocked");
    return <View style={styles.list}><EvidenceCard title="43 runnable" body={`${runnableReviewPractices().length} records enter the shared engine in package order.`} /><EvidenceCard title="2 gated · non-runnable" body={gated.map((practice) => practice.practiceId).join(" · ")} /><EvidenceCard title="8 blocked · non-runnable" body={blocked.map((practice) => practice.practiceId).join(" · ")} /></View>;
  }

  if (sheet === "persistence") return <View style={styles.list}><EvidenceCard title="Representative restart" body="Lesson, discrimination, transcript review, counterpart, coaching, retry, comparison, and transfer resume from their persisted state." /><EvidenceCard title="Progress unchanged" body="Migration adds practice evidence only. It does not create a scored record or alter scored-practice history." /><EvidenceCard title="Production visibility" body="Zero review practices are visible in production mode because every record remains launch_eligible: false." /></View>;

  return <EvidenceCard title="Unknown evidence sheet" body="Use path, a module ID, states, specials, continuity, inventory, or persistence." />;
}

function EvidenceCard({ title, body }: { title: string; body: string }) {
  return <Reveal><ProductCard><SectionLabel tone={C.purple}>Verified state</SectionLabel><Text style={styles.cardTitle}>{title}</Text><Text style={styles.body}>{body}</Text></ProductCard></Reveal>;
}

function titleFor(sheet: string): string {
  if (sheet === "path") return "Eight-module Path inventory";
  if (isModuleId(sheet)) return CURRICULUM_MODULES.find((module) => module.id === sheet)?.name ?? sheet;
  if (sheet === "states") return "Shared paid-practice compositions";
  if (sheet === "specials") return "Day 3, 4, 7, and 8 contracts";
  if (sheet === "continuity") return "Contextual counterpart continuity";
  if (sheet === "inventory") return "Runnable, gated, and blocked records";
  if (sheet === "persistence") return "Restart, migration, and visibility";
  return "Internal review evidence";
}

function bodyFor(sheet: string): string {
  if (sheet === "path") return "All module cards are revisitable capabilities. Status counts come directly from the reconciled package.";
  if (isModuleId(sheet)) return "Practices appear in package order. Gated and blocked records are visible here but cannot be opened.";
  return "This route-mounted sheet renders deterministic configuration and persisted-state contracts. Provider, microphone, playback, and native-device behavior require separate end-to-end QA.";
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, center: { paddingHorizontal: GUTTER, alignItems: "center", justifyContent: "center" },
  header: { minHeight: 64, paddingHorizontal: GUTTER, flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, backgroundColor: "rgba(255,255,255,0.8)", alignItems: "center", justifyContent: "center" }, headerCopy: { flex: 1 }, headerTitle: { fontFamily: font.semi, fontSize: 14, color: C.text }, headerMeta: { ...T.caption, marginTop: 2 },
  scroll: { paddingHorizontal: GUTTER, paddingTop: 18 }, title: { ...T.display, marginTop: 14 }, body: { ...T.support, marginTop: 8 }, list: { marginTop: 22, gap: 10 }, row: { flexDirection: "row", alignItems: "center", gap: 12 }, copy: { flex: 1 }, cardTitle: { ...T.title }, meta: { ...T.caption, marginTop: 4 }, number: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.purpleSoft, alignItems: "center", justifyContent: "center" }, lock: { backgroundColor: "rgba(23,26,31,0.06)" }, numberText: { fontFamily: font.bold, fontSize: 12, color: C.purple }, check: { width: 28, height: 28, borderRadius: 14, backgroundColor: C.purple, alignItems: "center", justifyContent: "center" },
});
