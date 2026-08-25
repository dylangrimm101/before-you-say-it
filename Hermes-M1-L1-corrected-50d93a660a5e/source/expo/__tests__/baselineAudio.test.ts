import { beforeEach, describe, expect, it, mock } from "bun:test";

interface FakeFile {
  uri: string;
  exists: boolean;
}

const disk = new Map<string, FakeFile>();
const createdDirs = new Set<string>();

function joinUri(parts: (string | { uri: string })[]): string {
  return parts
    .map((p) => (typeof p === "string" ? p : p.uri))
    .filter((p) => p.length > 0)
    .reduce((a, b) => (a ? `${a.replace(/\/$/, "")}/${b.replace(/^\//, "")}` : b));
}

class MockFile {
  uri: string;

  constructor(...parts: (string | { uri: string })[]) {
    this.uri = joinUri(parts);
  }

  get exists(): boolean {
    return disk.has(this.uri);
  }

  copy(dest: MockFile): void {
    if (!disk.has(this.uri)) throw new Error("source missing");
    disk.set(dest.uri, { uri: dest.uri, exists: true });
  }

  delete(): void {
    disk.delete(this.uri);
  }

  base64(): Promise<string> {
    return Promise.resolve("FIXTURE_BASE64");
  }
}

class MockDirectory {
  uri: string;

  constructor(...parts: (string | { uri: string })[]) {
    this.uri = joinUri(parts);
  }

  get exists(): boolean {
    return createdDirs.has(this.uri);
  }

  create(): void {
    createdDirs.add(this.uri);
  }

  list(): MockFile[] {
    return [...disk.keys()]
      .filter((k) => k.startsWith(`${this.uri}/`))
      .map((k) => new MockFile(k));
  }

  delete(): void {
    [...disk.keys()]
      .filter((k) => k.startsWith(`${this.uri}/`))
      .forEach((k) => disk.delete(k));
    createdDirs.delete(this.uri);
  }
}

mock.module("expo-file-system", () => ({
  File: MockFile,
  Directory: MockDirectory,
  Paths: { document: { uri: "file:///app/Documents" }, cache: { uri: "file:///app/Caches" } },
}));

const {
  BASELINE_DIR_NAME,
  baselineFileName,
  deleteAllBaselineAudio,
  deleteBaselineAudio,
  hasBaselineAudio,
  keepBaselineAudio,
} = await import("@/lib/baselineAudio");

beforeEach(() => {
  disk.clear();
  createdDirs.clear();
});

describe("baseline audio paths", () => {
  it("stores inside the app private document container, not the cache", async () => {
    disk.set("file:///app/Caches/rec-1.m4a", { uri: "file:///app/Caches/rec-1.m4a", exists: true });
    const uri = await keepBaselineAudio("s-1", "file:///app/Caches/rec-1.m4a");
    expect(uri).toContain("file:///app/Documents");
    expect(uri).toContain(BASELINE_DIR_NAME);
    expect(uri).not.toContain("Caches");
  });

  it("derives a filename from the session id only — never from user content", () => {
    expect(baselineFileName("s-1")).toBe("s-1.m4a");
    expect(baselineFileName("../../etc/passwd")).toBe("etcpasswd.m4a");
    expect(baselineFileName("a b/c:d")).toBe("abcd.m4a");
  });
});

describe("baseline audio lifecycle", () => {
  it("writes nothing until the user explicitly opts in", async () => {
    expect(await hasBaselineAudio("s-1")).toBe(false);
    expect(disk.size).toBe(0);
  });

  it("keeps, finds and deletes a single recording", async () => {
    disk.set("file:///app/Caches/rec-1.m4a", { uri: "file:///app/Caches/rec-1.m4a", exists: true });
    await keepBaselineAudio("s-1", "file:///app/Caches/rec-1.m4a");
    expect(await hasBaselineAudio("s-1")).toBe(true);

    await deleteBaselineAudio("s-1");
    expect(await hasBaselineAudio("s-1")).toBe(false);
  });

  it("deletes every retained recording and leaves no file behind", async () => {
    for (const id of ["s-1", "s-2", "s-3"]) {
      disk.set(`file:///app/Caches/${id}.m4a`, {
        uri: `file:///app/Caches/${id}.m4a`,
        exists: true,
      });
      await keepBaselineAudio(id, `file:///app/Caches/${id}.m4a`);
    }
    await deleteAllBaselineAudio();
    expect(await hasBaselineAudio("s-1")).toBe(false);
    expect(await hasBaselineAudio("s-2")).toBe(false);
    expect(await hasBaselineAudio("s-3")).toBe(false);
    expect([...disk.keys()].filter((k) => k.includes(BASELINE_DIR_NAME))).toEqual([]);
  });

  it("never throws when asked to delete something that is not there", async () => {
    await deleteBaselineAudio("missing");
    await deleteAllBaselineAudio();
    expect(await hasBaselineAudio("missing")).toBe(false);
  });
});

describe("baseline audio never touches AsyncStorage", () => {
  it("declares no cc.* key and no AsyncStorage import", async () => {
    const source = await Bun.file(
      new URL("../lib/baselineAudio.ts", import.meta.url).pathname,
    ).text();
    expect(source).not.toContain("AsyncStorage");
    expect(source).not.toContain("cc.");
    expect(source).not.toContain("base64");
  });
});
