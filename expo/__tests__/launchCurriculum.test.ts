import {
  LAUNCH_CURRICULUM_MODULES,
  LAUNCH_DECK_IDS,
  launchModuleCompletion,
  mergeModuleCloseProgress,
  nextLaunchDeck,
  normalizeModuleCloseProgress,
} from "@/lib/launchCurriculum";
import { completeModuleCloseDeckHtml } from "@/lib/approvedDeckLoader";

const source = (path: string): Promise<string> => Bun.file(`${import.meta.dir}/../${path}`).text();
const approvedTemplate = (html: string): string => {
  const encoded = html.match(/<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s)?.[1];
  if (!encoded) throw new Error("missing template");
  return JSON.parse(encoded) as string;
};
const cardNumbers = (template: string): number[] => {
  const start = template.indexOf("const CARDS = [");
  const end = template.indexOf("\n];", start);
  return Array.from(template.slice(start, end).matchAll(/\{ n:(\d+), type:/g), (match) => Number(match[1]));
};

describe("customer launch curriculum", () => {
  test("contains exactly two modules with five approved lessons and one close in source order", () => {
    expect(LAUNCH_CURRICULUM_MODULES).toHaveLength(2);
    expect(LAUNCH_CURRICULUM_MODULES.map((module) => module.deckIds)).toEqual([
      ["m1-l1", "m1-l2", "m1-l3", "m1-l4", "m1-l5", "m1-close"],
      ["m2-l1", "m2-l2", "m2-l3", "m2-l4", "m2-l5", "m2-close"],
    ]);
    expect(LAUNCH_DECK_IDS).toHaveLength(12);
  });

  test("progresses through every lesson, each close, and then finishes", () => {
    const lessonProgress = LAUNCH_DECK_IDS.filter((id) => !id.endsWith("-close")).map((lessonId, index) => ({ lessonId, completedAt: index + 1 }));
    expect(nextLaunchDeck([], [])).toBe("m1-l1");
    expect(nextLaunchDeck(lessonProgress.slice(0, 5), [])).toBe("m1-close");
    expect(nextLaunchDeck(lessonProgress.slice(0, 5), [{ lessonId: "m1-close", module: 1, completedAt: 10, sourceLineage: "approved-r2-close-deck" }])).toBe("m2-l1");
    expect(nextLaunchDeck(lessonProgress, [
      { lessonId: "m1-close", module: 1, completedAt: 10, sourceLineage: "approved-r2-close-deck" },
      { lessonId: "m2-close", module: 2, completedAt: 20, sourceLineage: "approved-r2-close-deck" },
    ])).toBeUndefined();
  });

  test("normalizes close completion without accepting invented or mismatched records", () => {
    const valid = { lessonId: "m1-close", module: 1, completedAt: 10, sourceLineage: "approved-r2-close-deck" } as const;
    expect(normalizeModuleCloseProgress([valid, { ...valid, lessonId: "m2-close" }, { ...valid, completedAt: Number.NaN }])).toEqual([valid]);
    expect(launchModuleCompletion(1, [], [valid])).toBe(true);
    expect(launchModuleCompletion(2, [], [valid])).toBe(false);
    expect(mergeModuleCloseProgress([valid], { ...valid, completedAt: 20 })).toEqual([{ ...valid, completedAt: 20 }]);
  });

  test("routes release customers only through approved launch decks and persists close completion", async () => {
    const path = await source("app/path.tsx");
    const today = await source("app/(tabs)/index.tsx");
    const lessonRoute = await source("app/approved-lesson/[lessonId].tsx");
    const store = await source("providers/store.tsx");
    expect(path).toContain("LAUNCH_CURRICULUM_MODULES");
    expect(path).not.toContain("pathPresentation");
    expect(today).toContain("nextLaunchDeck");
    expect(today).not.toContain("nextReviewPractice");
    expect(lessonRoute).not.toContain('if (!__DEV__) {\n    return <Unavailable title="Lesson review is unavailable.');
    expect(lessonRoute).toContain("loadModuleCloseDeckHtml");
    expect(lessonRoute).toContain("saveModuleCloseCompletion");
    expect(store).toContain('moduleCloseProgress: "cc.moduleCloseProgress.v1"');
    expect(store).toContain("saveModuleCloseCompletion");
  });
});

describe("complete approved module-close decks", () => {
  for (const [fileName, expectedTypes] of [
    ["M1-Close.html", ["Your moves", "Transfer", "Bridge"]],
    ["M2-Close.html", ["Your moves", "Transfer", "Bridge"]],
  ] as const) {
    test(`${fileName} exposes the complete canonical nine-card inventory`, async () => {
      const raw = await source(`assets/lesson-decks/${fileName}`);
      expect(cardNumbers(approvedTemplate(raw))).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      const completed = completeModuleCloseDeckHtml(raw);
      const template = approvedTemplate(completed);
      expect(cardNumbers(template)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expectedTypes.forEach((type, index) => expect(template).toContain(`{ n:${index + 7}, type:'${type}'`));
      expect(template).toContain("isMoves:!!c.moves");
      expect(template).toContain("isTransfer:!!c.transfer");
      expect(template).toContain("isBridge:!!c.bridge");
    });
  }
});

describe("narrow-card and reduced-motion regressions", () => {
  test("M1 L3 Card 19 and M2 L2 Card 11 can scroll above the fixed footer at 393 and 380 widths", async () => {
    const m1l3 = approvedTemplate(await source("assets/lesson-decks/M1-L3-Park-and-Return.html"));
    const m2l2 = approvedTemplate(await source("assets/lesson-decks/M2-L2-Say-Who.html"));
    expect(m1l3).toContain('data-bysi-card-content="quiz" style="flex:1;display:flex;flex-direction:column;gap:10px;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;padding:0 20px 8px"');
    expect(m2l2).toContain('data-bysi-card-content="standard" style="flex:1;display:flex;flex-direction:column;gap:20px;min-height:0;overflow-y:auto;overscroll-behavior-y:contain;padding-bottom:8px"');
  });

  test("M2 Close Card 6 derives its final still immediately under reduced motion and schedules beats outside render", async () => {
    const template = approvedTemplate(completeModuleCloseDeckHtml(await source("assets/lesson-decks/M2-Close.html")));
    expect(template).toContain("const beat = !mo && c.chain ? 2 : st.beat;");
    expect(template).not.toContain("if (c.chain) this.runBeats();");
    expect(template).toContain("this.setState({ i:n, hint:false }, () => this.runBeats());");
    expect(template).not.toContain("if (!mo) { this.setState({ beat:2 }); return; }");
  });
});
