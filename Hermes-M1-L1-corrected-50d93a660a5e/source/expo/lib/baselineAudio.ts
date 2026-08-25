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

export async function deleteBaselineAudio(sessionId: string): Promise<void> {
  try {
    const file = baselineFile(sessionId);
    if (file.exists) file.delete();
  } catch (e) {
    safeLog("[baseline] delete failed", errorShape(e));
  }
}

/** Remove every retained recording and the directory itself. */
export async function deleteAllBaselineAudio(): Promise<void> {
  try {
    const dir = baselineDir();
    if (!dir.exists) return;
    dir.list().forEach((entry) => {
      try {
        entry.delete();
      } catch {
        // A single stubborn entry must not stop the rest from being removed.
      }
    });
    dir.delete();
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
