import { describe, expect, test } from "bun:test";

import { POST_REHEARSAL_SEQUENCE, transitionPostRehearsal } from "@/lib/postRehearsalFlow";

describe("deterministic post-rehearsal flow", () => {
  test("matches the accepted web sequence exactly", () => {
    expect(POST_REHEARSAL_SEQUENCE).toEqual([
      "rehearsal_complete",
      "transcript_review",
      "generating",
      "pressure",
      "rewrite",
      "shift",
      "pay1",
      "pay2",
      "pay3",
    ]);
  });

  test("allows only adjacent navigation in the normal flow", () => {
    expect(transitionPostRehearsal("shift", "pay1")).toBe("pay1");
    expect(transitionPostRehearsal("pay2", "pay1")).toBe("pay1");
    expect(() => transitionPostRehearsal("pressure", "pay1")).toThrow("Invalid post-rehearsal transition");
  });

  test("allows explicit insufficient evidence only from generation", () => {
    expect(transitionPostRehearsal("generating", "insufficient_evidence")).toBe("insufficient_evidence");
    expect(() => transitionPostRehearsal("pressure", "insufficient_evidence")).toThrow("Invalid post-rehearsal transition");
  });
});
