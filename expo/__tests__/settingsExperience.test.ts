import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> {
  return Bun.file(`${import.meta.dir}/../${path}`).text();
}

describe("consumer settings experience", () => {
  test("uses customer-facing sections without internal implementation language", async () => {
    const settings = await source("app/settings.tsx");
    for (const label of ["Account", "Practice & permissions", "Privacy & data", "Help & legal"]) {
      expect(settings).toContain(`<SectionLabel>${label}</SectionLabel>`);
    }
    expect(settings).not.toContain("Device journey");
    expect(settings).not.toContain("Web continuation");
    expect(settings).not.toContain("Your practice, access, and privacy.");
    expect(settings).not.toContain("Provider not verified");
    expect(settings).not.toContain("Verified provider");
    expect(settings).not.toContain("Account status unavailable");
  });

  test("shows only working subscription, permission, privacy, support, and legal actions", async () => {
    const settings = await source("app/settings.tsx");
    for (const label of ["Manage subscription", "Restore purchases", "Microphone", "Rehearsal data", "Delete data on this device", "Help & feedback", "Apple standard EULA", "Google Play terms", "Privacy Policy"]) {
      expect(settings).toContain(label);
    }
    expect(settings).toContain("Raw audio is deleted after transcription");
    expect(settings).toContain("Approved lesson text may remain only while your active journey needs it");
    expect(settings).not.toContain("Audio and transcripts are deleted after lesson completion");
    expect(settings).toContain("Deletion may be incomplete. Some data may already be gone; try again to finish.");
    expect(settings).toContain('accessibilityLiveRegion="polite"');
    expect(settings).toContain("subscription management failed");
    expect(settings).not.toMatch(/Camera|Daily commitment|Nudge time|Google Calendar|Appearance|Auto-delete recordings/);
    expect(settings).toContain("{__DEV__ ?");
    expect(settings).toContain("QA access lab");
  });

  test("puts Settings in the Progress header as a gear action", async () => {
    const progress = await source("app/(tabs)/progress.tsx");
    expect(progress).toContain("styles.headerRow");
    expect(progress).toContain('accessibilityLabel="Open Settings"');
    expect(progress).toContain("<Settings size={20}");
    expect(progress).not.toContain("<Text style={styles.settingsText}>Settings</Text>");
  });
});
