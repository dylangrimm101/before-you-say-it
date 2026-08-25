import { File } from "expo-file-system";

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
