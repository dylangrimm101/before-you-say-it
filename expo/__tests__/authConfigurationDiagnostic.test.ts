import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { selectAuthEnvironment, STAGING_AUTH_URL } from "../lib/authEnvironment";
import { describeAuthConfiguration } from "../lib/authConfigurationDiagnostic";

type Input = Parameters<typeof selectAuthEnvironment>[0];
const normal: Input = {
  developmentBuild: false, nativeStagingBuild: false,
  applicationId: "app.rork.8fc4qwsqaurkxk0pimyvx",
  productionUrl: "https://spvksnddzyvycfoefrcf.supabase.co", productionKey: "sb_publishable_diagnosticfixture",
};
const installed = { version: "1.0.0", build: "24" };
const reportFor = (input: Input): string => describeAuthConfiguration(input, selectAuthEnvironment(input), installed);

test("diagnostics identify normal missing URL, missing key, both, and blank values separately", () => {
  for (const [patch, fields] of [
    [{ productionUrl: undefined }, ["Normal URL: missing", "normal-url-missing-or-blank"]],
    [{ productionKey: undefined }, ["Normal key: missing", "normal-key-missing-or-blank"]],
    [{ productionUrl: undefined, productionKey: undefined }, ["normal-url-missing-or-blank", "normal-key-missing-or-blank"]],
    [{ productionUrl: " \n", productionKey: "\t" }, ["Normal URL: blank", "Normal key: blank"]],
  ] as const) {
    const report = reportFor({ ...normal, ...patch });
    expect(report).toContain("Auth selection: unavailable");
    expect(report).toContain("Installed app: 1.0.0 (24)");
    for (const field of fields) expect(report).toContain(field);
  }
});

test("present inputs are not represented as provider validity or a successful sign-in", () => {
  const report = reportFor(normal);
  expect(report).toContain("Auth selection: normal");
  expect(report).toContain("Normal key: present");
  expect(report).toContain("Failed checks: none");
  expect(report).not.toContain(normal.productionKey!);
  expect(report).not.toContain(normal.productionUrl!);
});

test("diagnostics do not trim or normalize a truthy build mode into normal authentication", () => {
  for (const mode of ["staging-account", "production", "false", " "]) {
    const input = { ...normal, mode };
    const report = reportFor(input);
    expect(selectAuthEnvironment(input)).toBeNull();
    expect(report).toContain("Auth selection: unavailable");
    expect(report).toContain("staging-native-identity-required");
    expect(report).not.toContain("normal-key-missing-or-blank");
    if (mode !== "staging-account") expect(report).toContain("Build mode: unrecognized");
  }
});

test("every existing staging rejection has a diagnostic without production fallback", () => {
  const staging: Input = { ...normal, nativeStagingBuild: true, applicationId: "app.bysi.staging.account", mode: "staging-account", stagingUrl: STAGING_AUTH_URL, stagingKey: "sb_publishable_stagingfixture", stagingAccountRelease: true };
  expect(reportFor(staging)).toContain("Auth selection: staging");
  for (const [patch, reason] of [
    [{ stagingAccountRelease: false }, "staging-release-not-enabled"],
    [{ nativeStagingBuild: false }, "staging-native-identity-required"],
    [{ mode: undefined }, "staging-mode-not-recognized"],
    [{ stagingUrl: "https://other.invalid" }, "staging-url-not-matched"],
    [{ stagingKey: "sb_secret_canary" }, "staging-key-format-not-matched"],
  ] as const) {
    const input = { ...staging, ...patch };
    expect(selectAuthEnvironment(input)).toBeNull();
    expect(reportFor(input)).toContain(reason);
  }
  expect(reportFor({ ...staging, developmentBuild: true, stagingAccountRelease: false })).toContain("Failed checks: none");
});

test("diagnostics redact arbitrary inputs, identifiers, and malformed version strings", () => {
  const canary = "private-value-canary@example.invalid";
  const input = Object.freeze({ ...normal, nativeStagingBuild: true, mode: canary, productionUrl: canary, productionKey: canary, stagingUrl: canary, stagingKey: canary, applicationId: canary, projectId: canary });
  const selected = selectAuthEnvironment(input);
  const report = describeAuthConfiguration(input, selected, { version: canary, build: canary });
  expect(report).not.toContain(canary);
  expect(report).not.toContain("sb_");
  expect(report).toContain("Installed app: unavailable (unavailable)");
  expect(report).toContain("App identity: other");
  expect(selectAuthEnvironment(input)).toEqual(selected);
  expect(input.productionKey).toBe(canary);
  expect(describeAuthConfiguration(normal, selectAuthEnvironment(normal), { build: "1".repeat(100) })).toContain("(unavailable)");
});

test("diagnostic selection remains aligned with the unchanged selector over an input matrix", () => {
  for (const mode of [undefined, "", "staging-account", "wrong", " "])
    for (const nativeStagingBuild of [false, true])
      for (const developmentBuild of [false, true])
        for (const stagingAccountRelease of [false, true])
          for (const credentialsPresent of [false, true]) {
            const input = Object.freeze({ ...normal, mode, nativeStagingBuild, developmentBuild, stagingAccountRelease,
              productionUrl: credentialsPresent ? normal.productionUrl : undefined,
              productionKey: credentialsPresent ? normal.productionKey : undefined,
              stagingUrl: credentialsPresent ? STAGING_AUTH_URL : undefined,
              stagingKey: credentialsPresent ? "sb_publishable_matrixfixture" : undefined });
            const selection = selectAuthEnvironment(input);
            const report = reportFor(input);
            expect(report.includes("Failed checks: none")).toBe(selection !== null);
            expect(selectAuthEnvironment(input)).toEqual(selection);
          }
});

test("actual compiled Supabase startup reports consumed inputs even with no runtime env, without storage or network side effects", () => {
  const root = join(import.meta.dir, "..");
  const source = readFileSync(join(root, "lib/supabase.ts"), "utf8");
  const saved = { ...process.env };
  try {
    for (const name of Object.keys(process.env)) if (name.startsWith("EXPO_PUBLIC_")) delete process.env[name];
    process.env.NODE_ENV = "production";
    for (const scenario of ["configured", "missing-url", "missing-key", "missing-both", "rejected-mode"] as const) {
      process.env.EXPO_PUBLIC_SUPABASE_URL = normal.productionUrl;
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = normal.productionKey;
      delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
      if (scenario === "missing-url" || scenario === "missing-both") delete process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (scenario === "missing-key" || scenario === "missing-both") delete process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (scenario === "rejected-mode") process.env.EXPO_PUBLIC_BYSI_BUILD_MODE = "staging-account";
      // Deliberately bypass release preflight in this fault-injection fixture only:
      // simulate a bad shipped bundle, rather than weakening the real build guard.
      const compiled = require("@babel/core").transformSync(source, {
        filename: join(root, "lib/supabase.ts"), configFile: false, babelrc: false,
        presets: [[require.resolve("babel-preset-expo"), { unstable_transformImportMeta: true }]],
        caller: { name: "metro", bundler: "metro", platform: "ios", isDev: false, supportsStaticESM: false },
      }).code as string;
      expect(compiled).not.toMatch(/process\.env\.EXPO_PUBLIC_/);
      let clientCreations = 0;
      const forbiddenIO = () => { throw new Error("Diagnostic must not perform storage or network I/O"); };
      const dependencies: Record<string, unknown> = {
        "@react-native-async-storage/async-storage": { getItem: forbiddenIO, setItem: forbiddenIO, removeItem: forbiddenIO },
        "@supabase/supabase-js": { createClient: () => { clientCreations++; return { auth: {} }; } },
        "expo-crypto": {},
        "expo-constants": { executionEnvironment: "bare" },
        "expo-application": { applicationId: normal.applicationId, nativeApplicationVersion: installed.version, nativeBuildVersion: installed.build },
        "./authEnvironment": { selectAuthEnvironment },
        "./authConfigurationDiagnostic": { describeAuthConfiguration },
        "expo-secure-store": { getItemAsync: forbiddenIO, setItemAsync: forbiddenIO, deleteItemAsync: forbiddenIO },
        "react-native": { Platform: { OS: "ios" } },
        "react-native-url-polyfill/auto": {},
        "@/lib/secureSessionStorage": { createMigratingSecureSessionStorage: () => ({ getItem: forbiddenIO, setItem: forbiddenIO, removeItem: forbiddenIO }) },
      };
      const output: Record<string, any> = {};
      const runtimeEnv: Record<string, string> = {};
      runInNewContext(compiled, { exports: output, __DEV__: false, process: { env: runtimeEnv }, fetch: forbiddenIO, require: (id: string) => {
        if (Object.hasOwn(dependencies, id)) return dependencies[id];
        if (id.startsWith("@babel/runtime/")) return require(id);
        throw new Error(`Unexpected compiled dependency: ${id}`);
      } });
      const diagnostic = output.authConfigurationDiagnostic;
      expect(typeof diagnostic).toBe("string");
      expect(diagnostic).toContain("Installed app: 1.0.0 (24)");
      expect(output.isAuthConfigured).toBe(scenario === "configured");
      expect(clientCreations).toBe(scenario === "configured" ? 1 : 0);
      if (scenario !== "configured") expect(output.supabase).toBeNull();
      if (scenario === "missing-url" || scenario === "missing-both") expect(diagnostic).toContain("Normal URL: missing");
      if (scenario === "missing-key" || scenario === "missing-both") expect(diagnostic).toContain("Normal key: missing");
      if (scenario === "rejected-mode") expect(diagnostic).toContain("staging-native-identity-required");
      runtimeEnv.EXPO_PUBLIC_SUPABASE_ANON_KEY = "different-runtime-canary";
      expect(output.authConfigurationDiagnostic).toBe(diagnostic);
      expect(diagnostic).not.toContain(normal.productionKey!);
      expect(diagnostic).not.toContain("different-runtime-canary");
    }
  } finally {
    for (const name of Object.keys(process.env)) if (!(name in saved)) delete process.env[name];
    Object.assign(process.env, saved);
  }
});
