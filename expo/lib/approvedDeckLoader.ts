import { strFromU8, unzipSync } from "fflate";

const APPROVED_HANDOFF_ARCHIVE_URL = "https://r2-pub.rork.com/attachments/xo73vo5tbrhku6f68brbr.zip";
const TEMPLATE_PATTERN = /<script type="__bundler\/template">\s*(.*?)\s*<\/script>/s;

let archivePromise: Promise<Record<string, Uint8Array>> | null = null;

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

/** Opens the authoritative post-rehearsal cards at the manifest-defined return destination. */
export function returnedDeckHtml(rawHtml: string, returnCard: number): string {
  return replaceEncodedTemplate(rawHtml, (source) => {
    const marker = "state = { i:0,";
    if (!source.includes(marker)) throw new Error("Approved lesson return state is missing");
    return source.replace(marker, `state = { i:${returnCard - 1},`);
  });
}

async function approvedDeckSource(archivePath: string): Promise<string> {
  const archive = await approvedArchive();
  const bytes = archive[archivePath];
  if (!bytes) throw new Error("Approved lesson file is missing from the handoff");
  return strFromU8(bytes);
}

/** Downloads the approved handoff once and returns only the authorized lesson slice. */
export async function loadApprovedDeckHtml(archivePath: string, reviewThroughCard: number): Promise<string> {
  return authorizedDeckHtml(await approvedDeckSource(archivePath), reviewThroughCard);
}

export async function loadConvertedHandoffDeckHtml(archivePath: string, handoffCard: number): Promise<string> {
  return convertedHandoffDeckHtml(await approvedDeckSource(archivePath), handoffCard);
}

export async function loadReturnedDeckHtml(archivePath: string, returnCard: number): Promise<string> {
  return returnedDeckHtml(await approvedDeckSource(archivePath), returnCard);
}
