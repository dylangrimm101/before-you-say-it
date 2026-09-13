import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { serializeStoreOperation } from "@/lib/storePersistence";
import { DEFAULT_CONSENT } from "@/lib/consent";
import { createScenarioPracticeRun } from "@/lib/scenarioPractice";
import { createOnboardingPracticeSession } from "@/lib/practiceSession";
import { approvedRehearsalConfig } from "@/lib/approvedRehearsals";
import type { ConvertedLessonProgress } from "@/lib/convertedLesson";

function completion(lessonId: "m2-l1" | "m2-l2", completedAt: number): ConvertedLessonProgress {
  const config = approvedRehearsalConfig(lessonId)!;
  return {
    lessonId, moduleId: config.moduleId, practiceId: config.practiceId,
    contentVersion: config.contentVersion, runId: `run-${lessonId}-${completedAt}`,
    lessonCardCheckpoint: config.completionCard, quizGatesCompleted: true,
    rehearsalCompleted: true, retryCompleted: true, comparisonViewed: true,
    savedMoveId: config.namedMoveId, transferChoice: "say", completedAt,
    sourceLineage: "approved-html-deck-pinned",
  };
}

// Execute the actual provider with React updates deliberately deferred. Native
// boundaries are replaced, not the actions or their persistence algorithms.
function harness(seed: Record<string, unknown> = {}) {
  const disk = new Map(Object.entries(seed).map(([k, v]) => [k, JSON.stringify(v)]));
  const scheduled: unknown[] = [];
  const effects: (() => unknown)[] = [];
  const values: unknown[] = [];
  const pending: (() => void)[] = [];
  let cursor = 0;
  let fail = false;
  const storage = {
    // This isolated StoreProvider fixture has no continuation envelopes. The real
    // owner-lease receipt/privacy behavior is exercised in currentGuestContinuation.
    localContinuation: async () => false,
    forgetContinuationSnapshot: async () => {},
    getAllKeys: async () => [...disk.keys()],
    multiRemove: async (keys: readonly string[]) => { if (fail) throw new Error("disk full"); keys.forEach((key) => disk.delete(key)); },
    getItem: async (key: string) => disk.get(key) ?? null,
    setItem: async (key: string, value: string) => { if (fail) throw new Error("disk full"); disk.set(key, value); },
    removeItem: async (key: string) => { if (fail) throw new Error("disk full"); disk.delete(key); },
  };
  const file = resolve(import.meta.dir, "../providers/store.tsx");
  const localRequire = createRequire(file);
  const source = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const exports: any = {};
  const noop = async () => {};
  runInNewContext(source, { exports, __DEV__: false, console, require: (name: string) => {
    if (name === "react") return { useState: (value: unknown) => { const index = cursor++; if (!(index in values)) values[index] = value; return [values[index], (next: unknown) => { scheduled.push(next); pending.push(() => { values[index] = typeof next === "function" ? next(values[index]) : next; }); }]; }, useRef: (current: unknown) => ({ current }), useCallback: (fn: unknown) => fn, useMemo: (fn: () => unknown) => fn(), useEffect: (fn: () => unknown) => { effects.push(fn); } };
    if (name === "@react-native-async-storage/async-storage") return { default: storage, __esModule: true };
    if (name === "@nkzw/create-context-hook") return { default: (fn: () => unknown) => [null, fn], __esModule: true };
    if (name === "@tanstack/react-query") return { useQueryClient: () => ({ clear() {} }) };
    if (name === "@/lib/purchases") return { useIsPro: () => false, clearPurchasesIdentity: noop };
    if (name === "@/providers/auth") return { useAuth: () => ({ practiceOwner: { key: "fixture-owner", storage }, logout: async () => ({ success: true }) }) };
    if (name === "@/lib/supabase") return { supabase: null };
    if (name === "@/lib/baselineAudio") return { deleteAllBaselineAudioStrict: noop, deleteBaselineAudioStrict: noop };
    if (name === "@/lib/voice") return { deleteGeneratedVoiceCacheStrict: noop };
    if (name === "@/lib/reminders") return { cancelDailyReminder: noop, cancelChallengeNudge: noop, syncChallengeNudge: noop };
    return localRequire(name.startsWith("@/") ? resolve(import.meta.dir, "..", name.slice(2)) : name);
  }});
  return { store: exports.useStore(), disk, scheduled, storage,
    grant: async () => { effects.at(-2)!(); await serializeStoreOperation(storage, async () => {}); },
    hydrate: async () => { effects[0]!(); await serializeStoreOperation(storage, async () => {}); },
    render: () => { pending.splice(0).forEach((fn) => fn()); cursor = 0; return exports.useStore(); },
    fail: (value: boolean) => { fail = value; } };
}

test("drill persistence does not depend on React running its updater", async () => {
  const h = harness();
  const drill = { id: "one", date: "2026-09-05" };
  await h.store.logDrill(drill);
  expect(JSON.parse(h.disk.get("cc.drills.v1")!)).toEqual([drill]);
  expect(h.scheduled).toEqual([[drill]]);
});

test("concurrent drills merge durable state and failed writes neither publish nor poison the queue", async () => {
  const h = harness();
  h.fail(true);
  await expect(h.store.logDrill({ id: "failed" })).rejects.toThrow("disk full");
  expect(h.scheduled).toEqual([]);
  h.fail(false);
  await Promise.all([h.store.logDrill({ id: "a" }), h.store.logDrill({ id: "b" })]);
  expect(JSON.parse(h.disk.get("cc.drills.v1")!)).toEqual([{ id: "b" }, { id: "a" }]);
});

test("challenge and pilot completion survive deferred scheduling and duplicate concurrent calls", async () => {
  const h = harness();
  await Promise.all([h.store.markChallengeDayDone(1), h.store.markChallengeDayDone(1), h.store.markChallengeDayDone(2)]);
  expect(JSON.parse(h.disk.get("cc.challenge.v1")!).map((x: any) => x.day)).toEqual([1, 2]);
  const module = { day: 1, primary_behavior_id: "clear", practice_id: "practice-one", module_id: "make_a_clear_ask", content_version: "v1" };
  await Promise.all([h.store.markPilotDayDone(module), h.store.markPilotDayDone(module)]);
  expect(JSON.parse(h.disk.get("cc.pilotProgress.v1")!)).toHaveLength(1);
});

test("session mutations use disk not render state and deletion failures reject", async () => {
  const h = harness({ "cc.sessions.v2": [{ id: "old", schemaVersion: 2 }] });
  await h.store.upsertSession({ id: "new", scenarioId: "chores", schemaVersion: 2 });
  expect(JSON.parse(h.disk.get("cc.sessions.v2")!).map((x: any) => x.id)).toEqual(["new", "old"]);
  await h.store.deleteSession("new");
  expect(JSON.parse(h.disk.get("cc.sessions.v2")!).map((x: any) => x.id)).toEqual(["old"]);
  h.fail(true);
  await expect(h.store.deleteAllSessions()).rejects.toThrow("disk full");
});

test("scored completion persists before success, rejects storage failure, and deduplicates", async () => {
  const h = harness();
  const record = { id: "scored", completedAt: 1 };
  h.fail(true);
  await expect(h.store.saveScoredPracticeRecord(record)).rejects.toThrow("disk full");
  expect(h.scheduled).toEqual([]);
  h.fail(false);
  await Promise.all([h.store.saveScoredPracticeRecord(record), h.store.saveScoredPracticeRecord(record)]);
  expect(JSON.parse(h.disk.get("cc.scoredPracticeHistory.v1")!)).toEqual([record]);
});

test("custom retention changes serialize with additions even without a React render", async () => {
  const h = harness();
  await h.store.addCustomScenario({ id: "memory", situation: "private" });
  expect(h.disk.has("cc.custom.v1")).toBe(false);
  await h.store.setSaveCustomScenarioText(true);
  await h.store.addCustomScenario({ id: "saved", situation: "private" });
  expect(JSON.parse(h.disk.get("cc.custom.v1")!).map((x: any) => x.id)).toEqual(["saved", "memory"]);
  await Promise.all([h.store.setSaveCustomScenarioText(false), h.store.addCustomScenario({ id: "later", situation: "private" })]);
  expect(h.disk.has("cc.custom.v1")).toBe(false);
  expect(JSON.parse(h.disk.get("cc.consent.v1")!).saveCustomScenarioText).toBe(false);
});

test("profile and entry actions reject writes before publishing success", async () => {
  const h = harness();
  h.fail(true);
  await expect(h.store.saveProfile({ focus: "work", dread: "private", outcome: "private" })).rejects.toThrow("disk full");
  await expect(h.store.beginNativeJourney()).rejects.toThrow("disk full");
  expect(h.scheduled).toEqual([]);
  h.fail(false);
  await h.store.saveProfile({ focus: "work", dread: "private", outcome: "private" });
  expect(h.disk.get("cc.profile.v1")).not.toContain("private");
});

test("wrong-shaped progress hydration cannot crash render or block valid sibling progress", async () => {
  const h = harness({ "cc.drills.v1": {}, "cc.freeze.v1": { available: 1, usedDates: {}, lastMilestone: 0 }, "cc.challenge.v1": [null], "cc.profile.v1": {}, "cc.pilotProgress.v1": [{ curriculumVersion: "v1", day: 1, behaviorId: "ask", date: "2026-09-05", completedAt: 1 }] });
  await h.hydrate();
  let store: any;
  expect(() => { store = h.render(); }).not.toThrow();
  expect(store.drillLog).toEqual([]);
  expect(store.challengeLog).toEqual([]);
  expect(store.profile).toBeNull();
  expect(store.pilotProgress).toHaveLength(1);
});

test("freeze grant persists under deferred scheduling", async () => {
  const drills = Array.from({ length: 7 }, (_, i) => ({ drillId: String(i), date: new Date(Date.now() - i * 86400000).toLocaleDateString("en-CA"), score: 80, completedAt: Date.now() - i * 86400000 }));
  const h = harness({ "cc.drills.v1": drills });
  await h.hydrate();
  h.render();
  await h.grant();
  expect(JSON.parse(h.disk.get("cc.freeze.v1") ?? "null")).toEqual({ available: 2, usedDates: [], lastMilestone: 7 });
});

test("reset waits for earlier writes so they cannot resurrect erased history", async () => {
  const h = harness();
  let release!: () => void;
  let started!: () => void;
  const began = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const write = h.storage.setItem;
  h.storage.setItem = async (key, value) => { if (key === "cc.drills.v1") { started(); await gate; } await write(key, value); };
  const saving = h.store.logDrill({ id: "old" });
  await began;
  const resetting = h.store.reset();
  await new Promise((resolve) => setTimeout(resolve, 0));
  release();
  await Promise.all([saving, resetting]);
  expect(h.disk.has("cc.drills.v1")).toBe(false);
});

for (const action of ["undo", "reset"] as const) {
  test(`global clear waits for delayed lesson ${action} so progress cannot resurrect`, async () => {
    const key = "cc.convertedLessonProgress.v1";
    const selected = completion("m2-l1", 10);
    const other = completion("m2-l2", 20);
    const h = harness({ [key]: [selected, other] });
    const snapshot = await h.store.resetConvertedLesson(selected);
    if (action === "reset") await h.store.undoConvertedLessonReset(selected.lessonId, snapshot);
    let release!: () => void;
    let started!: () => void;
    const began = new Promise<void>((resolve) => { started = resolve; });
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const write = h.storage.setItem;
    h.storage.setItem = async (k, value) => {
      if (k === key) { started(); await gate; }
      await write(k, value);
    };
    const pending = action === "undo"
      ? h.store.undoConvertedLessonReset(selected.lessonId, snapshot)
      : h.store.resetConvertedLesson(selected);
    await began;
    let cleared = false;
    const clearing = h.store.reset().then(() => { cleared = true; });
    await new Promise((resolve) => setTimeout(resolve, 0));
    const clearedBeforeWriteSettled = cleared;
    release();
    await Promise.all([pending, clearing]);
    expect(h.disk.has(key)).toBe(false);
    expect(h.render().convertedLessonProgress).toEqual([]);
    expect(clearedBeforeWriteSettled).toBe(false);
  });
}

for (const rerender of [false, true]) {
test(`lesson reset clears its exact active rehearsal without nesting the store queue (rerender: ${rerender})`, async () => {
  const selected = completion("m2-l1", 10);
  const h = harness({ "cc.convertedLessonProgress.v1": [selected] });
  const scenario = { id: "chores", category: "work" as const, title: "Chores", counterpart: "Partner", situation: "Chores", persona: "Partner", goal: "Agree", openingLine: "" };
  const run = createScenarioPracticeRun(scenario, "steady", "defensive", "run", 1);
  run.run.convertedModuleId = selected.moduleId;
  run.run.practiceId = selected.practiceId;
  await h.store.createActiveScenarioRunStrict(run);
  const store = rerender ? h.render() : h.store;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("queue deadlock")), 200); });
  try {
    const snapshot = await Promise.race([store.resetConvertedLesson(selected), timeout]);
    expect(snapshot).toEqual([selected]);
    expect(h.disk.has("cc.activeScenarioRun.v1")).toBe(false);
    expect(JSON.parse(h.disk.get("cc.convertedLessonProgress.v1")!)).toEqual([]);
    await store.undoConvertedLessonReset(selected.lessonId, snapshot);
    expect(h.disk.has("cc.activeScenarioRun.v1")).toBe(false);
    expect(JSON.parse(h.disk.get("cc.convertedLessonProgress.v1")!)).toEqual([selected]);
  } finally { clearTimeout(timer!); }
});
}

test("new-run producer refuses reusing a persisted run ID as continuation provenance", async () => {
  const h = harness();
  const scenario = { id: "chores", category: "partner" as const, title: "Chores", counterpart: "Partner", situation: "private", persona: "Partner", goal: "Agree", openingLine: "" };
  const session = createOnboardingPracticeSession("historical", "anon-one", scenario, "Agree", "defensive", 100);
  await h.store.saveActivePracticeSession(session);
  const before = h.disk.get("cc.activePracticeSession.v1");
  await expect(h.store.createCurrentOnboardingPractice(session)).rejects.toThrow("New rehearsal required");
  expect(h.disk.get("cc.activePracticeSession.v1")).toBe(before);
});

test("account association reads latest durable handoff before React renders", async () => {
  const h = harness();
  const scenario = { id: "chores", category: "partner" as const, title: "Chores", counterpart: "Partner", situation: "private", persona: "Partner", goal: "Agree", openingLine: "" };
  const session = createOnboardingPracticeSession("one", "anon-one", scenario, "Agree", "defensive", 100);
  await h.store.saveActivePracticeSession(session);
  await h.store.associateActivePracticeSessionWithUser("account-one");
  expect(JSON.parse(h.disk.get("cc.activePracticeSession.v1")!).userId).toBe("account-one");
  await expect(h.store.associateActivePracticeSessionWithUser("account-two")).rejects.toThrow();
});

test("stale anonymous saves preserve durable account ownership", async () => {
  const h = harness();
  const scenario = { id: "chores", category: "partner" as const, title: "Chores", counterpart: "Partner", situation: "private", persona: "Partner", goal: "Agree", openingLine: "" };
  const stale = createOnboardingPracticeSession("one", "anon-one", scenario, "Agree", "defensive", 100);
  await h.store.saveActivePracticeSession(stale);
  await h.store.associateActivePracticeSessionWithUser("account-a");
  await h.store.saveActivePracticeSession(stale);
  expect(JSON.parse(h.disk.get("cc.activePracticeSession.v1")!).userId).toBe("account-a");
  expect(h.render().activePracticeSession.userId).toBe("account-a");
  await expect(h.store.associateActivePracticeSessionWithUser("account-b")).rejects.toThrow("another account");
});

test("ordinary saves reject a foreign owner without publishing or changing disk", async () => {
  const h = harness();
  const scenario = { id: "chores", category: "partner" as const, title: "Chores", counterpart: "Partner", situation: "private", persona: "Partner", goal: "Agree", openingLine: "" };
  const session = createOnboardingPracticeSession("one", "anon-one", scenario, "Agree", "defensive", 100);
  await h.store.saveActivePracticeSession(session);
  await h.store.associateActivePracticeSessionWithUser("account-a");
  const before = h.disk.get("cc.activePracticeSession.v1");
  const publications = h.scheduled.length;
  await expect(h.store.saveActivePracticeSession({ ...session, userId: "account-b" })).rejects.toThrow("another account");
  expect(h.disk.get("cc.activePracticeSession.v1")).toBe(before);
  expect(h.scheduled.length).toBe(publications);
});

test("a stale opted-in render cannot persist private run text after revocation", async () => {
  const h = harness({ "cc.consent.v1": { ...DEFAULT_CONSENT, saveCustomScenarioText: true } });
  await h.hydrate();
  const stale = h.render();
  await stale.setSaveCustomScenarioText(false);
  const scenario = { id: "custom-private", isCustom: true, category: "work" as const, title: "PRIVATE", counterpart: "PRIVATE", situation: "PRIVATE", persona: "PRIVATE", goal: "PRIVATE", openingLine: "PRIVATE" };
  await stale.createActiveScenarioRunStrict(createScenarioPracticeRun(scenario, "steady", "defensive", "private-run", 1));
  expect(h.disk.get("cc.activeScenarioRun.v1")).not.toContain("PRIVATE");
});

test("malformed profile hydration removes private text rather than retaining a backup", async () => {
  const h = harness({ "cc.profile.v1": { dread: "SECRET", outcome: "SECRET" }, "cc.drills.v1": {} });
  await h.hydrate();
  expect(h.disk.get("cc.profile.v1") ?? "").not.toContain("SECRET");
  await h.store.logDrill({ drillId: "valid", date: "2026-09-05", completedAt: 1, score: 80 });
  expect(JSON.parse(h.disk.get("cc.drills.v1")!)).toHaveLength(1);
});

test("one storage read failure does not discard healthy sibling progress", async () => {
  const h = harness({ "cc.challenge.v1": [{ day: 1, date: "2026-09-05", completedAt: 1 }] });
  const read = h.storage.getItem;
  h.storage.getItem = async (key) => { if (key === "cc.profile.v1") throw new Error("read failed"); return read(key); };
  await h.hydrate();
  expect(h.render().challengeLog).toHaveLength(1);
});

test("session migration failure does not suppress healthy pilot hydration", async () => {
  const h = harness({ "cc.pilotProgress.v1": [{ curriculumVersion: "v1", day: 1, behaviorId: "ask", date: "2026-09-05", completedAt: 1 }] });
  const read = h.storage.getItem;
  h.storage.getItem = async (key) => { if (key === "cc.sessions.v2") throw new Error("read failed"); return read(key); };
  await h.hydrate();
  expect(h.render().pilotProgress).toHaveLength(1);
});

test("completion cleanup callback can mark its journal without queue deadlock", async () => {
  const h = harness();
  const scenario = { id: "chores", category: "work" as const, title: "Chores", counterpart: "Partner", situation: "Chores", persona: "Partner", goal: "Agree", openingLine: "" };
  const run = createScenarioPracticeRun(scenario, "steady", "defensive", "run", 1);
  await h.store.createActiveScenarioRunStrict(run);
  const clearing = h.store.clearActiveScenarioRunStrict({ runId: "run", updatedAt: 1 }, () => h.store.markPendingConvertedLessonPrivateContentDeleted("run"));
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error("queue deadlock")), 100); });
  try { await expect(Promise.race([clearing, timeout])).rejects.toThrow("Pending completion identity changed"); }
  finally { clearTimeout(timer!); }
});

test("active handoff writes reject storage errors before publication", async () => {
  const h = harness();
  h.fail(true);
  await expect(h.store.saveActivePracticeSession(null)).rejects.toThrow("disk full");
  expect(h.scheduled).toEqual([]);
});

test("freeze spending is durable and concurrent spending is idempotent", async () => {
  const h = harness();
  expect(await Promise.all([h.store.spendStreakFreeze(), h.store.spendStreakFreeze()])).toEqual([true, false]);
  expect(JSON.parse(h.disk.get("cc.freeze.v1")!).available).toBe(0);
});
