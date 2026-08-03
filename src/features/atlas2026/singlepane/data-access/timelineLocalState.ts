import type { TimelineConfig } from '@/features/atlas2026/shared/contracts'
import {
  loadConfigPayloadMapByPrefix,
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const TIMELINE_CONFIG_KEY_PREFIX = 'timeline_config:'
const LOCAL_TIMELINE_CONFIGS_KEY = 'atlas2026.singlepane.timeline-configs.v1'
const ALLOW_SENSITIVE_LOCAL_CACHE = import.meta.env.VITE_ALLOW_SENSITIVE_LOCAL_CACHE === 'true'

function loadLocalTimelineConfigState(): Record<string, TimelineConfig> {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return {}
  return loadLocalStorageState(LOCAL_TIMELINE_CONFIGS_KEY, {}, (parsed) =>
    parsed && typeof parsed === 'object' ? parsed as Record<string, TimelineConfig> : {}
  )
}

function persistLocalTimelineConfigState(state: Record<string, TimelineConfig>) {
  if (!ALLOW_SENSITIVE_LOCAL_CACHE) return
  persistLocalStorageState(LOCAL_TIMELINE_CONFIGS_KEY, state)
}

export async function loadTimelineConfigs(): Promise<Record<string, TimelineConfig>> {
  const { rows, error } = await loadConfigPayloadMapByPrefix<TimelineConfig>(TIMELINE_CONFIG_KEY_PREFIX)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return loadLocalTimelineConfigState()
    throw error
  }
  const normalized = Object.fromEntries((rows || []).map((row) => {
    const key = row.config_key?.replace(TIMELINE_CONFIG_KEY_PREFIX, '')
    const payload = row.payload as TimelineConfig | null
    return key && payload ? [key, payload] : null
  }).filter((entry): entry is [string, TimelineConfig] => Boolean(entry)))
  persistLocalTimelineConfigState(normalized)
  return normalized
}

function buildTimelineConfigKeys(enrolleeId: string, enrollmentId?: string | null) {
  const keys = [`enrollee:${enrolleeId}`]
  if (enrollmentId?.trim()) keys.unshift(`enrollment:${enrollmentId.trim()}`)
  return keys
}

export async function saveTimelineConfig(
  ids: { enrolleeId: string; enrollmentId?: string | null },
  config: TimelineConfig
): Promise<TimelineConfig> {
  const keys = buildTimelineConfigKeys(ids.enrolleeId, ids.enrollmentId)
  const nextLocalState = { ...loadLocalTimelineConfigState() }
  for (const key of keys) nextLocalState[key] = config
  persistLocalTimelineConfigState(nextLocalState)

  // Verify each identity alias so enrollment and enrollee lookups cannot diverge.
  for (const key of keys) {
    const configKey = `${TIMELINE_CONFIG_KEY_PREFIX}${key}`
    const error = await upsertConfigPayload(configKey, config)
    if (error) {
      if (isOptionalSupabaseDataError(error)) return config
      throw error
    }
    const { payload, error: verifyError } = await loadLatestConfigPayload<TimelineConfig>(configKey)
    if (verifyError) {
      if (!isOptionalSupabaseDataError(verifyError)) throw verifyError
      continue
    }
    if (!payload || payload.planStartIso !== config.planStartIso) {
      throw new Error(`Timeline config verification failed for key ${configKey}.`)
    }
  }
  return config
}
