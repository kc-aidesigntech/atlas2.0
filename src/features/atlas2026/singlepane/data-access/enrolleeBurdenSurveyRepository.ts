import {
  deleteEnrolleeBurdenDraft,
  getEnrolleeBurdenSubmissionByDraftKey,
  listEnrolleeBurdenSubmissions,
  listLatestCompletedEnrolleeBurdenSubmissions,
  saveEnrolleeBurdenSubmission
} from '@atlas/shared'
import type {
  EnrolleeBurdenSurveySubmissionInput,
  EnrolleeBurdenSurveySubmissionRecord
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

export async function loadEnrolleeBurdenSurvey(
  enrollmentId: string,
  draftKey?: string
): Promise<EnrolleeBurdenSurveySubmissionRecord | null> {
  const trimmedEnrollmentId = enrollmentId.trim()
  const trimmedDraftKey = draftKey?.trim()
  if (!trimmedEnrollmentId && !trimmedDraftKey) return null

  if (!hasSupabaseConfig || !supabase) {
    return null
  }

  if (trimmedDraftKey) {
    return getEnrolleeBurdenSubmissionByDraftKey(supabase, trimmedDraftKey)
  }

  if (!trimmedEnrollmentId) return null
  const history = await listEnrolleeBurdenSubmissions(supabase, trimmedEnrollmentId)
  return history[0] || null
}

export async function loadEnrolleeBurdenSurveyHistory(
  enrollmentId: string
): Promise<EnrolleeBurdenSurveySubmissionRecord[]> {
  const trimmedEnrollmentId = enrollmentId.trim()
  if (!trimmedEnrollmentId) return []

  if (!hasSupabaseConfig || !supabase) {
    return []
  }

  return listEnrolleeBurdenSubmissions(supabase, trimmedEnrollmentId)
}

export async function loadLatestEnrolleeBurdenSurveySubmissions(): Promise<
  EnrolleeBurdenSurveySubmissionRecord[]
> {
  if (!hasSupabaseConfig || !supabase) {
    return []
  }

  return listLatestCompletedEnrolleeBurdenSubmissions(supabase)
}

export async function saveEnrolleeBurdenSurvey(
  input: EnrolleeBurdenSurveySubmissionInput
): Promise<EnrolleeBurdenSurveySubmissionRecord> {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to save enrollee burden survey records.')
  }

  return saveEnrolleeBurdenSubmission(supabase, input)
}

export async function deleteEnrolleeBurdenSurveyDraftRecord(submissionId: string) {
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to delete enrollee burden survey drafts.')
  }

  return deleteEnrolleeBurdenDraft(supabase, submissionId)
}
