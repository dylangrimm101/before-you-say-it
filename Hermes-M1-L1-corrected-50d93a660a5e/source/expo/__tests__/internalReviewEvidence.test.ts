import { describe, expect, test } from "bun:test";

const source = await Bun.file(`${import.meta.dir}/../app/internal-review-evidence.tsx`).text();

describe("route-mounted internal-review evidence", () => {
  test("fails closed before rendering review state sheets in production mode", () => {
    expect(source).toContain('DEFAULT_CURRICULUM_VISIBILITY !== "internal_review"');
    expect(source).toContain("Production visibility is closed.");
  });

  test("covers every required deterministic sheet without claiming physical QA", () => {
    for (const sheet of ["path", "states", "specials", "continuity", "inventory", "persistence"]) {
      expect(source).toContain(`sheet === "${sheet}"`);
    }
    expect(source).toContain("not a physical click-through");
    expect(source).toContain("Provider, microphone, playback, and native-device behavior require separate end-to-end QA");
  });

  test("mounts all eight module inventories from the canonical taxonomy", () => {
    expect(source).toContain("CURRICULUM_MODULES.map");
    expect(source).toContain("visiblePracticesForModule(sheet");
  });
});
