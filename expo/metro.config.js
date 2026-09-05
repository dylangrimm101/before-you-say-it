const { getDefaultConfig } = require("expo/metro-config");
const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

runClientEnvPreflight(__dirname);
module.exports = getDefaultConfig(__dirname);
