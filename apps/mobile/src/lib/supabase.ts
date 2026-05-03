/**
 * Mobile Supabase client factory with React Native auth persistence settings.
 * This file is the single source of truth for Expo env-based connectivity.
 */
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createAtlasSupabaseClient, hasSupabaseConfig } from "@atlas/shared";

const supabaseConfig = {
  url: process.env.EXPO_PUBLIC_SUPABASE_URL,
  publishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
};

export const hasMobileSupabaseConfig = hasSupabaseConfig(supabaseConfig);

export const supabase = createAtlasSupabaseClient(supabaseConfig, {
  auth: {
    // React Native has no Uniform Resource Locator (URL) callback session handoff, so auth state must persist in AsyncStorage.
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
