const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = getDefaultConfig(__dirname);

if (!config.resolver.assetExts.includes("html")) {
  config.resolver.assetExts.push("html");
}

module.exports = withRorkMetro(config);
