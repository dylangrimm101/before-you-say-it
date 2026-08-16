import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { PILOT_PROGRAM } from "@/lib/pilotCurriculum";
import { errorShape, safeLog } from "@/lib/redact";
import {
  audioExtensionFor,
  isAutoplayBlocked,
  parseDataUri,
  speechCacheFileName,
  type SpeakOutcome,
  type SpeechPhase,
} from "@/lib/speech";
import type { PersonaVoice } from "@/types/convo";
import type { PilotAudioLine } from "@/types/pilotCurriculum";

const TTS_ENDPOINT = process.env.EXPO_PUBLIC_TTS_ENDPOINT?.trim() || "https://beforeyousayit.app/api/tts";

type BysiVoiceRole = "hope" | "adam";

function roleForPersona(persona: PersonaVoice): BysiVoiceRole {
  return persona === "man-adam" ? "adam" : "hope";
}

function evidenceEndpoint(url: string): string {
  return url.replace(/^https?:\/\//, "").slice(0, 64);
}

/** A single frame of silence, used only to unlock playback from a real tap. */
const SILENT_WAV =
  "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";

export interface SpeechSnapshot {
  phase: SpeechPhase;
  /** True when a counterpart line is available to play or play again. */
  canReplay: boolean;
}

interface Utterance {
  text: string;
  persona: PersonaVoice;
  /** Stable authored audio ID. Its versioned cache path invalidates stale V2 audio. */
  staticAudioId?: string;
  leadingPauseMs?: number;
  /** Prepared, playable source. Null until audio has been fetched. */
  source: string | null;
}

let snapshot: SpeechSnapshot = { phase: "idle", canReplay: false };
const listeners = new Set<(s: SpeechSnapshot) => void>();

/**
 * Incremented for every new request and every teardown. An in-flight fetch or
 * playback whose token is stale is discarded, so a response can never be heard
 * after the user left the screen or moved on.
 */
let token = 0;
let lastUtterance: Utterance | null = null;
let currentPlayer: AudioPlayer | null = null;
let webUnlocked = false;
let webEl: HTMLAudioElement | null = null;
const webStaticCache = new Map<string, string>();

function publish(next: Partial<SpeechSnapshot>): void {
  const merged: SpeechSnapshot = { ...snapshot, ...next };
  if (merged.phase === snapshot.phase && merged.canReplay === snapshot.canReplay) return;
  snapshot = merged;
  listeners.forEach((l) => l(snapshot));
}

/** Subscribe to voice state. Returns an unsubscribe function. */
export function onSpeechChange(listener: (s: SpeechSnapshot) => void): () => void {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

/** React hook exposing live voice state for the UI. */
export function useSpeech(): SpeechSnapshot {
  const [state, setState] = useState<SpeechSnapshot>(snapshot);
  useEffect(() => onSpeechChange(setState), []);
  return state;
}

function webElement(): HTMLAudioElement | null {
  if (Platform.OS !== "web" || typeof document === "undefined") return null;
  if (!webEl) {
    const el = document.createElement("audio");
    el.preload = "auto";
    // Required on iOS or playback takes over the screen as a video surface.
    el.setAttribute("playsinline", "true");
    webEl = el;
  }
  return webEl;
}

/**
 * Unlock the audio path from inside a real user gesture.
 *
 * iOS Safari only allows an element to play later if it has already played
 * once during a tap. Called when the user submits their turn, which is the
 * last gesture before the counterpart replies.
 */
export async function unlockAudioPlayback(): Promise<boolean> {
  const el = webElement();
  if (!el) return true; // Native needs no unlock.
  if (webUnlocked) return true;
  try {
    el.muted = true;
    el.src = SILENT_WAV;
    await el.play();
    el.pause();
    el.currentTime = 0;
    webUnlocked = true;
    return true;
  } catch (e) {
    safeLog("[voice] unlock refused", errorShape(e));
    return false;
  } finally {
    el.muted = false;
  }
}

async function fetchSpeechDataUri(text: string, persona: PersonaVoice): Promise<string> {
  const role = roleForPersona(persona);
  safeLog("[evidence] BYSI TTS request", {
    endpoint: evidenceEndpoint(TTS_ENDPOINT),
    provider: "user-owned-bysi-tts",
    role,
  });
  const response = await fetch(TTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, text }),
  });
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() ?? "unknown";
  if (!response.ok) {
    safeLog("[evidence] BYSI TTS response", {
      endpoint: evidenceEndpoint(TTS_ENDPOINT),
      ok: false,
      role,
      status: response.status,
      type: contentType,
    });
    throw new Error(`Voice request failed (${response.status})`);
  }
  if (contentType !== "audio/mpeg") throw new Error("Voice response was not MPEG audio");

  const blob = await response.blob();
  safeLog("[evidence] BYSI TTS response", {
    count: blob.size,
    endpoint: evidenceEndpoint(TTS_ENDPOINT),
    ok: true,
    role,
    status: response.status,
    type: contentType,
  });
  if (blob.size === 0) throw new Error("Voice response was empty");
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read voice audio"));
    reader.readAsDataURL(blob);
  });
}

/**
 * Turn fetched audio into something the current platform can actually play.
 *
 * iOS AVPlayer cannot open a `data:` URI, so on native the bytes are written to
 * a cache file and played from `file://`. Browsers play the data URI directly.
 */
async function prepareSource(dataUri: string, id: number): Promise<string> {
  if (Platform.OS === "web") return dataUri;

  const parts = parseDataUri(dataUri);
  if (!parts) throw new Error("Unreadable voice audio");

  // Required only on native. Loading it on web logs a missing-module warning.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FS = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const dir = `${FS.cacheDirectory ?? ""}rehearsal-voice/`;
  try {
    await FS.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    // Already present.
  }
  const uri = `${dir}${speechCacheFileName(id, audioExtensionFor(parts.mime))}`;
  await FS.writeAsStringAsync(uri, parts.base64, { encoding: FS.EncodingType.Base64 });
  return uri;
}

async function staticCacheSource(audioId: string): Promise<string | null> {
  if (Platform.OS === "web") return webStaticCache.get(audioId) ?? null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FS = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const safeId = audioId.replace(/[^a-zA-Z0-9_-]/g, "");
  const uri = `${FS.cacheDirectory ?? ""}rehearsal-voice/${PILOT_PROGRAM.audio_cache_version}/${safeId}.mp3`;
  const info = await FS.getInfoAsync(uri);
  return info.exists ? uri : null;
}

async function prepareStaticSource(dataUri: string, audioId: string): Promise<string> {
  if (Platform.OS === "web") {
    webStaticCache.set(audioId, dataUri);
    return dataUri;
  }
  const parts = parseDataUri(dataUri);
  if (!parts) throw new Error("Unreadable voice audio");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const FS = require("expo-file-system/legacy") as typeof import("expo-file-system/legacy");
  const dir = `${FS.cacheDirectory ?? ""}rehearsal-voice/${PILOT_PROGRAM.audio_cache_version}/`;
  await FS.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const safeId = audioId.replace(/[^a-zA-Z0-9_-]/g, "");
  const uri = `${dir}${safeId}.${audioExtensionFor(parts.mime)}`;
  await FS.writeAsStringAsync(uri, parts.base64, { encoding: FS.EncodingType.Base64 });
  return uri;
}

async function teardownSound(): Promise<void> {
  const player = currentPlayer;
  currentPlayer = null;
  if (!player) return;
  try {
    player.pause();
  } catch {
    // Not playing.
  }
  try {
    player.remove();
  } catch {
    // Already released.
  }
}

function stopWeb(): void {
  const el = webEl;
  if (!el) return;
  try {
    el.pause();
    el.currentTime = 0;
  } catch {
    // Nothing loaded.
  }
}

/** Stop playback now. The last line stays available to replay. */
export async function stopSpeech(): Promise<void> {
  token += 1;
  stopWeb();
  await teardownSound();
  publish({ phase: "idle" });
}

/**
 * Full teardown when leaving a rehearsal: stops audio, drops the cached line,
 * and invalidates anything still in flight.
 */
export async function resetSpeech(): Promise<void> {
  lastUtterance = null;
  await stopSpeech();
  publish({ phase: "idle", canReplay: false });
}

async function playPrepared(source: string, id: number): Promise<SpeakOutcome> {
  if (id !== token) return "empty";

  if (Platform.OS === "web") {
    const el = webElement();
    if (!el) return "failed";
    el.src = source;
    el.onended = () => {
      if (id !== token) return;
      safeLog("[evidence] BYSI TTS playback completed", {
        platform: Platform.OS,
        role: lastUtterance ? roleForPersona(lastUtterance.persona) : "unknown",
        status: "completed",
      });
      publish({ phase: "idle" });
    };
    try {
      await el.play();
    } catch (e) {
      if (isAutoplayBlocked(e)) {
        safeLog("[voice] autoplay blocked");
        publish({ phase: "blocked" });
        return "blocked";
      }
      safeLog("[voice] web playback failed", errorShape(e));
      publish({ phase: "failed" });
      return "failed";
    }
    if (id !== token) {
      stopWeb();
      return "empty";
    }
    publish({ phase: "speaking" });
    return "played";
  }

  await teardownSound();
  // Recording and playback use the same Expo Audio session. Explicitly leave
  // recording mode before every line so iOS routes the reply to the speaker
  // instead of retaining the receiver route after the second recording.
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    interruptionMode: "duckOthers",
    shouldRouteThroughEarpiece: false,
  });
  if (id !== token) return "empty";

  const role = lastUtterance ? roleForPersona(lastUtterance.persona) : "unknown";
  // `source` is already a complete local cache file. `downloadFirst: true`
  // initializes an empty imperative player and attaches the source later, which
  // races with `play()` and can silently do nothing. Attach it synchronously.
  const player = createAudioPlayer({ uri: source }, {
    downloadFirst: false,
    keepAudioSessionActive: true,
    updateInterval: 100,
  });
  player.volume = 1;
  player.muted = false;
  currentPlayer = player;

  try {
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      let removeLoadListener: (() => void) | null = null;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        removeLoadListener?.();
        reject(new Error("Voice audio did not load"));
      }, 5000);
      const finish = (): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        removeLoadListener?.();
        resolve();
      };
      const loadSubscription = player.addListener("playbackStatusUpdate", (status) => {
        if (status.isLoaded) finish();
      });
      removeLoadListener = (): void => loadSubscription.remove();
      if (player.isLoaded || player.currentStatus.isLoaded) finish();
    });
  } catch (error) {
    if (currentPlayer === player) currentPlayer = null;
    player.remove();
    throw error;
  }

  if (id !== token || currentPlayer !== player) {
    player.remove();
    return "empty";
  }

  let hasLoggedStart = false;
  const subscription = player.addListener("playbackStatusUpdate", (status) => {
    if (status.playing && !hasLoggedStart) {
      hasLoggedStart = true;
      safeLog("[evidence] BYSI TTS playback started", {
        platform: Platform.OS,
        role,
        status: "playing",
      });
    }
    if (!status.didJustFinish) return;
    subscription.remove();
    if (currentPlayer !== player) {
      player.remove();
      return;
    }
    currentPlayer = null;
    player.remove();
    if (id === token) {
      safeLog("[evidence] BYSI TTS playback completed", {
        platform: Platform.OS,
        role,
        status: "completed",
      });
      publish({ phase: "idle" });
    }
  });
  player.play();
  publish({ phase: "speaking" });
  return "played";
}

/**
 * Speak a counterpart line. `text` must already be the exact string shown in
 * the bubble, so what is heard always matches what is read.
 *
 * Never throws: the outcome tells the caller which state to render.
 */
export async function speak(
  text: string,
  persona: PersonaVoice,
  options: { muted?: boolean } = {},
): Promise<SpeakOutcome> {
  const clean = text.trim();
  if (clean.length === 0) return "empty";

  // Staged so the speaker control can play it later even when muted now.
  lastUtterance = { text: clean, persona, source: null };
  publish({ canReplay: true });
  if (options.muted === true) {
    publish({ phase: "idle" });
    return "muted";
  }
  return await playUtterance();
}

/**
 * Play the staged line, fetching its audio if needed. Used for the first
 * attempt, the replay control, the tap-to-hear control, and the retry control.
 */
async function playUtterance(): Promise<SpeakOutcome> {
  const utterance = lastUtterance;
  if (!utterance) return "empty";

  token += 1;
  const id = token;
  stopWeb();
  await teardownSound();

  if (utterance.source !== null) {
    publish({ phase: "generating" });
    if ((utterance.leadingPauseMs ?? 0) > 0) await new Promise<void>((resolve) => setTimeout(resolve, utterance.leadingPauseMs));
    return await playPrepared(utterance.source, id);
  }

  publish({ phase: "generating" });
  try {
    const cached = utterance.staticAudioId ? await staticCacheSource(utterance.staticAudioId) : null;
    if (cached) {
      utterance.source = cached;
      if ((utterance.leadingPauseMs ?? 0) > 0) await new Promise<void>((resolve) => setTimeout(resolve, utterance.leadingPauseMs));
      return await playPrepared(cached, id);
    }
    const dataUri = await fetchSpeechDataUri(utterance.text, utterance.persona);
    if (id !== token) return "empty";
    const source = utterance.staticAudioId
      ? await prepareStaticSource(dataUri, utterance.staticAudioId)
      : await prepareSource(dataUri, id);
    if (id !== token) return "empty";
    utterance.source = source;
    if ((utterance.leadingPauseMs ?? 0) > 0) await new Promise<void>((resolve) => setTimeout(resolve, utterance.leadingPauseMs));
    return await playPrepared(source, id);
  } catch (e) {
    safeLog("[voice] generation failed", errorShape(e));
    if (id !== token) return "empty";
    publish({ phase: "failed" });
    return "failed";
  }
}

/**
 * Play the most recent counterpart line again. Also the handler for the
 * tap-to-hear control after a blocked autoplay and the retry after a failure,
 * both of which run inside a real user gesture.
 */
/** Play an approved fixed line through its semantic voice and versioned cache ID. */
export async function speakPilotAudio(line: PilotAudioLine, options: { muted?: boolean } = {}): Promise<SpeakOutcome> {
  const persona: PersonaVoice = line.voice_key === "hope_teacher" ? "woman-hope" : "man-adam";
  const clean = line.text.replace(/^\(brief pause\)\s*/i, "").trim();
  if (!clean) return "empty";
  lastUtterance = {
    text: clean,
    persona,
    staticAudioId: line.audio_id,
    leadingPauseMs: line.leading_pause_ms ?? 0,
    source: null,
  };
  publish({ canReplay: true });
  if (options.muted === true) return "muted";
  return await playUtterance();
}

export async function replaySpeech(): Promise<SpeakOutcome> {
  if (!lastUtterance) return "empty";
  await unlockAudioPlayback();
  webUnlocked = true;
  return await playUtterance();
}

/** True when there is a line staged to play. Kept for non-reactive callers. */
export function hasReplayableLine(): boolean {
  return lastUtterance !== null;
}
