const optionalSupabaseFallbackCache = new Map<string, unknown>()

export function isOptionalSupabaseDataError(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: number; code?: string; message?: string; details?: string }
  const status = candidate.status
  const code = candidate.code
  const message = `${candidate.message || ''} ${candidate.details || ''}`.toLowerCase()
  return (
    status === 401 ||
    status === 403 ||
    status === 404 ||
    code === '42501' ||
    code === 'PGRST205' ||
    code === '42P01' ||
    message.includes('permission denied') ||
    message.includes('could not find the table') ||
    message.includes('does not exist')
  )
}

export async function withOptionalSupabaseFallback<T>(key: string, loader: () => Promise<T>, fallback: T): Promise<T> {
  if (optionalSupabaseFallbackCache.has(key)) {
    return optionalSupabaseFallbackCache.get(key) as T
  }
  try {
    return await loader()
  } catch (error) {
    if (isOptionalSupabaseDataError(error)) {
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
