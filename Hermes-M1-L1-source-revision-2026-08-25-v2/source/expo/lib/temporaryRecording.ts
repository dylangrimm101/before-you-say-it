import { File } from "expo-file-system";

export interface NativeRecordingCleanupAdapter {
  stop(): Promise<void>;
  uri(): string | null;
  releaseAudioMode(): Promise<void>;
  discard(uri: string): Promise<void>;
}

/** Stops/releases native capture and deletes content even when stop itself fails. */
export async function cleanupNativeRecordingStrict(adapter: NativeRecordingCleanupAdapter): Promise<void> {
  let stopError: unknown;
  try { await adapter.stop(); } catch (error) { stopError = error; }
  const uri = adapter.uri();
  let deletionError: unknown;
  try { if (uri) await adapter.discard(uri); } catch (error) { deletionError = error; }
  try { await adapter.releaseAudioMode(); } catch (error) { if (!stopError) stopError = error; }
  if (deletionError) throw deletionError;
  if (stopError) throw stopError;
}

export interface WebRecordingCleanupAdapter {
  stop(): Promise<void>;
  discardBufferedContent(): Promise<void>;
  releaseTracks(): void;
}

/** Browser cleanup keeps buffered content pending unless stop and discard both succeed. */
export async function cleanupWebRecordingStrict(adapter: WebRecordingCleanupAdapter): Promise<void> {
  await adapter.stop();
  await adapter.discardBufferedContent();
  adapter.releaseTracks();
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
