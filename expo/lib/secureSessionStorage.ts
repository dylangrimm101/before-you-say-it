export interface AsyncKeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

interface GenerationRecord {
  generation: string;
  count: number;
}

interface SecureManifest extends GenerationRecord {
  version: 1;
  retired: GenerationRecord[];
  legacyCleanup: boolean;
}

interface PendingManifest extends GenerationRecord {
  version: 1;
}

interface SecureSessionStorageOptions {
  secure: AsyncKeyValueStore;
  legacy: AsyncKeyValueStore;
  namespaceForKey: (key: string) => Promise<string>;
  generation: () => string;
  chunkSize?: number;
}

const DEFAULT_CHUNK_SIZE_BYTES = 1_800;
const MAX_VALUE_BYTES = 1_800;
const MAX_CHUNKS = 256;
const MAX_RETIRED_GENERATIONS = 16;
const SAFE_GENERATION = /^[A-Za-z0-9_-]{1,100}$/;
const queues = new Map<string, Promise<void>>();

function validGeneration(value: unknown): value is string {
  return typeof value === "string" && SAFE_GENERATION.test(value);
}

function validCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) > 0 && Number(value) <= MAX_CHUNKS;
}

function parseGeneration(value: unknown): GenerationRecord | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<GenerationRecord>;
  return validGeneration(candidate.generation) && validCount(candidate.count)
    ? { generation: candidate.generation, count: candidate.count }
    : null;
}

function parseManifest(raw: string | null): SecureManifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<SecureManifest>;
    const current = parseGeneration(value);
    if (value.version !== 1 || !current) return null;
    const retired = Array.isArray(value.retired)
      ? value.retired.map(parseGeneration).filter((entry): entry is GenerationRecord => entry !== null)
      : [];
    if (retired.length > MAX_RETIRED_GENERATIONS) return null;
    return {
      version: 1,
      ...current,
      retired,
      legacyCleanup: value.legacyCleanup === true,
    };
  } catch {
    return null;
  }
}

function parsePending(raw: string | null): PendingManifest | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<PendingManifest>;
    const generation = parseGeneration(value);
    return value.version === 1 && generation ? { version: 1, ...generation } : null;
  } catch {
    return null;
  }
}

function chunkKey(namespace: string, generation: string, index: number): string {
  return `${namespace}.${generation}.${index}`;
}

function splitUtf8(value: string, maxBytes: number): string[] {
  if (value.length === 0) return [""];
  const encoder = new TextEncoder();
  const chunks: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const character of value) {
    const characterBytes = encoder.encode(character).byteLength;
    if (characterBytes > maxBytes) throw new Error("Secure session chunk size cannot hold one character");
    if (current && currentBytes + characterBytes > maxBytes) {
      chunks.push(current);
      current = "";
      currentBytes = 0;
    }
    current += character;
    currentBytes += characterBytes;
  }
  if (current) chunks.push(current);
  return chunks;
}

function serializeBounded(value: SecureManifest | PendingManifest): string {
  const serialized = JSON.stringify(value);
  if (new TextEncoder().encode(serialized).byteLength > MAX_VALUE_BYTES) {
    throw new Error("Secure session metadata exceeds the supported size");
  }
  return serialized;
}

async function setVerified(store: AsyncKeyValueStore, key: string, value: string): Promise<void> {
  await store.setItem(key, value);
  if (await store.getItem(key) !== value) throw new Error("Secure session write verification failed");
}

async function readGeneration(
  secure: AsyncKeyValueStore,
  namespace: string,
  generation: GenerationRecord,
): Promise<string | null> {
  const chunks: string[] = [];
  for (let index = 0; index < generation.count; index += 1) {
    const chunk = await secure.getItem(chunkKey(namespace, generation.generation, index));
    if (chunk === null) return null;
    chunks.push(chunk);
  }
  return chunks.join("");
}

async function deleteGeneration(
  secure: AsyncKeyValueStore,
  namespace: string,
  entry: GenerationRecord,
): Promise<boolean> {
  try {
    for (let index = 0; index < entry.count; index += 1) {
      await secure.removeItem(chunkKey(namespace, entry.generation, index));
    }
    return true;
  } catch {
    return false;
  }
}

async function withNamespaceLock<T>(namespace: string, work: () => Promise<T>): Promise<T> {
  const previous = queues.get(namespace) ?? Promise.resolve();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const queued = previous.catch(() => {}).then(() => gate);
  queues.set(namespace, queued);
  await previous.catch(() => {});
  try {
    return await work();
  } finally {
    release();
    if (queues.get(namespace) === queued) queues.delete(namespace);
  }
}

async function recoverPending(
  secure: AsyncKeyValueStore,
  namespace: string,
  manifest: SecureManifest | null,
): Promise<void> {
  const pendingKey = `${namespace}.pending`;
  const pending = parsePending(await secure.getItem(pendingKey));
  if (!pending) return;
  if (manifest?.generation === pending.generation) {
    await secure.removeItem(pendingKey);
    return;
  }
  if (await deleteGeneration(secure, namespace, pending)) {
    await secure.removeItem(pendingKey);
    return;
  }
  throw new Error("Pending secure session cleanup is incomplete");
}

/**
 * Adapts bounded secure key/value storage to Supabase's async storage contract.
 * A persistent pending journal makes partial writes recoverable after process
 * interruption, while the committed manifest always points at the last complete
 * session. Legacy AsyncStorage is removed only after secure read-back succeeds.
 */
export function createMigratingSecureSessionStorage(options: SecureSessionStorageOptions): AsyncKeyValueStore {
  const chunkSize = Math.max(4, Math.min(options.chunkSize ?? DEFAULT_CHUNK_SIZE_BYTES, MAX_VALUE_BYTES));

  async function getUnlocked(key: string, namespace: string): Promise<string | null> {
    let manifest = parseManifest(await options.secure.getItem(`${namespace}.manifest`));
    await recoverPending(options.secure, namespace, manifest).catch(() => {});
    manifest = parseManifest(await options.secure.getItem(`${namespace}.manifest`));
    if (manifest) {
      const secureValue = await readGeneration(options.secure, namespace, manifest);
      if (secureValue !== null) {
        if (manifest.legacyCleanup) {
          try {
            await options.legacy.removeItem(key);
            await setVerified(options.secure, `${namespace}.manifest`, serializeBounded({ ...manifest, legacyCleanup: false }));
          } catch {
            // Keep the cleanup bit so the next read retries legacy deletion.
          }
        }
               return secureValue;
      }
    }

    const legacyValue = await options.legacy.getItem(key);
    if (legacyValue === null) return null;
    try {
      await setUnlocked(key, namespace, legacyValue);
      return (await readGeneration(
        options.secure,
        namespace,
        parseManifest(await options.secure.getItem(`${namespace}.manifest`))!,
      )) ?? legacyValue;
    } catch {
      return legacyValue;
    }
  }

  async function setUnlocked(key: string, namespace: string, value: string): Promise<void> {
    const manifestKey = `${namespace}.manifest`;
    const pendingKey = `${namespace}.pending`;
    let previous = parseManifest(await options.secure.getItem(manifestKey));
    await recoverPending(options.secure, namespace, previous);
    previous = parseManifest(await options.secure.getItem(manifestKey));

    const generation = options.generation();
    if (!SAFE_GENERATION.test(generation)) throw new Error("Secure session generation is invalid");
    const chunks = splitUtf8(value, chunkSize);
    if (chunks.length > MAX_CHUNKS) throw new Error("Secure session exceeds the supported size");
    const candidate: PendingManifest = { version: 1, generation, count: chunks.length };
    await setVerified(options.secure, pendingKey, serializeBounded(candidate));

    try {
      for (let index = 0; index < chunks.length; index += 1) {
        await setVerified(options.secure, chunkKey(namespace, generation, index), chunks[index]!);
      }
      const retired = previous
        ? [{ generation: previous.generation, count: previous.count }, ...previous.retired]
        : [];
      if (retired.length > MAX_RETIRED_GENERATIONS) {
        throw new Error("Secure session cleanup backlog must be resolved before another write");
      }
      const committed: SecureManifest = {
        version: 1,
        generation,
        count: chunks.length,
        retired,
        legacyCleanup: true,
      };
      await setVerified(options.secure, manifestKey, serializeBounded(committed));

      let legacyCleanup = true;
      try {
        await options.legacy.removeItem(key);
        legacyCleanup = false;
      } catch {
        // A committed secure session remains usable; future reads retry cleanup.
      }

      const remaining: GenerationRecord[] = [];
      for (const entry of retired) {
        if (!(await deleteGeneration(options.secure, namespace, entry))) remaining.push(entry);
      }
      const cleaned = { ...committed, retired: remaining, legacyCleanup };
      await setVerified(options.secure, manifestKey, serializeBounded(cleaned));
      await options.secure.removeItem(pendingKey);
    } catch (error) {
      const active = parseManifest(await options.secure.getItem(manifestKey));
      if (active?.generation !== generation && await deleteGeneration(options.secure, namespace, candidate)) {
        await options.secure.removeItem(pendingKey).catch(() => {});
      }
      throw error;
    }
  }

  async function removeUnlocked(key: string, namespace: string): Promise<void> {
    const manifestKey = `${namespace}.manifest`;
    const pendingKey = `${namespace}.pending`;
    const manifest = parseManifest(await options.secure.getItem(manifestKey));
    const pending = parsePending(await options.secure.getItem(pendingKey));
    const generations = [
      ...(manifest ? [{ generation: manifest.generation, count: manifest.count }, ...manifest.retired] : []),
      ...(pending && pending.generation !== manifest?.generation ? [pending] : []),
    ];
    const unique = generations.filter((entry, index) =>
      generations.findIndex((candidate) => candidate.generation === entry.generation) === index,
    );
    const failures: GenerationRecord[] = [];
    for (const entry of unique) {
      if (!(await deleteGeneration(options.secure, namespace, entry))) failures.push(entry);
    }
    await options.legacy.removeItem(key);
    if (failures.length > 0) throw new Error("Secure session deletion is incomplete");
    await options.secure.removeItem(manifestKey);
    await options.secure.removeItem(pendingKey);
  }

  return {
    async getItem(key: string): Promise<string | null> {
      const namespace = await options.namespaceForKey(key);
      return withNamespaceLock(namespace, () => getUnlocked(key, namespace));
    },
    async setItem(key: string, value: string): Promise<void> {
      const namespace = await options.namespaceForKey(key);
      return withNamespaceLock(namespace, () => setUnlocked(key, namespace, value));
    },
    async removeItem(key: string): Promise<void> {
      const namespace = await options.namespaceForKey(key);
      return withNamespaceLock(namespace, () => removeUnlocked(key, namespace));
    },
  };
}
