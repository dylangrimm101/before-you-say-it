#!/usr/bin/env node
"use strict";

// Standalone handoff verifier. Keep outside the pinned checkout; never edits it,
// authenticates, signs in, starts EAS, or dispatches a native build.
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const vm = require("node:vm");
const { createRequire } = require("node:module");
const { createHash } = require("node:crypto");
const { spawnSync } = require("node:child_process");

const PIN = "c504d722cb05bfb6af57d3d947ff48ce741a6202";
const TREE = "43570d287d4d19ca003cf423bdd6f7df769f2ce1";
const APP_ID = "app.rork.8fc4qwsqaurkxk0pimyvx";
const PROJECT_ID = "1b655360-557d-4dba-ad69-fbf26120e852";
// Digest of the previously reviewed PUBLIC URL + NUL + public client key.
// This is a local baseline comparison, not independent proof of key ownership.
const PUBLIC_AUTH_INPUTS_SHA256 = "f7492c4788fcdedf8f2ea618fc0d3d65f2b283e98b69680b414804302d65b930";
const approvedBlobs = {
  "babel.config.js": "e5aeeeaacaaebe6c53ed6e38050814cac0bf3090",
  "metro.config.js": "c1037982fac61f18101a94f6ec6091f26328d0a8",
  "lib/supabase.ts": "294e07dfceb73112e8c4712e5cdc4632b9796870",
  "lib/authEnvironment.ts": "dbfd5dcbfb8b0a040fb1c941448e63ee71d9457c",
  "lib/authConfigurationDiagnostic.ts": "a2f17d91b3fdcd613979dee0b91ee9bec677756b",
  "components/SetupDiagnosticDetails.tsx": "3d58460c39825be362e121cfd1a2275df30f3232",
  "app/entry.tsx": "d0d3deca4bfe9c956b19e5301d5ab32e9f303b33",
};
class VerificationError extends Error {}
function check(ok, code) { if (!ok) throw new VerificationError(code); }
const sha256 = value => createHash("sha256").update(value).digest("hex");
function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 10000, maxBuffer: 16 * 1024 * 1024 });
  check(result.status === 0, "GIT_READ_FAILED");
  return result.stdout.trim();
}
function verifySource(root, allowRestoredWorktree) {
  check(git(root, ["rev-parse", `${PIN}:expo`]) === TREE, "PINNED_APP_TREE_MISMATCH");
  for (const [file, blob] of Object.entries(approvedBlobs)) {
    check(git(root, ["rev-parse", `${PIN}:expo/${file}`]) === blob, "COMMITTED_CRITICAL_BLOB_MISMATCH");
    check(git(root, ["hash-object", file]) === blob, "WORKING_CRITICAL_BLOB_MISMATCH");
  }
  const recorded = JSON.parse(git(root, ["show", `${PIN}:handoff/testflight24-candidate.json`]));
  for (const [file, blob] of Object.entries(recorded.fileGitBlobHashes)) {
    check(git(root, ["rev-parse", `${PIN}:${file}`]) === blob, "RECORDED_CANDIDATE_COMMITTED_BLOB_MISMATCH");
  }
  const diff = spawnSync("git", ["diff", "--quiet", PIN, "--", "."], { cwd: root });
  check(diff.status === 0, "APP_DIRECTORY_DIFFERS_FROM_PIN");
  check(!git(root, ["ls-files", "--others", "--exclude-standard"]), "UNTRACKED_APP_FILES");
  if (!allowRestoredWorktree) {
    check(git(root, ["rev-parse", "HEAD"]) === PIN, "CHECKOUT_NOT_AT_PIN");
    check(!git(root, ["status", "--porcelain"]), "CHECKOUT_NOT_CLEAN");
    check(!fs.existsSync(path.join(root, "ios")) && !fs.existsSync(path.join(root, "android")), "UNREVIEWED_NATIVE_DIRECTORY");
    check(!fs.existsSync(path.join(root, ".easignore")), "UNREVIEWED_EAS_IGNORE");
  }
  const requireApp = createRequire(path.join(root, "package.json"));
  requireApp("./scripts/release-env.cjs").assertReleaseToolchain(root);
  const app = requireApp("./app.json").expo;
  const eas = requireApp("./eas.json");
  check(app.ios.bundleIdentifier === APP_ID && app.extra.eas.projectId === PROJECT_ID
    && app.version === "1.0.0" && app.ios.buildNumber === "24", "APP_IDENTITY_OR_VERSION_MISMATCH");
  check(eas.cli.requireCommit === true && eas.cli.appVersionSource === "local"
    && eas.build.testflight.environment === "production" && eas.build.testflight.autoIncrement === false
    && eas.build.testflight.ios.buildConfiguration === "Release", "EAS_PROFILE_MISMATCH");
  return { pinnedCommit: PIN, appTree: TREE, committedCriticalBlobsVerified: true,
    recordedCandidateBlobsVerified: Object.keys(recorded.fileGitBlobHashes).length,
    workingAppMatchesPinnedTree: true, exactCheckout: !allowRestoredWorktree };
}
function dotenvSnapshot(root) {
  return Object.fromEntries(fs.readdirSync(root).filter(name => name === ".env" || name.startsWith(".env.")).map(name => [name, sha256(fs.readFileSync(path.join(root, name)))]));
}
function releaseEnvironment(root, allowRestoredWorktree) {
  const requireApp = createRequire(path.join(root, "package.json"));
  if (allowRestoredWorktree) {
    process.env.NODE_ENV = "production";
    requireApp("@expo/env").loadProjectEnv(root, { force: true, silent: true });
  }
  const env = { ...process.env };
  check(env.EXPO_NO_DOTENV === undefined && env.EXPO_NO_CLIENT_ENV_VARS === undefined, "EXPO_ENV_LOADING_OR_INLINING_OVERRIDE");
  // A fresh release checkout must not silently consume an old development dotenv.
  if (!allowRestoredWorktree) check(Object.keys(dotenvSnapshot(root)).length === 0, "DOTENV_PRESENT_USE_FRESH_CHECKOUT_AND_EAS_ENV_EXEC");
  check(env.EXPO_PUBLIC_BYSI_BUILD_MODE === undefined, "NORMAL_BUILD_MODE_MUST_BE_UNSET");
  check(env.EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE === undefined, "STAGING_RELEASE_MARKER_MUST_BE_UNSET");
  check(!Object.keys(env).some(name => name.startsWith("EXPO_PUBLIC_STAGING_")), "STAGING_INPUTS_MUST_BE_UNSET");
  check(env.EXPO_PUBLIC_NATIVE_RESULTS === undefined, "D1_SAVED_RESULTS_MUST_REMAIN_UNSET");
  const profile = requireApp("./eas.json").build.testflight;
  for (const [name, value] of Object.entries(profile.env)) {
    check(env[name] === undefined || env[name] === value, "PROFILE_INPUT_CONFLICT");
    env[name] = value;
  }
  env.NODE_ENV = "production";
  env.EAS_BUILD_PROFILE = "testflight";
  const guards = requireApp("./scripts/release-env.cjs");
  guards.prepareReleaseEnvironment(env);
  try { guards.assertReleaseClientInputs(env); }
  catch { throw new VerificationError("REVIEWED_RELEASE_INPUTS_MISSING_OR_REJECTED"); }
  return env;
}
function verifyApprovedAuthInputs(env) {
  check(sha256(`${env.EXPO_PUBLIC_SUPABASE_URL}\0${env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`) === PUBLIC_AUTH_INPUTS_SHA256,
    "PUBLIC_AUTH_INPUTS_DIFFER_FROM_REVIEWED_BASELINE");
}
function verifyResolvedConfig(root, env) {
  const requireApp = createRequire(path.join(root, "package.json"));
  const saved = process.env;
  try {
    process.env = { ...env };
    const { exp } = requireApp("@expo/config").getConfig(root, { skipSDKVersionRequirement: true });
    check(exp.ios?.bundleIdentifier === APP_ID && exp.extra?.eas?.projectId === PROJECT_ID
      && exp.version === "1.0.0" && exp.ios?.buildNumber === "24", "RESOLVED_IDENTITY_OR_VERSION_MISMATCH");
    check(exp.updates?.enabled === false, "OTA_NOT_DISABLED_IN_RESOLVED_CONFIG");
  } finally { process.env = saved; }
}
function runExport(root, env) {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "bysi-d1-eas-"));
  const args = [path.join(root, "node_modules/expo/bin/cli"), "export", "--platform", "ios", "--output-dir", output, "--clear", "--no-bytecode", "--no-minify", "--source-maps"];
  const result = spawnSync(process.execPath, args, { cwd: root, env, encoding: "utf8", timeout: 180000, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) {
    // Never return a raw CLI error: it can contain transformed source or values.
    const diagnostics = `${result.stdout ?? ""}\n${result.stderr ?? ""}`;
    const categories = ["SyntaxError", "Unable to resolve", "configuration drift", "requires reviewed", "ENOENT", "timeout", "Error"].filter(value => diagnostics.includes(value));
    console.error(JSON.stringify({ exportFailed: true, exitCode: result.status, diagnosticCategories: categories }));
    throw new VerificationError("IOS_EXPORT_FAILED_RAW_OUTPUT_WITHHELD");
  }
  console.log(JSON.stringify({ localJavaScriptExportCompleted: true, exportDirectory: output }));
  return output;
}
function inspectBundle(root, output, env) {
  const requireApp = createRequire(path.join(root, "package.json"));
  const bundleDir = path.join(output, "_expo/static/js/ios");
  const names = fs.readdirSync(bundleDir).filter(name => name.endsWith(".js"));
  check(names.length === 1, "EXPECTED_ONE_IOS_JS_BUNDLE");
  const bundlePath = path.join(bundleDir, names[0]);
  const source = fs.readFileSync(bundlePath, "utf8");
  const sourceMap = JSON.parse(fs.readFileSync(`${bundlePath}.map`, "utf8"));
  for (const marker of ["BYSI setup diagnostic D1", "Copy setup details", "normal-url-missing-or-blank", "normal-key-missing-or-blank"]) {
    check(source.includes(marker), "D1_MARKER_MISSING");
  }
  check(!source.includes("RorkAnalyticsProvider") && !source.includes("relay-GnBZ"), "EXCLUDED_ANALYTICS_MARKER_PRESENT");
  for (const name of ["OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "SUPABASE_ACCESS_TOKEN", "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY", "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY"]) {
    const value = process.env[name];
    if (value && value.length > 8) check(!source.includes(value), "EXCLUDED_KNOWN_VALUE_IN_BUNDLE");
  }
  check(source.includes(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY), "IOS_REVENUECAT_INPUT_NOT_EMBEDDED");
  const { parse } = requireApp("@babel/parser");
  const { TraceMap, eachMapping } = requireApp("@jridgewell/trace-mapping");
  const ast = parse(source, { sourceType: "script" });
  const modules = [];
  for (const statement of ast.program.body) {
    const call = statement.type === "ExpressionStatement" ? statement.expression : null;
    if (call?.type !== "CallExpression" || call.callee.name !== "__d") continue;
    const [factory, id, deps] = call.arguments;
    check(factory.type === "FunctionExpression" && id.type === "NumericLiteral" && deps.type === "ArrayExpression", "UNSUPPORTED_METRO_MODULE_SHAPE");
    modules.push({ id: id.value, factory, deps: deps.elements.map(value => value.value), names: new Set() });
  }
  check(modules.length > 0, "METRO_MODULES_NOT_FOUND");
  let cursor = 0;
  eachMapping(new TraceMap(sourceMap), mapping => {
    while (cursor < modules.length && mapping.generatedLine > modules[cursor].factory.loc.end.line) cursor++;
    const mod = modules[cursor];
    if (mod && mapping.source && mapping.generatedLine >= mod.factory.loc.start.line) mod.names.add(mapping.source.replaceAll("\\", "/"));
  });
  const byId = new Map(modules.map(mod => [mod.id, mod]));
  function named(suffix) {
    const found = modules.filter(mod => [...mod.names].some(name => name.endsWith(suffix)));
    check(found.length === 1, "EXPECTED_UNIQUE_EXPORTED_MODULE");
    return found[0];
  }
  const auth = named("lib/supabase.ts");
  const selector = named("lib/authEnvironment.ts");
  const diagnostic = named("lib/authConfigurationDiagnostic.ts");
  const storage = named("lib/secureSessionStorage.ts");
  const executableIds = new Set([auth.id, selector.id, diagnostic.id, storage.id,
    ...modules.filter(mod => [...mod.names].some(name => name.includes("@babel/runtime/helpers/"))).map(mod => mod.id)]);
  const cache = new Map();
  let creationCalls = 0;
  let nativeStorageCalls = 0;
  let networkCalls = 0;
  let embeddedInputsMatch = false;
  function unexpected() { throw new VerificationError("UNEXPECTED_NATIVE_DEPENDENCY_USE"); }
  const nativeStorage = { getItem: async () => { nativeStorageCalls++; return null; }, setItem: unexpected, removeItem: unexpected };
  const supabasePackage = requireApp("@supabase/supabase-js");
  const sdkVersion = requireApp("@supabase/supabase-js/package.json").version;
  check(sdkVersion === "2.112.3", "INSTALLED_SUPABASE_VERSION_DIFFERS_FROM_PINNED_LOCK");
  function external(mod) {
    const name = [...mod.names].join("\n");
    if (name.includes("@supabase/supabase-js/")) return { createClient(url, key, options) {
      creationCalls++;
      embeddedInputsMatch = url === env.EXPO_PUBLIC_SUPABASE_URL && key === env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      check(embeddedInputsMatch, "EMBEDDED_AUTH_INPUTS_DO_NOT_MATCH_APPROVED_ENVIRONMENT");
      // Real installed SDK (version checked against the pinned lock), with no
      // native storage or backend access. A fresh frozen install is required.
      check(options.auth.persistSession === true && options.auth.autoRefreshToken === true
        && options.auth.detectSessionInUrl === false && !options.auth.storageKey, "AUTH_OPTIONS_OR_ISOLATION_CHANGED");
      const authClient = supabasePackage.createClient(url, key, { ...options,
        auth: { ...options.auth, storage: nativeStorage, persistSession: false, autoRefreshToken: false },
        global: { fetch: async () => { networkCalls++; throw new VerificationError("NETWORK_FORBIDDEN"); } },
      });
      return authClient;
    } };
    if (name.includes("@react-native-async-storage/async-storage/")) return nativeStorage;
    if (name.includes("expo-application/")) return { applicationId: APP_ID, nativeApplicationVersion: "1.0.0", nativeBuildVersion: "24" };
    if (name.includes("expo-constants/")) return { executionEnvironment: "bare", expoConfig: { extra: { eas: { projectId: PROJECT_ID } } } };
    if (name.includes("expo-crypto/")) return { CryptoDigestAlgorithm: { SHA256: "SHA-256" }, randomUUID: unexpected, digestStringAsync: unexpected };
    if (name.includes("expo-secure-store/")) return { AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1, getItemAsync: unexpected, setItemAsync: unexpected, deleteItemAsync: unexpected };
    if (name.includes("react-native-url-polyfill/")) return {};
    if (name.includes("react-native/index.js")) return { Platform: { OS: "ios" } };
    console.error(JSON.stringify({ unreviewedDependency: [...mod.names].map(value => path.basename(value)).filter(value => /^[A-Za-z0-9_.-]+$/.test(value)) }));
    throw new VerificationError("UNREVIEWED_EXPORTED_DEPENDENCY");
  }
  const context = vm.createContext({ __DEV__: false, process: { env: {} }, URL, URLSearchParams,
    console: { log() {}, warn() {}, error() {} } });
  function load(id) {
    if (cache.has(id)) return cache.get(id).exports;
    const mod = byId.get(id);
    check(Boolean(mod), "EXPORTED_DEPENDENCY_NOT_FOUND");
    if (!executableIds.has(id)) return external(mod);
    const record = { exports: {} };
    cache.set(id, record);
    const importDefault = dep => { const value = load(dep); return value?.__esModule ? value.default : value; };
    const importAll = dep => { const value = load(dep); return value?.__esModule ? value : { ...value, default: value }; };
    const argumentsKey = `__d1Arguments${id}`;
    context[argumentsKey] = [context, load, importDefault, importAll, record, record.exports, mod.deps];
    try {
      vm.runInContext(`(${source.slice(mod.factory.start, mod.factory.end)})(...${argumentsKey})`, context, { timeout: 5000 });
    } finally { delete context[argumentsKey]; }
    return record.exports;
  }
  const exports = load(auth.id);
  check(exports.isAuthConfigured === true && exports.authEnvironment?.staging === false, "NORMAL_AUTH_NOT_SELECTED");
  check(exports.authEnvironment?.keychainService === "beforeyousayit.supabase", "NORMAL_STORAGE_NAMESPACE_MISMATCH");
  check(creationCalls === 1 && embeddedInputsMatch && Boolean(exports.supabase?.auth), "NORMAL_CLIENT_NOT_INITIALIZED");
  for (const line of ["Runtime: release", "App identity: normal", "Auth selection: normal", "Build mode: unset", "Normal URL: present", "Normal key: present", "Failed checks: none"]) {
    check(exports.authConfigurationDiagnostic.includes(line), "D1_STARTUP_CLASSIFICATION_MISMATCH");
  }
  check(networkCalls === 0 && nativeStorageCalls === 0, "UNEXPECTED_NETWORK_OR_STORAGE_ACCESS");
  return { bundleSHA256: sha256(source), bundleName: names[0],
    actualExportedAuthFactoryExecuted: true, actualExportedSelectorAndDiagnosticExecuted: true,
    devicePublicEnvironmentEmpty: true, normalAuthSelected: true, embeddedInputsMatch: true,
    realInstalledSupabaseClientConstructed: true, installedSDKVersionMatchesPinnedLock: sdkVersion,
    createClientCalls: creationCalls, networkCalls, nativeStorageCalls,
    d1SafeStartupChecksPassed: true, diagnosticIdentityIsHarnessSupplied: true,
    nativePersistenceAndAutoRefreshNotExercised: true, signedAppVerified: false };
}
async function main() {
  const [command, directory, ...flags] = process.argv.slice(2);
  check(["source", "export"].includes(command) && Boolean(directory)
    && flags.every(flag => flag === "--allow-restored-worktree"), "USAGE_NODE_VERIFIER_SOURCE_OR_EXPORT_EXPO_DIRECTORY");
  const root = path.resolve(directory);
  const allowRestoredWorktree = flags.includes("--allow-restored-worktree");
  const before = dotenvSnapshot(root);
  const provenance = verifySource(root, allowRestoredWorktree);
  if (command === "source") { console.log(JSON.stringify({ ...provenance, scope: "source-only; environment and signed app not verified" }, null, 2)); return; }
  const env = releaseEnvironment(root, allowRestoredWorktree);
  verifyApprovedAuthInputs(env);
  verifyResolvedConfig(root, env);
  const output = runExport(root, env);
  const inspection = inspectBundle(root, output, env);
  check(JSON.stringify(dotenvSnapshot(root)) === JSON.stringify(before), "DOTENV_CHANGED_DURING_VALIDATION");
  verifySource(root, allowRestoredWorktree);
  const report = { ...provenance, ...inspection, exportDirectory: output, dotenvUnchanged: true,
    approvedPublicAuthInputFingerprintMatched: true,
    resolvedIdentityVerified: true, otaDisabledInResolvedConfig: true, savedResultsInputUnset: true,
    verifierSHA256: sha256(fs.readFileSync(__filename)),
    nodeVersion: process.version, runDate: new Date().toISOString(),
    scope: "Local production iOS JavaScript export; no EAS build, signing, sign-in or remote-environment verification" };
  fs.writeFileSync(path.join(output, "d1-verification.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(report, null, 2));
}
if (require.main === module) main().catch(error => {
  console.error(JSON.stringify({ passed: false, reason: error instanceof VerificationError ? error.message : "VERIFICATION_FAILED_RAW_ERROR_WITHHELD" }));
  process.exitCode = 1;
});
module.exports = { verifySource, releaseEnvironment, verifyApprovedAuthInputs, verifyResolvedConfig, inspectBundle };
