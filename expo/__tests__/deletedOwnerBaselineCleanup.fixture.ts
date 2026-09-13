import { mock } from "bun:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scenario = process.argv[2] ?? "";
const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const url = "https://spvksnddzyvycfoefrcf.supabase.co";
const rootDir = mkdtempSync(join(tmpdir(), "native-r2-baseline-"));
const documentsDir = join(rootDir, "Documents");
const statePath = join(rootDir, "state.json");
type State = { disk: [string, string][], secure: [string, string][], baseline: [string, string][], dirs: string[] };
const load = (): State => {
  try { return JSON.parse(readFileSync(statePath, "utf8")); }
  catch { return { disk: [], secure: [], baseline: [], dirs: [] }; }
};
let saved = load();
const disk = new Map<string, string>(saved.disk);
const secureDisk = new Map<string, string>(saved.secure);
const baselineFiles = new Map<string, string>(saved.baseline);
const dirs = new Set<string>(saved.dirs);
const persist = () => writeFileSync(statePath, JSON.stringify({ disk: [...disk], secure: [...secureDisk], baseline: [...baselineFiles], dirs: [...dirs] } satisfies State));
let failGetAllKeys = false, failList = false, failRead = false, failWrite = false, failDelete = false;
let gateGetAllKeys: Promise<void> | null = null;
let enteredGetAllKeys: (() => void) | null = null;
const host = {
  getItem: async (key: string) => { if (failRead) throw Error("synthetic read failure"); return disk.get(key) ?? null; },
  setItem: async (key: string, value: string) => { if (failWrite) throw Error("synthetic write failure"); disk.set(key, value); persist(); },
  removeItem: async (key: string) => { disk.delete(key); persist(); },
  getAllKeys: async () => {
    if (failGetAllKeys) throw Error("synthetic key listing failure");
    enteredGetAllKeys?.();
    if (gateGetAllKeys) await gateGetAllKeys;
    return [...disk.keys()];
  },
  multiRemove: async (keys: string[]) => { for (const key of keys) disk.delete(key); persist(); },
};

mock.module("@react-native-async-storage/async-storage", () => ({ default: host }));
mock.module("@/lib/supabase", () => ({ supabase: null, authEnvironment: { url, keychainService: "beforeyousayit.supabase", staging: false }, isAuthConfigured: true }));
mock.module("react-native", () => ({ Platform: { OS: "ios" } }));
mock.module("expo-secure-store", () => ({
  isAvailableAsync: async () => true,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
  getItemAsync: async (key: string, options: { keychainService?: string } = {}) => secureDisk.get(`${options.keychainService ?? "default"}:${key}`) ?? null,
  setItemAsync: async (key: string, value: string, options: { keychainService?: string } = {}) => { secureDisk.set(`${options.keychainService ?? "default"}:${key}`, value); persist(); },
  deleteItemAsync: async (key: string, options: { keychainService?: string } = {}) => { secureDisk.delete(`${options.keychainService ?? "default"}:${key}`); persist(); },
}));
mock.module("expo-crypto", () => ({ CryptoDigestAlgorithm: { SHA256: "SHA256" }, randomUUID, digestStringAsync: async (_: string, value: string) => createHash("sha256").update(value).digest("hex") }));
mock.module("expo-file-system/legacy", () => ({ cacheDirectory: "cache/", getInfoAsync: async () => ({ exists: false }), deleteAsync: async () => {} }));

const joinUri = (parts: (string | { uri: string })[]) => parts.map(part => typeof part === "string" ? part : part.uri).filter(Boolean).reduce((left, right) => left ? `${left.replace(/\/$/, "")}/${right.replace(/^\//, "")}` : right, "");
const pathFromUri = (uri: string) => fileURLToPath(uri);
class File {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) { this.uri = joinUri(parts); }
  get exists() { return existsSync(pathFromUri(this.uri)); }
  copy(target: File) {
    if (!this.exists) throw Error("missing source");
    mkdirSync(pathFromUri(target.uri).replace(/\/[^/]+$/, ""), { recursive: true });
    writeFileSync(pathFromUri(target.uri), readFileSync(pathFromUri(this.uri)));
    baselineFiles.set(target.uri, readFileSync(pathFromUri(target.uri), "utf8"));
    persist();
  }
  delete() { if (failDelete) throw Error("synthetic delete failure"); if (this.exists) unlinkSync(pathFromUri(this.uri)); baselineFiles.delete(this.uri); persist(); }
}
class Directory {
  uri: string;
  constructor(...parts: (string | { uri: string })[]) { this.uri = joinUri(parts); }
  get exists() { return existsSync(pathFromUri(this.uri)); }
  create() { mkdirSync(pathFromUri(this.uri), { recursive: true }); dirs.add(this.uri); persist(); }
  list() { if (failList) throw Error("synthetic list failure"); if (!this.exists) return []; return readdirSync(pathFromUri(this.uri)).map(name => new File(this.uri + "/" + name)); }
  delete() { if (this.exists) rmSync(pathFromUri(this.uri), { recursive: true, force: true }); for (const file of baselineFiles.keys()) if (file.startsWith(this.uri + "/")) baselineFiles.delete(file); dirs.delete(this.uri); persist(); }
}
mock.module("expo-file-system", () => ({ File, Directory, Paths: { document: { uri: pathToFileURL(documentsDir).href } } }));

const { cleanupDeletedAccountOwner } = await import("../lib/accountLifecycleRuntime");
const { BASELINE_DIR_NAME, baselineFileName } = await import("../lib/baselineAudio");
const storageOwner = `${url}:${A}`;
const foreignOwner = `${url}:${B}`;
const ownerPrefix = (owner: string) => `bysi.owner.v1:${encodeURIComponent(owner)}:`;
const pendingKey = (owner: string) => `bysi.accountDeletion.baselinePending.v1:${encodeURIComponent(owner)}`;
const root = pathToFileURL(join(documentsDir, BASELINE_DIR_NAME)).href;
const seedFile = (id: string, value = id) => {
  mkdirSync(pathFromUri(root), { recursive: true });
  dirs.add(root);
  const uri = root + "/" + baselineFileName(id);
  writeFileSync(pathFromUri(uri), value);
  baselineFiles.set(uri, value);
  persist();
};
const ownerSession = (id: string) => JSON.stringify([{ id, schemaVersion: 2 }]);
const run = async (owner = A) => cleanupDeletedAccountOwner(owner);
const expectPending = async (owner = storageOwner) => assert.match((await host.getItem(pendingKey(owner))) ?? "", /"version":1/);
const resetFromDisk = () => {
  saved = load();
  disk.clear(); secureDisk.clear(); baselineFiles.clear(); dirs.clear();
  for (const item of saved.disk) disk.set(...item);
  for (const item of saved.secure) secureDisk.set(...item);
  for (const item of saved.baseline) baselineFiles.set(...item);
  for (const item of saved.dirs) dirs.add(item);
};

try {
  if (scenario === "malformed-global-preserves") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    await host.setItem("cc.sessions.v2", "{malformed");
    seedFile("owner-baseline", "owner audio");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("owner-baseline")), "owner audio");
    assert.equal(await host.getItem(ownerPrefix(storageOwner) + "cc.sessions.v2"), null);
    await expectPending();
  } else if (scenario === "malformed-owner-key-durable") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    await host.setItem("bysi.owner.v1:%E0%A4%A:cc.sessions.v2", ownerSession("unknown-owner"));
    seedFile("owner-baseline", "owner audio");
    seedFile("unknown-owner", "unknown audio");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.has(root + "/" + baselineFileName("owner-baseline")), true);
    await expectPending();
  } else if (scenario === "foreign-pending-preserves") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    await host.setItem(ownerPrefix(foreignOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    seedFile("shared:baseline", "shared bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    resetFromDisk();
    await assert.rejects(cleanupDeletedAccountOwner(B), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("shared:baseline")), "shared bytes");
  } else if (scenario === "foreign-reference-removed-retry-preserves") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    await host.setItem(ownerPrefix(foreignOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    seedFile("shared:baseline", "shared bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(await host.getItem(ownerPrefix(storageOwner) + "cc.sessions.v2"), null);
    await host.removeItem(ownerPrefix(foreignOwner) + "cc.sessions.v2");
    resetFromDisk();
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("shared:baseline")), "shared bytes");
  } else if (scenario === "malformed-own-reference-retry") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", "{malformed");
    seedFile("owner-baseline", "owner bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(await host.getItem(ownerPrefix(storageOwner) + "cc.sessions.v2"), null);
    resetFromDisk();
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("owner-baseline")), "owner bytes");
  } else if (scenario === "malformed-pending-prefix-blocks") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    await host.setItem("bysi.accountDeletion.baselinePending.v1:%E0%A4%A", JSON.stringify({ version: 1, owner: foreignOwner, ids: ["owner-baseline"] }));
    seedFile("owner-baseline", "owner bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("owner-baseline")), "owner bytes");
  } else if (scenario === "active-envelope-conflicting-ids") {
    const sourceSnapshot = JSON.stringify({ id: "owner-baseline" });
    const value = JSON.stringify({ id: "other-baseline" });
    await host.setItem(ownerPrefix(storageOwner) + "cc.activePracticeSession.v1", JSON.stringify({ localGuestContinuation: 1, owner: storageOwner, sourceSnapshot, value }));
    seedFile("owner-baseline", "owner bytes");
    seedFile("other-baseline", "other bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("owner-baseline")), "owner bytes");
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("other-baseline")), "other bytes");
  } else if (scenario === "corrupt-pending-not-overwritten") {
    await host.setItem(pendingKey(storageOwner), "{corrupt");
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    seedFile("owner-baseline", "owner bytes");
    await assert.rejects(run(), /baseline cleanup is pending/);
    assert.equal(await host.getItem(pendingKey(storageOwner)), "{corrupt");
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("owner-baseline")), "owner bytes");
  } else if (scenario === "concurrent-cleanup") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    await host.setItem(ownerPrefix(foreignOwner) + "cc.sessions.v2", ownerSession("shared:baseline"));
    seedFile("shared:baseline", "shared bytes");
    let release!: () => void;
    const entered = new Promise<void>(resolve => { enteredGetAllKeys = resolve; });
    gateGetAllKeys = new Promise<void>(resolve => { release = resolve; });
    const aCleanup = run();
    await entered;
    const bCleanup = cleanupDeletedAccountOwner(B);
    release();
    await assert.rejects(aCleanup, /baseline cleanup is pending/);
    await assert.rejects(bCleanup, /baseline cleanup is pending/);
    assert.equal(baselineFiles.get(root + "/" + baselineFileName("shared:baseline")), "shared bytes");
  } else if (scenario === "disk-failures") {
    await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    seedFile("owner-baseline", "owner bytes");
    for (const [flag, message] of [
      ["list", /baseline cleanup is pending/],
      ["delete", /baseline cleanup is pending/],
      ["write", /synthetic write failure/],
      ["read", /baseline cleanup is pending/],
      ["keys", /synthetic key listing failure/],
    ] as const) {
      failList = flag === "list"; failDelete = flag === "delete"; failWrite = flag === "write"; failRead = flag === "read"; failGetAllKeys = flag === "keys";
      if (flag === "write") failDelete = true;
      await assert.rejects(run(), message);
      failList = failDelete = failWrite = failRead = failGetAllKeys = false;
      if (!baselineFiles.has(root + "/" + baselineFileName("owner-baseline"))) seedFile("owner-baseline", "owner bytes");
      if (!disk.has(ownerPrefix(storageOwner) + "cc.sessions.v2")) await host.setItem(ownerPrefix(storageOwner) + "cc.sessions.v2", ownerSession("owner-baseline"));
    }
    await run();
    assert.equal(baselineFiles.has(root + "/" + baselineFileName("owner-baseline")), false);
  } else {
    throw Error(`Unknown scenario ${scenario}`);
  }
  console.log(`PASS native-r2 ${scenario}`);
} finally {
  rmSync(rootDir, { recursive: true, force: true });
}
