const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

// The workspace orchestrator may materialize every project environment variable
// into expo/.env. Remove server credentials and secret-like public variables
// before Metro can inspect the client environment. Values are never logged.
const envPath = path.join(__dirname, ".env");
const prohibited = new Set([
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "ELEVENLABS_API_KEY",
  "SUPABASE_ACCESS_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SERVICE_ROLE_KEY",
  "EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY",
]);
if (fs.existsSync(envPath)) {
  const original = fs.readFileSync(envPath, "utf8");
  const removed = [];
  const kept = original.split(/\r?\n/).filter((line) => {
    const match = line.match(/^\s*(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/);
    if (!match || !prohibited.has(match[1])) return true;
    removed.push(match[1]);
    return false;
  });
  if (removed.length > 0) {
    fs.writeFileSync(envPath, `${kept.join("\n").trimEnd()}\n`, { mode: 0o600 });
    process.stderr.write(`[env-guard] sanitized prohibited client variables: ${removed.sort().join(", ")}\n`);
  }
}

const config = getDefaultConfig(__dirname);

module.exports = withRorkMetro(config);
