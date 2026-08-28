import { describe, expect, test } from "bun:test";

import { authorizedDeckHtml, installTapTutorialDismissal, materializeApprovedDeckHtml, removeM1L1OutcomePreview, removeRehearsalContinuationCopy } from "../lib/approvedDeckLoader";

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

  test("retries transient archive failures and lets a failed WebView load be retried in place", async () => {
    const loader = await source("lib/approvedDeckLoader.ts");
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    expect(loader).toContain("ARCHIVE_LOAD_ATTEMPTS = 3");
    expect(loader).toContain("ARCHIVE_LOAD_TIMEOUT_MS = 12_000");
    expect(loader).toContain("for (let attempt = 0; attempt < ARCHIVE_LOAD_ATTEMPTS; attempt += 1)");
    expect(loader).toContain("controller.abort()");
    expect(deckScreen).toContain('label="Try again"');
    expect(deckScreen).toContain("setLoadAttempt((current) => current + 1)");
    expect(deckScreen).toContain("lesson, loadAttempt, rehearsalConfig");
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
    expect(deckScreen).toContain('message.type === "deck-render-error"');
    expect(deckScreen).toContain("setLoadError(true)");
    expect(deckScreen).not.toContain("Asset.fromModule");
    expect(deckScreen).not.toContain("downloadAsync");
  });

  test("materializes every approved deck with safe runtime order and mount monitoring", async () => {
    const sourceOrders = new Map<string, "react-first" | "react-dom-first">();

    for (const [fileName, limit] of Object.entries(DECK_LIMITS)) {
      const bundle = await source(`assets/lesson-decks/${fileName}`);
      const externalEncoded = bundle.match(/<script type="__bundler\/ext_resources">\s*(.*?)\s*<\/script>/s)?.[1];
      expect(externalEncoded).toBeTruthy();
      const externalResources = JSON.parse(externalEncoded!) as { id: string }[];
      const sourceReactIndex = externalResources.findIndex(({ id }) => /\/react@[^/]+\/umd\/react\./i.test(id));
      const sourceReactDomIndex = externalResources.findIndex(({ id }) => /\/react-dom@/i.test(id));
      expect(sourceReactIndex).toBeGreaterThan(-1);
      expect(sourceReactDomIndex).toBeGreaterThan(-1);
      sourceOrders.set(fileName, sourceReactIndex < sourceReactDomIndex ? "react-first" : "react-dom-first");

      const page = materializeApprovedDeckHtml(bundle);
      const reactIndex = page.indexOf("react.production.min.js");
      const reactDomIndex = page.indexOf("react-dom.production.min.js");
      expect(page.startsWith("<!DOCTYPE html>")).toBe(true);
      expect(page).toContain('data-bysi="deck"');
      expect(cardNumbers(page)).toEqual(Array.from({ length: limit }, (_, index) => index + 1));
      expect(reactIndex).toBeGreaterThan(-1);
      expect(reactDomIndex).toBeGreaterThan(reactIndex);
      expect(page).toContain("class Component extends DCLogic");
      expect(page).toContain('post("deck-ready", runtimeFailure || "none")');
      expect(page).toContain('post("deck-render-error", runtimeFailure || "mount-timeout")');
      expect(page).toContain('window.addEventListener("error"');
      expect(page).toContain('runtimeFailure = "javascript-error"');
      expect(page).toContain('window.addEventListener("unhandledrejection"');
      expect(page).toContain('runtimeFailure = "unhandled-rejection"');
      expect(page).toContain('attempts >= 120');
      expect(page).toContain('post("deck-render-error", runtimeFailure || "mount-timeout")');
      expect(page).not.toContain('window.addEventListener("error", function () { post("deck-render-error")');
      expect(page).not.toContain('window.addEventListener("unhandledrejection", function () { post("deck-render-error")');
      expect(page).toContain("document.querySelector('[data-bysi=\"deck\"]')");
      expect(page).toContain('id="bysi-native-deck-shell"');
      expect(page).not.toContain("__bundler_loading");
      expect(page).not.toContain('type="__bundler/manifest"');
      expect(page).not.toMatch(/<script\s+src=/i);
      expect(page).not.toContain("blob:");
    }

    expect(sourceOrders.get("M1-L3-Park-and-Return.html")).toBe("react-dom-first");
    expect(sourceOrders.get("M1-Close.html")).toBe("react-dom-first");
    expect(sourceOrders.size).toBe(12);
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

  test("uses the first tutorial tap only to dismiss the hint and keeps Card 1 visible", async () => {
    let tutorialDeckCount = 0;
    for (const fileName of Object.keys(DECK_LIMITS)) {
      const template = approvedTemplate(await source(`assets/lesson-decks/${fileName}`));
      const hasTutorial = template.includes("showHint:st.hint && i === 0,");
      const installed = installTapTutorialDismissal(template);
      if (!hasTutorial) {
        expect(installed).toBe(template);
        continue;
      }
      tutorialDeckCount += 1;
      expect(installed).toContain("go(d) {\n    if (this.state.hint && this.state.i === 0)");
      expect(installed).toContain("this.setState({ hint:false });\n      return;");
      expect((installed.match(/if \(this\.state\.hint && this\.state\.i === 0\)/g) ?? [])).toHaveLength(1);
    }
    expect(tutorialDeckCount).toBe(11);

    const m1L2Page = materializeApprovedDeckHtml(await source("assets/lesson-decks/M1-L2-Cut-the-Case.html"));
    expect(m1L2Page).toContain("go(d) {\n    if (this.state.hint && this.state.i === 0)");
  });

  test("removes the redundant voice-engine continuation paragraph from every handoff that contains it", async () => {
    const paragraphStart = "The rehearsal runs in the voice engine.";
    let affectedDeckCount = 0;
    for (const fileName of Object.keys(DECK_LIMITS)) {
      const template = approvedTemplate(await source(`assets/lesson-decks/${fileName}`));
      const cleaned = removeRehearsalContinuationCopy(template);
      if (!template.includes(paragraphStart)) {
        expect(cleaned).toBe(template);
        continue;
      }
      affectedDeckCount += 1;
      expect(cleaned).not.toContain(paragraphStart);
      expect(cleaned).toContain("Now say it out loud");
      expect(cleaned).toContain("Start rehearsal");
    }
    expect(affectedDeckCount).toBe(1);
  });

  test("removes the entire M1 L1 What happens card from the approved handoff", async () => {
    const template = approvedTemplate(await source("assets/lesson-decks/M1-L1-Buried-Point.html"));
    expect(template).toContain("What happens");
    const cleaned = removeM1L1OutcomePreview(template);
    expect(cleaned).not.toMatch(/<span\b[^>]*>\s*What happens\s*<\/span>/i);
    expect(cleaned).not.toMatch(/<span\b[^>]*>\s*You open\.\s*Adam pushes back twice\./i);
    expect(cleaned).toContain("Start rehearsal");
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

  test("opens every rehearsal runtime directly and silently preserves conflicts first", async () => {
    const rehearsalRoute = await source("app/approved-rehearsal/[lessonId].tsx");
    expect(rehearsalRoute).toContain('hasConflict ? "preserving" : "starting"');
    expect(rehearsalRoute).toContain("await archiveActiveScenarioRunStrict(expected)");
    expect(rehearsalRoute).toContain('setStep("starting")');
    expect(rehearsalRoute).toContain("void startRuntime()");
    expect(rehearsalRoute).toContain("preservationStarted.current");
    expect(rehearsalRoute).not.toContain("SAVED REHEARSAL FOUND");
    expect(rehearsalRoute).not.toContain("BEFORE YOU PRACTICE");
    expect(rehearsalRoute).not.toContain("THE {config?.scenario.category.toUpperCase()} SCENE");
    expect(rehearsalRoute).not.toContain('label="Start rehearsal"');
  });

  test("removes the unsafe-practice exit from every approved rehearsal runtime", async () => {
    const rehearsalRoute = await source("app/approved-rehearsal/[lessonId].tsx");
    const sharedRuntime = await source("components/ScenarioPaidPractice.tsx");
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    const implementation = `${rehearsalRoute}\n${sharedRuntime}\n${m1L1Runtime}`;
    expect(implementation).not.toContain("This doesn’t feel safe to practice");
    expect(implementation).not.toContain("onSafetyExit");
    expect(implementation).not.toContain("different-route");
    expect(implementation).not.toContain("A DIFFERENT ROUTE MAY FIT BETTER");
  });

  test("shows the onboarding-style thinking indicator while lesson counterparts respond", async () => {
    const sharedRuntime = await source("components/ScenarioPaidPractice.tsx");
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(sharedRuntime).toContain("<Thinking />");
    expect(sharedRuntime).toContain("is thinking…");
    expect(sharedRuntime).toContain('accessibilityLiveRegion="polite"');
    expect(m1L1Runtime).toContain("<Thinking />");
    expect(m1L1Runtime).toContain("Adam is thinking…");
    expect(m1L1Runtime).toContain('accessibilityLiveRegion="polite"');
  });

  test("labels the lesson comparison CTA by the results screen it opens", async () => {
    const sharedRuntime = await source("components/ScenarioPaidPractice.tsx");
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(sharedRuntime).toContain('label={isLessonPractice ? "See my results" : "Continue"}');
    expect(m1L1Runtime).toContain('label="See my results"');
    expect(m1L1Runtime).not.toContain('label="Return to the lesson"');
  });

  test("gives the learner a concrete M1 L1 setup and an optional non-scripted opener hint", async () => {
    const conversion = await source("lib/convertedLesson.ts");
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(conversion).toContain("weekly client file");
    expect(conversion).toContain("Yesterday it arrived at 4:20 PM");
    expect(conversion).toContain("before the 5:00 PM deadline");
    expect(conversion).toContain("This has happened twice this month");
    expect(conversion).toContain("send future files by noon");
    expect(m1L1Runtime).toContain("Need help starting?");
    expect(m1L1Runtime).toContain("Describe one thing Adam could have done differently. Then say what you need going forward.");
    expect(m1L1Runtime).toContain("isOpenerHintVisible ?");
    expect(m1L1Runtime).not.toContain('Shape: “When');
  });

  test("uses the shortened seven-step M1 L1 flow without a second learner response", async () => {
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(m1L1Runtime).toContain("`Step ${step} of 7`");
    expect(m1L1Runtime).toContain("Seven-step rehearsal progress.");
    expect(m1L1Runtime).toContain("(step / 7) * 100");
    expect(m1L1Runtime).not.toContain('kind="response-two"');
    expect(m1L1Runtime).not.toContain("confirmSecondResponse");
    expect(m1L1Runtime).not.toContain("Optional final retry");
    expect(m1L1Runtime).not.toContain('kind="final-retry"');
    expect(m1L1Runtime).toContain('state: "attempt_comparison" as const');
    expect(m1L1Runtime).toContain("A strong version");
  });

  test("shows each approved M1 L1 transcript as a sent message while Adam thinks", async () => {
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    const firstApproval = m1L1Runtime.indexOf('preserveScenarioAttempt(value, "opener"');
    const firstPersist = m1L1Runtime.indexOf("await persist(approved)", firstApproval);
    const firstGenerate = m1L1Runtime.indexOf("await generateM1L1DynamicReply", firstPersist);
    const secondApproval = m1L1Runtime.indexOf('preserveScenarioAttempt(value, "response"');
    const secondPersist = m1L1Runtime.indexOf("await persist(approved)", secondApproval);
    const secondGenerate = m1L1Runtime.indexOf("await generateM1L1DynamicReply", secondPersist);
    expect(firstApproval).toBeGreaterThan(-1);
    expect(firstApproval).toBeLessThan(firstPersist);
    expect(firstPersist).toBeLessThan(firstGenerate);
    expect(secondApproval).toBeGreaterThan(firstGenerate);
    expect(secondApproval).toBeLessThan(secondPersist);
    expect(secondPersist).toBeLessThan(secondGenerate);
    expect(m1L1Runtime).toContain('const isReview = state.startsWith("confirm_") && !busy;');
    expect(m1L1Runtime).not.toContain("<ActivityIndicator");
  });

  test("keeps the latest M1 L1 chat transition visible as content grows", async () => {
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(m1L1Runtime).toContain("shouldAutoScrollRef.current = true");
    expect(m1L1Runtime).toContain("scrollViewRef.current?.scrollToEnd({ animated: true })");
    expect(m1L1Runtime).toContain("onContentSizeChange={handleContentSizeChange}");
  });

  test("prepares M1 L1 audio before revealing Adam's persisted text, then starts it after the reveal paint", async () => {
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    const firstPrepare = m1L1Runtime.indexOf("await preparePilotAudio(lineFor(selected))");
    const firstPersist = m1L1Runtime.indexOf("await replaceActiveScenarioRunStrict(ready, activeRunRevision(approved))", firstPrepare);
    const firstPaint = m1L1Runtime.indexOf("await afterNextPaint()", firstPersist);
    const firstPlay = m1L1Runtime.indexOf("await playPreparedPilotAudio()", firstPaint);
    expect(firstPrepare).toBeGreaterThan(-1);
    expect(firstPrepare).toBeLessThan(firstPersist);
    expect(firstPersist).toBeLessThan(firstPaint);
    expect(firstPaint).toBeLessThan(firstPlay);

    const secondPrepare = m1L1Runtime.indexOf("await preparePilotAudio(lineFor(trap))");
    const secondPersist = m1L1Runtime.indexOf("await replaceActiveScenarioRunStrict(coached, activeRunRevision(approved))", secondPrepare);
    const secondPaint = m1L1Runtime.indexOf("await afterNextPaint()", secondPersist);
    const secondPlay = m1L1Runtime.indexOf("await playPreparedPilotAudio()", secondPaint);
    expect(secondPrepare).toBeGreaterThan(firstPlay);
    expect(secondPrepare).toBeLessThan(secondPersist);
    expect(secondPersist).toBeLessThan(secondPaint);
    expect(secondPaint).toBeLessThan(secondPlay);
  });

  test("bounds Stop and opens transcript review safely across every interactive approved lesson", async () => {
    const sharedRuntime = await source("components/ScenarioPaidPractice.tsx");
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    const dictation = await source("lib/useDictation.ts");
    const transcription = await source("lib/transcription.ts");
    const rehearsalConfigs = await source("lib/approvedRehearsals.ts");

    expect((rehearsalConfigs.match(/lessonId: "m[12]-l[1-5]"/g) ?? [])).toHaveLength(9);
    expect(dictation).toContain("WEB_RECORDER_STOP_TIMEOUT_MS = 1_500");
    expect(dictation).toContain("await stopWebRecorder(webRecorder)");
    expect(transcription).toContain("TRANSCRIPTION_TIMEOUT_MS = 45_000");
    expect(transcription).toContain("signal: controller.signal");
    for (const runtime of [m1L1Runtime, sharedRuntime]) {
      expect(runtime).toContain("Preparing your transcript…");
      expect(runtime).toContain("Your recording has stopped. You’ll approve the wording next.");
      expect(runtime).toContain("recording stop failed");
      expect(runtime).toContain("captureTransitionInFlightRef.current");
      expect(runtime).toContain("confirm_retry_transcript");
    }
  });

  test("serializes typed transcript approvals and catches stale-write protection without a developer error toast", async () => {
    const m1L1Runtime = await source("components/M1L1PaidPractice.tsx");
    expect(m1L1Runtime).toContain("approvalInFlightRef.current");
    expect(m1L1Runtime).toContain("captureTransitionInFlightRef.current");
    expect(m1L1Runtime).toContain("if (!value || draft.trim().length < 2 || approvalInFlightRef.current) return");
    expect(m1L1Runtime).toContain("typed transcript transition failed");
    expect(m1L1Runtime).toContain("first response approval failed");
    expect(m1L1Runtime).toContain("persist(coached).catch");
    expect(m1L1Runtime).toContain("replayTransitionInFlightRef.current");
    expect(m1L1Runtime).toContain("recording start failed");
    expect(m1L1Runtime).toContain("recording stop failed");
    expect(m1L1Runtime).toContain("Preparing your transcript…");
    expect(m1L1Runtime).toContain("Your recording has stopped. You’ll approve the wording next.");
    expect(m1L1Runtime).toContain("flagged replay failed");
    expect(m1L1Runtime).not.toContain("void persist(coached);");
    expect(m1L1Runtime).not.toContain("void unlockAudioPlayback();");
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

  test("keeps deck review isolated from purchases while giving every approved rehearsal a native evidence-based completion", async () => {
    const catalog = await source("constants/approvedLessons.ts");
    const catalogScreen = await source("app/approved-lessons.tsx");
    const deckScreen = await source("app/approved-lesson/[lessonId].tsx");
    const implementation = `${catalog}\n${catalogScreen}\n${deckScreen}`;
    expect(implementation).not.toContain("useIsPro");
    expect(implementation).not.toContain("purchasePackage");
    expect(implementation).not.toContain("restorePurchases");
    expect(deckScreen).toContain("m1L1IndexImpact");
    expect(deckScreen).toContain("approvedRehearsalIndexImpact");
    expect(deckScreen).toContain("approvedRehearsalStrongVersion");
    expect(deckScreen).toContain("saveScoredPracticeRecord");
    expect(deckScreen).toContain("Same moment · before and after");
    expect(deckScreen).toContain("A strong version");
    expect(deckScreen).toContain("Done — back to Home");
    expect(deckScreen).toContain("Animated.timing(indexProgress");
    expect(deckScreen).toContain("useReducedMotion()");
    expect(deckScreen).toContain("announceForAccessibility");
    expect(deckScreen).toContain("Communication Index moved from");
    expect(deckScreen).not.toContain("approved move auto-save failed");
    expect(deckScreen).not.toContain("approvedMoveSavedAt: Date.now()");
    expect(deckScreen).not.toContain("if (isM1L1 && isReturning && hasValidReturn");
    expect(deckScreen).toContain("isStrongVersionSaved && strongVersion");
    expect(deckScreen).toContain("Your rehearsal transcript will be deleted");
    expect(deckScreen).not.toContain("Optional custom wording");
    expect(implementation).not.toContain("AsyncStorage");
  });
});
