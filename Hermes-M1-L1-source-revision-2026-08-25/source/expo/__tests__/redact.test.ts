import { describe, expect, it } from "bun:test";

import { MAX_LOG_VALUE_LENGTH, sanitizeMeta } from "@/lib/redact";

const TRANSCRIPT =
  "USER: I need you to actually take bedtime on Tuesdays. THEM: I already do more than you think.";
const BASE64 = "A".repeat(4000);

describe("sanitizeMeta", () => {
  it("drops keys that are not on the allowlist", () => {
    const out = sanitizeMeta({
      status: 500,
      transcript: TRANSCRIPT,
      dread: "the thing I cannot say to my mother",
      outcome: "agree on who handles bedtime",
      quote: "you never listen",
      reply: "why are you attacking me",
      audio: BASE64,
      answers: { fearsRetaliation: true },
    });

    expect(Object.keys(out)).toEqual(["status"]);
    expect(JSON.stringify(out)).not.toContain("bedtime");
    expect(JSON.stringify(out)).not.toContain("mother");
  });

  it("keeps short allowlisted scalars", () => {
    const out = sanitizeMeta({
      status: "denied",
      count: 3,
      ok: false,
      scenarioId: "chores",
      schemaVersion: 2,
    });

    expect(out).toEqual({
      status: "denied",
      count: 3,
      ok: false,
      scenarioId: "chores",
      schemaVersion: 2,
    });
  });

  it("drops allowlisted string values that are long enough to be content", () => {
    const out = sanitizeMeta({ reason: TRANSCRIPT });
    expect(out.reason).toBeUndefined();
  });

  it("never emits a value longer than the cap", () => {
    const out = sanitizeMeta({ reason: "x".repeat(MAX_LOG_VALUE_LENGTH + 1), code: 9 });
    Object.values(out).forEach((v) => {
      if (typeof v === "string") expect(v.length).toBeLessThanOrEqual(MAX_LOG_VALUE_LENGTH);
    });
  });

  it("drops nested objects and arrays outright", () => {
    const out = sanitizeMeta({
      status: 1,
      nested: { transcript: TRANSCRIPT },
      list: [TRANSCRIPT],
    });
    expect(out).toEqual({ status: 1 });
  });
});
