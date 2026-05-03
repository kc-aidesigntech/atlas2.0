import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

/**
 * Shared persistence helpers for single-pane config documents.
 *
 * Purpose:
 * - remove repetitive localStorage + app_config_documents boilerplate.
 * - keep local-first behavior and Supabase fallback behavior consistent.
 */
export const SINGLEPANE_CONFIG_SURFACE = 'singlepane'
export const SINGLEPANE_CONFIG_VERSION = 'runtime-v1'

function parseJsonOrFallback<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function loadLocalStorageState<T>(
  storageKey: string,
  fallback: T,
  normalize?: (parsed: T) => T
): T {
  if (typeof window === 'undefined') return fallback
  const parsed = parseJsonOrFallback(window.localStorage.getItem(storageKey), fallback)
  return normalize ? normalize(parsed) : parsed
}

export function persistLocalStorageState<T>(storageKey: string, payload: T) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(payload))
}

export async function loadLatestConfigPayload<T>(
  configKey: string
): Promise<{ payload: T | null; error: unknown }> {
  if (!hasSupabaseConfig || !supabase) {
    return { payload: null, error: null }
  }
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', SINGLEPANE_CONFIG_SURFACE)
    .eq('config_key', configKey)
    .eq('version', SINGLEPANE_CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
  return { payload: ((data?.[0]?.payload ?? null) as T | null), error }
}

export async function loadConfigPayloadMapByPrefix<T>(
  configKeyPrefix: string
): Promise<{ rows: Array<{ config_key?: string; payload?: unknown }>; error: unknown }> {
  if (!hasSupabaseConfig || !supabase) {
    return { rows: [], error: null }
  }
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('config_key,payload')
    .eq('surface', SINGLEPANE_CONFIG_SURFACE)
    .eq('version', SINGLEPANE_CONFIG_VERSION)
    .like('config_key', `${configKeyPrefix}%`)
  return { rows: (data || []) as Array<{ config_key?: string; payload?: unknown }>, error }
}

export async function upsertConfigPayload(configKey: string, payload: unknown): Promise<unknown> {
  if (!hasSupabaseConfig || !supabase) return null
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: SINGLEPANE_CONFIG_SURFACE,
        config_key: configKey,
        version: SINGLEPANE_CONFIG_VERSION,
        payload
      },
      { onConflict: 'surface,config_key,version' }
    )
  return error
}
