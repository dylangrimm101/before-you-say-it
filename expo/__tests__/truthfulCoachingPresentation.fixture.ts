import { mock } from "bun:test";
import { plugin } from "bun";
plugin({ name: "test-image-assets", setup(build) { build.onLoad({ filter: /\.(png|ttf)$/ }, () => ({ contents: "export default 1", loader: "js" })); } });
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { ScoredPracticeRecord } from "@/lib/scoredPracticeHistory";

const Host = ({ children, accessibilityLabel }: any) => React.createElement("div", { "aria-label": accessibilityLabel }, children);
class Value {
  constructor(_value: number) {}
  interpolate() { return 0; }
  setValue() {}
}
mock.module("react-native", () => ({
  View: Host, Text: Host, Pressable: Host, ScrollView: Host,
  StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 1 },
  Platform: { OS: "web", select: (options: any) => options.web ?? options.default }, Alert: {}, Easing: { bezier: () => undefined },
  Animated: { View: Host, ScrollView: Host, Value, event: () => () => {} },
}));
mock.module("expo-router", () => ({ useRouter: () => ({ push() {} }) }));
mock.module("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
mock.module("lucide-react-native", () => Object.fromEntries(["Check", "ChevronRight", "Circle", "Info", "Settings", "Target", "Trash2"].map((name) => [name, () => null])));
mock.module("@/components/ui", () => ({ Backdrop: () => null, Meter: () => null, PressCard: Host, Reveal: Host, useReducedMotion: () => true }));
mock.module("@/components/PaidProductUI", () => ({ ProductCard: Host, SectionLabel: Host, StatusPill: ({ label }: any) => React.createElement(Host, null, label) }));
let store: any;
mock.module("@/providers/store", () => ({ useStore: () => store }));
const { approvedRehearsalConfigs } = await import("@/lib/approvedRehearsals");
const { default: Today } = await import("@/app/(tabs)/index");
const { default: Progress } = await import("@/app/(tabs)/progress");
const configs = approvedRehearsalConfigs();
const legacy: ScoredPracticeRecord[] = configs.map((config, i) => ({
  schemaVersion: 1, id: `legacy-${i}`, rehearsalId: `legacy-${i}`, scenarioId: config.scenario.id,
  scenarioTitle: `Unverified scene ${i}`, completedAt: i + 2,
  observedSignals: [{ key: "clarity", value: 72, evidenceTurnIds: ["retry"] }],
  observedSignalSet: ["clarity"], overallIndex: 72, evidence: [{ turnId: "retry" }], currentFocus: "Old heuristic praise",
}));
const genuine: ScoredPracticeRecord = { ...legacy[0]!, id: "genuine", rehearsalId: "genuine", scenarioId: "provider-scene", scenarioTitle: "Genuinely scored practice", completedAt: 1,
  observedSignals: [{ key: "clarity", value: 60, evidenceTurnIds: ["real"] }], overallIndex: 60, evidence: [{ turnId: "real" }], currentFocus: "Measured focus" };
store = { access: { entitlement: "pro" }, activityDays: new Set(), convertedLessonProgress: [], drillLog: [], moduleCloseProgress: [], completed: [], pilotProgress: [], scoredPracticeHistory: legacy, deleteSession() {} };
const snapshot = JSON.stringify(store);
const home = renderToStaticMarkup(React.createElement(Today));
assert.ok(!home.includes("Latest lesson included"), "Home must not badge unverified history as an Index update");
assert.ok(!home.includes("Scored practice included"), "unverified history must not display a measured-practice badge");
assert.ok(!home.includes("Latest completed lesson included"));
const progress = renderToStaticMarkup(React.createElement(Progress));
assert.ok(progress.includes("No Index history yet"));
assert.ok(!progress.includes("Unverified scene"));
assert.ok(!progress.includes("72 / 100"));
assert.equal(JSON.stringify(store), snapshot, "presentation must leave stored records untouched");
store.scoredPracticeHistory = [genuine, ...legacy];
const mixed = renderToStaticMarkup(React.createElement(Progress));
assert.ok(mixed.includes("Genuinely scored practice"));
assert.ok(mixed.includes("60 / 100"));
assert.ok(mixed.includes("1 scored practice ·"));
assert.ok(!mixed.includes("Unverified scene"));
assert.equal(store.scoredPracticeHistory.length, legacy.length + 1);
const mixedHome = renderToStaticMarkup(React.createElement(Today));
assert.ok(mixedHome.includes("Scored practice included"), "badge describes measured practice, not the latest unscored lesson");
assert.ok(!mixedHome.includes("Latest lesson included"));
store.scoredPracticeHistory = legacy;
const { approvedLessonDeck } = await import("@/constants/approvedLessons");
const { M1_L1_CONVERSION, convertedProgressFacts } = await import("@/lib/convertedLesson");
store.convertedLessonProgress = [M1_L1_CONVERSION, ...configs].map((config, i) => ({
  lessonId: config.lessonId, moduleId: config.moduleId, practiceId: config.practiceId, contentVersion: config.contentVersion,
  runId: `completed-${i}`, lessonCardCheckpoint: config.completionCard, quizGatesCompleted: true,
  rehearsalCompleted: true, retryCompleted: true, comparisonViewed: true, savedMoveId: "saved",
  transferChoice: "work", completedAt: i + 1, sourceLineage: "approved-html-deck-pinned",
}));
const completedSnapshot = JSON.stringify(store);
const milestones = renderToStaticMarkup(React.createElement(Progress));
for (const entry of store.convertedLessonProgress) {
  const escapedTitle = renderToStaticMarkup(React.createElement(Host, null, approvedLessonDeck(entry.lessonId)!.title));
  assert.ok(milestones.includes(escapedTitle), `canonical milestone title missing for ${entry.lessonId}`);
  for (const fact of convertedProgressFacts(entry)) assert.ok(milestones.includes(fact));
}
assert.ok(milestones.includes("No Index history yet"));
assert.equal(JSON.stringify(store), completedSnapshot);
console.log("truthful presentation verified");
