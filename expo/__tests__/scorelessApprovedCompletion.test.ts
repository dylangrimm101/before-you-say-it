import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { approvedRehearsalCoachNote, approvedRehearsalComparison, approvedRehearsalConfig, approvedRehearsalIndexImpact, approvedRehearsalStrongVersion, validateApprovedRehearsalCompletion } from "@/lib/approvedRehearsals";
import { createScenarioPracticeRun, initializeApprovedRehearsalRun } from "@/lib/scenarioPractice";
import { finalizeConvertedLesson } from "@/lib/convertedCompletion";
import { activeRunRevision } from "@/lib/activeScenarioRunRepository";
import type { PilotDayRun } from "@/types/pilotCurriculum";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

// Exercise the route's real callback/return guard without loading native modules in Bun.
// Only platform/storage boundaries are substituted; validation and the deletion saga are real.
const source = readFileSync(new URL("../app/approved-lesson/[lessonId].tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("route.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodesWhere(predicate: (node: ts.Node) => boolean): ts.Node[] {
  const found: ts.Node[] = [];
  function visit(node: ts.Node) { if (predicate(node)) found.push(node); ts.forEachChild(node, visit); }
  visit(ast);
  return found;
}
function evaluate(expression: string, scope: Record<string, unknown>): any {
  const js = ts.transpile(`const value = (${expression});`, { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React });
  return new Function("scope", `with (scope) { ${js}; return value; }`)(scope);
}
const finishDeclaration = nodesWhere((n) => ts.isVariableDeclaration(n) && n.name.getText(ast) === "finishLesson")[0] as ts.VariableDeclaration;
const finishSource = (finishDeclaration.initializer as ts.CallExpression).arguments[0]!.getText(ast);
const returnGuard = nodesWhere((n) => ts.isIfStatement(n) && n.thenStatement.getText(ast).includes("return <LessonCompletionScreen"))[0] as ts.IfStatement;
const lessonIds = ["m1-l2", "m1-l3", "m1-l4", "m1-l5", "m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5"] as const;
function fixture(lessonId: typeof lessonIds[number]) {
  const config = approvedRehearsalConfig(lessonId)!;
  const id = `scoreless-${lessonId}`;
  const created = initializeApprovedRehearsalRun(createScenarioPracticeRun(config.scenario, "steady", "defensive", id, 1), 1);
  // Provider contract fixtures, not claims of live AI output.
  const pressure = (beat: 1 | 2, text: string, authoredAt: number) => ({ id: `${id}-counterpart-turn-${beat}`, text, source: "provider" as const,
    reactionId: `${lessonId}-dynamic-pressure-${beat}`, semanticVoiceKey: "contextual_counterpart" as const,
    resolvedAudioId: `${created.run.curriculumVersion}-${id}-counterpart-turn-${beat}`, authoredAt });
  const first = pressure(1, (config.lessonId === "m1-l2" ? "I don't think one late file proves our approval process is broken." : `I still need a clearer answer about ${config.scenario.title}.`), 3);
  const second = pressure(2, (config.lessonId === "m1-l2" ? "Does Tuesday's file prove a pattern with final approval?" : `Why does ${config.scenario.goal.toLowerCase()} follow from that?`), 5);
  const before = "Here is my first response.";
  const note = approvedRehearsalCoachNote(config, before);
  const run: PilotDayRun = {
    ...created.run, convertedModuleId: config.moduleId, practiceId: config.practiceId, contentVersion: config.contentVersion,
    counterpartIdentity: config.counterpartId, scenarioContext: { ...created.run.scenarioContext!, counterpartId: config.counterpartId },
    attempt: { id: `${id}-opener`, kind: "opener", transcript: "Here is my opening request.", representation: "confirmed_transcript", confirmedAt: 2 },
    counterpartTurn: first,
    responseAttempt: { id: `${id}-response`, kind: "response", transcript: before, representation: "confirmed_transcript", confirmedAt: 4 },
    retryAttempt: { id: `${id}-retry`, kind: "retry", transcript: "Here is my retry, not a measured improvement.", representation: "confirmed_transcript", confirmedAt: 7 },
    coachNote: note.note, retryInstruction: note.retryDirection, coachedBehaviorId: config.coachedBehaviorId, coachedSegment: "pushback_response",
    approvedRehearsal: { beat: 7, retryCount: 1, pushbackOne: first, pushbackTwo: second, coachedBeat: 3, selectedDimension: config.coachedBehaviorId,
      replayProof: "text_read_confirmed", replayAudioId: first.resolvedAudioId, replayCompletedAt: 6 },
    comparison: approvedRehearsalComparison(config, before, "Here is my retry, not a measured improvement."),
    state: "attempt_comparison", updatedAt: 8,
  };
  return { config, run, wrapper: { ...created, run } };
}
function harness(lessonId: typeof lessonIds[number], mutate?: (run: PilotDayRun) => PilotDayRun, failAt?: string) {
  const value = fixture(lessonId);
  const run = mutate ? mutate(value.run) : value.run;
  const wrapper = { ...value.wrapper, run };
  const events: string[] = [];
  const progress: ConvertedLessonProgress[] = [];
  const history: unknown[] = [];
  let pending: ConvertedLessonProgress | undefined;
  const step = (name: string) => { events.push(name); if (name === failAt) throw new Error(`Failed ${name}`); };
  const scope = {
    activeScenarioRun: wrapper, returningRun: run, indexImpact: approvedRehearsalIndexImpact(value.config, run, [{ key: "clarity", value: 65 }]),
    rehearsalConfig: value.config, approvedConfig: value.config, feedbackLessonId: lessonId, lesson: { title: value.config.scenario.title },
    isCompleting: false, completionCommitted: false, isReturning: true, isM1L1: false, params: { runId: run.id },
    hasValidReturn: validateApprovedRehearsalCompletion(value.config, run, run.id), validateApprovedRehearsalCompletion,
    isStrongVersionSaved: false, strongVersion: approvedRehearsalStrongVersion(value.config), coachedOriginalResponse: run.responseAttempt?.transcript,
    setIsCompleting: () => {}, setCompletionCommitted: () => step("committed"), setFeedbackContext: () => step("feedback"),
    Crypto: { randomUUID: () => "feedback-id" }, safeLog: () => {}, errorShape: (e: unknown) => e, Alert: { alert: () => step("alert") },
    finalizeConvertedLesson, activeRunRevision,
    writePendingConvertedLessonCompletion: async (record: ConvertedLessonProgress) => { step("pending"); pending = record; },
    clearActiveScenarioRunStrict: async (_revision: unknown, after: () => Promise<void>) => { step("delete"); await after(); },
    markPendingConvertedLessonPrivateContentDeleted: async () => { step("mark-deleted"); },
    promotePendingConvertedLessonCompletion: async () => { step("promote"); progress.push(pending!); },
    saveScoredPracticeRecord: async (record: unknown) => { step("score"); history.push(record); },
  };
  return { scope, events, progress, history, finish: () => evaluate(finishSource, scope)() };
}

test("scoreless return never repeats a legacy comparison as measured improvement", () => {
  const h = harness("m1-l2", (run) => ({ ...run, comparison: { ...run.comparison!, text: "You improved your score by 20 points.", criterionChanged: true } }));
  const comparisonProp = nodesWhere((node) => ts.isJsxAttribute(node) && node.name.getText(ast) === "comparison")[0] as ts.JsxAttribute;
  const expression = (comparisonProp.initializer as ts.JsxExpression).expression!;
  const text = evaluate(expression.getText(ast), { ...h.scope, approvedRehearsalComparison });
  expect(text).toContain("not assessed");
  expect(text).not.toContain("improved your score");
});

test("scoreless UI shows reviewed responses, no fake score or assessment claim, and a working finish action", () => {
  const h = harness("m1-l2");
  let animations = 0;
  const scope: Record<string, unknown> = {
    React: { createElement: (type: unknown, props: unknown, ...children: unknown[]) => typeof type === "function" ? type({ ...(props as object), children }) : { type, props, children } },
    useReducedMotion: () => true, useState: (value: unknown) => [value, () => {}], useRef: (value: unknown) => ({ current: value }), useEffect: () => {},
    Animated: { Value: class { constructor() { animations += 1; } interpolate() { return 0; } }, Text: "Animated.Text", View: "Animated.View" },
    styles: {}, C: {},
  };
  for (const name of ["View", "Backdrop", "ScrollView", "Reveal", "Sparkles", "SectionLabel", "Text", "ProductCard", "TrendingUp", "Pressable", "Check", "Bookmark", "PrimaryButton"]) scope[name] = name;
  for (const node of ast.statements) {
    if (ts.isFunctionDeclaration(node) && node.name && !node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) {
      scope[node.name.text] = evaluate(node.getText(ast), scope);
    }
  }
  let finished = false;
  const render = scope.LessonCompletionScreen as (props: Record<string, unknown>) => unknown;
  const tree = render({ impact: null, originalResponse: h.scope.coachedOriginalResponse, retryResponse: h.scope.returningRun.retryAttempt!.transcript,
    comparison: h.scope.returningRun.comparison!.text, strongVersion: h.scope.strongVersion, isSaved: false, isCompleting: false,
    bottomInset: 0, onToggleSave: () => {}, onFinish: () => { finished = true; } });
  const text = JSON.stringify(tree);
  expect(text).toContain("not assessed");
  expect(text).toContain("Communication Index has not changed");
  expect(text).toContain(h.scope.coachedOriginalResponse!);
  expect(text).toContain(h.scope.returningRun.retryAttempt!.transcript);
  expect(text).not.toContain("Hope compared");
  expect(text).not.toContain("/ 100");
  expect(animations).toBe(0);
  function clickFinish(node: any): void {
    if (!node || typeof node !== "object") return;
    if (node.type === "PrimaryButton") node.props.onPress();
    for (const child of node.children ?? []) clickFinish(child);
  }
  clickFinish(tree);
  expect(finished).toBe(true);
  const saving = JSON.stringify(render({ impact: null, isCompleting: true, bottomInset: 0 }));
  expect(saving).toContain("Saving practice");
  expect(saving).not.toContain("Updating your Index");
});

test("scoreless completion never promotes progress before successful private deletion", async () => {
  for (const failAt of ["pending", "delete", "mark-deleted", "promote"]) {
    const h = harness("m2-l5", undefined, failAt);
    await h.finish();
    expect(h.progress).toEqual([]);
    expect(h.history).toEqual([]);
    expect(h.events.at(-1)).toBe("alert");
    expect(h.events).not.toContain("committed");
    expect(h.events).not.toContain("feedback");
    if (failAt !== "promote") expect(h.events).not.toContain("promote");
  }
});

test("finish revalidates actual practice gates rather than trusting a stale render", async () => {
  const mutations: ((run: PilotDayRun) => PilotDayRun)[] = [
    (run) => ({ ...run, practiceId: "wrong-lesson" }),
    (run) => ({ ...run, retryAttempt: undefined }),
    (run) => ({ ...run, comparison: undefined }),
    (run) => ({ ...run, state: "hope_coaching" }),
    (run) => ({ ...run, approvedRehearsal: { ...run.approvedRehearsal!, replayProof: undefined } }),
    (run) => ({ ...run, approvedRehearsal: { ...run.approvedRehearsal!, pushbackTwo: undefined } }),
  ];
  for (const mutate of mutations) {
    const h = harness("m1-l2", mutate);
    expect(h.scope.hasValidReturn).toBe(false);
    h.scope.hasValidReturn = true; // stale UI state must never authorize a write
    await h.finish();
    expect(h.events).toEqual([]);
  }
  for (const change of [{ params: { runId: "other-run" } }, { isReturning: false }, { completionCommitted: true }]) {
    const h = harness("m2-l4");
    Object.assign(h.scope, change);
    await h.finish();
    expect(h.events).toEqual([]);
  }
});

for (const lessonId of lessonIds) {
  test(`${lessonId}: valid scoreless return reaches completion and finishes through private deletion without scoring`, async () => {
    const h = harness(lessonId);
    expect(h.scope.hasValidReturn).toBe(true);
    expect(h.scope.indexImpact).toBeNull();
    expect(Boolean(evaluate(returnGuard.expression.getText(ast), h.scope))).toBe(true);
    await h.finish();
    expect(h.events).toEqual(["pending", "delete", "mark-deleted", "promote", "committed", "feedback"]);
    expect(h.progress).toHaveLength(1);
    expect(h.progress[0]).toMatchObject({ lessonId, comparisonViewed: true, rehearsalCompleted: true, retryCompleted: true, transferChoice: "finish" });
    expect(h.history).toEqual([]);
  });
}
