import type {
  IntervalCadence,
  RegulationReviewEnrolleeSetting,
  RegulationReviewSettings
} from '@/features/atlas2026/shared/contracts'
import {
  loadLatestConfigPayload,
  loadLocalStorageState,
  persistLocalStorageState,
  upsertConfigPayload
} from '@/features/atlas2026/singlepane/data-access/configDocumentPersistence'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const REGULATION_REVIEW_SETTINGS_CONFIG_KEY = 'regulation_review_settings'
const LOCAL_REGULATION_REVIEW_SETTINGS_KEY = 'atlas2026.singlepane.regulation-review-settings.v1'

function normalizeIntervalCadence(value: unknown, fallback: IntervalCadence): IntervalCadence {
  return value === 'weekly' || value === 'monthly' || value === 'quarterly' ? value : fallback
}

export function getDefaultRegulationReviewSettings(): RegulationReviewSettings {
  return {
    // Client mandate: the review is weekly and active by default for new enrollees.
    defaultCadence: 'weekly',
    isActiveForNewEnrollees: true,
    enrolleeSettings: {},
    updatedAtIso: new Date().toISOString()
  }
}

function normalizeEnrolleeSetting(
  payload: Partial<RegulationReviewEnrolleeSetting> | null | undefined,
  enrolleeId: string
): RegulationReviewEnrolleeSetting {
  return {
    enrolleeId,
    enrolleeName: String(payload?.enrolleeName || '').trim(),
    // Missing flags stay active so partial records cannot silently disable reviews.
    isActive: payload?.isActive !== false,
    cadence: payload?.cadence === 'weekly' || payload?.cadence === 'monthly' || payload?.cadence === 'quarterly'
      ? payload.cadence
      : null,
    updatedAtIso: payload?.updatedAtIso || new Date().toISOString()
  }
}

export function normalizeRegulationReviewSettings(
  payload: Partial<RegulationReviewSettings> | null | undefined
): RegulationReviewSettings {
  const fallback = getDefaultRegulationReviewSettings()
  const rawEntries = payload?.enrolleeSettings && typeof payload.enrolleeSettings === 'object'
    ? payload.enrolleeSettings
    : {}
  return {
    defaultCadence: normalizeIntervalCadence(payload?.defaultCadence, fallback.defaultCadence),
    isActiveForNewEnrollees: payload?.isActiveForNewEnrollees !== false,
    enrolleeSettings: Object.fromEntries(Object.entries(rawEntries)
      .filter(([id]) => String(id).trim())
      .map(([id, entry]) => [id, normalizeEnrolleeSetting(entry as Partial<RegulationReviewEnrolleeSetting>, id)])),
    updatedAtIso: payload?.updatedAtIso || fallback.updatedAtIso
  }
}

function loadLocalRegulationReviewSettingsState(): RegulationReviewSettings {
  return loadLocalStorageState(
    LOCAL_REGULATION_REVIEW_SETTINGS_KEY,
    getDefaultRegulationReviewSettings(),
    (parsed) => normalizeRegulationReviewSettings(parsed as Partial<RegulationReviewSettings>)
  )
}

export async function loadRegulationReviewSettings(): Promise<RegulationReviewSettings> {
  const { payload, error } = await loadLatestConfigPayload<Partial<RegulationReviewSettings>>(REGULATION_REVIEW_SETTINGS_CONFIG_KEY)
  if (error) {
    // Only schema-optional environments fall back locally; real failures surface.
    if (isOptionalSupabaseDataError(error)) return loadLocalRegulationReviewSettingsState()
    throw error
  }
  const normalized = normalizeRegulationReviewSettings(payload)
  persistLocalStorageState(LOCAL_REGULATION_REVIEW_SETTINGS_KEY, normalized)
  return normalized
}

export async function saveRegulationReviewSettings(settings: RegulationReviewSettings): Promise<RegulationReviewSettings> {
  const normalized = normalizeRegulationReviewSettings({ ...settings, updatedAtIso: new Date().toISOString() })
  persistLocalStorageState(LOCAL_REGULATION_REVIEW_SETTINGS_KEY, normalized)
  const error = await upsertConfigPayload(REGULATION_REVIEW_SETTINGS_CONFIG_KEY, normalized)
  if (error && !isOptionalSupabaseDataError(error)) throw error
  return normalized
}
