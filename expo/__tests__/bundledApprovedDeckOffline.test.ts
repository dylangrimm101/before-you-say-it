import { afterAll, expect, mock, test } from "bun:test";
import { createHash } from "node:crypto";
// Bun cannot import PNG modules; strip only thumbnail requires from the real catalog.
const catalogSource = await Bun.file(`${import.meta.dir}/../constants/approvedLessons.ts`).text();
const catalogJs = new Bun.Transpiler({ loader: "ts" }).transformSync(catalogSource.replace(/require\("\.\.\/assets\/lesson-thumbnails\/[^"\n]+"\)/g, "null"));
const { APPROVED_LESSON_DECKS } = await import(`data:text/javascript;base64,${Buffer.from(catalogJs).toString("base64")}`);

// Substitute Metro's asset registry and native bridges, never authored content.
const sources: Record<string, string> = {};
const assetPaths: string[] = [];
for (const lesson of APPROVED_LESSON_DECKS) {
  const path = `${import.meta.dir}/../assets/approved-decks/${lesson.archivePath.split("/").at(-1)}`;
  sources[lesson.archivePath] = await Bun.file(path).text();
  const id = assetPaths.push(path);
  mock.module(path, () => ({ default: id }));
}
// Replace the registry boundary itself as other suites may have imported the
// loader before these HTML module mocks (Bun caches the generated index).
mock.module("../assets/approved-decks", () => ({ default: Object.fromEntries(
  APPROVED_LESSON_DECKS.map((lesson: { archivePath: string }, index: number) => [lesson.archivePath, index + 1]),
) }));
let platform = "ios";
let remoteOnly = false;
let useLocalUri = false;
let embeddedResource = false;
let uriOverride: string | null = null;
let localUriOverride: string | null = null;
const readUris: string[] = [];
let tamperedPath = "";
let reads = 0;
let downloads = 0;
mock.module("react-native", () => ({ Platform: { get OS() { return platform; } } }));
mock.module("expo-asset", () => ({ Asset: { fromModule: (module: number | { default: number }) => {
  // Bun's require(mock) returns a namespace; Metro returns the numeric ID.
  const id = typeof module === "number" ? module : module.default;
  return {
  uri: uriOverride ?? (remoteOnly || useLocalUri ? "https://unavailable.invalid/deck.html" : platform === "android" ? (embeddedResource ? `file:///android_res/raw/approved_deck_${id}.html` : `approved_deck_${id}`) : `file://${assetPaths[id - 1]}`),
  localUri: localUriOverride ?? (useLocalUri ? (embeddedResource ? `file:///android_res/raw/approved_deck_${id}.html` : `file://${assetPaths[id - 1]}`) : null),
  downloadAsync: () => { downloads += 1; throw new Error("Asset download forbidden"); },
}; } } }));
mock.module("expo-file-system/legacy", () => ({
  EncodingType: { UTF8: "utf8" },
  readAsStringAsync: async (uri: string) => {
    reads += 1;
    readUris.push(uri);
    // SDK 54 sends file: to FileInputStream, not Android resources.
    if (uri.startsWith("file:///android_res/")) throw new Error("FileInputStream: ENOENT");
    const path = uri.startsWith("file://") ? uri.slice(7) : assetPaths[Number(uri.replace("approved_deck_", "")) - 1];
    return await Bun.file(path).text() + (path.endsWith(tamperedPath) && tamperedPath ? "\n" : "");
  },
}));
mock.module("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  digestStringAsync: async (_algorithm: string, source: string) => createHash("sha256").update(source, "utf8").digest("hex"),
}));
const loader = await import("../lib/approvedDeckLoader");
const originalFetch = globalThis.fetch;
let fetchCalls = 0;
globalThis.fetch = (() => { fetchCalls += 1; throw new Error("OFFLINE: network is disabled"); }) as typeof fetch;
afterAll(() => { globalThis.fetch = originalFetch; });

test("approved corpus is packaged as twelve independent Metro assets, not JS source strings", async () => {
  const loaderSource = await Bun.file(`${import.meta.dir}/../lib/approvedDeckLoader.ts`).text();
  expect(loaderSource).not.toContain('approved-decks/sources.json');
  const assetIndex = await Bun.file(`${import.meta.dir}/../assets/approved-decks/index.ts`).text();
  expect(assetIndex.match(/require\("\.\/[^"\n]+\.html"\)/g)).toHaveLength(12);
});

test("every bundled deck fails closed when its exact source bytes are altered", async () => {
  for (const lesson of APPROVED_LESSON_DECKS) {
    const path = lesson.archivePath as keyof typeof sources;
    tamperedPath = path.split("/").at(-1)!;
    try {
      const result = lesson.isCloseDeck
        ? loader.loadModuleCloseDeckHtml(path)
        : loader.loadConvertedHandoffDeckHtml(path, lesson.reviewThroughCard);
      await expect(result).rejects.toThrow("authenticity check");
    } finally {
      tamperedPath = "";
    }
  }
  expect(fetchCalls).toBe(0);
});

test("bundled lessons preserve authorized review and both post-rehearsal cards offline", async () => {
  for (const lesson of APPROVED_LESSON_DECKS.filter((entry: { isCloseDeck: boolean }) => !entry.isCloseDeck)) {
    const raw = sources[lesson.archivePath as keyof typeof sources];
    const review = await loader.loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    expect(review).toBe(loader.materializeApprovedDeckHtml(loader.authorizedDeckHtml(raw, lesson.reviewThroughCard)));
    expect(cardNumbers(review)).toHaveLength(lesson.reviewThroughCard);
    for (const saved of [false, true]) {
      // Preserve the existing fail-closed contract, including source decks that
      // never had this legacy saved-move gate. Native return UI no longer calls it.
      const unsupportedSavedGate = ["m1-l3", "m1-l4", "m2-l2", "m2-l3", "m2-l4", "m2-l5"].includes(lesson.id);
      if (saved && unsupportedSavedGate) {
        await expect(loader.loadReturnedDeckHtml(lesson.archivePath, lesson.rehearsalReturnCard, lesson.cardCount, saved)).rejects.toThrow("Approved move gate contract is missing");
        expect(() => loader.returnedDeckHtml(raw, lesson.rehearsalReturnCard, lesson.cardCount, saved)).toThrow("Approved move gate contract is missing");
        continue;
      }
      const returned = await loader.loadReturnedDeckHtml(lesson.archivePath, lesson.rehearsalReturnCard, lesson.cardCount, saved);
      expect(returned).toBe(loader.materializeApprovedDeckHtml(loader.returnedDeckHtml(raw, lesson.rehearsalReturnCard, lesson.cardCount, saved)));
      expect(cardNumbers(returned)).toEqual([lesson.rehearsalReturnCard, lesson.cardCount]);
    }
    const handoff = await loader.loadConvertedHandoffDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    expect(handoff).toBe(loader.materializeApprovedDeckHtml(loader.convertedHandoffDeckHtml(raw, lesson.reviewThroughCard)));
  }
  for (const lesson of APPROVED_LESSON_DECKS.filter((entry: { isCloseDeck: boolean }) => entry.isCloseDeck)) {
    const raw = sources[lesson.archivePath as keyof typeof sources];
    expect(await loader.loadModuleCloseDeckHtml(lesson.archivePath)).toBe(loader.materializeApprovedDeckHtml(loader.completeModuleCloseDeckHtml(raw)));
  }
  expect(fetchCalls).toBe(0);
});

test("missing and prototype paths fail closed without a network fallback", async () => {
  for (const path of ["missing.html", "toString", "__proto__", "../M1-Close.html"]) {
    await expect(loader.loadModuleCloseDeckHtml(path)).rejects.toThrow("missing from the handoff");
  }
  expect(fetchCalls).toBe(0);
});

test("a changed archive identity fails closed before materializing bundled content", async () => {
  const { default: manifest } = await import("../assets/approved-decks/manifest.json");
  const original = manifest.archiveSha256;
  manifest.archiveSha256 = "0".repeat(64);
  try {
    await expect(loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html")).rejects.toThrow("manifest failed authenticity check");
  } finally {
    manifest.archiveSha256 = original;
  }
});

test("native reads only the requested packaged asset, including Android raw resources and updates localUri", async () => {
  for (const os of ["ios", "android"]) {
    platform = os;
    for (const updates of [false, true]) {
      useLocalUri = updates;
      const before = reads;
      for (const lesson of APPROVED_LESSON_DECKS) {
        const html = lesson.isCloseDeck
          ? await loader.loadModuleCloseDeckHtml(lesson.archivePath)
          : await loader.loadConvertedHandoffDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
        expect(html).toContain('data-bysi="deck"');
      }
      expect(reads - before).toBe(12);
    }
  }
  platform = "ios";
  useLocalUri = false;
  expect(fetchCalls).toBe(0);
  expect(downloads).toBe(0);
});

for (const field of ["uri", "localUri"]) {
  test(`Android embedded raw resources in asset.${field} load through resource identifiers`, async () => {
    platform = "android";
    embeddedResource = true;
    useLocalUri = field === "localUri";
    const before = readUris.length;
    try {
      for (const lesson of APPROVED_LESSON_DECKS) {
        const html = lesson.isCloseDeck
          ? await loader.loadModuleCloseDeckHtml(lesson.archivePath)
          : await loader.loadConvertedHandoffDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
        expect(html).toContain('data-bysi="deck"');
      }
      expect(readUris.slice(before)).toEqual(assetPaths.map((_, index) => `approved_deck_${index + 1}`));
      expect(fetchCalls).toBe(0);
      expect(downloads).toBe(0);
    } finally {
      platform = "ios";
      embeddedResource = false;
      useLocalUri = false;
    }
  });
}

test("Android malformed packaged resource URIs fail closed before the native bridge", async () => {
  platform = "android";
  const invalid = [
    "file://evil/android_res/raw/approved_deck_1.html",
    "file://android_res/raw/approved_deck_1.html",
    "file:///android_res/drawable/approved_deck_1.html",
    "file:///android_res/raw/../approved_deck_1.html",
    "file:///android_res/raw/%2e%2e/approved_deck_1.html",
    "file:///android_res/raw/sub/approved_deck_1.html",
    "file:///android_res/raw/approved_deck_1.html?x=1",
    "file:///android_res/raw/approved_deck_1.html#fragment",
    "file:///android_res/raw/approved_deck_1.html\n",
    "file:///android_res/raw/Approved-Deck.html",
    "file:///android_res/raw/approved_deck_1.json",
    "file:///%61ndroid_res/raw/approved_deck_1.html",
    "file:///ANDROID_RES/raw/approved_deck_1.html",
    "android.resource://evil/raw/approved_deck_1",
  ];
  const before = reads;
  try {
    for (const field of ["uri", "localUri"]) {
      for (const uri of invalid) {
        uriOverride = field === "uri" ? uri : "https://unavailable.invalid/deck.html";
        localUriOverride = field === "localUri" ? uri : null;
        await expect(loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html")).rejects.toThrow("not packaged locally");
      }
    }
    expect(reads).toBe(before);
    expect(fetchCalls).toBe(0);
    expect(downloads).toBe(0);
  } finally {
    platform = "ios";
    uriOverride = localUriOverride = null;
  }
});

test("real localUri file paths take precedence over embedded Android resource URIs", async () => {
  const lesson = APPROVED_LESSON_DECKS[0];
  const localFile = `file://${assetPaths[0]}`;
  try {
    for (const os of ["android", "ios"]) {
      platform = os;
      uriOverride = "file:///android_res/raw/unused.html";
      localUriOverride = localFile;
      await loader.loadApprovedDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
      expect(readUris.at(-1)).toBe(localFile);
    }
  } finally {
    platform = "ios";
    uriOverride = localUriOverride = null;
  }
});

test("native missing embedded assets fail closed instead of downloading", async () => {
  remoteOnly = true;
  const before = reads;
  try {
    await expect(loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html")).rejects.toThrow("not packaged locally");
  } finally { remoteOnly = false; }
  expect(reads).toBe(before);
  expect(fetchCalls).toBe(0);
  expect(downloads).toBe(0);
});

test("web reads each emitted asset response and rejects HTTP failure or tampering", async () => {
  platform = "web";
  const offlineFetch = globalThis.fetch;
  const before = reads;
  let status = 200;
  let tamper = false;
  let webRequests = 0;
  globalThis.fetch = (async (input: string | URL | Request) => {
    webRequests += 1;
    return new Response(await Bun.file(String(input).slice(7)).text() + (tamper ? "\n" : ""), { status });
  }) as typeof fetch;
  try {
    for (const lesson of APPROVED_LESSON_DECKS) {
      const html = lesson.isCloseDeck
        ? await loader.loadModuleCloseDeckHtml(lesson.archivePath)
        : await loader.loadConvertedHandoffDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
      expect(html).toContain('data-bysi="deck"');
    }
    expect(webRequests).toBe(12);
    status = 404;
    await expect(loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html")).rejects.toThrow("could not be read");
    status = 200;
    tamper = true;
    await expect(loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html")).rejects.toThrow("authenticity check");
  } finally {
    platform = "ios";
    globalThis.fetch = offlineFetch;
  }
  expect(reads).toBe(before);
  expect(downloads).toBe(0);
});

test("web deadline bounds a stalled body after response headers arrive", async () => {
  platform = "web";
  const offlineFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  let requestSignal: AbortSignal | null | undefined;
  let bodyStarted = false;
  const deadlines: number[] = [];
  // Accelerate the real deadline helper, without replacing its Promise race.
  globalThis.setTimeout = ((callback: (...args: unknown[]) => void, ms?: number, ...args: unknown[]) => {
    deadlines.push(ms ?? 0);
    return originalSetTimeout(callback, ms === 12_000 ? 10 : ms, ...args);
  }) as typeof setTimeout;
  globalThis.fetch = (async (_input: unknown, options?: RequestInit) => {
    requestSignal = options?.signal;
    return { ok: true, text: () => { bodyStarted = true; return new Promise<string>(() => {}); } } as Response;
  }) as typeof fetch;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const result = await Promise.race([
      loader.loadModuleCloseDeckHtml("BYSI-Rork-Handoff/decks/M1-Close.html").then(() => "unexpected success", (error: Error) => error.name),
      new Promise<string>((resolve) => { watchdog = originalSetTimeout(() => resolve("body still stalled"), 100); }),
    ]);
    expect(bodyStarted).toBe(true);
    expect(result).toBe("TimeoutError");
    expect(deadlines).toContain(12_000);
    expect(requestSignal?.aborted).toBe(true);
  } finally {
    clearTimeout(watchdog);
    globalThis.setTimeout = originalSetTimeout;
    globalThis.fetch = offlineFetch;
    platform = "ios";
  }
});

function cardNumbers(html: string): number[] {
  const start = html.indexOf("const CARDS = [");
  const end = html.indexOf("\n];", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return Array.from(html.slice(start, end).matchAll(/\{ n:(\d+), type:/g), (match) => Number(match[1]));
}

test("all twelve launch decks load from cold bundled bytes with the network disabled", async () => {
  expect(APPROVED_LESSON_DECKS).toHaveLength(12);
  for (const lesson of APPROVED_LESSON_DECKS) {
    const html = lesson.isCloseDeck
      ? await loader.loadModuleCloseDeckHtml(lesson.archivePath)
      : await loader.loadConvertedHandoffDeckHtml(lesson.archivePath, lesson.reviewThroughCard);
    expect(cardNumbers(html)).toEqual(Array.from({ length: lesson.isCloseDeck ? 9 : lesson.reviewThroughCard }, (_, i) => i + 1));
    expect(html).toContain('data-bysi="deck"');
    expect(html).toContain('aria-label="Exit lesson"');
    expect(html).not.toMatch(/<script\s+src=/i);
  }
  expect(fetchCalls).toBe(0);
});
