import { describe, expect, it } from "bun:test";

import {
  DEFAULT_CONSENT,
  TRANSCRIPTION_PROVIDER,
  needsMigrationNotice,
  normalizeConsent,
  withMigrationNoticeSeen,
} from "@/lib/consent";

describe("default consent", () => {
  it("starts with every retention toggle off", () => {
    expect(DEFAULT_CONSENT.keepBaselineAudio).toBe(false);
    expect(DEFAULT_CONSENT.saveCustomScenarioText).toBe(false);
    expect(DEFAULT_CONSENT.migrationNoticeSeenAt).toBeNull();
  });
});

describe("normalizeConsent", () => {
  it("falls back to the safe default for unusable input", () => {
    expect(normalizeConsent(null)).toEqual(DEFAULT_CONSENT);
    expect(normalizeConsent("{not json")).toEqual(DEFAULT_CONSENT);
    expect(normalizeConsent(42)).toEqual(DEFAULT_CONSENT);
    expect(normalizeConsent([])).toEqual(DEFAULT_CONSENT);
  });

  it("coerces hostile values instead of trusting them", () => {
    const out = normalizeConsent({
      keepBaselineAudio: "yes",
      saveCustomScenarioText: 1,
      migrationNoticeSeenAt: Number.NaN,
    });
    expect(out.keepBaselineAudio).toBe(false);
    expect(out.saveCustomScenarioText).toBe(false);
    expect(out.migrationNoticeSeenAt).toBeNull();
  });

  it("round-trips a valid stored state through JSON", () => {
    const state = withMigrationNoticeSeen(DEFAULT_CONSENT, 20);
    expect(normalizeConsent(JSON.stringify(state))).toEqual(state);
  });
});

describe("migration notice", () => {
  it("is shown once and then never again", () => {
    expect(needsMigrationNotice(DEFAULT_CONSENT, true)).toBe(true);
    const seen = withMigrationNoticeSeen(DEFAULT_CONSENT, 5);
    expect(needsMigrationNotice(seen, true)).toBe(false);
  });

  it("is not shown when nothing was actually migrated", () => {
    expect(needsMigrationNotice(DEFAULT_CONSENT, false)).toBe(false);
  });
});

describe("disclosure copy", () => {
  it("names the real transcription provider rather than a generic claim", () => {
    expect(TRANSCRIPTION_PROVIDER.toLowerCase()).toContain("openai");
  });
});
