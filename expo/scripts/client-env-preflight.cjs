const fs = require("node:fs");
const path = require("node:path");

const allowedPublic = new Set([
  "EXPO_PUBLIC_GENERATE_ENDPOINT", "EXPO_PUBLIC_PROJECT_ID", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY",
  "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY", "EXPO_PUBLIC_RORK_API_BASE_URL", "EXPO_PUBLIC_RORK_APP_KEY",
  "EXPO_PUBLIC_RORK_AUTH_URL", "EXPO_PUBLIC_RORK_FUNCTIONS_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  "EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_TEAM_ID", "EXPO_PUBLIC_TOOLKIT_URL", "EXPO_PUBLIC_TRANSCRIBE_ENDPOINT", "EXPO_PUBLIC_TTS_ENDPOINT",
]);
const prohibited = new Set([
  "OPENAI_API_KEY", "ANTHROPIC_API_KEY", "ELEVENLABS_API_KEY", "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY", "SERVICE_ROLE_KEY", "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY",
]);
const secretLike = /^EXPO_PUBLIC_.*(?:SECRET|TOKEN|PRIVATE|PASSWORD|SERVICE_ROLE|ACCESS_KEY)/;

function classification(name) {
  if (prohibited.has(name)) return "remove";
  if (!name.startsWith("EXPO_PUBLIC_") || allowedPublic.has(name)) return "keep";
  return secretLike.test(name) ? "reject" : "remove";
}

function runClientEnvPreflight(rootDirectory) {
  const rejected = [];
  Object.keys(process.env).forEach((name) => {
    const kind = classification(name);
    if (kind === "keep") return;
    if (kind === "reject") rejected.push(name);
    delete process.env[name];
  });
  if (rejected.length > 0) throw new Error(`Unknown secret-like client variables: ${rejected.sort().join(", ")}`);

  const envPath = path.join(rootDirectory, ".env");
  if (!fs.existsSync(envPath)) return;
  const kept = fs.readFileSync(envPath, "utf8").split(/\r?\n/).filter((line) => {
    const name = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/)?.[1];
    if (!name) return true;
    const kind = classification(name);
    if (kind === "reject") throw new Error(`Unknown secret-like client variable: ${name}`);
    return kind === "keep";
  });
  fs.writeFileSync(envPath, `${kept.join("\n").trimEnd()}\n`, { mode: 0o600 });
}

module.exports = { runClientEnvPreflight };
