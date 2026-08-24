const { getDefaultConfig } = require("expo/metro-config");
const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");

const config = withRorkMetro(getDefaultConfig(__dirname));

config.resolver.assetExts = config.resolver.assetExts.filter((extension) => extension !== "html");
if (!config.resolver.sourceExts.includes("html")) {
  config.resolver.sourceExts.push("html");
}
config.transformer.babelTransformerPath = require.resolve("./html-transformer");

module.exports = config;
