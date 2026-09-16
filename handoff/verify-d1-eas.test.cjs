"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { releaseEnvironment, verifyApprovedAuthInputs, verifyResolvedConfig, inspectBundle } = require("./verify-d1-eas.cjs");

const appRoot = path.resolve(process.env.BYSI_D1_APP_DIR ?? path.join(__dirname, "../expo"));
const root = fs.mkdtempSync(path.join(os.tmpdir(), "bysi-d1-verifier-test-"));
fs.mkdirSync(path.join(root, "scripts"));
fs.copyFileSync(path.join(appRoot, "scripts/release-env.cjs"), path.join(root, "scripts/release-env.cjs"));
fs.copyFileSync(path.join(appRoot, "eas.json"), path.join(root, "eas.json"));
process.on("exit", () => fs.rmSync(root, { recursive: true, force: true }));
function fixture(patch, action) {
  const saved = process.env;
  const env = Object.fromEntries(Object.entries(saved).filter(([name]) => !name.startsWith("EXPO_PUBLIC_") && !["EXPO_NO_DOTENV", "EXPO_NO_CLIENT_ENV_VARS", "EAS_BUILD_PROFILE"].includes(name)));
  Object.assign(env, { EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_verifierfixture", EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: "appl_verifierfixture" });
  for (const [name, value] of Object.entries(patch)) {
    if (value === undefined) delete env[name]; else env[name] = value;
  }
  process.env = env;
  try { action(); } finally { process.env = saved; }
}

test("minimal public inputs plus the pinned profile pass without disabling dotenv", () => {
  fixture({}, () => {
    const env = releaseEnvironment(root, false);
    assert.equal(env.EAS_BUILD_PROFILE, "testflight");
    assert.equal(env.NODE_ENV, "production");
    assert.equal(env.EXPO_PUBLIC_BYSI_BUILD_MODE, undefined);
    assert.equal(env.EXPO_NO_DOTENV, undefined);
    assert.equal(env.EXPO_NO_CLIENT_ENV_VARS, undefined);
    assert.equal(env.EXPO_PUBLIC_NATIVE_RESULTS, undefined);
  });
});
test("missing, blank, secret-format and JWT replacements for the approved public key fail", () => {
  for (const value of [undefined, "", " ", "sb_secret_fixture", "eyJhbGciOiJIUzI1NiJ9.fixture.signature"]) {
    fixture({ EXPO_PUBLIC_SUPABASE_ANON_KEY: value }, () => assert.throws(() => releaseEnvironment(root, false), /REVIEWED_RELEASE_INPUTS_MISSING_OR_REJECTED/));
  }
});
test("a conflicting normal URL and missing iOS billing public key fail", () => {
  fixture({ EXPO_PUBLIC_SUPABASE_URL: "https://wrong.invalid" }, () => assert.throws(() => releaseEnvironment(root, false), /PROFILE_INPUT_CONFLICT/));
  fixture({ EXPO_PUBLIC_REVENUECAT_IOS_API_KEY: undefined }, () => assert.throws(() => releaseEnvironment(root, false), /REVIEWED_RELEASE_INPUTS_MISSING_OR_REJECTED/));
});
test("normal mode must be truly unset, including empty, whitespace and production labels", () => {
  for (const value of ["", " ", "production", "false", "staging-account"]) {
    fixture({ EXPO_PUBLIC_BYSI_BUILD_MODE: value }, () => assert.throws(() => releaseEnvironment(root, false), /NORMAL_BUILD_MODE_MUST_BE_UNSET/));
  }
});
test("staging values and saved results remain excluded without weakening app guards", () => {
  for (const [name, expected] of [
    ["EXPO_PUBLIC_STAGING_SUPABASE_URL", /STAGING_INPUTS_MUST_BE_UNSET/],
    ["EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE", /STAGING_RELEASE_MARKER_MUST_BE_UNSET/],
    ["EXPO_PUBLIC_NATIVE_RESULTS", /D1_SAVED_RESULTS_MUST_REMAIN_UNSET/],
  ]) fixture({ [name]: "" }, () => assert.throws(() => releaseEnvironment(root, false), expected));
});
test("client environment loading and inlining overrides fail", () => {
  for (const name of ["EXPO_NO_DOTENV", "EXPO_NO_CLIENT_ENV_VARS"]) {
    fixture({ [name]: "1" }, () => assert.throws(() => releaseEnvironment(root, false), /EXPO_ENV_LOADING_OR_INLINING_OVERRIDE/));
  }
});
test("fresh-checkout preflight refuses dotenv and never edits it", () => {
  const file = path.join(root, ".env.local");
  const original = "EXPO_PUBLIC_SUPABASE_ANON_KEY=synthetic-canary\n";
  fs.writeFileSync(file, original);
  try {
    fixture({}, () => assert.throws(() => releaseEnvironment(root, false), /DOTENV_PRESENT/));
    assert.equal(fs.readFileSync(file, "utf8"), original);
  } finally { fs.unlinkSync(file); }
});
test("a different well-formed public key cannot pass the reviewed-baseline fingerprint", () => {
  fixture({}, () => assert.throws(() => verifyApprovedAuthInputs(releaseEnvironment(root, false)), /PUBLIC_AUTH_INPUTS_DIFFER_FROM_REVIEWED_BASELINE/));
});
test("actual exported auth initializes with approved inputs and rejects a mismatched expected key", { skip: !process.env.BYSI_D1_EXPORT_DIR }, () => {
  const env = releaseEnvironment(appRoot, true);
  verifyApprovedAuthInputs(env);
  verifyResolvedConfig(appRoot, env);
  const result = inspectBundle(appRoot, process.env.BYSI_D1_EXPORT_DIR, env);
  assert.equal(result.actualExportedAuthFactoryExecuted, true);
  assert.equal(result.normalAuthSelected, true);
  assert.equal(result.networkCalls, 0);
  assert.equal(result.nativeStorageCalls, 0);
  assert.throws(() => inspectBundle(appRoot, process.env.BYSI_D1_EXPORT_DIR, { ...env, EXPO_PUBLIC_SUPABASE_ANON_KEY: "sb_publishable_intentional_mismatch_fixture" }), /EMBEDDED_AUTH_INPUTS_DO_NOT_MATCH_APPROVED_ENVIRONMENT/);
});
