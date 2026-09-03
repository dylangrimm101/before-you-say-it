import { describe, expect, test } from "bun:test";

import { hydrateJsonEntry } from "@/lib/hydration";

describe("isolated hydration", () => {
  test("one malformed key falls back without aborting an unrelated valid key", () => {
    const failures: string[] = [];
    const malformed = hydrateJsonEntry("{bad", [], "progress", (key) => failures.push(key));
    const valid = hydrateJsonEntry(JSON.stringify([{ id: "kept" }]), [], "sessions", (key) => failures.push(key));
    expect(malformed).toEqual([]);
    expect(valid).toEqual([{ id: "kept" }]);
    expect(failures).toEqual(["progress"]);
  });

  test("normalizer rejection is isolated to its own key", () => {
    const normalized = hydrateJsonEntry("42", "safe", "profile", undefined, (value) => typeof value === "string" ? value : null);
    expect(normalized).toBe("safe");
  });
});
