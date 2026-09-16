const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const TOKEN = /^[^\s]+$/;
const KEYCHAIN_SERVICE = "beforeyousayit.normal.result-claim-retry.v1";
const PREFIX = "claim.";
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type NormalResultClaimRetry = {
  schemaVersion: 1;
  sourceOwnerId: string;
  destinationOwnerId: string;
  sessionId: string;
  sourceAccessToken: string;
  createdAt: number;
};

export function isValidNormalResultSessionId(value: unknown): value is string {
  return typeof value === "string" && UUID.test(value);
}

function valid(value: unknown, destinationOwnerId: string, now = Date.now()): value is NormalResultClaimRetry {
  const record = value as Partial<NormalResultClaimRetry> | null;
  return Boolean(record
    && record.schemaVersion === 1
    && isValidNormalResultSessionId(record.sourceOwnerId)
    && record.destinationOwnerId === destinationOwnerId
    && isValidNormalResultSessionId(record.destinationOwnerId)
    && isValidNormalResultSessionId(record.sessionId)
    && typeof record.sourceAccessToken === "string"
    && TOKEN.test(record.sourceAccessToken)
    && record.sourceAccessToken.length <= 8192
    && typeof record.createdAt === "number"
    && Number.isFinite(record.createdAt)
    && now - record.createdAt >= 0
    && now - record.createdAt <= MAX_AGE_MS);
}

async function storage() {
  const secure = await import("expo-secure-store");
  if (!await secure.isAvailableAsync()) return null;
  return {
    get: (key: string) => secure.getItemAsync(key, { keychainService: KEYCHAIN_SERVICE }),
    set: (key: string, value: string) => secure.setItemAsync(key, value, {
      keychainService: KEYCHAIN_SERVICE,
      keychainAccessible: secure.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      requireAuthentication: false,
    }),
    remove: (key: string) => secure.deleteItemAsync(key, { keychainService: KEYCHAIN_SERVICE }),
  };
}

const keyFor = (destinationOwnerId: string) => PREFIX + destinationOwnerId;

export async function saveNormalResultClaimRetry(record: NormalResultClaimRetry): Promise<void> {
  if (!valid(record, record.destinationOwnerId)) throw new Error("Invalid saved result retry");
  const store = await storage();
  if (!store) throw new Error("Secure saved result retry unavailable");
  await store.set(keyFor(record.destinationOwnerId), JSON.stringify(record));
}

export async function readNormalResultClaimRetry(destinationOwnerId: string): Promise<NormalResultClaimRetry | null> {
  if (!isValidNormalResultSessionId(destinationOwnerId)) return null;
  const store = await storage();
  if (!store) return null;
  const raw = await store.get(keyFor(destinationOwnerId));
  if (!raw) return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); }
  catch {
    await store.remove(keyFor(destinationOwnerId));
    return null;
  }
  if (!valid(parsed, destinationOwnerId)) {
    await store.remove(keyFor(destinationOwnerId));
    return null;
  }
  return parsed;
}

export async function clearNormalResultClaimRetry(destinationOwnerId: string | null | undefined): Promise<void> {
  if (!isValidNormalResultSessionId(destinationOwnerId)) return;
  const store = await storage();
  await store?.remove(keyFor(destinationOwnerId));
}
