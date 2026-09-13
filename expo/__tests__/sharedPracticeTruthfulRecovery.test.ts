import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { renderToStaticMarkup } from "react-dom/server";

// Execute the component's JSX with native boundaries stubbed and the busy hook
// held true, without installing module mocks in the shared Bun process.
function renderBusyPractice(approved: boolean, state: "confirm_response_transcript" | "confirm_retry_transcript") {
  const config = approvedRehearsalConfig("m1-l2")!;
  const run = transitionScenarioPracticeRun(createScenarioPracticeRun(config.scenario, "steady", "defensive", "busy-run", 1), state, 2);
  const file = resolve(import.meta.dir, "../components/ScenarioPaidPractice.tsx");
  const localRequire = createRequire(file);
  const react = localRequire("react");
  const Host = ({ children }: any) => react.createElement("div", null, children);
  let hook = 0;
  const exports: any = {};
  const compiled = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  runInNewContext(compiled, { exports, console, require: (name: string) => {
    if (name === "react") return { ...react, useState: (initial: any) => [hook++ === 2 ? true : typeof initial === "function" ? initial() : initial, () => {}], useRef: (current: unknown) => ({ current }), useCallback: (fn: unknown) => fn, useEffect() {} };
    if (name === "react-native") return { ...Object.fromEntries(["ActivityIndicator", "KeyboardAvoidingView", "Pressable", "ScrollView", "Text", "TextInput", "View"].map(key => [key, Host])), StyleSheet: { create: (s: unknown) => s }, Platform: { OS: "web" } };
    if (name === "@/constants/theme") return { C: {}, GUTTER: 20, T: {}, font: () => ({}), radius: {} };
    if (name === "expo-router") return { useRouter: () => ({}) };
    if (name === "react-native-safe-area-context") return { useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) };
    if (name === "lucide-react-native") return { Mic: Host, Square: Host, X: Host };
    if (name.startsWith("@/components/")) return new Proxy({}, { get: () => Host });
    if (name === "@/providers/store") return { useStore: () => ({ activeScenarioRun: run }) };
    if (name === "@/lib/useDictation") return { useDictation: () => ({ cancel: async () => {} }) };
    if (name === "@/lib/voice") return { useSpeech: () => ({ phase: "idle" }) };
    if (["@/lib/ai", "@/lib/scenarioAudio", "@/lib/temporaryRecording"].includes(name)) return {};
    return localRequire(name.startsWith("@/") ? resolve(import.meta.dir, "..", name.slice(2)) : name);
  }});
  const shared = exports.ScenarioPaidPractice({ scenario: config.scenario, approvedRehearsal: approved ? config : undefined });
  return renderToStaticMarkup(shared.type(shared.props));
}

for (const state of ["confirm_response_transcript", "confirm_retry_transcript"] as const) {
  test(`approved lesson busy JSX does not claim an assessment (${state})`, () => {
    const html = renderBusyPractice(true, state);
    expect(html).toContain("Preparing your lesson practice");
    expect(html).not.toContain("Hope is reviewing your approved words");
  });
}
test("ordinary reviewed scenario busy JSX retains its review copy", () => {
  expect(renderBusyPractice(false, "confirm_response_transcript")).toContain("Hope is reviewing your approved words");
});
import { createScenarioPracticeRun, preserveScenarioAttempt, transitionScenarioPracticeRun } from "@/lib/scenarioPractice";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
const source = () => readFileSync(new URL("../components/ScenarioPaidPractice.tsx", import.meta.url), "utf8");
test("runtime uses unassessed practice preparation instead of persisting false observations", () => {
  expect(source()).toContain("prepareUnassessedApprovedRehearsal(approvedRehearsal, withSecondPressure");
  expect(source()).not.toContain("Hope · one observed behavior");
});
test("legacy saved coaching and comparisons are not rendered as verified verdicts", () => {
  expect(source().includes("approvedRehearsalCoachNote(approvedRehearsal")).toBe(true);
  expect(source().includes("{practiceNote?.note ?? run.coachNote}")).toBe(true);
  expect(source().includes("approvedRehearsalComparison(approvedRehearsal, coachedOriginal, run.retryAttempt.transcript).text")).toBe(true);
});
test("exact retry audio includes run-bound contextual voice", () => {
  const callback = source().split("completeApprovedRehearsalReplay(staged")[1]?.split("if (confirmed")[0];
  expect(callback).toContain("contextualPersona: context.contextualPersona");
  expect(callback).toContain("text: exactPressure.text");
  expect(callback).toContain("exactPressure.resolvedAudioId");
});
test("reopened generation errors restore the matching approved draft and visible error", async () => {
  const api = await import("@/lib/scenarioPracticeRecovery").catch(() => ({}));
  expect(typeof api.scenarioPracticeRecovery).toBe("function");
  const config = approvedRehearsalConfig("m1-l2")!;
  let value = createScenarioPracticeRun(config.scenario, "steady", "defensive", "recover", 1);
  value = preserveScenarioAttempt(value, "opener", "My approved opening.", 2);
  for (const state of ["network_error", "model_error"] as const) {
    const failed = transitionScenarioPracticeRun(value, state, 3);
    const recovered = api.scenarioPracticeRecovery(JSON.parse(JSON.stringify(failed.run)));
    expect(recovered.draft).toBe("My approved opening.");
    expect(recovered.reviewState).toBe("confirm_attempt_transcript");
    expect(recovered.error).toContain("saved");
  }
  value = preserveScenarioAttempt(value, "response", "My approved response.", 4);
  for (const state of ["network_error", "model_error"] as const) {
    const recovered = api.scenarioPracticeRecovery(transitionScenarioPracticeRun(value, state, 5).run);
    expect(recovered.draft).toBe("My approved response.");
    expect(recovered.reviewState).toBe("confirm_response_transcript");
  }
  expect(source()).toContain("setDraft(recovery.draft)");
  expect(source()).toContain("scenarioPracticeRecovery(value.run)");
  expect(source()).toContain("scenarioPracticeRecovery(initialRun)");
});
