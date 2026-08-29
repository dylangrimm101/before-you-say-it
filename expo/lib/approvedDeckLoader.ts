import { gunzipSync, strFromU8, unzipSync } from "fflate";

import { M1_L1_CONVERSION } from "@/lib/convertedLesson";

const APPROVED_HANDOFF_ARCHIVE_URL = "https://r2-pub.rork.com/attachments/xo73vo5tbrhku6f68brbr.zip";
const TEMPLATE_PATTERN = /<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s;
const MANIFEST_PATTERN = /<script type="__bundler\/manifest">\s*(.*?)\s*<\/script>/s;
const EXTERNAL_RESOURCES_PATTERN = /<script type="__bundler\/ext_resources">\s*(.*?)\s*<\/script>/s;

type BundleEntry = { mime: string; compressed: boolean; data: string };
type ExternalResource = { id: string; uuid: string };
const M1_L1_ARCHIVE_PATH = "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html";
const M1_L1_CONTENT_VERSION = "m1-l1-v2.1-2026-08-24";
const M1_L1_APPROVED_SHA256 = "aa4f4016888794b8f43139e8defdc01c14c4455476fa47f7d1ebb94cd412bd9e";
const STALE_M1_L1_SCENE = "Sunday evening, kitchen. Dishes done, kid finally asleep. You've wanted to say this for two weeks. Your partner is on the couch, half looking at their phone. Not hostile. Tired.";
const STALE_M1_L1_SCENE_BEATS = "You open. Adam pushes back twice. The second one is <em>“You're acting like this happens all the time.”</em> Then Hope names one change and hands the same moment back to you.";
const STALE_M1_L3_SCENE = "Sunday evening, on the phone with your sister. You want March's appointments split before you hang up.";
const APPROVED_M1_L3_SCENE = "Sunday evening, you’re on the phone with your sister, Renee. Dad’s March appointments still need to be divided, and you handled the last four. You want to agree on who will take each March appointment before you hang up. Renee has been handling more of Dad’s regular check-in calls and may raise that you haven’t been calling as often.";
const STALE_M1_L4_SCENE = "Thursday night, the house is finally quiet. The plan changed twice this month after you had already rearranged work. By now it has become a month of things in your head.";
const APPROVED_M1_L4_SCENE = "Thursday night, you’re talking with Theo, your partner, after the house is quiet. Twice this month, Theo agreed to handle school pickup, so you rearranged work around that plan. Both times, he changed the plan after your schedule was already set, leaving you to move meetings again. You want future changes discussed before either of you commits—not to suggest that Theo never considers your schedule.";
const STALE_M1_L5_SCENE = "Friday night, kitchen table. The kid went down at seven for once. Neither of you is running on four hours.";
const APPROVED_M1_L5_SCENE = "Friday night, you’re at the kitchen table with Adam, who shares responsibility for your child’s calendar, after the kid has gone to bed. This month, most of the calendar has fallen to you—including camp signups, the dentist, and both birthday RSVPs. You want several things addressed, but raising all of them at once could leave none of them clear. Choose one purpose for tonight and keep the others for later. Adam has his own read of the month and may question which issue you actually want him to address.";
const STALE_M2_L1_SCENE = "Thursday morning, before standup. The handoff brief has landed late three weeks running and the review is at 4. You've mentioned it twice without asking for anything.";
const APPROVED_M2_L1_SCENE = "Thursday morning, before standup, you’re speaking with Maya, your teammate who prepares the revised two-page handoff brief for a 4 PM review. The brief has arrived late three weeks in a row, and you’ve mentioned the pattern twice without making a specific request. You need to leave the conversation knowing what Maya can deliver in time for today’s review and by when. Maya may say she cannot finish the whole brief today, so make one clear, answerable ask while leaving room for a real constraint.";
const STALE_M2_L2_SCENE = "Thursday afternoon, outside the school. You asked the group, there was the pause, and nobody has answered yet. Renee, Cory and Angela are still standing there. The bakery needs the cupcake order confirmed by five.";
const APPROVED_M2_L2_SCENE = "Thursday afternoon, outside the school after pickup, you’re standing with Renee, Cory, Angela, and Jen. The group’s cupcake order must be confirmed with the bakery by 5 PM. You already asked whether someone could handle it, but after a pause no one answered. Renee has collected everyone’s cash, while the order is under Jen’s name and card. You need to leave knowing who will take the next answerable action. Address one person directly rather than sending the request back to the group; Renee may ask why the request belongs to her.";
const STALE_M2_L3_SCENE = "Thursday night, on the phone with your brother Marcus about Saturday. Ellie gets the keys in the morning and the van goes back Sunday night.";
const APPROVED_M2_L3_SCENE = "Thursday night, you’re on the phone with your brother, Marcus, arranging who will handle the van on Saturday. Ellie will have the keys that morning, and the van must be returned Sunday night, so Saturday’s plan needs to be settled before the weekend. You want to leave with a clear agreement about which part of Saturday Marcus can take. Marcus may say he cannot do the whole day because Theo has a game and he is not free until 2 PM. Hear the constraint, trade one part of the original ask, and clearly restate what you are still asking him to do.";
const STALE_M2_L4_SCENE = "Wednesday night at home, talking to Sam about tomorrow. The client dinner is Thursday and it won't move. Pickup is at 5:30.";
const APPROVED_M2_L4_SCENE = "Wednesday night at home, you’re talking with Sam, your partner, about school pickup tomorrow. You have a client dinner on Thursday that cannot move, and pickup is at 5:30. You need to know whether Sam can handle pickup, but you can make another arrangement if the answer is no. Ask directly while making clear that no is genuinely available. Sam may say they cannot do pickup and then check whether no is actually okay. If you offered room to say no, honor the answer without asking again or adding a penalty.";
const M1_L1_OUTCOME_CARD = /<div\b[^>]*>\s*<span\b[^>]*>\s*What happens\s*<\/span>[\s\S]*?<\/div>/gi;
const M1_L1_OUTCOME_PREVIEW = /<div\b[^>]*>\s*<div\b[^>]*>\s*What happens\s*<\/div>\s*<div\b[^>]*>\s*You open\.\s*Adam pushes back twice\..*?same moment back to you\.\s*<\/div>\s*<\/div>/is;
const M1_L1_EMPTY_OUTCOME_PREVIEW = /<div\b[^>]*>\s*<div\b[^>]*>\s*What happens\s*<\/div>\s*<div\b[^>]*>\s*<\/div>\s*<\/div>/gis;

let archivePromise: Promise<Record<string, Uint8Array>> | null = null;
const ARCHIVE_LOAD_ATTEMPTS = 3;
const ARCHIVE_LOAD_TIMEOUT_MS = 12_000;

/** Binds executable M1 L1 deck bytes to its lesson path and content version. */
export function isApprovedM1L1DeckDigest(archivePath: string, contentVersion: string, digest: string): boolean {
  return archivePath === M1_L1_ARCHIVE_PATH && contentVersion === M1_L1_CONTENT_VERSION && digest === M1_L1_APPROVED_SHA256;
}

async function fetchApprovedArchive(): Promise<Record<string, Uint8Array>> {
  let lastError: unknown = new Error("Approved lesson archive is unavailable");
  for (let attempt = 0; attempt < ARCHIVE_LOAD_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), ARCHIVE_LOAD_TIMEOUT_MS);
    try {
      const response = await fetch(APPROVED_HANDOFF_ARCHIVE_URL, { signal: controller.signal });
      if (!response.ok) throw new Error("Approved lesson archive is unavailable");
      return unzipSync(new Uint8Array(await response.arrayBuffer()));
    } catch (error: unknown) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError;
}

function approvedArchive(): Promise<Record<string, Uint8Array>> {
  if (!archivePromise) {
    archivePromise = fetchApprovedArchive().catch((error: unknown) => {
      archivePromise = null;
      throw error;
    });
  }
  return archivePromise;
}

/** Removes every card and runtime branch beyond the currently authorized QA boundary. */
export function authorizedDeckHtml(rawHtml: string, reviewThroughCard: number): string {
  const templateMatch = rawHtml.match(TEMPLATE_PATTERN);
  const encodedTemplate = templateMatch?.[1];
  if (!templateMatch || !encodedTemplate) throw new Error("Approved lesson template is missing");

  let template = JSON.parse(encodedTemplate) as string;
  const cardsStart = template.indexOf("const CARDS = [");
  const cardsEnd = template.indexOf("\n];", cardsStart);
  const deferredCardStart = template.indexOf(`{ n:${reviewThroughCard + 1}, type:`, cardsStart);
  if (cardsStart < 0 || cardsEnd < 0) throw new Error("Approved lesson cards are missing");
  if (deferredCardStart >= 0 && deferredCardStart < cardsEnd) {
    template = `${template.slice(0, deferredCardStart)}${template.slice(cardsEnd)}`;
  }

  template = template
    .replace(/\s*<sc-if value="\{\{ handoffOpen \}\}".*?<\/sc-if>/s, "")
    .replace(/\s*<button[^>]*data-sheet-primary[^>]*>.*?<\/button>/gs, "")
    .replace(/Voice-engine handoff preview.*?no rehearsal was completed/gs, "")
    .replace(/openHandoff:\(\) => \{.*?\},\s*handoffContinue:/s, "openHandoff:() => {}, handoffContinue:");

  const cardBlockEnd = template.indexOf("\n];", template.indexOf("const CARDS = ["));
  const cardBlock = template.slice(template.indexOf("const CARDS = ["), cardBlockEnd);
  const cardNumbers = Array.from(cardBlock.matchAll(/\{ n:(\d+), type:/g), (match) => Number(match[1]));
  if (cardNumbers.length !== reviewThroughCard || cardNumbers.at(-1) !== reviewThroughCard) {
    throw new Error("Approved lesson boundary could not be verified");
  }

  const encoded = JSON.stringify(template).replace(/<\//g, "<\\u002F");
  return `${rawHtml.slice(0, templateMatch.index)}${rawHtml.slice(templateMatch.index).replace(encodedTemplate, () => encoded)}`;
}

function decodeBase64(value: string): Uint8Array {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/[^A-Za-z0-9+/]/g, "");
  const output = new Uint8Array(Math.floor((clean.length * 6) / 8));
  let accumulator = 0;
  let bits = 0;
  let offset = 0;
  for (const character of clean) {
    const index = alphabet.indexOf(character);
    if (index < 0) continue;
    accumulator = (accumulator << 6) | index;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output[offset] = (accumulator >> bits) & 0xff;
      offset += 1;
    }
  }
  return output.subarray(0, offset);
}

function executableSource(entry: BundleEntry): string {
  const encoded = decodeBase64(entry.data);
  return strFromU8(entry.compressed ? gunzipSync(encoded) : encoded);
}

function inlineScript(source: string): string {
  return `<script>${source.replace(/<\/script/gi, "<\\/script")}<\/script>`;
}

function externalRuntimePriority(resource: ExternalResource): number {
  if (/\/react@[^/]+\/umd\/react\./i.test(resource.id)) return 0;
  if (/\/react-dom@/i.test(resource.id)) return 1;
  return 2;
}

function orderedExternalResources(resources: ExternalResource[]): ExternalResource[] {
  return resources
    .map((resource, sourceIndex) => ({ resource, sourceIndex }))
    .sort((left, right) => externalRuntimePriority(left.resource) - externalRuntimePriority(right.resource) || left.sourceIndex - right.sourceIndex)
    .map(({ resource }) => resource);
}

const DECK_RUNTIME_MONITOR = `<script>
(function () {
  var finished = false;
  var runtimeFailure = null;
  function post(type, category) {
    if (finished || !window.ReactNativeWebView) return;
    finished = true;
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: type, category: category || "none" }));
  }
  window.addEventListener("error", function () { runtimeFailure = "javascript-error"; });
  window.addEventListener("unhandledrejection", function () { runtimeFailure = "unhandled-rejection"; });
  var attempts = 0;
  function verifyMount() {
    if (document.querySelector('[data-bysi="deck"]')) {
      post("deck-ready", runtimeFailure || "none");
      return;
    }
    attempts += 1;
    if (attempts >= 120) {
      post("deck-render-error", runtimeFailure || "mount-timeout");
      return;
    }
    window.setTimeout(verifyMount, 100);
  }
  window.setTimeout(verifyMount, 0);
})();
<\/script>`;

const NATIVE_DECK_SHELL = `<style id="bysi-native-deck-shell">
html,body{margin:0!important;padding:0!important;width:100%!important;height:100%!important;overflow:hidden!important;background:#FAF7F2!important}
body *{visibility:hidden!important}
[data-bysi="deck"],[data-bysi="deck"] *{visibility:visible!important}
[data-bysi="deck"]{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;transform:none!important;border:0!important;border-radius:0!important;box-shadow:none!important;margin:0!important}
</style>`;

function isolateNativeDeck(template: string): string {
  if (!template.includes('data-bysi="deck"')) throw new Error("Approved lesson frame is missing");
  if (!template.includes("</head>")) throw new Error("Approved lesson document head is missing");
  return template.replace("</head>", `${NATIVE_DECK_SHELL}</head>`);
}

const REHEARSAL_CONTINUATION_PARAGRAPH = /<p\b[^>]*>\s*The rehearsal runs in the voice engine\..*?<\/p>/gs;
const TAP_TUTORIAL_MARKER = "showHint:st.hint && i === 0,";
const DECK_GO_MARKER = "go(d) {\n";

/** Makes the first tutorial tap dismiss its overlay without advancing Card 1. */
export function installTapTutorialDismissal(template: string): string {
  if (!template.includes(TAP_TUTORIAL_MARKER)) return template;
  if (!template.includes(DECK_GO_MARKER)) throw new Error("Approved lesson navigation contract is missing");
  return template.replace(
    DECK_GO_MARKER,
    `${DECK_GO_MARKER}    if (this.state.hint && this.state.i === 0) {\n      this.setState({ hint:false });\n      return;\n    }\n`,
  );
}

/** Removes the redundant continuation paragraph from rehearsal handoff cards. */
export function removeRehearsalContinuationCopy(template: string): string {
  return template.replace(REHEARSAL_CONTINUATION_PARAGRAPH, "");
}

/** Flattens the approved artifact into one same-origin page for native WebViews. */
export function materializeApprovedDeckHtml(bundleHtml: string): string {
  const templateEncoded = bundleHtml.match(TEMPLATE_PATTERN)?.[1];
  const manifestEncoded = bundleHtml.match(MANIFEST_PATTERN)?.[1];
  const externalEncoded = bundleHtml.match(EXTERNAL_RESOURCES_PATTERN)?.[1];
  if (!templateEncoded || !manifestEncoded || !externalEncoded) throw new Error("Approved lesson bundle metadata is missing");

  let template = installTapTutorialDismissal(
    removeRehearsalContinuationCopy(JSON.parse(templateEncoded) as string),
  );
  const manifest = JSON.parse(manifestEncoded) as Record<string, BundleEntry>;
  const externalResources = orderedExternalResources(JSON.parse(externalEncoded) as ExternalResource[]);
  const externalScripts = externalResources.map(({ uuid }) => {
    const entry = manifest[uuid];
    if (!entry || entry.mime !== "text/javascript") throw new Error("Approved lesson runtime dependency is missing");
    return inlineScript(executableSource(entry));
  }).join("");
  const runtimeMatch = template.match(/<script\s+src="([0-9a-f-]+)"\s*><\/script>/i);
  const runtimeId = runtimeMatch?.[1];
  const runtimeEntry = runtimeId ? manifest[runtimeId] : undefined;
  if (!runtimeMatch || !runtimeId || !runtimeEntry || runtimeEntry.mime !== "text/javascript") throw new Error("Approved lesson runtime is missing");

  const inlineRuntime = `<script>window.__resources={};<\/script>${DECK_RUNTIME_MONITOR}${externalScripts}${inlineScript(executableSource(runtimeEntry))}`;
  template = template.replace(runtimeMatch[0], () => inlineRuntime);
  Object.entries(manifest).forEach(([uuid, entry]) => {
    if (entry.mime === "text/javascript") return;
    if (entry.compressed) throw new Error("Compressed approved lesson media is unsupported");
    template = template.split(uuid).join(`data:${entry.mime};base64,${entry.data}`);
  });
  if (template.includes("__bundler_loading") || /<script\s+src="blob:/i.test(template)) throw new Error("Approved lesson page was not fully materialized");
  return isolateNativeDeck(template);
}

function replaceEncodedTemplate(rawHtml: string, transform: (template: string) => string): string {
  const templateMatch = rawHtml.match(TEMPLATE_PATTERN);
  const encodedTemplate = templateMatch?.[1];
  if (!templateMatch || !encodedTemplate) throw new Error("Approved lesson template is missing");
  const template = transform(JSON.parse(encodedTemplate) as string);
  const encoded = JSON.stringify(template).replace(/<\//g, "<\\u002F");
  return `${rawHtml.slice(0, templateMatch.index)}${rawHtml.slice(templateMatch.index).replace(encodedTemplate, () => encoded)}`;
}

function sliceCards(template: string, throughCard: number): string {
  const cardsStart = template.indexOf("const CARDS = [");
  const cardsEnd = template.indexOf("\n];", cardsStart);
  const deferredCardStart = template.indexOf(`{ n:${throughCard + 1}, type:`, cardsStart);
  if (cardsStart < 0 || cardsEnd < 0 || deferredCardStart < 0 || deferredCardStart >= cardsEnd) {
    throw new Error("Converted lesson boundary could not be verified");
  }
  return `${template.slice(0, deferredCardStart)}${template.slice(cardsEnd)}`;
}

/** Removes the outcome preview so the handoff gives context without revealing the exchange. */
export function removeM1L1OutcomePreview(template: string): string {
  return template
    .replace(M1_L1_OUTCOME_CARD, "")
    .replace(M1_L1_OUTCOME_PREVIEW, "")
    .replace(STALE_M1_L1_SCENE_BEATS, "")
    .replace(M1_L1_EMPTY_OUTCOME_PREVIEW, "");
}

/** Applies approved scene-copy revisions at runtime without modifying bundled lesson sources. */
export function alignApprovedRehearsalScene(template: string): string {
  return template
    .replace(STALE_M1_L3_SCENE, APPROVED_M1_L3_SCENE)
    .replace(STALE_M1_L4_SCENE, APPROVED_M1_L4_SCENE)
    .replace(STALE_M1_L5_SCENE, APPROVED_M1_L5_SCENE)
    .replace(STALE_M2_L1_SCENE, APPROVED_M2_L1_SCENE)
    .replace(STALE_M2_L2_SCENE, APPROVED_M2_L2_SCENE)
    .replace(STALE_M2_L3_SCENE, APPROVED_M2_L3_SCENE)
    .replace(STALE_M2_L4_SCENE, APPROVED_M2_L4_SCENE);
}

/** Converts an approved lesson handoff action into the fail-closed native QA runtime launch. */
export function convertedHandoffDeckHtml(rawHtml: string, handoffCard: number): string {
  return replaceEncodedTemplate(rawHtml, (source) => {
    const sliced = sliceCards(source, handoffCard);
    const withAcceptedScene = alignApprovedRehearsalScene(removeM1L1OutcomePreview(sliced))
      .replace(STALE_M1_L1_SCENE, M1_L1_CONVERSION.scenario.situation);
    if (sliced.includes(STALE_M1_L1_SCENE) && withAcceptedScene.includes(STALE_M1_L1_SCENE)) {
      throw new Error("Converted lesson scene could not be aligned");
    }
    const converted = withAcceptedScene.replace(
      /openHandoff:\(\) => \{.*?\},\s*handoffContinue:/s,
      `openHandoff:() => { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'start-rehearsal' })); }, handoffContinue:`,
    );
    if (converted === withAcceptedScene) throw new Error("Converted lesson handoff could not be installed");
    return converted;
  });
}

function sliceCardsFrom(template: string, returnCard: number, completionCard: number): string {
  const cardsStart = template.indexOf("const CARDS = [");
  const firstCard = template.indexOf("{ n:1, type:", cardsStart);
  const returnStart = template.indexOf(`{ n:${returnCard}, type:`, cardsStart);
  const cardsEnd = template.indexOf("\n];", cardsStart);
  const afterCompletion = template.indexOf(`{ n:${completionCard + 1}, type:`, cardsStart);
  if (cardsStart < 0 || firstCard < 0 || returnStart < 0 || cardsEnd < 0) throw new Error("Approved return cards are missing");
  const end = afterCompletion >= 0 && afterCompletion < cardsEnd ? afterCompletion : cardsEnd;
  const sliced = `${template.slice(0, firstCard)}${template.slice(returnStart, end)}${template.slice(cardsEnd)}`;
  const slicedCardsStart = sliced.indexOf("const CARDS = [");
  const slicedCardsEnd = sliced.indexOf("\n];", slicedCardsStart);
  const inventory = Array.from(sliced.slice(slicedCardsStart, slicedCardsEnd).matchAll(/\{ n:(\d+), type:/g), (match) => Number(match[1]));
  if (inventory.length !== 2 || inventory[0] !== returnCard || inventory[1] !== completionCard) {
    throw new Error(`Converted return inventory must contain exactly Cards ${returnCard}–${completionCard}`);
  }
  return sliced;
}

/** Executes only the lesson's two accepted post-rehearsal cards, never the full remote deck. */
export function returnedDeckHtml(rawHtml: string, returnCard: number, completionCard: number = 22, approvedMoveSaved: boolean = false): string {
  return replaceEncodedTemplate(rawHtml, (source) => {
    let sliced = sliceCardsFrom(source, returnCard, completionCard);
    const stateMarker = "state = { i:0,";
    if (!sliced.includes(stateMarker)) throw new Error("Approved lesson return state is missing");
    if (!approvedMoveSaved) return sliced;
    sliced = sliced.replace(stateMarker, "state = { approvedMoveSaved:true, i:0,");
    const goGate = "if (c.saved && this.state.sm.indexOf(false) !== -1) return;";
    const actionGate = "const smDone = st.sm.indexOf(false) === -1;";
    if (!sliced.includes(goGate) || !sliced.includes(actionGate)) throw new Error("Approved move gate contract is missing");
    sliced = sliced
      .replace(goGate, "if (c.saved && !this.state.approvedMoveSaved && this.state.sm.indexOf(false) !== -1) return;")
      .replace(actionGate, "const smDone = st.approvedMoveSaved || st.sm.indexOf(false) === -1;");
    return sliced;
  });
}

async function approvedDeckSource(archivePath: string): Promise<string> {
  const archive = await approvedArchive();
  const bytes = archive[archivePath];
  if (!bytes) throw new Error("Approved lesson file is missing from the handoff");
  const source = strFromU8(bytes);
  if (archivePath === M1_L1_ARCHIVE_PATH) {
    // Keep this synchronous module boundary compatible with Hermes; a lazy dynamic
    // import can surface as a SyntaxError before the approved digest is checked.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Crypto = require("expo-crypto") as typeof import("expo-crypto");
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, source);
    if (!isApprovedM1L1DeckDigest(archivePath, M1_L1_CONTENT_VERSION, digest)) throw new Error(`Approved M1 L1 deck failed authenticity check for ${M1_L1_CONTENT_VERSION}`);
  }
  return source;
}

/** Downloads the approved handoff once and returns only the authorized lesson slice. */
export async function loadApprovedDeckHtml(archivePath: string, reviewThroughCard: number): Promise<string> {
  return materializeApprovedDeckHtml(authorizedDeckHtml(await approvedDeckSource(archivePath), reviewThroughCard));
}

export async function loadConvertedHandoffDeckHtml(archivePath: string, handoffCard: number): Promise<string> {
  return materializeApprovedDeckHtml(convertedHandoffDeckHtml(await approvedDeckSource(archivePath), handoffCard));
}

export async function loadReturnedDeckHtml(archivePath: string, returnCard: number, completionCard: number = 22, approvedMoveSaved: boolean = false): Promise<string> {
  return materializeApprovedDeckHtml(returnedDeckHtml(await approvedDeckSource(archivePath), returnCard, completionCard, approvedMoveSaved));
}
