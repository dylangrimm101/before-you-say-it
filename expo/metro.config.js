const { getDefaultConfig } = require("expo/metro-config");
const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

runClientEnvPreflight(__dirname);
const config = getDefaultConfig(__dirname);
if (process.env.EXPO_PUBLIC_BYSI_BUILD_MODE === "staging-account") {
  // Expo's development virtual-env module reads dotenv through require.context
  // independently of EXPO_NO_DOTENV. Exclude those files from staging Metro too.
  config.resolver.blockList = [
    ...[config.resolver.blockList ?? []].flat(),
    /[/\\]\.env(?:\.[^/\\]*)?$/,
  ];
}
// Approved HTML is opaque authored content, not a JS module or web entry point.
config.resolver.assetExts = [...new Set([...config.resolver.assetExts, "html"])];
module.exports = config;
