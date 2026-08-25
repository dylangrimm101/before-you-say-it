import { strFromU8, unzipSync } from "fflate";

const APPROVED_HANDOFF_ARCHIVE_URL = "https://r2-pub.rork.com/attachments/xo73vo5tbrhku6f68brbr.zip";
const TEMPLATE_PATTERN = /<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s;
const M1_L1_ARCHIVE_PATH = "BYSI-Rork-Handoff/decks/M1-L1-Buried-Point.html";
const M1_L1_CONTENT_VERSION = "m1-l1-v2.1-2026-08-24";
const M1_L1_APPROVED_SHA256 = "aa4f4016888794b8f43139e8defdc01c14c4455476fa47f7d1ebb94cd412bd9e";

let archivePromise: Promise<Record<string, Uint8Array>> | null = null;

/** Binds executable M1 L1 deck bytes to its lesson path and content version. */
export function isApprovedM1L1DeckDigest(archivePath: string, contentVersion: string, digest: string): boolean {
  return archivePath === M1_L1_ARCHIVE_PATH && contentVersion === M1_L1_CONTENT_VERSION && digest === M1_L1_APPROVED_SHA256;
}

function approvedArchive(): Promise<Record<string, Uint8Array>> {
  if (!archivePromise) {
    archivePromise = fetch(APPROVED_HANDOFF_ARCHIVE_URL)
      .then((response) => {
        if (!response.ok) throw new Error("Approved lesson archive is unavailable");
        return response.arrayBuffer();
      })
      .then((buffer) => unzipSync(new Uint8Array(buffer)))
      .catch((error: unknown) => {
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
  return `${rawHtml.slice(0, templateMatch.index)}${rawHtml.slice(templateMatch.index).replace(encodedTemplate, encoded)}`;
}

function replaceEncodedTemplate(rawHtml: string, transform: (template: string) => string): string {
  const templateMatch = rawHtml.match(TEMPLATE_PATTERN);
  const encodedTemplate = templateMatch?.[1];
  if (!templateMatch || !encodedTemplate) throw new Error("Approved lesson template is missing");
  const template = transform(JSON.parse(encodedTemplate) as string);
  const encoded = JSON.stringify(template).replace(/<\//g, "<\\u002F");
  return `${rawHtml.slice(0, templateMatch.index)}${rawHtml.slice(templateMatch.index).replace(encodedTemplate, encoded)}`;
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

/** Converts M1 L1's approved handoff action into the fail-closed native QA runtime launch. */
export function convertedHandoffDeckHtml(rawHtml: string, handoffCard: number): string {
  return replaceEncodedTemplate(rawHtml, (source) => {
    const sliced = sliceCards(source, handoffCard);
    const converted = sliced.replace(
      /openHandoff:\(\) => \{.*?\},\s*handoffContinue:/s,
      `openHandoff:() => { window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type:'start-rehearsal' })); }, handoffContinue:`,
    );
    if (converted === sliced) throw new Error("Converted lesson handoff could not be installed");
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
    throw new Error("Converted return inventory must contain exactly Cards 21–22");
  }
  return sliced;
}

/** Executes only the accepted post-rehearsal Cards 21–22, never the full remote deck. */
export function returnedDeckHtml(rawHtml: string, returnCard: number, completionCard: number = 22): string {
  return replaceEncodedTemplate(rawHtml, (source) => {
    const sliced = sliceCardsFrom(source, returnCard, completionCard);
    const marker = "state = { i:0,";
    if (!sliced.includes(marker)) throw new Error("Approved lesson return state is missing");
    return sliced;
  });
}

async function approvedDeckSource(archivePath: string): Promise<string> {
  const archive = await approvedArchive();
  const bytes = archive[archivePath];
  if (!bytes) throw new Error("Approved lesson file is missing from the handoff");
  const source = strFromU8(bytes);
  if (archivePath === M1_L1_ARCHIVE_PATH) {
    const Crypto = await import("expo-crypto");
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, source);
    if (!isApprovedM1L1DeckDigest(archivePath, M1_L1_CONTENT_VERSION, digest)) throw new Error(`Approved M1 L1 deck failed authenticity check for ${M1_L1_CONTENT_VERSION}`);
  }
  return source;
}

/** Downloads the approved handoff once and returns only the authorized lesson slice. */
export async function loadApprovedDeckHtml(archivePath: string, reviewThroughCard: number): Promise<string> {
  return authorizedDeckHtml(await approvedDeckSource(archivePath), reviewThroughCard);
}

export async function loadConvertedHandoffDeckHtml(archivePath: string, handoffCard: number): Promise<string> {
  return convertedHandoffDeckHtml(await approvedDeckSource(archivePath), handoffCard);
}

export async function loadReturnedDeckHtml(archivePath: string, returnCard: number, completionCard: number = 22): Promise<string> {
  return returnedDeckHtml(await approvedDeckSource(archivePath), returnCard, completionCard);
}
