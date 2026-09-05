import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import "react-native-url-polyfill/auto";

import { createMigratingSecureSessionStorage } from "@/lib/secureSessionStorage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** True only when the public Supabase authentication configuration is available. */
export const isAuthConfigured: boolean = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

const KEYCHAIN_SERVICE = "beforeyousayit.supabase";
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
  legacy: AsyncStorage,
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
        storage: Platform.OS === "web" ? AsyncStorage : supabaseAuthStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
