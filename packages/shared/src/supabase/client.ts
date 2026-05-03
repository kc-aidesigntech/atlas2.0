import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AtlasDatabase } from "./contracts";

export interface AtlasSupabaseConfig {
  url?: string;
  publishableKey?: string;
}

export function resolveSupabaseConfig(config: AtlasSupabaseConfig) {
  // Env-based config often carries whitespace from shell exports or CI secrets;
  // normalize once so all downstream checks share identical behavior.
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
  // Returning null (instead of throwing) lets app shells decide whether to show
  // offline/unauthenticated states before network clients are initialized.
  if (!resolved.url || !resolved.publishableKey) {
    return null;
  }
  return createClient<AtlasDatabase>(resolved.url, resolved.publishableKey, options);
}
