const fs = require("node:fs");
const path = require("node:path");

// These workspace inputs are not used by the reviewed iOS release. Remove only
// this known ambient set; unknown inputs and endpoint overrides still fail closed.
const ambientNames = [
  "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY",
  "EXPO_PUBLIC_RORK_API_BASE_URL", "EXPO_PUBLIC_RORK_APP_KEY", "EXPO_PUBLIC_RORK_AUTH_URL",
  "EXPO_PUBLIC_RORK_FUNCTIONS_URL", "EXPO_PUBLIC_TOOLKIT_URL", "EXPO_PUBLIC_PROJECT_ID",
  "EXPO_PUBLIC_TEAM_ID", "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY",
  "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY",
];

/** Select the normal release only; staging and development keep their own rules. */
function isNormalRelease(env = process.env) {
  return env.EAS_BUILD_PROFILE === "testflight"
    || (env.NODE_ENV === "production" && !env.EXPO_PUBLIC_BYSI_BUILD_MODE);
}

/** Filter this process, never persisted workspace settings or dotenv files. */
function prepareReleaseEnvironment(env = process.env) {
  if (!isNormalRelease(env)) return false;
  for (const name of ambientNames) delete env[name];
  // Expo has already loaded the runner's dotenv by config evaluation. Child
  // processes inherit this flag so it cannot reintroduce the removed inputs.
  env.EXPO_NO_DOTENV = "1";
  // Rork does not select an EAS profile. Carry over its reviewed non-secret
  // origin explicitly, without replacing an incorrect or empty supplied value.
  if (env.EAS_BUILD_PROFILE !== "testflight" && env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN === undefined) {
    env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN = require("../eas.json").build.testflight.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN;
  }
  return true;
}

/** Check the consuming Metro/Babel process as well as the app-config process. */
function assertReleaseClientInputs(env = process.env) {
  if (env.EXPO_PUBLIC_BYSI_BUILD_MODE
    || Object.keys(env).some(name => name.startsWith("EXPO_PUBLIC_STAGING_") && env[name])
    || env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY) throw new Error("TestFlight rejects staging and Test Store inputs");
  const allowed = new Set(["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "EXPO_PUBLIC_NATIVE_BILLING_ORIGIN", "EXPO_PUBLIC_NATIVE_RESULTS", "EXPO_PUBLIC_PROJECT_ROOT"]);
  if (env.EXPO_PUBLIC_NATIVE_RESULTS && env.EXPO_PUBLIC_NATIVE_RESULTS !== "normal-results-v1") throw new Error("TestFlight rejects unknown saved-result capability");
  if (Object.keys(env).some(name => name.startsWith("EXPO_PUBLIC_") && env[name] && !allowed.has(name))) {
    throw new Error("TestFlight rejects unreviewed public inputs and legacy public-funnel endpoint overrides");
  }
  if (env.EXPO_PUBLIC_SUPABASE_URL !== "https://spvksnddzyvycfoefrcf.supabase.co"
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "")
    || !/^appl_[A-Za-z0-9]+$/.test(env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "")
    || env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN !== "https://beforeyousayit.app") {
    throw new Error("TestFlight requires reviewed normal Auth, iOS RevenueCat, billing and free-service inputs; no fallback");
  }
}

/** Fail before archiving if managed configuration drift restores injection. */
function assertReleaseToolchain(rootDirectory) {
  const metro = fs.readFileSync(path.join(rootDirectory, "metro.config.js"), "utf8");
  const babel = fs.readFileSync(path.join(rootDirectory, "babel.config.js"), "utf8");
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDirectory, "package.json"), "utf8"));
  if (metro.includes("withRorkMetro") || metro.includes("@rork-ai/toolkit-sdk")
    || !metro.includes("runClientEnvPreflight(__dirname)")
    || !metro.includes('"html"') || !metro.includes("config.resolver.blockList")
    || !babel.includes("runClientEnvPreflight(__dirname)")
    || pkg.dependencies?.["@rork-ai/toolkit-sdk"] !== "0.3.0") {
    throw new Error("TestFlight requires guarded Babel/Metro, HTML assets, and inert toolkit 0.3.0; release configuration drift detected");
  }
}

module.exports = { isNormalRelease, prepareReleaseEnvironment, assertReleaseClientInputs, assertReleaseToolchain };
