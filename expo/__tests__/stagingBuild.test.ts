import { expect, test } from "bun:test";
import * as selection from "../lib/authEnvironment";
import { REVIEWED_STAGING_BRIDGE } from "../lib/stagingWebBridge";
import { sanitizeClientEnv } from "../lib/clientEnvGuard";
import configure from "../app.config";

test("Metro preflight preserves staging inputs and never edits dotenv in isolated mode", async () => {
  const child = Bun.spawn(["bun", "-e", `
    const fs = require("node:fs"), os = require("node:os"), path = require("node:path"), assert = require("node:assert/strict");
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bysi-staging-preflight-"));
    const file = path.join(root, ".env"), original = "OPENAI_API_KEY=synthetic-do-not-edit\\n";
    fs.writeFileSync(file, original);
    process.env.EXPO_NO_DOTENV = "1";
    process.env.EXPO_PUBLIC_BYSI_BUILD_MODE = "staging-account";
    process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL = "https://pqqxaklcburdxjfeolmd.supabase.co";
    process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test";
    process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT = "https://bysi-signup-staging.vercel.app/api/practice/generate";
    try {
      require("./scripts/client-env-preflight.cjs").runClientEnvPreflight(root);
      assert.equal(process.env.EXPO_PUBLIC_BYSI_BUILD_MODE, "staging-account");
      assert.equal(process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY, "sb_publishable_test");
      assert.equal(process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL, "https://pqqxaklcburdxjfeolmd.supabase.co");
      assert.equal(process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT, "https://bysi-signup-staging.vercel.app/api/practice/generate");
      assert.equal(fs.readFileSync(file, "utf8"), original);
      const config = require("./metro.config.js");
      const rules = [config.resolver.blockList].flat();
      for (const name of [".env", ".env.local", ".env.development.local"]) assert.ok(rules.some(rule => rule?.test(path.join(process.cwd(), name))), "Staging Metro must exclude dotenv HMR modules");
      delete process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
      require("./scripts/client-env-preflight.cjs").runClientEnvPreflight(root);
      assert.equal(fs.readFileSync(file, "utf8"), "\\n", "Normal preflight behavior must remain unchanged");
    } finally { fs.rmSync(root, { recursive: true }); }
  `], { cwd: `${import.meta.dir}/..`, stdout: "pipe", stderr: "pipe" });
  const err = await new Response(child.stderr).text();
  expect({ code: await child.exited, err }).toEqual({ code: 0, err: "" });
});

test("paid endpoint is explicit and pinned through launcher and both preflights", async()=>{
 const {stagingAccountEnvironment}=await import('../scripts/run-staging-account');
 const endpoint='https://bysi-signup-staging.vercel.app/api/practice/generate';
 expect(stagingAccountEnvironment({EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT:endpoint}).EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT).toBe(endpoint);
 expect(()=>stagingAccountEnvironment({EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_test',EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT:'https://beforeyousayit.app/api/generate'})).toThrow();
 expect(sanitizeClientEnv('EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT='+endpoint).removedNames).toEqual([]);
});

test("launcher makes a separate account-only dev app without inherited production services", async () => {
  const script = `${import.meta.dir}/../scripts/run-staging-account.ts`;
  expect(await Bun.file(script).exists()).toBe(true);
  const { stagingAccountEnvironment } = await import(script);
  const env = stagingAccountEnvironment({ EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test", EXPO_PUBLIC_SUPABASE_URL: "production", EXPO_PUBLIC_SUPABASE_ANON_KEY: "production", EXPO_PUBLIC_GENERATE_ENDPOINT: "production", OPENAI_API_KEY: "secret", PATH: process.env.PATH });
  expect(env.EXPO_PUBLIC_SUPABASE_URL).toBeUndefined();
  expect(env.EXPO_PUBLIC_GENERATE_ENDPOINT).toBeUndefined();
  expect(env.OPENAI_API_KEY).toBeUndefined();
  expect(env.EXPO_NO_DOTENV).toBe("1");
  expect(env.EXPO_PUBLIC_BYSI_BUILD_MODE).toBe("staging-account");
  expect(() => stagingAccountEnvironment({})).toThrow();
  const saved = { ...process.env };
  try {
    for (const key of Object.keys(process.env)) if (key.startsWith("EXPO_PUBLIC_")) delete process.env[key];
    Object.assign(process.env, env);
    const config = configure({ config: { name: "Production", slug: "production", ios: { bundleIdentifier: "production" }, extra: { eas: { projectId: "production" } } } } as any);
    expect(config.ios?.bundleIdentifier).toBe("app.bysi.staging.account");
    expect(config.android?.package).toBe("app.bysi.staging.account");
    expect(config.scheme).toBe("beforeyousayit-staging");
    expect(config.updates).toEqual({ enabled: false });
    expect(config.owner).toBe("dgrim101");
    expect(config.extra).toEqual({ bysiBuildMode: "staging-account", eas: { projectId: "b25c7aba-ef9d-4f88-b7c5-4da1678fcf44" } });
    process.env.EXPO_PUBLIC_SUPABASE_URL = "production";
    expect(() => configure({ config } as any)).toThrow();
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
  }
});

test("runnable configuration wires only selected auth and preserves disabled default", async () => {
  expect(REVIEWED_STAGING_BRIDGE?.endpoints.restore).toBe(`${selection.STAGING_AUTH_URL}/functions/v1/bysi-staging-account/restore`);
  expect(REVIEWED_STAGING_BRIDGE?.endpoints.discover).toBe(`${selection.STAGING_AUTH_URL}/functions/v1/bysi-staging-account/discover`);
  expect(REVIEWED_STAGING_BRIDGE?.endpoints.activate).toBe(`${selection.STAGING_AUTH_URL}/functions/v1/bysi-staging-account/activate`);
  for (const name of ["EXPO_PUBLIC_BYSI_BUILD_MODE", "EXPO_PUBLIC_STAGING_SUPABASE_URL", "EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE"]) expect(sanitizeClientEnv(`${name}=value`).removedNames).toEqual([]);
  const auth = await Bun.file(`${import.meta.dir}/../providers/auth.tsx`).text();
  expect(auth).toContain("reviewed: authEnvironment?.staging ? REVIEWED_STAGING_BRIDGE : null");
  expect(auth).toContain("authUrl: authEnvironment?.url");
  const client = await Bun.file(`${import.meta.dir}/../lib/supabase.ts`).text();
  expect(client).toContain("storageKey: authEnvironment?.storageKey");
  expect(client).toContain("selectAuthEnvironment");
  expect(client).toContain('Constants.executionEnvironment !== "storeClient"');
  expect(client).toContain('Application.applicationId === "app.bysi.staging.account"');
  expect(client).toContain('applicationId: Application.applicationId');
  expect(client).toContain('legacy: authEnvironment?.staging ?');
  const runtime = await Bun.file(`${import.meta.dir}/../lib/accountLifecycleRuntime.ts`).text();
  expect(runtime).not.toContain("expo-application");
  expect(runtime).not.toContain("expo-constants");
  expect(runtime).toContain("applicationId:authEnvironment.applicationId");
  expect(await Bun.file(`${import.meta.dir}/../app.config.ts`).exists()).toBe(true);
});

test("real Supabase construction uses isolated native storage across build modes", async () => {
  const fixture = `${import.meta.dir}/stagingAuthRuntime.fixture.ts`;
  expect(await Bun.file(fixture).exists()).toBe(true);
  for (const mode of ["staging", "normal", "wrong-binary", "release", "release-missing-marker", "missing-key", "staging-binary-no-flag"]) {
    const child = Bun.spawn(["bun", fixture, mode], { stdout: "pipe", stderr: "pipe" });
    const [out, err, code] = await Promise.all([new Response(child.stdout).text(), new Response(child.stderr).text(), child.exited]);
    expect({ code, err, out }).toEqual({ code: 0, err: "", out: `verified ${mode}\n` });
  }
});

test("export acceptance requires actual inlined staging env, not just a successful Metro exit", async () => {
  const path = `${import.meta.dir}/../scripts/verify-staging-account-export.ts`;
  expect(await Bun.file(path).exists()).toBe(true);
  const { verifyStagingBundleEnvironment } = await import(path);
  expect(await Bun.file(`${import.meta.dir}/../scripts/run-staging-account.ts`).text()).toContain('await verifyStagingAccountExport(');
  const values = { EXPO_PUBLIC_BYSI_BUILD_MODE: "staging-account", EXPO_PUBLIC_STAGING_SUPABASE_URL: selection.STAGING_AUTH_URL, EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test" };
  const make = (values: Record<string, string>) => 'process.env=Object.defineProperties(process.env, {' + Object.entries(values).map(([k, v]) => `${JSON.stringify(k)}: { enumerable: true, value: ${JSON.stringify(v)} }`).join(',') + '});';
  expect(() => verifyStagingBundleEnvironment(make(values), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY)).not.toThrow();
  const paid = "https://bysi-signup-staging.vercel.app/api/practice/generate";
  expect(() => verifyStagingBundleEnvironment(make({...values,EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT:paid}), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY, paid)).not.toThrow();
  expect(() => verifyStagingBundleEnvironment(make(values), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY, paid)).toThrow();
  expect(() => verifyStagingBundleEnvironment(make({ ...values, EXPO_PUBLIC_PROJECT_ROOT: process.cwd() }), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY)).not.toThrow();
  expect(() => verifyStagingBundleEnvironment(make({}), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY)).toThrow();
  expect(() => verifyStagingBundleEnvironment(make({ ...values, EXPO_PUBLIC_GENERATE_ENDPOINT: "https://production.invalid" }), values.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY)).toThrow();
});

test("explicit native development staging selects only pinned public auth and separate storage", () => {
  expect(typeof selection.selectAuthEnvironment).toBe("function");
  const input = { developmentBuild: true, nativeStagingBuild: true, mode: "staging-account", stagingUrl: "https://pqqxaklcburdxjfeolmd.supabase.co", stagingKey: "sb_publishable_test", productionUrl: "https://production.invalid", productionKey: "production-key" };
  const selected = selection.selectAuthEnvironment(input);
  expect(selected).toMatchObject({ staging: true, url: input.stagingUrl, key: input.stagingKey, storageKey: "bysi.staging.pqqxaklcburdxjfeolmd.auth", keychainService: "beforeyousayit.staging.supabase" });
  expect(selection.selectAuthEnvironment({ ...input, developmentBuild: false, stagingAccountRelease: true })).toMatchObject({ staging: true, url: input.stagingUrl, key: input.stagingKey, storageKey: "bysi.staging.pqqxaklcburdxjfeolmd.auth", keychainService: "beforeyousayit.staging.supabase" });
  for (const change of [{ developmentBuild: false }, { nativeStagingBuild: false }, { stagingUrl: "https://production.invalid" }, { stagingKey: "" }, { stagingKey: "sb_secret_no" }, { mode: "typo" }]) {
    expect(selection.selectAuthEnvironment({ ...input, ...change })).toBeNull();
  }
  expect(selection.selectAuthEnvironment({ ...input, nativeStagingBuild: false, mode: undefined })).toMatchObject({ staging: false, url: input.productionUrl, key: input.productionKey });
  expect(selection.selectAuthEnvironment({ ...input, mode: undefined })).toBeNull();
});
