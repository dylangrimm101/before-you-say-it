import { afterEach, beforeEach, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync, copyFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import configure from "../app.config";
import app from "../app.json";
import { runInNewContext } from "node:vm";
import { createHash, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { selectAuthEnvironment } from "../lib/authEnvironment";
import { describeAuthConfiguration } from "../lib/authConfigurationDiagnostic";
import { createMigratingSecureSessionStorage } from "../lib/secureSessionStorage";
import { createNativeSessionStarter } from "../lib/nativeAuth";

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
  for (const marker of ["BYSI setup diagnostic D1", "normal-url-missing-or-blank", "normal-key-missing-or-blank", "Copy setup details"]) {
    expect(bundle.includes(marker)).toBe(true);
  }
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

test("Metro and Babel reject missing release inputs even after app configuration passed", () => {
  const { runClientEnvPreflight } = require("../scripts/client-env-preflight.cjs");
  for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY"]) {
    configure({ config: app.expo } as any);
    const value = process.env[name];
    delete process.env[name];
    expect(() => runClientEnvPreflight(root)).toThrow("requires reviewed normal Auth");
    expect(() => require("../babel.config.js")({ cache: () => {} })).toThrow("requires reviewed normal Auth");
    process.env[name] = value;
  }
});

test("compiled production Supabase module starts guest setup with no device environment variables", async () => {
  configure({ config: app.expo } as any);
  const source = readFileSync(join(root, "lib/supabase.ts"), "utf8");
  const compiled = require("@babel/core").transformSync(source, {
    filename: join(root, "lib/supabase.ts"), configFile: join(root, "babel.config.js"), babelrc: false,
    caller: { name: "metro", bundler: "metro", platform: "ios", isDev: false, supportsStaticESM: false },
  }).code as string;
  expect(compiled).not.toMatch(/process\.env\.EXPO_PUBLIC_/);
  const disk = new Map<string, string>();
  let requests = 0;
  const dependencies: Record<string, unknown> = {
    "@react-native-async-storage/async-storage": { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} },
    "@supabase/supabase-js": { createClient: (url: string, key: string, options: any) => createClient(url, key, {
      ...options, global: { fetch: async (url: string | URL | Request) => {
        requests++;
        expect(String(url)).toBe("https://spvksnddzyvycfoefrcf.supabase.co/auth/v1/signup");
        return new Response(JSON.stringify({ access_token: "synthetic-session", refresh_token: "synthetic-refresh", token_type: "bearer", expires_in: 3600, user: { id: "synthetic-guest", is_anonymous: true } }), { status: 200, headers: { "Content-Type": "application/json" } });
      } },
    }) },
    "expo-crypto": { CryptoDigestAlgorithm: { SHA256: "sha256" }, randomUUID, digestStringAsync: async (_: string, value: string) => createHash("sha256").update(value).digest("hex") },
    "expo-constants": { executionEnvironment: "bare" },
    "expo-application": { applicationId: app.expo.ios.bundleIdentifier },
    "./authEnvironment": { selectAuthEnvironment },
    "./authConfigurationDiagnostic": { describeAuthConfiguration },
    "expo-secure-store": { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1, getItemAsync: async (key: string) => disk.get(key) ?? null, setItemAsync: async (key: string, value: string) => { disk.set(key, value); }, deleteItemAsync: async (key: string) => { disk.delete(key); } },
    "react-native": { Platform: { OS: "ios" } },
    "react-native-url-polyfill/auto": {},
    "@/lib/secureSessionStorage": { createMigratingSecureSessionStorage },
  };
  const output: Record<string, any> = {};
  runInNewContext(compiled, { exports: output, __DEV__: false, process: { env: {} }, require: (id: string) => {
    if (Object.hasOwn(dependencies, id)) return dependencies[id];
    if (id.startsWith("@babel/runtime/")) return require(id);
    throw new Error(`Unexpected compiled dependency: ${id}`);
  } });
  expect(output.isAuthConfigured).toBe(true);
  expect(output.authEnvironment?.staging).toBe(false);
  expect(output.supabase).not.toBeNull();
  try {
    expect((await output.supabase.auth.getSession()).data.session).toBeNull();
    expect(requests).toBe(0);
    const result = await createNativeSessionStarter(output.supabase.auth)();
    expect(result.success).toBe(true);
    expect(requests).toBe(1);
    expect(disk.size).toBeGreaterThan(0);
  } finally { await output.supabase.auth.stopAutoRefresh(); }
});

test("Babel worker filters inherited inputs before inlining production client code", () => {
  for (const name of excluded) process.env[name] = "excluded-babel-canary";
  // A fresh worker must not reuse Babel's cached config from another test's environment.
  const child = Bun.spawnSync([process.execPath, "--no-env-file", "-e", `
    const assert = require("node:assert/strict");
    const path = require("node:path");
    const source = "export const env = [process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY, process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY, process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY, process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN];";
    const result = require("@babel/core").transformSync(source, {
      filename: path.join(process.cwd(), "release-environment-fixture.ts"),
      configFile: path.join(process.cwd(), "babel.config.js"), babelrc: false,
      caller: { name: "metro", bundler: "metro", platform: "ios", isDev: false, supportsStaticESM: true },
    });
    assert.ok(!result.code.includes("excluded-babel-canary"));
    assert.ok(result.code.includes("appl_fixtureonly"));
    assert.ok(result.code.includes("https://beforeyousayit.app"));
    assert.equal(process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY, undefined);
  `], { cwd: root, env: { ...process.env, EXPO_NO_DOTENV: "1" }, stdout: "pipe", stderr: "pipe", timeout: 15000 });
  expect({ code: child.exitCode, error: child.stderr.toString() }).toEqual({ code: 0, error: "" });
});
