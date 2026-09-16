"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { verifyRepository, verifySource, releaseEnvironment, verifyApprovedAuthInputs, verifyResolvedConfig, inspectBundle } = require("./verify-d1-eas.cjs");

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

// Deterministic Git-response fixtures: no clone, commit, checkout or app changes.
const managedPin = "c504d722cb05bfb6af57d3d947ff48ce741a6202";
const githubPin = "d6ebd779dd0922d631b774dd64cd1f8438ced6b3";
const candidateRecord = fs.readFileSync(path.join(appRoot, "../handoff/testflight24-candidate.json"), "utf8");
const recordedBlobs = JSON.parse(candidateRecord).fileGitBlobHashes;
function repositoryFixture(options = {}) {
  const head = options.head ?? githubPin;
  const pin = options.allowRestored ? managedPin : head;
  const calls = [];
  function readGit(_root, args) {
    calls.push(args);
    const replacement = options.override?.(args);
    if (replacement !== undefined) return replacement;
    const [command, value] = args;
    if (command === "rev-parse" && value === "HEAD") return head;
    if (command === "rev-parse" && value === `${pin}:expo`) return "43570d287d4d19ca003cf423bdd6f7df769f2ce1";
    if (command === "rev-parse" && value === `${pin}:handoff/testflight24-candidate.json`) return "75435d266e25bd2df87f667c00c241beb3ef296d";
    if (command === "show" && value === `${pin}:handoff/testflight24-candidate.json`) return candidateRecord;
    if (command === "rev-parse" && value.startsWith(`${pin}:expo/`)) {
      const blob = recordedBlobs[value.slice(pin.length + 1)];
      assert.ok(blob, "unexpected committed path");
      return blob;
    }
    if (command === "hash-object") {
      assert.ok(recordedBlobs[`expo/${value}`], "unexpected working path");
      return recordedBlobs[`expo/${value}`];
    }
    if (["diff", "ls-files", "status"].includes(command)) return "";
    assert.fail(`Unexpected Git read: ${args.join(" ")}`);
  }
  return { readGit, calls };
}
test("strict GitHub identity passes all tree and 14 blob checks without managed objects", () => {
  const { readGit, calls } = repositoryFixture();
  const result = verifyRepository(root, false, readGit);
  assert.equal(result.pinnedCommit, githubPin);
  assert.equal(result.candidateIdentity, "verified-github-candidate");
  assert.equal(result.exactCheckout, true);
  assert.equal(result.recordedCandidateBlobsVerified, 14);
  assert.equal(result.recordedWorkingBlobsVerified, 14);
  assert.equal(result.remoteAvailabilityCheckedDuringThisRun, false);
  assert.ok(!calls.flat().some(value => value.includes(managedPin)));
});
test("original managed candidate remains recognized without substituting GitHub main", () => {
  const { readGit } = repositoryFixture({ head: managedPin });
  assert.equal(verifyRepository(root, false, readGit).candidateIdentity, "managed-candidate");
});
test("main, historical handoff and unknown commits fail even with an identical claimed app tree", () => {
  for (const head of ["d380f50bebc91b88793636156bdf283e2f314205", "eeddbb43af837f72e244f4740017228953fa502b", "0".repeat(40)]) {
    const { readGit } = repositoryFixture({ head });
    assert.throws(() => verifyRepository(root, false, readGit), /CHECKOUT_NOT_AT_VERIFIED_CANDIDATE/);
  }
});
test("approved commit identity does not waive the full app tree or pinned candidate record", () => {
  for (const [suffix, reason] of [[":expo", /PINNED_APP_TREE_MISMATCH/], [":handoff/testflight24-candidate.json", /CANDIDATE_RECORD_BLOB_MISMATCH/]]) {
    const { readGit } = repositoryFixture({ override: args => args[0] === "rev-parse" && args[1] === `${githubPin}${suffix}` ? "0".repeat(40) : undefined });
    assert.throws(() => verifyRepository(root, false, readGit), reason);
  }
});
test("critical committed and working configuration drift is rejected", () => {
  for (const [command, value, reason] of [
    ["rev-parse", `${githubPin}:expo/metro.config.js`, /COMMITTED_CRITICAL_BLOB_MISMATCH/],
    ["hash-object", "babel.config.js", /WORKING_CRITICAL_BLOB_MISMATCH/],
  ]) {
    const { readGit } = repositoryFixture({ override: args => args[0] === command && args[1] === value ? "0".repeat(40) : undefined });
    assert.throws(() => verifyRepository(root, false, readGit), reason);
  }
});
test("all recorded hashes remain mandatory, including package and lockfile bytes", () => {
  for (const [command, value, reason] of [
    ["rev-parse", `${githubPin}:expo/package.json`, /RECORDED_CANDIDATE_COMMITTED_BLOB_MISMATCH/],
    ["hash-object", "bun.lock", /RECORDED_CANDIDATE_WORKING_BLOB_MISMATCH/],
    ["show", `${githubPin}:handoff/testflight24-candidate.json`, /RECORDED_CANDIDATE_HASH_COUNT_MISMATCH/],
  ]) {
    const { readGit } = repositoryFixture({ override: args => args[0] === command && args[1] === value ? (command === "show" ? '{"fileGitBlobHashes":{}}' : "0".repeat(40)) : undefined });
    assert.throws(() => verifyRepository(root, false, readGit), reason);
  }
});
test("noncritical app changes, untracked files and dirty repository remain blocked", () => {
  for (const [command, reason] of [["diff", /APP_DIRECTORY_DIFFERS_FROM_PIN/], ["ls-files", /UNTRACKED_APP_FILES/], ["status", /CHECKOUT_NOT_CLEAN/]]) {
    const { readGit } = repositoryFixture({ override: args => args[0] === command ? "changed-file" : undefined });
    assert.throws(() => verifyRepository(root, false, readGit), reason);
  }
});
test("legacy restored-worktree mode keeps managed provenance and never reports exact checkout", () => {
  const head = "5e9bf286291d8de286db71e6ae7a872ed760ce06";
  const { readGit } = repositoryFixture({ head, allowRestored: true });
  const result = verifyRepository(root, true, readGit);
  assert.equal(result.pinnedCommit, managedPin);
  assert.equal(result.checkoutCommit, head);
  assert.equal(result.exactCheckout, false);
  const drift = repositoryFixture({ head, allowRestored: true, override: args => args[0] === "hash-object" && args[1] === "metro.config.js" ? "0".repeat(40) : undefined });
  assert.throws(() => verifyRepository(root, true, drift.readGit), /WORKING_CRITICAL_BLOB_MISMATCH/);
});
test("optional real fresh GitHub checkout passes the source-only gate", { skip: !process.env.BYSI_D1_GITHUB_CHECKOUT }, () => {
  const result = verifySource(path.resolve(process.env.BYSI_D1_GITHUB_CHECKOUT), false);
  assert.equal(result.pinnedCommit, githubPin);
  assert.equal(result.exactCheckout, true);
  assert.equal(result.recordedCandidateBlobsVerified, 14);
});

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
