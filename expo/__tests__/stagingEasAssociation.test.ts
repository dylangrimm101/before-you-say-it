import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { inspectLocalBuild } from "../scripts/iphone-build-preflight";

const root = `${import.meta.dir}/..`;
const publicFixture = "sb_publishable_fixture_only";
const projectId = "b25c7aba-ef9d-4f88-b7c5-4da1678fcf44";

test("dedicated staging profile has no inheritance or update channel and keeps commit policy", () => {
  const eas = JSON.parse(readFileSync(`${root}/eas.json`, "utf8"));
  expect(eas.cli.requireCommit).toBe(true);
  expect(eas.build["staging-account-development"]).toEqual({
    developmentClient: true, distribution: "internal", environment: "development",
    ios: { simulator: false, buildConfiguration: "Debug" },
    env: {
      EXPO_NO_DOTENV: "1", EXPO_PUBLIC_BYSI_BUILD_MODE: "staging-account",
      EXPO_PUBLIC_STAGING_SUPABASE_URL: "https://pqqxaklcburdxjfeolmd.supabase.co",
      EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT: "https://bysi-signup-staging.vercel.app/api/practice/generate",
    },
  });
  expect(eas.submit["staging-account-development"]).toBeUndefined();
});

test("actual Expo resolver preserves separately verified normal and staging associations", async () => {
  const env = { ...process.env, EXPO_NO_DOTENV: "1" };
  for (const name of Object.keys(env)) if (name.startsWith("EXPO_PUBLIC_")) delete env[name];
  for (const staging of [false, true]) {
    const child = Bun.spawn(staging
      ? ["bun", "scripts/run-staging-account.ts", "config"]
      : ["bun", "node_modules/expo/bin/cli", "config", "--type", "public", "--json"], {
      cwd: root, env: { ...env, ...(staging ? { EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: publicFixture } : {}) }, stdout: "pipe", stderr: "pipe",
    });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect({ code, err }).toEqual({ code: 0, err: "" });
    const cfg = JSON.parse(out);
    if (staging) {
      expect(cfg.owner).toBe("dgrim101");
      expect(cfg.extra.eas.projectId).toBe(projectId);
      expect(cfg.slug).toBe("bysi-staging-account");
      expect(cfg.ios.bundleIdentifier).toBe("app.bysi.staging.account");
      expect(cfg.scheme).toBe("beforeyousayit-staging");
      expect(cfg.updates.enabled).toBe(false);
      const router = cfg.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-router');
      expect(router?.[1]?.origin).toBeUndefined();
      expect(JSON.stringify(cfg)).not.toContain('https://beforeyousayit.app');
      expect(cfg.extra?.router?.origin).toBeUndefined();
    } else {
      const base = JSON.parse(readFileSync(`${root}/app.json`, "utf8")).expo;
      expect(cfg.slug).toBe(base.slug);
      expect(cfg.ios.bundleIdentifier).toBe(base.ios.bundleIdentifier);
      expect(cfg.scheme).toBe(base.scheme);
      expect(cfg.plugins).toEqual(base.plugins);
      expect(cfg.extra?.router?.origin).toBe('https://beforeyousayit.app');
      expect(cfg.owner).toBe('dgrim101');
      expect(cfg.extra?.eas?.projectId).toBe('1b655360-557d-4dba-ad69-fbf26120e852');
    }
  }
});

test("offline preflight verifies pinned local EAS association without certifying remote readiness", () => {
  const r = inspectLocalBuild({ EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: publicFixture });
  expect(r.passed).toContain("PINNED_LOCAL_STAGING_EAS_ASSOCIATION");
  expect(r.blockers).not.toContain("STAGING_EAS_ASSOCIATION_MISSING");
  expect(r.ready).toBe(false);
  expect(r.blockers).toContain("REMOTE_ACCOUNT_SIGNING_DEVICE_UNVERIFIED");
});
