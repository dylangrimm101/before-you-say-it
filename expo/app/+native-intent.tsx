import { validatedNativeIntentPath } from "@/lib/nativeIntent";

export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  return validatedNativeIntentPath(path);
}
