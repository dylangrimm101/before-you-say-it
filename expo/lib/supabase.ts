import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import Constants from "expo-constants";
import * as Application from "expo-application";
import { selectAuthEnvironment } from "./authEnvironment";
import { describeAuthConfiguration } from "./authConfigurationDiagnostic";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

import { createMigratingSecureSessionStorage } from "@/lib/secureSessionStorage";

const authEnvironmentInputs: Parameters<typeof selectAuthEnvironment>[0] = {
  developmentBuild: __DEV__,
  nativeStagingBuild: Platform.OS !== "web" && Constants.executionEnvironment !== "storeClient"
    && Application.applicationId === "app.bysi.staging.account",
  mode: process.env.EXPO_PUBLIC_BYSI_BUILD_MODE,
  stagingUrl: process.env.EXPO_PUBLIC_STAGING_SUPABASE_URL,
  stagingKey: process.env.EXPO_PUBLIC_STAGING_SUPABASE_PUBLISHABLE_KEY,
  productionUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  productionKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  stagingAccountRelease: process.env.EXPO_PUBLIC_BYSI_STAGING_ACCOUNT_RELEASE === "1",
  applicationId: Application.applicationId,
  projectId: Constants.expoConfig?.extra?.eas?.projectId as string | undefined,
};
export const authEnvironment = selectAuthEnvironment(authEnvironmentInputs);

/** Credential-free startup snapshot; never re-read potentially changed runtime env on a tap. */
export const authConfigurationDiagnostic: string = describeAuthConfiguration(authEnvironmentInputs, authEnvironment, {
  version: Application.nativeApplicationVersion,
  build: Application.nativeBuildVersion,
});
const supabaseUrl = authEnvironment?.url ?? "";
const supabaseAnonKey = authEnvironment?.key ?? "";

/** True only when the public Supabase authentication configuration is available. */
export const isAuthConfigured: boolean = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

const KEYCHAIN_SERVICE = authEnvironment?.keychainService ?? "beforeyousayit.supabase";
const secureKeyValueStore = {
  getItem: (key: string) => SecureStore.getItemAsync(key, { keychainService: KEYCHAIN_SERVICE }),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value, {
    keychainService: KEYCHAIN_SERVICE,
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  }),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key, { keychainService: KEYCHAIN_SERVICE }),
};

const supabaseAuthStorage = createMigratingSecureSessionStorage({
  secure: secureKeyValueStore,
  // Staging never imports or removes legacy production sessions.
  legacy: authEnvironment?.staging ? { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} } : AsyncStorage,
  namespaceForKey: async (key) => {
    const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, key);
    return `bysi.auth.${digest}`;
  },
  generation: () => Crypto.randomUUID().replaceAll("-", ""),
});

/** Shared authenticated client. A missing configuration fails closed in the login UI. */
export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        ...(authEnvironment?.staging ? { storageKey: authEnvironment?.storageKey } : {}),
        storage: Platform.OS === "web" ? AsyncStorage : supabaseAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
