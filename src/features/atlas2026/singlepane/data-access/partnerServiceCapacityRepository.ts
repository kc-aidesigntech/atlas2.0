import {
  createPartnerServiceCapacityDraftKey,
  normalizeOrganizationName,
  savePartnerServiceCapacityRecord,
  searchPartnerIdentifierRecords,
  sortPartnerServiceCapacityRecords,
  getPartnerServiceCapacitySubmissionByDraftKey,
  getLatestPartnerServiceCapacitySubmission,
  listPartnerServiceCapacitySubmissions,
  savePartnerServiceCapacitySubmission
} from '@atlas/shared'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { searchLocalPartnerIdentifierRecords } from '@/features/atlas2026/singlepane/data-access/localCsvData'

const PARTNER_SERVICE_CAPACITY_SURVEY_KEY = 'atlas2026.singlepane.partner-service-capacity.v1'

type PersistedPartnerServiceCapacityState = PartnerServiceCapacitySubmissionRecord[]

function loadPartnerServiceCapacityState(): PersistedPartnerServiceCapacityState {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(PARTNER_SERVICE_CAPACITY_SURVEY_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as PersistedPartnerServiceCapacityState | Record<string, PartnerServiceCapacitySubmissionRecord>
    if (Array.isArray(parsed)) {
      return sortPartnerServiceCapacityRecords(parsed)
    }
    if (parsed && typeof parsed === 'object') {
      const dedupedRecords = new Map<string, PartnerServiceCapacitySubmissionRecord>()
      Object.values(parsed).forEach((record) => {
        if (!record) return
        dedupedRecords.set(record.draftKey || record.id, record)
      })
      return sortPartnerServiceCapacityRecords(Array.from(dedupedRecords.values()))
    }
    return []
  } catch {
    return []
  }
}

function persistPartnerServiceCapacityState(state: PersistedPartnerServiceCapacityState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PARTNER_SERVICE_CAPACITY_SURVEY_KEY, JSON.stringify(state))
}

function persistPartnerServiceCapacityRecord(record: PartnerServiceCapacitySubmissionRecord) {
  const currentRecords = loadPartnerServiceCapacityState()
  const nextRecords = currentRecords.filter((currentRecord) => currentRecord.draftKey !== record.draftKey && currentRecord.id !== record.id)
  persistPartnerServiceCapacityState(sortPartnerServiceCapacityRecords([record, ...nextRecords]))
}

function toSubmissionRecord(input: PartnerServiceCapacitySubmissionInput, partnerId: string | null, submittedAtIso: string, id: string) {
  return {
    id,
    draftKey: input.draftKey || id,
    status: input.status || 'draft',
    completedAtIso: input.completedAtIso || null,
    partnerId,
    organizationNameNormalized: input.header.organizationName ? normalizeOrganizationName(input.header.organizationName) : null,
    submittedAtIso,
    updatedAtIso: submittedAtIso,
    formVersion: input.formVersion,
    header: input.header,
    answers: input.answers
  } satisfies PartnerServiceCapacitySubmissionRecord
}

export async function loadPartnerServiceCapacitySurvey(
  organizationName: string,
  draftKey?: string
): Promise<PartnerServiceCapacitySubmissionRecord | null> {
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  const trimmedDraftKey = draftKey?.trim()
  if (!organizationNameNormalized && !trimmedDraftKey) return null

  if (!hasSupabaseConfig || !supabase) {
    const localRecords = loadPartnerServiceCapacityState()
    if (trimmedDraftKey) {
      const draftRecord = localRecords.find((record) => record.draftKey === trimmedDraftKey)
      if (draftRecord) return draftRecord
    }
    if (!organizationNameNormalized) return null
    return localRecords.find((record) => record.organizationNameNormalized === organizationNameNormalized) || null
  }

  if (trimmedDraftKey) {
    const draftRecord = await getPartnerServiceCapacitySubmissionByDraftKey(supabase, trimmedDraftKey)
    if (draftRecord) return draftRecord
  }

  if (!organizationNameNormalized) return null

  return getLatestPartnerServiceCapacitySubmission(supabase, organizationNameNormalized)
}

export async function loadPartnerServiceCapacitySurveyHistory(
  organizationName: string
): Promise<PartnerServiceCapacitySubmissionRecord[]> {
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  if (!organizationNameNormalized) return []

  if (!hasSupabaseConfig || !supabase) {
    return loadPartnerServiceCapacityState().filter((record) => record.organizationNameNormalized === organizationNameNormalized)
  }

  return listPartnerServiceCapacitySubmissions(supabase, organizationNameNormalized)
}

export async function searchPartnerIdentifierRecordMatches(
  firstName: string,
  lastName: string
): Promise<PartnerIdentifierRecord[]> {
  const trimmedFirstName = firstName.trim()
  const trimmedLastName = lastName.trim()
  if (!trimmedFirstName || !trimmedLastName) return []

  if (!hasSupabaseConfig || !supabase) {
    return searchLocalPartnerIdentifierRecords(trimmedFirstName, trimmedLastName)
  }

  return searchPartnerIdentifierRecords(supabase, trimmedFirstName, trimmedLastName)
}

export async function savePartnerServiceCapacitySurvey(
  input: PartnerServiceCapacitySubmissionInput
): Promise<PartnerServiceCapacitySubmissionRecord> {
  const submittedAtIso = new Date().toISOString()
  const fallbackId = createPartnerServiceCapacityDraftKey()

  if (!hasSupabaseConfig || !supabase) {
    const nextRecord = toSubmissionRecord(input, null, submittedAtIso, fallbackId)
    persistPartnerServiceCapacityRecord(nextRecord)
    return nextRecord
  }

  const persistedRecord =
    input.status === 'completed'
      ? await savePartnerServiceCapacityRecord(supabase, input)
      : await savePartnerServiceCapacitySubmission(supabase, input)

  persistPartnerServiceCapacityRecord(persistedRecord)
  return persistedRecord
}
