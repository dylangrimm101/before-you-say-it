const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

module.exports = function (api) {
  runClientEnvPreflight(__dirname);
  api.cache(true);
  return {
    presets: [["babel-preset-expo", { unstable_transformImportMeta: true }]],
  };
};
