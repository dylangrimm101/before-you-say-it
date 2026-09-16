import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import configure from "../app.config";
import app from "../app.json";

const root = join(import.meta.dir, "..");
const exportDirectory = process.env.BYSI_RELEASE_EXPORT_DIR;
const { prepareReleaseEnvironment, assertReleaseToolchain } = require("../scripts/release-env.cjs");
let saved: NodeJS.ProcessEnv;

beforeEach(() => {
  saved = { ...process.env };
  for (const name of Object.keys(process.env)) {
    if (name.startsWith("EXPO_PUBLIC_") || name === "EAS_BUILD_PROFILE") delete process.env[name];
  }
  Object.assign(process.env, {
    NODE_ENV: "production",
    EXPO_PUBLIC_SUPABASE_URL: "https://spvksnddzyvycfoefrcf.supabase.co",
    EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_fixtureonly",
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_fixtureonly",
  });
});
afterEach(() => {
  for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
  Object.assign(process.env, saved);
});

test.skipIf(!exportDirectory)("actual iOS export contains production credentials and no excluded secret values or analytics relay", () => {
  const bundleDirectory = join(exportDirectory!, "_expo/static/js/ios");
  const bundle = readdirSync(bundleDirectory).filter(name => name.endsWith(".js")).map(name => readFileSync(join(bundleDirectory, name), "utf8")).join("\n");
  for (const name of ["EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY"]) {
    expect(saved[name]?.length).toBeGreaterThan(8);
    expect(bundle.includes(saved[name]!)).toBe(true);
  }
  expect(bundle.includes("https://beforeyousayit.app")).toBe(true);
  expect(bundle.includes("https://spvksnddzyvycfoefrcf.supabase.co")).toBe(true);
  expect(bundle.includes("relay-GnBZ")).toBe(false);
  expect(bundle.includes("RorkAnalyticsProvider")).toBe(false);
  for (const name of ["EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY", "OPENAI_API_KEY", "SUPABASE_ACCESS_TOKEN"]) {
    const value = saved[name];
    if (value && value.length > 8) expect(bundle.includes(value)).toBe(false);
  }
});

const excluded = [
  "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_RORK_API_BASE_URL", "EXPO_PUBLIC_RORK_APP_KEY", "EXPO_PUBLIC_RORK_AUTH_URL",
  "EXPO_PUBLIC_RORK_FUNCTIONS_URL", "EXPO_PUBLIC_TOOLKIT_URL", "EXPO_PUBLIC_PROJECT_ID",
  "EXPO_PUBLIC_TEAM_ID", "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY", "OPENAI_API_KEY",
  "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "ELEVENLABS_API_KEY",
];

test("managed release excludes ambient inputs, uses reviewed origin, and leaves results off", () => {
  for (const name of excluded) process.env[name] = "excluded-synthetic-canary";
  const config = configure({ config: app.expo } as any);
  for (const name of excluded) expect(process.env[name]).toBeUndefined();
  expect(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY).toBe("sb_publishable_fixtureonly");
  expect(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY).toBe("appl_fixtureonly");
  expect(process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN).toBe("https://beforeyousayit.app");
  expect(process.env.EXPO_PUBLIC_NATIVE_RESULTS).toBeUndefined();
  expect(process.env.EXPO_NO_DOTENV).toBe("1");
  expect(config.updates?.enabled).toBe(false);
});

test("development and staging environment filtering is a no-op", () => {
  for (const env of [
    { NODE_ENV: "development", EXPO_PUBLIC_REVENUECAT_TEST_API_KEY: "keep" },
    { NODE_ENV: "production", EXPO_PUBLIC_BYSI_BUILD_MODE: "staging-account", EXPO_PUBLIC_REVENUECAT_TEST_API_KEY: "keep" },
  ]) {
    const before = { ...env };
    expect(prepareReleaseEnvironment(env)).toBe(false);
    expect(env).toEqual(before);
  }
});

test("filter does not hide unknown inputs, staging endpoints, or incorrect production values", () => {
  for (const [name, value] of Object.entries({
    EXPO_PUBLIC_UNKNOWN_SECRET: "canary",
    EXPO_PUBLIC_STAGING_SUPABASE_URL: "https://staging.invalid",
    EXPO_PUBLIC_GENERATE_ENDPOINT: "https://wrong.invalid",
    EXPO_PUBLIC_NATIVE_BILLING_ORIGIN: "https://wrong.invalid",
    EXPO_PUBLIC_SUPABASE_URL: "https://wrong.invalid",
    EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "test_wrong",
  })) {
    const before = process.env[name];
    process.env[name] = value;
    expect(() => configure({ config: app.expo } as any)).toThrow("TestFlight");
    if (before === undefined) delete process.env[name]; else process.env[name] = before;
  }
});

test("release rejects a staging selector even with otherwise valid production credentials", () => {
  process.env.EAS_BUILD_PROFILE = "testflight";
  process.env.EXPO_PUBLIC_BYSI_BUILD_MODE = "staging-account";
  expect(() => configure({ config: app.expo } as any)).toThrow("TestFlight");
});

test("release does not edit any dotenv file, and Expo reload cannot restore excluded inputs", () => {
  const temp = mkdtempSync(join(tmpdir(), "bysi-release-env-"));
  const names = [".env", ".env.local", ".env.production", ".env.production.local"];
  const original = "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY=excluded-dotenv-canary\nOPENAI_API_KEY=private-canary\n";
  try {
    for (const name of names) writeFileSync(join(temp, name), original);
    configure({ config: app.expo } as any);
    require("../scripts/client-env-preflight.cjs").runClientEnvPreflight(temp);
    require("@expo/env").loadProjectEnv(temp, { force: true, silent: true });
    expect(process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY).toBeUndefined();
    for (const name of names) expect(readFileSync(join(temp, name), "utf8")).toBe(original);
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("release gate catches restored wrapper, missing preflight, HTML support, and toolkit drift", () => {
  const temp = mkdtempSync(join(tmpdir(), "bysi-release-toolchain-"));
  const files = ["metro.config.js", "babel.config.js", "package.json"];
  const reset = () => { for (const file of files) copyFileSync(join(root, file), join(temp, file)); };
  try {
    reset();
    expect(() => assertReleaseToolchain(temp)).not.toThrow();
    for (const [file, from, to] of [
      ["metro.config.js", "module.exports = config;", "module.exports = withRorkMetro(config);"],
      ["metro.config.js", '"html"', '"txt"'],
      ["babel.config.js", "runClientEnvPreflight(__dirname);", ""],
      ["package.json", '"0.3.0"', '"latest"'],
    ]) {
      reset();
      const target = join(temp, file!);
      writeFileSync(target, readFileSync(target, "utf8").replace(from!, to!));
      expect(() => assertReleaseToolchain(temp)).toThrow("configuration drift");
    }
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test("Babel worker filters inherited inputs before inlining production client code", () => {
  for (const name of excluded) process.env[name] = "excluded-babel-canary";
  const source = `export const env = [process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY, process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY, process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN];`;
  const result = require("@babel/core").transformSync(source, {
    filename: join(root, "release-environment-fixture.ts"),
    configFile: join(root, "babel.config.js"),
    babelrc: false,
    caller: { name: "metro", bundler: "metro", platform: "ios", isDev: false, supportsStaticESM: true },
  });
  expect(result.code).not.toContain("excluded-babel-canary");
  expect(result.code).toContain("appl_fixtureonly");
  expect(result.code).toContain("https://beforeyousayit.app");
  expect(process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY).toBeUndefined();
});
