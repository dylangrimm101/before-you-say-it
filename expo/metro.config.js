const { getDefaultConfig } = require("expo/metro-config");
const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

runClientEnvPreflight(__dirname);
const config = getDefaultConfig(__dirname);
if (process.env.EXPO_PUBLIC_BYSI_BUILD_MODE === "staging-account" || process.env.EXPO_NO_DOTENV === "1") {
  // Virtual dotenv modules must not reintroduce excluded release/staging inputs.
  config.resolver.blockList = [
    ...[config.resolver.blockList ?? []].flat(),
    /[/\\]\.env(?:\.[^/\\]*)?$/,
  ];
}
// Approved HTML is opaque authored content, not a JS module or web entry point.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "html"])];
module.exports = config;
