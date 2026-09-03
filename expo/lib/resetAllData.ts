export interface ResetStorage {
  getItem(key: string): Promise<string | null>;
  getAllKeys(): Promise<readonly string[]>;
  setItem(key: string, value: string): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

export interface ResetAllDataDependencies {
  storage: ResetStorage;
  appKeys: readonly string[];
  anonymousKey: string;
  newAnonymousId(): string;
  signOutSupabase(): Promise<void>;
  logOutPurchases(): Promise<void>;
  deletePrivateAudio(): Promise<void>;
  deleteGeneratedVoiceCache(): Promise<void>;
}

function supabaseAuthKeys(keys: readonly string[]): string[] {
  return keys.filter((key) => /^sb-.+-auth-token(?:[.-].+)?$/.test(key));
}

/** Performs and verifies every durable boundary before the UI announces reset. */
export async function resetAllDataStrict(deps: ResetAllDataDependencies): Promise<string> {
  await deps.signOutSupabase();
  await deps.logOutPurchases();
  await deps.deletePrivateAudio();
  await deps.deleteGeneratedVoiceCache();

  const authKeys = supabaseAuthKeys(await deps.storage.getAllKeys());
  const removalKeys = [...new Set([...deps.appKeys, ...authKeys])];
  await deps.storage.multiRemove(removalKeys);

  const nextAnonymousId = deps.newAnonymousId();
  if (!nextAnonymousId.trim()) throw new Error("Anonymous identity regeneration failed");
  await deps.storage.setItem(deps.anonymousKey, nextAnonymousId);

  const remaining = await Promise.all(removalKeys.filter((key) => key !== deps.anonymousKey).map(async (key) => [key, await deps.storage.getItem(key)] as const));
  if (remaining.some(([, value]) => value !== null)) throw new Error("Reset storage deletion was not confirmed");
  if (await deps.storage.getItem(deps.anonymousKey) !== nextAnonymousId) throw new Error("Anonymous identity persistence was not confirmed");
  return nextAnonymousId;
}
