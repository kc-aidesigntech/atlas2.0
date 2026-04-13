import {
  deletePartnerServiceCapacityDraft,
  normalizeOrganizationName,
  savePartnerServiceCapacityRecord,
  searchPartnerIdentifierRecords,
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

export async function loadPartnerServiceCapacitySurvey(
  organizationName: string,
  draftKey?: string
): Promise<PartnerServiceCapacitySubmissionRecord | null> {
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  const trimmedDraftKey = draftKey?.trim()
  if (!organizationNameNormalized && !trimmedDraftKey) return null

  if (!hasSupabaseConfig || !supabase) {
    return null
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
    return []
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
    return []
  }

  return searchPartnerIdentifierRecords(supabase, trimmedFirstName, trimmedLastName)
}

export async function savePartnerServiceCapacitySurvey(
  input: PartnerServiceCapacitySubmissionInput
): Promise<PartnerServiceCapacitySubmissionRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to save partner service capacity records.')
  }

  const persistedRecord =
    input.status === 'completed'
      ? await savePartnerServiceCapacityRecord(supabase, input)
      : await savePartnerServiceCapacitySubmission(supabase, input)

  return persistedRecord
}

export async function deletePartnerServiceCapacityDraftRecord(
  submissionId: string
): Promise<{ id: string; draftKey: string }> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to delete partner service capacity draft records.')
  }

  return deletePartnerServiceCapacityDraft(supabase, submissionId)
}
