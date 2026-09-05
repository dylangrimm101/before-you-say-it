import { describe, expect, test } from "bun:test";

const root = `${import.meta.dir}/..`;
const text = (path: string) => Bun.file(`${root}/${path}`).text();

describe("TestFlight foundation", () => {
  test("production Metro does not inject Rork analytics or native template dependencies", async () => {
    const [metro, packageText] = await Promise.all([text("metro.config.js"), text("package.json")]);
    const pkg = JSON.parse(packageText) as { dependencies?: Record<string, string> };
    expect(metro).not.toContain("withRorkMetro");
    expect(metro).not.toContain("@rork-ai/toolkit-sdk");
    expect(pkg.dependencies?.["@rork-ai/toolkit-sdk"]).toBeUndefined();
    expect(pkg.dependencies?.["expo-location"]).toBeUndefined();
    expect(pkg.dependencies?.["expo-image-picker"]).toBeUndefined();
    expect(pkg.dependencies?.["expo-av"]).toBeUndefined();
    const app = JSON.parse(await text("app.json")) as { expo?: { plugins?: unknown[] } };
    expect(JSON.stringify(app.expo?.plugins)).toContain('"faceIDPermission":false');
  });

  test("completion never triggers an unsolicited notification permission prompt", async () => {
    const store = await text("providers/store.tsx");
    expect(store).not.toContain("requestReminderPermission");
  });

  test("privacy copy matches optional account and RevenueCat identity behavior", async () => {
    const privacy = await text("app/privacy.tsx");
    const settings = await text("app/settings.tsx");
    expect(privacy).not.toContain("does not provide an account or cross-device recovery");
    expect(privacy).toContain("protected device credential storage");
    expect(privacy).toContain("Signing in reconnects your eligible access");
    expect(privacy).toContain("anonymous app ID or your signed-in account ID");
    expect(settings).toContain("It does not delete your web account or cancel a subscription");
  });

  test("client environment does not enable undeclared Rork analytics", async () => {
    const [guard, preflight] = await Promise.all([
      text("lib/clientEnvGuard.ts"),
      text("scripts/client-env-preflight.cjs"),
    ]);
    for (const source of [guard, preflight]) {
      expect(source).not.toContain('"EXPO_PUBLIC_PROJECT_ID"');
      expect(source).not.toContain('"EXPO_PUBLIC_TEAM_ID"');
    }
  });

  test("owned lifecycle commands use Expo rather than on-demand Rork tooling", async () => {
    const runner = await text("scripts/run-client-command.ts");
    expect(runner).not.toContain('"rork"');
    expect(runner).toContain('["bunx", "expo", "start"]');
    expect(runner).toContain('["bunx", "expo", "start", "--web"]');
  });

  test("owned deep-link configuration matches the BYSI route validator", async () => {
    const app = JSON.parse(await text("app.json")) as { expo?: { scheme?: string; plugins?: unknown[] } };
    expect(app.expo?.scheme).toBe("beforeyousayit");
    expect(JSON.stringify(app.expo?.plugins)).toContain("https://beforeyousayit.app");
    const intent = await text("lib/nativeIntent.ts");
    expect(intent).toContain('"beforeyousayit:"');
  });

  test("OTA updates are separated by runtime and release channel", async () => {
    const app = JSON.parse(await text("app.json")) as { expo?: { runtimeVersion?: { policy?: string } } };
    const eas = JSON.parse(await text("eas.json")) as { build?: Record<string, { channel?: string }> };
    const pkg = JSON.parse(await text("package.json")) as { dependencies?: Record<string, string> };
    const runbook = await text("../docs/TESTFLIGHT-AND-OTA-OPERATIONS.md");
    expect(app.expo?.runtimeVersion?.policy).toBe("appVersion");
    expect(eas.build?.preview?.channel).toBe("preview");
    expect(eas.build?.production?.channel).toBe("production");
    expect(pkg.dependencies?.["expo-updates"]).toBeDefined();
    expect(runbook).toContain("exact verified Git commit");
    expect(runbook).toContain("rollback");
  });

  test("iOS release config declares export compliance and repeatable EAS profiles", async () => {
    const app = JSON.parse(await text("app.json")) as { expo?: { ios?: { infoPlist?: Record<string, unknown> } } };
    const eas = JSON.parse(await text("eas.json")) as { build?: Record<string, Record<string, unknown>>; submit?: Record<string, unknown> };
    expect(app.expo?.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
    expect(eas.build?.development?.developmentClient).toBe(true);
    expect(eas.build?.preview?.distribution).toBe("internal");
    expect(eas.build?.production?.autoIncrement).toBe(true);
    expect(eas.submit?.production).toBeDefined();
  });

  test("CI protects the release branch with the full local quality gates", async () => {
    const workflow = await text("../.github/workflows/mobile-ci.yml");
    for (const command of ["bun install --frozen-lockfile", "bun test", "bun run check", "bunx expo-doctor", "bun run export"]) {
      expect(workflow).toContain(command);
    }
  });
});
