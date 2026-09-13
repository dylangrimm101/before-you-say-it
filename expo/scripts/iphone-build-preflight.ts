import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import configure from "../app.config";
import { stagingAccountEnvironment } from "./run-staging-account";
import { selectAuthEnvironment, STAGING_AUTH_URL } from "../lib/authEnvironment";
import { verifyStagingBundleEnvironment } from "./verify-staging-account-export";

const root = resolve(new URL("..", import.meta.url).pathname);
const allowed = new Set(["EXPO_PUBLIC_BYSI_BUILD_MODE", "EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE", "EXPO_PUBLIC_STAGING_SUPABASE_URL", "EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY", "EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT", "EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT", "EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED"]);
/** Offline evidence only; no login, network, config writes or build dispatch. */
export function inspectLocalBuild(source: NodeJS.ProcessEnv) {
  const blockers = ["REMOTE_ACCOUNT_SIGNING_DEVICE_UNVERIFIED", "PUBLISHABLE_KEY_PROJECT_OWNERSHIP_UNVERIFIED"];
  const passed: string[] = [];
  if (Object.keys(source).some(n => n.startsWith("EXPO_PUBLIC_") && !allowed.has(n))) blockers.push("UNREVIEWED_PUBLIC_ENVIRONMENT");
  if (source.EXPO_PUBLIC_BYSI_BUILD_MODE && source.EXPO_PUBLIC_BYSI_BUILD_MODE !== "staging-account") blockers.push("WRONG_REQUESTED_BUILD_MODE");
  if (!source.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT) blockers.push("PAID_PRACTICE_OPT_IN_MISSING");
  let env: NodeJS.ProcessEnv;
  try { env = stagingAccountEnvironment(source); }
  catch { blockers.push("STAGING_INPUTS_INVALID_OR_MISSING"); return { ready: false as const, passed, blockers }; }
  const saved = process.env;
  try {
    process.env = env;
    const base = JSON.parse(readFileSync(resolve(root, "app.json"), "utf8")).expo;
    const cfg = configure({ config: base, projectRoot: root, staticConfigPath: null, packageJsonPath: resolve(root, "package.json") });
    assert.equal(cfg.ios?.bundleIdentifier, "app.bysi.staging.account");
    assert.equal(cfg.scheme, "beforeyousayit-staging");
    assert.equal(cfg.slug, "bysi-staging-account");
    assert.equal(cfg.updates?.enabled, false);
    assert.equal(env.EXPO_NO_DOTENV, "1");
    assert.ok(Object.keys(env).filter(n => n.startsWith("EXPO_PUBLIC_")).every(n => allowed.has(n)));
    const input = { developmentBuild: true, nativeStagingBuild: true, mode: env.EXPO_PUBLIC_BYSI_BUILD_MODE, stagingUrl: env.EXPO_PUBLIC_STAGING_SUPABASE_URL, stagingKey: env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY };
    assert.equal(selectAuthEnvironment(input)?.url, STAGING_AUTH_URL);
    assert.equal(selectAuthEnvironment(input)?.storageKey, "bysi.staging.pqqxaklcburdxjfeolmd.auth");
    assert.equal(selectAuthEnvironment(input)?.keychainService, "beforeyousayit.staging.supabase");
    passed.push("NATIVE_ID_URL_AND_ISOLATION");
    assert.equal(selectAuthEnvironment({ ...input, developmentBuild: false, stagingAccountRelease: true })?.url, STAGING_AUTH_URL);
    assert.equal(selectAuthEnvironment({ ...input, nativeStagingBuild: false }), null);
    passed.push("RELEASE_AUTH_MARKER_ALLOWED");
    // A syntactically valid ID still cannot establish account/project ownership offline.
    if (!cfg.extra?.eas?.projectId || !cfg.owner) blockers.push("STAGING_EAS_ASSOCIATION_MISSING");
    else {
      assert.equal(cfg.owner, "dgrim101");
      assert.equal(cfg.extra.eas.projectId, "b25c7aba-ef9d-4f88-b7c5-4da1678fcf44");
      passed.push("PINNED_LOCAL_STAGING_EAS_ASSOCIATION");
    }
  } catch { blockers.push("LOCAL_CONFIG_OR_AUTH_CONTRACT_FAILED"); }
  finally { process.env = saved; }
  return { ready: false as const, passed, blockers };
}

if ((import.meta as ImportMeta & { main?: boolean }).main) {
  if (process.argv.length !== 2) { console.error("Offline only; no arguments or build/login commands accepted."); process.exit(2); }
  const report = inspectLocalBuild(process.env);
  try {
    const eas = JSON.parse(readFileSync(resolve(root, "eas.json"), "utf8"));
    assert.equal(eas.cli.requireCommit, true);
    const p = eas.build["staging-account-development"];
    if (!p) report.blockers.push("DEDICATED_STAGING_EAS_PROFILE_MISSING");
    else {
      assert.equal(p.developmentClient, true); assert.equal(p.distribution, "internal");
      assert.equal(p.ios.simulator, false); assert.equal(p.ios.buildConfiguration, "Debug");
      assert.equal(p.environment, "development"); assert.equal(p.extends, undefined);
      assert.equal(p.env.EXPO_NO_DOTENV, "1");
      assert.equal(p.env.EXPO_PUBLIC_BYSI_BUILD_MODE, "staging-account");
      assert.equal(p.env.EXPO_PUBLIC_STAGING_SUPABASE_URL, STAGING_AUTH_URL);
      report.passed.push("LOCAL_EAS_PROFILE_SHAPE_ONLY");
    }
  } catch { report.blockers.push("EAS_POLICY_INVALID_OR_UNREADABLE"); }
  const git = spawnSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8", timeout: 5000 });
  if (git.status !== 0 || git.stdout.trim()) report.blockers.push("REVIEWED_CLEAN_ARTIFACT_MISSING");
  else report.passed.push("WORKTREE_CLEAN_ONLY_NOT_REVIEWED");
  if (readdirSync(root).some(n => n === ".env" || n.startsWith(".env."))) report.blockers.push("DOTENV_FILES_REQUIRE_REVIEW");
  try {
    assert.equal(process.cwd(), root);
    const dir = resolve(root, "dist-staging-account/_expo/static/js/ios");
    const files = readdirSync(dir).filter(n => n.endsWith(".js")); assert.equal(files.length, 1);
    const bundle = readFileSync(resolve(dir, files[0]!), "utf8");
    verifyStagingBundleEnvironment(bundle, process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "", process.env.EXPO_PUBLIC_STAGING_PAID_GENERATE_ENDPOINT, process.env.EXPO_PUBLIC_STAGING_FREE_GENERATE_ENDPOINT, process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED);
    assert.ok(bundle.includes("__DEV__=true"));
    for (const suffix of ["tts", "transcribe"]) assert.ok(bundle.includes(`https://bysi-signup-staging.vercel.app/api/practice/${suffix}`));
    report.passed.push("EXISTING_EXPORT_ENV_AND_VOICE_URLS_ONLY_NOT_FRESH_BUILD");
  } catch { report.blockers.push("EXISTING_EXPORT_NOT_VERIFIED_WITH_CURRENT_INPUTS"); }
  console.log(JSON.stringify({ scope: "offline iPhone development preflight; NEVER build authorization", ...report, notes: ["Cloud build needs no local Xcode. Local compilation does.", "CLI token presence and browser login are not account/project/signing verification.", "RevenueCat remains disabled; this does not prove Apple sandbox purchases.", "Environment values and raw errors intentionally omitted."] }, null, 2));
  process.exitCode = 2;
}
