import { mock } from "bun:test";
import assert from "node:assert/strict";
mock.module("react-native", () => ({ Platform: { OS: "web" } }));
mock.module("expo-audio", () => ({ createAudioPlayer() { throw new Error("Unexpected native player"); }, setAudioModeAsync: async () => {} }));
mock.module("@/lib/supabase", () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: "test-session" } } }) } } }));
process.env.EXPO_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = "test-anon";
process.env.EXPO_PUBLIC_TRANSCRIBE_ENDPOINT = "https://example.supabase.co/functions/v1/transcribe";
process.env.EXPO_PUBLIC_TTS_ENDPOINT = "https://example.com/api/tts";
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((callback: TimerHandler, ms?: number, ...args: unknown[]) => realSetTimeout(callback, ms && ms >= 1000 ? 5 : ms, ...args)) as typeof setTimeout;
const bounded = <T>(promise: Promise<T>) => Promise.race([promise, new Promise<string>(resolve => realSetTimeout(() => resolve("still pending"), 100))]);
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const scenario = process.argv[2];
if (scenario === "transcription-body") {
  const { transcribeRecording } = await import("@/lib/transcription");
  globalThis.fetch = (async (url) => String(url).startsWith("blob:") ? new Response("audio") : new Response(new ReadableStream({ start() {} }))) as typeof fetch;
  assert.equal(await bounded(transcribeRecording("blob:recording", "audio/webm", "opener").catch(e => e.status)), 408);
}
if (scenario === "voice-body") {
  const { speak, resetSpeech } = await import("@/lib/voice");
  globalThis.fetch = (async () => new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "audio/mpeg" } })) as typeof fetch;
  assert.equal(await bounded(speak("Test line", "man-adam")), "failed");
  await resetSpeech();
}
if (scenario === "dictation-cancel") {
  const discarded: string[] = [];
  const retained: string[] = [];
  mock.module("react", () => ({ useCallback: (f: unknown) => f, useEffect: () => {}, useRef: (current: unknown) => ({ current }), useState: (initial: unknown) => [initial, () => {}] }));
  mock.module("react-native", () => ({ Platform: { OS: "ios" } }));
  const recorder = { uri: "file:///private/recording.m4a", prepareToRecordAsync: async () => {}, record() {}, stop: async () => {} };
  mock.module("expo-audio", () => ({ AudioModule: { requestRecordingPermissionsAsync: async () => ({ granted: true }) }, RecordingPresets: { HIGH_QUALITY: {} }, useAudioRecorder: () => recorder, useAudioRecorderState: () => ({}), setAudioModeAsync: async () => {} }));
  mock.module("@/components/ui", () => ({ tap() {} }));
  mock.module("@/lib/baselineAudio", () => ({ keepBaselineAudio: async (id: string) => { retained.push(id); } }));
  mock.module("@/lib/temporaryRecording", () => ({ discardTemporaryRecordingStrict: async (uri: string) => { discarded.push(uri); }, cleanupNativeRecordingStrict: async () => {}, cleanupWebRecordingStrict: async () => {} }));
  const { useDictation } = await import("@/lib/useDictation");
  let signal: AbortSignal | null | undefined;
  globalThis.fetch = ((_url, init) => { signal = init?.signal; return new Promise(() => {}); }) as typeof fetch;
  const dictation = useDictation({ keepAudioAs: "private-opt-in" });
  assert.equal(await dictation.start(), true);
  const pending = dictation.stop("opener");
  await flush();
  const cancelled = dictation.cancel();
  assert.equal(signal?.aborted, true, "cancel must abort before waiting for operation cleanup");
  assert.equal(await bounded(pending), null);
  await cancelled;
  assert.ok(discarded.includes(recorder.uri));
  assert.deepEqual(retained, []);
}
if (scenario === "voice-late-play") {
  const { speak, resetSpeech, onSpeechChange } = await import("@/lib/voice");
  let rejectPlay!: (error: Error) => void;
  let state: unknown;
  const el = { preload: "", src: "", setAttribute() {}, pause() {}, currentTime: 0, play: () => new Promise<void>((_resolve, reject) => { rejectPlay = reject; }) };
  globalThis.document = { createElement: () => el } as unknown as Document;
  globalThis.FileReader = class { result = "data:audio/mpeg;base64,YQ=="; onloadend?: () => void; readAsDataURL() { this.onloadend?.(); } } as unknown as typeof FileReader;
  globalThis.fetch = (async () => new Response("audio", { headers: { "content-type": "audio/mpeg" } })) as typeof fetch;
  onSpeechChange(s => { state = s; });
  const pending = speak("Old line", "man-adam");
  for (let i = 0; i < 10 && !rejectPlay; i++) await new Promise(resolve => realSetTimeout(resolve, 1));
  assert.ok(rejectPlay);
  await resetSpeech();
  const error = new Error("Not allowed"); error.name = "NotAllowedError";
  rejectPlay(error);
  assert.equal(await pending, "empty");
  assert.deepEqual(state, { phase: "idle", canReplay: false });
}
if (scenario === "voice-reader-reset") {
  const { speak, resetSpeech } = await import("@/lib/voice");
  let readerStarted = false;
  let readerAborted = false;
  globalThis.FileReader = class { readAsDataURL() { readerStarted = true; } abort() { readerAborted = true; } } as unknown as typeof FileReader;
  globalThis.fetch = (async () => new Response("audio", { headers: { "content-type": "audio/mpeg" } })) as typeof fetch;
  const pending = speak("Old line", "man-adam");
  for (let i = 0; i < 10 && !readerStarted; i++) await new Promise(resolve => realSetTimeout(resolve, 1));
  assert.ok(readerStarted);
  await resetSpeech();
  assert.equal(readerAborted, true);
  assert.equal(await pending, "empty");
}
if (scenario === "voice-reset") {
  const { speak, resetSpeech, hasReplayableLine, onSpeechChange } = await import("@/lib/voice");
  let signal: AbortSignal | null | undefined;
  let state: unknown;
  onSpeechChange(s => { state = s; });
  globalThis.fetch = ((_url, init) => { signal = init?.signal; return new Promise(() => {}); }) as typeof fetch;
  const pending = speak("Test line", "man-adam");
  await flush();
  await resetSpeech();
  assert.equal(signal?.aborted, true);
  assert.equal(await bounded(pending), "empty");
  assert.equal(hasReplayableLine(), false);
  assert.deepEqual(state, { phase: "idle", canReplay: false });
}
