import type { ConfigContext, ExpoConfig } from "expo/config";

export default function configure({ config }: ConfigContext): ExpoConfig {
  const mode = process.env.EXPO_PUBLIC_BYSI_BUILD_MODE;
  // Rork's native release runner need not set an EAS profile.
  // Apply the same reviewed checks to non-staging production exports.
  if (process.env.EAS_BUILD_PROFILE === "testflight" || (process.env.NODE_ENV === "production" && !mode)) {
    if (mode || Object.keys(process.env).some(name => name.startsWith("EXPO_PUBLIC_STAGING_") && process.env[name])
      || process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY) throw new Error("TestFlight rejects staging and Test Store inputs");
    if (config.ios?.bundleIdentifier !== "app.rork.8fc4qwsqaurkxk0pimyvx"
      || config.owner !== "dgrim101" || config.slug !== "8fc4qwsqaurkxk0pimyvx"
      || config.extra?.eas?.projectId !== "1b655360-557d-4dba-ad69-fbf26120e852") {
      throw new Error("TestFlight requires independently verified normal EAS owner/project association; staging cannot be reused");
    }
    // Registered free uses /api/native/free/*; paid uses /api/native/*.
    // Both transports derive from this origin, not the old public-funnel inputs.
    const allowedPublicInputs = new Set(["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "EXPO_PUBLIC_NATIVE_BILLING_ORIGIN", "EXPO_PUBLIC_NATIVE_RESULTS"]);
    if (process.env.EXPO_PUBLIC_NATIVE_RESULTS && process.env.EXPO_PUBLIC_NATIVE_RESULTS !== 'normal-results-v1') throw new Error('TestFlight rejects unknown saved-result capability');
    // Metro export:embed sets EXPO_PUBLIC_PROJECT_ROOT to the project path. That is not a product/funnel input.
    const expoCliPublicNoise = new Set(["EXPO_PUBLIC_PROJECT_ROOT"]);
    if (Object.keys(process.env).some(name => name.startsWith("EXPO_PUBLIC_") && process.env[name] && !allowedPublicInputs.has(name) && !expoCliPublicNoise.has(name))) {
      throw new Error("TestFlight rejects unreviewed public inputs and legacy public-funnel endpoint overrides");
    }
    if (process.env.EXPO_PUBLIC_SUPABASE_URL !== "https://spvksnddzyvycfoefrcf.supabase.co"
      || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "")
      || !/^appl_[A-Za-z0-9]+$/.test(process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY ?? "")
      || process.env.EXPO_PUBLIC_NATIVE_BILLING_ORIGIN !== "https://beforeyousayit.app") {
      throw new Error("TestFlight requires reviewed normal Auth, iOS RevenueCat, billing and free-service inputs; no fallback");
    }
    // No OTA service is associated/accepted yet. TestFlight exercises embedded bytes.
    return { ...config, updates: { ...config.updates, enabled: false } } as ExpoConfig;
  }
  if (!mode) return config as ExpoConfig;
  if (mode !== "staging-account") throw new Error("Unknown BYSI build mode");
  if (process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL !== "https://pqqxaklcburdxjfeolmd.supabase.co"
    || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY ?? "")) {
    throw new Error("Staging requires the pinned URL and a staging publishable key; no production fallback");
  }
  if (process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED
    && process.env.EXPO_PUBLIC_STAGING_ACCOUNT_DELETION_ENABLED !== "reviewed-task1-20260910") {
    throw new Error("Staging account deletion requires the exact reviewed Task 1 flag");
  }
  // Account-only build: fail before bundling if normal service settings leaked in.
  for (const name of ["EXPO_PUBLIC_SUPABASE_URL", "EXPO_PUBLIC_SUPABASE_ANON_KEY", "EXPO_PUBLIC_GENERATE_ENDPOINT", "EXPO_PUBLIC_TRANSCRIBE_ENDPOINT", "EXPO_PUBLIC_TTS_ENDPOINT", "EXPO_PUBLIC_REVENUECAT_IOS_API_KEY", "EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY", "EXPO_PUBLIC_REVENUECAT_TEST_API_KEY"]) {
    if (process.env[name]) throw new Error(`Clear ${name} for the isolated staging account build`);
  }
  return {
    ...config,
    name: "BYSI Staging Account",
    slug: "bysi-staging-account",
    // Dedicated staging project, independently read back via EAS project:info.
    owner: "dgrim101",
    scheme: "beforeyousayit-staging",
    ios: { ...config.ios, bundleIdentifier: "app.bysi.staging.account" },
    android: { ...config.android, package: "app.bysi.staging.account" },
    updates: { enabled: false },
    // Never inherit the production Router fetch origin into the isolated app.
    plugins: config.plugins?.map(plugin => {
      if (!Array.isArray(plugin) || plugin[0] !== "expo-router") return plugin;
      const options = { ...plugin[1] };
      delete options.origin;
      return [plugin[0], options];
    }),
    extra: { bysiBuildMode: "staging-account", eas: { projectId: "b25c7aba-ef9d-4f88-b7c5-4da1678fcf44" } },
  } as ExpoConfig;
}
