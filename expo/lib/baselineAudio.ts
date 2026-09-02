import { Directory, File, Paths } from "expo-file-system";

import { errorShape, safeLog } from "@/lib/redact";

/**
 * Optional, opt-in baseline recordings. Files live only in this app's private
 * document container on this device. Nothing here is ever uploaded, and no
 * audio is ever written into key-value storage as encoded text.
 *
 * No claim is made about encryption: the platform's own file protection is
 * whatever the OS applies to an app container, and there is no API available
 * here to verify or set it.
 */

export const BASELINE_DIR_NAME = "baseline-audio";

/** Expo inlines EXPO_OS for web bundles; document covers an executing browser. */
function isWebRuntime(): boolean {
  return process.env.EXPO_OS === "web" || typeof document !== "undefined";
}

/**
 * Filename derived from the session id alone. Everything outside a safe
 * character set is removed, so nothing a user typed can shape a path.
 */
export function baselineFileName(sessionId: string): string {
  const safe = sessionId.replace(/[^a-zA-Z0-9_-]/g, "");
  return `${safe.length > 0 ? safe : "session"}.m4a`;
}

function baselineDir(): Directory {
  return new Directory(Paths.document, BASELINE_DIR_NAME);
}

function baselineFile(sessionId: string): File {
  return new File(baselineDir(), baselineFileName(sessionId));
}

/**
 * Copy a finished recording into the private container. Only ever called when
 * the user has explicitly turned the keep-this-recording option on.
 */
export async function keepBaselineAudio(
  sessionId: string,
  sourceUri: string,
): Promise<string | null> {
  try {
    const dir = baselineDir();
    if (!dir.exists) dir.create({ intermediates: true });
    const target = baselineFile(sessionId);
    if (target.exists) target.delete();
    new File(sourceUri).copy(target);
    return target.uri;
  } catch (e) {
    safeLog("[baseline] keep failed", errorShape(e));
    return null;
  }
}

export async function hasBaselineAudio(sessionId: string): Promise<boolean> {
  try {
    return baselineFile(sessionId).exists;
  } catch {
    return false;
  }
}

export async function baselineAudioUri(sessionId: string): Promise<string | null> {
  try {
    const file = baselineFile(sessionId);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

/** Strictly removes one retained recording. Privacy-sensitive callers must surface failures. */
export async function deleteBaselineAudioStrict(sessionId: string): Promise<void> {
  // Web recordings are Blob URLs held only in memory. Never construct native
  // File/Directory objects in browsers, where expo-file-system is unsupported.
  if (isWebRuntime()) return;
  const file = baselineFile(sessionId);
  if (file.exists) file.delete();
  if (file.exists) throw new Error("Retained recording deletion was not confirmed");
}

/** Best-effort cache maintenance. Never use this to confirm a privacy deletion. */
export async function deleteBaselineAudio(sessionId: string): Promise<void> {
  try {
    await deleteBaselineAudioStrict(sessionId);
  } catch (e) {
    safeLog("[baseline] delete failed", errorShape(e));
  }
}

/** Strictly removes every retained recording and verifies the directory is gone. */
export async function deleteAllBaselineAudioStrict(): Promise<void> {
  if (isWebRuntime()) return;
  const dir = baselineDir();
  if (!dir.exists) return;
  for (const entry of dir.list()) entry.delete();
  if (dir.list().length > 0) throw new Error("Retained recordings remain on disk");
  dir.delete();
  if (dir.exists) throw new Error("Retained recording directory deletion was not confirmed");
}

/** Best-effort cache maintenance. Privacy-sensitive flows use the strict variant. */
export async function deleteAllBaselineAudio(): Promise<void> {
  try {
    await deleteAllBaselineAudioStrict();
  } catch (e) {
    safeLog("[baseline] delete all failed", errorShape(e));
  }
}

/** How many recordings are currently retained on this device. */
export async function countBaselineAudio(): Promise<number> {
  try {
    const dir = baselineDir();
    if (!dir.exists) return 0;
    return dir.list().length;
  } catch {
    return 0;
  }
}
