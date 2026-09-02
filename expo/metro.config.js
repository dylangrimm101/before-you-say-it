const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

runClientEnvPreflight(__dirname);
const config = getDefaultConfig(__dirname);

module.exports = withRorkMetro(config);
