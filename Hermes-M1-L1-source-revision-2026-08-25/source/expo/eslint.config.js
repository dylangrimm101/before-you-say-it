const { defineConfig } = require("eslint/config");
const { runClientEnvPreflight } = require("./scripts/client-env-preflight.cjs");

runClientEnvPreflight(__dirname);
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
  },
]);
