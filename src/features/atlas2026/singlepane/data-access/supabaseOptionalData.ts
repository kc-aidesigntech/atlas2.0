const optionalSupabaseFallbackCache = new Map<string, unknown>()

/**
 * Optional-Supabase fallback utilities.
 *
 * Purpose:
 * - classifies permission/schema errors that should degrade gracefully.
 * - memoizes fallback payloads to avoid repeated failing network calls.
 */

/**
 * Classifies an error as a *genuinely optional* data dependency: a feature whose
 * backing relation is simply not deployed in this environment (missing table /
 * undefined view). Only those degrade to a fallback.
 *
 * Permission/authorization failures are deliberately EXCLUDED. A `42501`
 * (permission denied) / 401 / 403 means the database HAS the data but the
 * caller's grants or Row-Level Security (RLS) hid it -- that is a contract
 * violation between identity and data, never an "optional" condition. Swallowing
 * it is what previously made an assigned enrollee silently vanish from a
 * navigator's list. These must now fail loudly so the misconfiguration surfaces.
 */
export function isOptionalSupabaseDataError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: number; code?: string; message?: string; details?: string }
  const status = candidate.status
  const code = candidate.code
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase()
  if (isSupabasePermissionError(error)) return false
  return (
    status === 404 ||
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

/**
 * True for authorization/permission failures (grant or RLS denial). These are
 * surfaced loudly rather than degraded, so identity<->data contract breaks are
 * never hidden behind an empty list.
 */
export function isSupabasePermissionError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: number; code?: string; message?: string; details?: string }
  const status = candidate.status
  const code = candidate.code
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase()
  return (
    status === 401 ||
    status === 403 ||
    code === '42501' ||
    message.includes('permission denied')
  )
}

/**
 * Extracts a human-readable message from any thrown value.
 *
 * Supabase/PostgREST rejections are plain objects ({ message, details, hint,
 * code }), NOT `Error` instances, so the common `error instanceof Error`
 * extraction silently drops their message and shows only a generic fallback.
 * That masking is exactly what hid a real database failure (42601) behind
 * "Unable to save service capacity survey". This pulls the most specific text
 * available (and appends the SQLSTATE code when present) so failures are loud.
 */
export function toSupabaseErrorMessage(error: unknown, fallbackMessage: string): string {
  if (typeof error === 'string' && error.trim()) return error
  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    const message = typeof candidate.message === 'string' ? candidate.message.trim() : ''
    const details = typeof candidate.details === 'string' ? candidate.details.trim() : ''
    const hint = typeof candidate.hint === 'string' ? candidate.hint.trim() : ''
    const code = typeof candidate.code === 'string' ? candidate.code.trim() : ''
    const primary = message || details || hint
    if (primary) return code ? `${primary} (${code})` : primary
  }
  return fallbackMessage
}

export async function withOptionalSupabaseFallback<T>(key: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  if (optionalSupabaseFallbackCache.has(key)) {
    return optionalSupabaseFallbackCache.get(key) as T
  }
  try {
    return await loader()
  } catch (error) {
    if (isOptionalSupabaseDataError(error)) {
      // Cache fallback by key once a dependency is known-optional so repeated
      // User Interface (UI) hydration paths avoid noisy retries.
      if (import.meta.env.DEV) {
        const candidate = error as { message?: string; code?: string }
        console.warn(`[singlepane] optional supabase fallback for ${key}`, candidate.code || '', candidate.message || '')
      }
      optionalSupabaseFallbackCache.set(key, fallback)
      return fallback
    }
    throw error
  }
}
