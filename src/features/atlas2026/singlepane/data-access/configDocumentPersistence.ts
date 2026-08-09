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

// Values at or above this length that embed a data Uniform Resource Locator (URL)
// image are almost certainly legacy full-resolution avatar caches from builds that
// predate Storage-backed uploads. They are safe to evict: current builds persist
// only short public URLs, and every pruned key re-hydrates from Supabase or defaults.
const LEGACY_OVERSIZED_CACHE_VALUE_MIN_LENGTH = 100_000

function isLocalStorageQuotaError(error: unknown) {
  return (
    (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'QuotaExceededError') ||
    (error instanceof Error && /quota/i.test(error.message))
  )
}

/**
 * Evict legacy oversized data-URL image caches so a single stale avatar from an
 * old build cannot permanently wedge every future localStorage write at quota.
 * Returns true when at least one entry was removed (so callers can retry once).
 */
function pruneLegacyOversizedImageCaches(excludedKey: string) {
  let removedAny = false
  // Iterate backwards because removeItem reindexes the remaining keys.
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index)
    if (!key || key === excludedKey || !key.startsWith('atlas2026.')) continue
    const value = window.localStorage.getItem(key)
    if (value && value.length >= LEGACY_OVERSIZED_CACHE_VALUE_MIN_LENGTH && value.includes('data:image/')) {
      window.localStorage.removeItem(key)
      removedAny = true
    }
  }
  return removedAny
}

export function persistLocalStorageState<T>(storageKey: string, payload: T) {
  if (typeof window === 'undefined') return
  const serialized = JSON.stringify(payload)
  try {
    window.localStorage.setItem(storageKey, serialized)
  } catch (error) {
    // Large data-URL avatars historically blew past browser quota. First try to
    // self-heal by evicting legacy oversized image caches, then retry once.
    if (isLocalStorageQuotaError(error) && pruneLegacyOversizedImageCaches(storageKey)) {
      try {
        window.localStorage.setItem(storageKey, serialized)
        return
      } catch (retryError) {
        error = retryError
      }
    }
    if (isLocalStorageQuotaError(error)) {
      // Surface a clear recovery path instead of a raw DOMException.
      throw new Error(
        'Browser storage is full. Use a smaller profile image, or sign in so the photo can upload to cloud storage.'
      )
    }
    throw error
  }
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
