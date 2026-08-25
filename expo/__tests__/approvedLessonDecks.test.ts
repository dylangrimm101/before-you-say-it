import { describe, expect, test } from "bun:test";

import { authorizedDeckHtml, materializeApprovedDeckHtml } from "../lib/approvedDeckLoader";

const DECK_LIMITS = {
  "M1-L1-Buried-Point.html": 20,
  "M1-L2-Cut-the-Case.html": 20,
  "M1-L3-Park-and-Return.html": 20,
  "M1-L4-Make-It-Repeatable.html": 17,
  "M1-L5-Fit-in-One.html": 18,
  "M1-Close.html": 6,
  "M2-L1-Clear-Ask.html": 20,
  "M2-L2-Say-Who.html": 20,
  "M2-L3-When-They-Say-They-Cant.html": 20,
  "M2-L4-Say-Whether-No.html": 20,
  "M2-L5-Ask-for-the-Loop.html": 20,
  "M2-Close.html": 6,
} as const;

async function source(path: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../${path}`).text();
}

function approvedTemplate(bundle: string): string {
  const match = bundle.match(/<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s);
  if (!match?.[1]) throw new Error("Approved deck template is missing");
  return JSON.parse(match[1]) as string;
}

function cardNumbers(template: string): number[] {
  const start = template.indexOf("const CARDS = [");
  const end = template.indexOf("\n];", start);
  if (start < 0 || end < 0) throw new Error("Approved card inventory is missing");
  return Array.from(template.slice(start, end).matchAll(/\{ n:(\d+), type:/g), (match) => Number(match[1]));
}

describe("approved Modules 1 and 2 internal deck port", () => {
  test("catalogs exactly twelve approved decks and preserves the ruled identities", async () => {
    const catalog = await source("constants/approvedLessons.ts");
    expect((catalog.match(/id: "m[12]-(?:l[1-5]|close)"/g) ?? []).length).toBe(12);
    expect(catalog).toContain('id: "m1-l4"');
    expect(catalog).toContain("cardCount: 19");
    expect(catalog).toContain("reviewThroughCard: 17");
    expect(catalog).toContain("rehearsalReturnCard: 18");
    expect(catalog).toContain('id: "m1-l5"');
    expect(catalog).toContain("rehearsalReturnCard: 19");
    expect(catalog).toContain("Hear it. Trade one thing. Say where it stands.");
    expect(catalog).toContain("Ask for the loop, not the last step.");
  });

  test("packages only the authorized review slice of every approved deck", async () => {
    for (const [fileName, limit] of Object.entries(DECK_LIMITS)) {
      const bundle = await source(`assets/lesson-decks/${fileName}`);
      const template = approvedTemplate(bundle);
      const numbers = cardNumbers(template);
      expect(numbers).toHaveLength(limit);
      expect(numbers.at(-1)).toBe(limit);
      expect(template).not.toContain(`{ n:${limit + 1}, type:`);
    }
  });

  test("does not package deferred prototype voice or continuation copy", async () => {
    for (const fileName of Object.keys(DECK_LIMITS)) {
      const template = approvedTemplate(await source(`assets/lesson-decks/${fileName}`));
      expect(template).not.toContain("Continue lesson preview");
      expect(template).not.toContain("Start voice rehearsal");
      expect(template).not.toContain("Voice-engine handoff preview");
      expect(template).not.toContain('value="{{ handoffOpen }}"');
      expect(template).not.toMatch(/<button[^>]*data-sheet-primary/);
    }
  });

  test("loads decks without relying on unsupported live-preview HTML asset URLs", async () => {
    const catalog = await source("constants/approvedLessons.ts");
    const loader = await source("lib/approvedDeckLoader.ts");
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    expect(catalog).toContain('archivePath: "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html"');
    expect(catalog).not.toContain("deckHtml: require");
    expect(loader).toContain("unzipSync");
    expect(loader).toContain("authorizedDeckHtml");
    expect(deckScreen).toContain("loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard)");
    expect(deckScreen).toContain('source={{ html: deckHtml, baseUrl: "about:blank" }}');
    expect(deckScreen).not.toContain("Asset.fromModule");
    expect(deckScreen).not.toContain("downloadAsync");
  });

  test("materializes approved decks without blob scripts or the artifact unpacker", async () => {
    const bundle = await source("assets/lesson-decks/M1-L1-Buried-Point.html");
    const page = materializeApprovedDeckHtml(bundle);
    expect(page.startsWith("<!DOCTYPE html>")).toBe(true);
    expect(page).toContain("window.React");
    expect(page).toContain("window.ReactDOM");
    expect(page).toContain("class Component extends DCLogic");
    expect(page).toContain("data:font/woff2;base64,");
    expect(page).toContain('id="bysi-native-deck-shell"');
    expect(page).toContain('body *{visibility:hidden!important}');
    expect(page).toContain('[data-bysi="deck"],[data-bysi="deck"] *{visibility:visible!important}');
    expect(page).toContain('position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important');
    expect(page).not.toContain("__bundler_loading");
    expect(page).not.toContain('type="__bundler/manifest"');
    expect(page).not.toMatch(/<script\s+src=/i);
    expect(page).not.toContain("blob:");
  });

  test("re-verifies every fetched deck against its authorized boundary before display", async () => {
    for (const [fileName, limit] of Object.entries(DECK_LIMITS)) {
      const approvedSlice = await Bun.file(`${import.meta.dir}/../assets/lesson-decks/${fileName}`).text();
      const sanitized = authorizedDeckHtml(approvedSlice, limit);
      const template = approvedTemplate(sanitized);
      expect(cardNumbers(template)).toHaveLength(limit);
      expect(template).not.toContain(`{ n:${limit + 1}, type:`);
      expect(template).not.toContain("Voice-engine handoff preview");
      expect(template).not.toContain('value="{{ handoffOpen }}"');
      expect(template).not.toMatch(/<button[^>]*data-sheet-primary/);
    }
  });

  test("gives every approved deck a protected central overflow pane", async () => {
    const panePattern = /<div style="flex:1;position:relative;display:flex;flex-direction:column;min-height:0">\s*<div style="[^"]*flex:1[^"]*min-height:0[^"]*overflow:hidden[^"]*"/s;
    for (const fileName of Object.keys(DECK_LIMITS)) {
      const template = approvedTemplate(await source(`assets/lesson-decks/${fileName}`));
      expect(template).toMatch(panePattern);
    }
  });

  test("makes every card type scrollable when its approved content exceeds the frame", async () => {
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    expect(deckScreen).toContain("function protectScrollableCardContent()");
    expect(deckScreen).toContain('child.style.position === "relative" && child.style.minHeight === "0px"');
    expect(deckScreen).toContain('contentPane.style.overflowY = "auto"');
    expect(deckScreen).toContain('contentPane.style.webkitOverflowScrolling = "touch"');
    expect(deckScreen).toContain('contentPane.setAttribute("data-bysi-scrollable-content", "true")');
    expect(deckScreen).toContain("protectScrollableCardContent();");
    expect(deckScreen).toContain("animation-duration:.001ms!important");
    expect(deckScreen).toContain('document.getElementById("__bundler_err")');
    expect(deckScreen).toContain("suppressArtifactHostDiagnostic();");
  });

  test("keeps the catalog and deck route fail-closed outside development", async () => {
    const catalogScreen = await source("app/approved-lessons.tsx");
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    const qa = await source("app/qa-access.tsx");
    expect(catalogScreen).toContain("if (!__DEV__)");
    expect(deckScreen).toContain("if (!__DEV__)");
    expect(qa).toContain('router.push("/approved-lessons")');
    expect(deckScreen).toContain('var blockedLabels = ${isConverted ? "[]"');
    expect(deckScreen).toContain('["start rehearsal", "start voice rehearsal", "continue lesson preview"]');
    expect(deckScreen).toContain("conversionRuntimeEnabled(params.lessonId)");
  });

  test("keeps the new deck review isolated from purchases, persistence, and legacy scores", async () => {
    const catalog = await source("constants/approvedLessons.ts");
    const catalogScreen = await source("app/approved-lessons.tsx");
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    const implementation = `${catalog}\n${catalogScreen}\n${deckScreen}`;
    expect(implementation).not.toContain("useIsPro");
    expect(implementation).not.toContain("purchasePackage");
    expect(implementation).not.toContain("restorePurchases");
    expect(implementation).not.toContain("scoredPracticeHistory");
    expect(implementation).not.toContain("saveScoredPracticeRecord");
    expect(implementation).not.toContain("AsyncStorage");
  });
});
