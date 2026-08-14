import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import "react-native-url-polyfill/auto";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

/** True only when the public Supabase authentication configuration is available. */
export const isAuthConfigured: boolean = supabaseUrl.length > 0 && supabaseAnonKey.length > 0;

/** Shared authenticated client. A missing configuration fails closed in the login UI. */
export const supabase: SupabaseClient | null = isAuthConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
