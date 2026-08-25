import { File } from "expo-file-system";

export interface NativeRecordingCleanupAdapter {
  stop(): Promise<void>;
  uri(): string | null;
  releaseAudioMode(): Promise<void>;
  discard(uri: string): Promise<void>;
}

/** Stops/releases native capture and deletes content even when stop itself fails. */
export async function cleanupNativeRecordingStrict(adapter: NativeRecordingCleanupAdapter): Promise<void> {
  await adapter.stop();
  const uri = adapter.uri();
  await adapter.releaseAudioMode();
  if (uri) await adapter.discard(uri);
}

export interface WebRecordingCleanupAdapter {
  stop(): Promise<void>;
  discardBufferedContent(): Promise<void>;
  releaseTracks(): void;
}

/** Browser cleanup keeps buffered content pending unless stop and discard both succeed. */
export async function cleanupWebRecordingStrict(adapter: WebRecordingCleanupAdapter): Promise<void> {
  await adapter.stop();
  adapter.releaseTracks();
  await adapter.discardBufferedContent();
}

/** Runs the navigation boundary only after the hook confirms all pending recorder cleanup. */
export async function leaveAfterStrictDictationCleanup(
  cancel: () => Promise<void>,
  navigate: () => void,
): Promise<void> {
  await cancel();
  navigate();
}

/** Strictly deletes one temporary recording and verifies native content is absent. */
export async function discardTemporaryRecordingStrict(uri: string): Promise<void> {
  if (uri.startsWith("blob:")) {
    URL.revokeObjectURL(uri);
    return;
  }
  const file = new File(uri);
  if (file.exists) file.delete();
  if (file.exists) throw new Error("Temporary recording deletion was not confirmed");
}
