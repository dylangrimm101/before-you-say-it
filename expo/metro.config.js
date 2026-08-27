const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");
const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

runClientEnvPreflight(__dirname);
const config = getDefaultConfig(__dirname);

module.exports = withRorkMetro(config);
