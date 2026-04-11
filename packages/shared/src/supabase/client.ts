import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AtlasDatabase } from "./contracts";

export interface AtlasSupabaseConfig {
  url?: string;
  publishableKey?: string;
}

export function resolveSupabaseConfig(config: AtlasSupabaseConfig) {
  return {
    url: config.url?.trim() || "",
    publishableKey: config.publishableKey?.trim() || "",
  };
}

export function hasSupabaseConfig(config: AtlasSupabaseConfig) {
  const resolved = resolveSupabaseConfig(config);
  return Boolean(resolved.url && resolved.publishableKey);
}

export function createAtlasSupabaseClient(
  config: AtlasSupabaseConfig,
  options?: Parameters<typeof createClient<AtlasDatabase>>[2],
): SupabaseClient<AtlasDatabase> | null {
  const resolved = resolveSupabaseConfig(config);
  if (!resolved.url || !resolved.publishableKey) {
    return null;
  }
  return createClient<AtlasDatabase>(resolved.url, resolved.publishableKey, options);
}
