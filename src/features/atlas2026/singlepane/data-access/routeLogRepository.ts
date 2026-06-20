import type { RouteLogEvent } from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

/**
 * Route-log persistence repository.
 *
 * Purpose:
 * - normalizes timeline log records before persistence.
 * - maintains local durability with optional Supabase replication.
 */

const ROUTE_LOG_CONFIG_KEY = 'route_logs'
const CONFIG_SURFACE = 'singlepane'
const CONFIG_VERSION = 'runtime-v1'
const LOCAL_ROUTE_LOG_STORAGE_KEY = 'atlas2026.singlepane.logs.v4'

function normalizeLog(log: RouteLogEvent): RouteLogEvent {
  return {
    ...log,
    phase: log.phase || 'regulation',
    milestoneType: log.milestoneType || 'intervention',
    domainsRelieved: Array.isArray(log.domainsRelieved) ? log.domainsRelieved : ['social'],
    stationIcon: log.stationIcon || 'check',
    timelinePositionRatio:
      typeof log.timelinePositionRatio === 'number' && Number.isFinite(log.timelinePositionRatio)
        ? Math.max(0, Math.min(1, log.timelinePositionRatio))
        : null
  }
}

async function persistRouteLogsToSupabase(logs: RouteLogEvent[]) {
  const payload = logs.map(normalizeLog)
  // Local persistence happens first so timeline interactions remain durable even
  // when network writes fail or optional Supabase access is unavailable.
  persistLocalLogs(payload)
  if (!hasSupabaseConfig || !supabase) {
    return
  }
  const { error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .upsert(
      {
        surface: CONFIG_SURFACE,
        config_key: ROUTE_LOG_CONFIG_KEY,
        version: CONFIG_VERSION,
        payload
      },
      { onConflict: 'surface,config_key,version' }
    )
  if (error) {
    if (isOptionalSupabaseDataError(error)) return
    throw error
  }
  // Read-after-write continuity check: the same request cycle must observe the
  // just-written payload size, otherwise timeline actions fail loudly instead of
  // silently diverging across sessions.
  const { data: verifyRows, error: verifyError } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('config_key', ROUTE_LOG_CONFIG_KEY)
    .eq('version', CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
  if (verifyError) {
    if (isOptionalSupabaseDataError(verifyError)) return
    throw verifyError
  }
  const persistedPayload = verifyRows?.[0]?.payload
  const persistedLength = Array.isArray(persistedPayload) ? persistedPayload.length : -1
  if (persistedLength !== payload.length) {
    throw new Error(
      `Route-log write verification failed: expected ${payload.length} rows, observed ${persistedLength}.`
    )
  }
}

export async function loadLocalLogs(): Promise<RouteLogEvent[]> {
  if (!hasSupabaseConfig || !supabase) return loadLocalLogsFromStorage()
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('app_config_documents')
    .select('payload')
    .eq('surface', CONFIG_SURFACE)
    .eq('config_key', ROUTE_LOG_CONFIG_KEY)
    .eq('version', CONFIG_VERSION)
    .order('created_at', { ascending: false })
    .limit(1)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalLogsFromStorage()
    throw error
  }
  const payload = data?.[0]?.payload
  if (!Array.isArray(payload)) return []
  const normalized = payload.map((item) => normalizeLog(item as RouteLogEvent))
  // Mirror cloud reads into local cache so subsequent offline sessions can recover
  // the latest known timeline state.
  persistLocalLogs(normalized)
  return normalized
}

export async function appendRouteLog(logs: RouteLogEvent[], nextLog: RouteLogEvent) {
  const finalLogs = [...logs, nextLog].map(normalizeLog)
  await persistRouteLogsToSupabase(finalLogs)
  return finalLogs
}

export async function saveRouteLogs(logs: RouteLogEvent[]) {
  const finalLogs = logs.map(normalizeLog)
  await persistRouteLogsToSupabase(finalLogs)
  return finalLogs
}

function loadLocalLogsFromStorage(): RouteLogEvent[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(LOCAL_ROUTE_LOG_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as RouteLogEvent[]
    if (!Array.isArray(parsed)) return []
    return parsed.map(normalizeLog)
  } catch {
    return []
  }
}

function persistLocalLogs(logs: RouteLogEvent[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_ROUTE_LOG_STORAGE_KEY, JSON.stringify(logs.map(normalizeLog)))
}
