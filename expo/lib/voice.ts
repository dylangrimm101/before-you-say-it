import { Audio } from "expo-av";
import { useEffect, useState } from "react";
import { Platform } from "react-native";

import { voiceIdFor } from "@/constants/personas";
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

const BASE = process.env.EXPO_PUBLIC_TOOLKIT_URL ?? "";
const KEY = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY ?? "";

// Voice ids live with the persona definitions, so gender and voice cannot drift.

/** Both voices use the expressive model auditioned and approved in ElevenLabs. */
const TTS_MODEL: Record<PersonaVoice, string> = {
  "woman-hope": "eleven_multilingual_v2",
  "man-adam": "eleven_multilingual_v2",
};

interface VoiceSettings {
  speed: number;
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
}

/** Explicitly mirrors each voice's approved ElevenLabs controls. */
const VOICE_SETTINGS: Record<PersonaVoice, VoiceSettings> = {
  "woman-hope": {
    speed: 1,
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    use_speaker_boost: true,
  },
  "man-adam": {
    speed: 1,
    stability: 0.75,
    similarity_boost: 0.75,
    style: 0.4,
    use_speaker_boost: true,
  },
};

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
let currentSound: Audio.Sound | null = null;
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
  if (__DEV__) console.log(`[voice] tts_request persona=${persona}`);
  const res = await fetch(
    `${BASE}/v2/elevenlabs/v1/text-to-speech/${voiceIdFor(persona)}?output_format=mp3_44100_128`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        text,
        model_id: TTS_MODEL[persona],
        voice_settings: VOICE_SETTINGS[persona],
      }),
    },
  );
  if (!res.ok) throw new Error(`Voice request failed (${res.status})`);

  const blob = await res.blob();
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
  const sound = currentSound;
  currentSound = null;
  if (!sound) return;
  try {
    await sound.stopAsync();
  } catch {
    // Not playing.
  }
  try {
    await sound.unloadAsync();
  } catch {
    // Already unloaded.
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
      if (id === token) publish({ phase: "idle" });
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
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
  });
  const { sound } = await Audio.Sound.createAsync({ uri: source }, { shouldPlay: true });
  if (id !== token) {
    await sound.unloadAsync().catch(() => {});
    return "empty";
  }
  currentSound = sound;
  publish({ phase: "speaking" });
  sound.setOnPlaybackStatusUpdate((status) => {
    if (!status.isLoaded || !status.didJustFinish) return;
    sound.unloadAsync().catch(() => {});
    if (currentSound === sound) {
      currentSound = null;
      if (id === token) publish({ phase: "idle" });
    }
  });
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
