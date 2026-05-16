import {
  ensurePartnerIdentifierRecord,
  deletePartnerServiceCapacityDraft,
  normalizeOrganizationName,
  savePartnerServiceCapacityRecord,
  searchPartnerIdentifierRecords,
  getPartnerServiceCapacitySubmissionByDraftKey,
  getLatestPartnerServiceCapacitySubmission,
  listZCodeDomainSurveyHistory,
  listPartnerServiceCapacitySubmissions,
  savePartnerServiceCapacitySubmission,
  setZCodeDomainSurveyAnswerNullification
} from '@atlas/shared'
import type {
  PartnerIdentifierRecord,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  ZCodeDomainSurveyHistorySummary
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

/**
 * Partner service-capacity repository adapter.
 *
 * Purpose:
 * - delegates persistence/search operations to shared contracts.
 * - enforces single-pane runtime preconditions for Supabase-backed workflows.
 */

export async function loadPartnerServiceCapacitySurvey(
  organizationName: string,
  draftKey?: string
): Promise<PartnerServiceCapacitySubmissionRecord | null> {
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  const trimmedDraftKey = draftKey?.trim()
  if (!organizationNameNormalized && !trimmedDraftKey) return null

  if (!hasSupabaseConfig || !supabase) {
    // Survey history is intentionally unavailable in pure local mode because
    // records are keyed to shared Supabase submissions.
    return null
  }

  if (trimmedDraftKey) {
    const draftRecord = await getPartnerServiceCapacitySubmissionByDraftKey(supabase, trimmedDraftKey)
    return draftRecord
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

export async function ensurePartnerIdentifierRecordForSurvey(
  header: {
    firstName: string
    lastName: string
    organizationName: string
    email?: string | null
  }
): Promise<PartnerIdentifierRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to create partner identifier records.')
  }

  return ensurePartnerIdentifierRecord(supabase, header)
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

export async function loadZCodeDomainSurveyHistorySummary(): Promise<ZCodeDomainSurveyHistorySummary[]> {
  if (!hasSupabaseConfig || !supabase) {
    return []
  }

  return listZCodeDomainSurveyHistory(supabase)
}

export async function setZCodeDomainSurveyAnswerNullified(input: {
  answerId: string
  isNullified: boolean
  nullifiedByEmail?: string | null
  nullifiedReason?: string | null
}) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to nullify z-code domain survey answers.')
  }

  return setZCodeDomainSurveyAnswerNullification(supabase, input)
}
