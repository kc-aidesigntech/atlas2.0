import type {
  RegulationTestAnswer,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestType
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { computeAssessmentScoreSummary, isRenewalAssessmentType } from '@/features/atlas2026/singlepane/data/assessmentCatalog'

/**
 * Regulation and renewal assessment repository.
 *
 * Purpose:
 * - persists submission + answer rows with compatibility fallbacks.
 * - keeps local cache synchronized so draft/complete timelines remain resilient.
 */

const LOCAL_STORAGE_KEY = 'atlas2026.singlepane.regulation-tests.v1'

function computePassThreshold(testType: RegulationTestType, answers: RegulationTestAnswer[]) {
  return computeAssessmentScoreSummary(testType, answers).passThreshold
}

function computeScore(testType: RegulationTestType, answers: RegulationTestAnswer[]) {
  return computeAssessmentScoreSummary(testType, answers).gateScore
}

function mapSubmissionRow(
  submission: {
    id: string
    draft_key: string
    enrollee_id: string
    enrollment_id: string | null
    test_type: RegulationTestType
    status: 'draft' | 'completed'
    submitted_at: string
    updated_at: string
    enrollee_name: string
    enrollee_case_id: string
    enrollee_email: string
    total_score: number | null
    pass_threshold: number
    passed: boolean | null
  },
  answers: RegulationTestAnswer[]
): RegulationTestSubmissionRecord {
  return {
    id: submission.id,
    draftKey: submission.draft_key || submission.id,
    enrolleeId: submission.enrollee_id,
    enrollmentId: submission.enrollment_id || null,
    testType: submission.test_type,
    status: submission.status,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    enrolleeName: submission.enrollee_name,
    enrolleeCaseId: submission.enrollee_case_id,
    enrolleeEmail: submission.enrollee_email || '',
    score: submission.total_score,
    passThreshold: submission.pass_threshold,
    passed: submission.passed,
    answers
  }
}

function loadLocalState(): RegulationTestSubmissionRecord[] {
  if (typeof window === 'undefined') return []
  const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as RegulationTestSubmissionRecord[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function persistLocalState(records: RegulationTestSubmissionRecord[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records))
}

// Regulation-stage instruments only (renewal-stage types are excluded); derived from the
// catalog so a stage reclassification cannot silently desynchronize the due computation.
const REGULATION_STAGE_TEST_TYPES = (['mh_sca', 'svs', 'ipf', 'b_ipf'] as RegulationTestType[]).filter(
  (testType) => !isRenewalAssessmentType(testType)
)

/**
 * Latest completed regulation-stage submission time per enrollee.
 *
 * Feeds the forced regulation review due computation: an enrollee with no completed
 * regulation test inside the cadence window is "due now".
 */
export async function loadLatestCompletedRegulationReviewTimes(
  enrolleeIds: string[]
): Promise<Record<string, string>> {
  const normalizedIds = Array.from(new Set(enrolleeIds.map((id) => id.trim()).filter(Boolean)))
  if (!normalizedIds.length) return {}

  const reduceToLatest = (
    rows: Array<{ enrolleeId: string; submittedAtIso: string }>
  ): Record<string, string> =>
    rows.reduce<Record<string, string>>((latest, row) => {
      const existing = latest[row.enrolleeId]
      if (!existing || new Date(row.submittedAtIso).getTime() > new Date(existing).getTime()) {
        latest[row.enrolleeId] = row.submittedAtIso
      }
      return latest
    }, {})

  const reduceLocal = () =>
    reduceToLatest(
      loadLocalState()
        .filter(
          (record) =>
            record.status === 'completed' &&
            REGULATION_STAGE_TEST_TYPES.includes(record.testType) &&
            normalizedIds.includes(record.enrolleeId)
        )
        .map((record) => ({ enrolleeId: record.enrolleeId, submittedAtIso: record.submittedAtIso }))
    )

  if (!hasSupabaseConfig || !supabase) return reduceLocal()

  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_submissions')
    .select('enrollee_id,submitted_at')
    .in('enrollee_id', normalizedIds)
    .in('test_type', REGULATION_STAGE_TEST_TYPES)
    .eq('status', 'completed')
  if (error) {
    if (isOptionalSupabaseDataError(error)) return reduceLocal()
    throw error
  }
  return reduceToLatest(
    ((data || []) as Array<{ enrollee_id: string; submitted_at: string }>).map((row) => ({
      enrolleeId: row.enrollee_id,
      submittedAtIso: row.submitted_at
    }))
  )
}

export async function loadRegulationTestHistory(enrolleeId: string, testType: RegulationTestType): Promise<RegulationTestSubmissionRecord[]> {
  if (!enrolleeId.trim()) return []
  if (!hasSupabaseConfig || !supabase) {
    return loadLocalState()
      .filter((record) => record.enrolleeId === enrolleeId && record.testType === testType)
      .sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())
  }

  const { data: submissions, error } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_submissions')
    .select('*')
    .eq('enrollee_id', enrolleeId)
    .eq('test_type', testType)
    .order('updated_at', { ascending: false })

  if (error) {
    // Renewal tests are intentionally allowed to fall back to local persistence
    // because those schemas can lag behind in optional Supabase environments.
    if (isOptionalSupabaseDataError(error) || isRenewalAssessmentType(testType)) {
      return loadLocalState()
        .filter((record) => record.enrolleeId === enrolleeId && record.testType === testType)
        .sort((left, right) => new Date(right.updatedAtIso).getTime() - new Date(left.updatedAtIso).getTime())
    }
    throw error
  }

  const submissionIds = (submissions || []).map((submission: { id: string }) => submission.id)
  let answersBySubmissionId = new Map<string, RegulationTestAnswer[]>()
  if (submissionIds.length) {
    const { data: answers, error: answersError } = await (supabase as any)
      .schema('atlas')
      .from('navigator_regulation_test_answers')
      .select('*')
      .in('submission_id', submissionIds)
      .order('created_at', { ascending: true })
    if (answersError) {
      if (!isOptionalSupabaseDataError(answersError)) throw answersError
    } else {
      answersBySubmissionId = new Map<string, RegulationTestAnswer[]>()
      ;(answers || []).forEach((answer: { submission_id: string; prompt_id: string; prompt_label: string; response_value: number | null }) => {
        const existing = answersBySubmissionId.get(answer.submission_id) || []
        existing.push({
          promptId: answer.prompt_id,
          promptLabel: answer.prompt_label,
          responseValue: answer.response_value
        })
        answersBySubmissionId.set(answer.submission_id, existing)
      })
    }
  }

  // Cloud results replace only the scoped enrollee/test partition in local cache,
  // preventing unrelated local drafts from being evicted.
  const records = (submissions || []).map((submission: any) => mapSubmissionRow(submission, answersBySubmissionId.get(submission.id) || []))
  const local = loadLocalState().filter((record) => !(record.enrolleeId === enrolleeId && record.testType === testType))
  persistLocalState([...local, ...records])
  return records
}

export async function saveRegulationTestSubmission(input: RegulationTestSubmissionInput): Promise<RegulationTestSubmissionRecord> {
  const threshold = computePassThreshold(input.testType, input.answers)
  const score = computeScore(input.testType, input.answers)
  const passed = typeof score === 'number' ? score >= threshold : null
  const draftKey = input.draftKey?.trim() || `reg-test-${Date.now().toString(36)}`

  if (!hasSupabaseConfig || !supabase) {
    // Preserve identical record shape in local mode so User Interface (UI) rendering and merge logic
    // do not branch on persistence backend.
    const now = new Date().toISOString()
    const record: RegulationTestSubmissionRecord = {
      id: draftKey,
      draftKey,
      enrolleeId: input.enrolleeId,
      enrollmentId: input.enrollmentId || null,
      testType: input.testType,
      status: input.status,
      submittedAtIso: now,
      updatedAtIso: now,
      enrolleeName: input.enrolleeName,
      enrolleeCaseId: input.enrolleeCaseId,
      enrolleeEmail: input.enrolleeEmail,
      score,
      passThreshold: threshold,
      passed,
      answers: input.answers
    }
    const local = loadLocalState().filter((item) => item.id !== record.id && item.draftKey !== record.draftKey)
    persistLocalState([record, ...local])
    return record
  }

  const now = new Date().toISOString()
  // Writes go through the validated SECURITY DEFINER command RPC: the whole
  // submission (header + answers) is sent as one JSON packet and the database
  // scopes/validates it atomically. Direct table writes are revoked.
  const payload = {
    draftKey,
    enrolleeId: input.enrolleeId,
    enrollmentId: input.enrollmentId || null,
    testType: input.testType,
    status: input.status,
    enrolleeName: input.enrolleeName,
    enrolleeCaseId: input.enrolleeCaseId,
    enrolleeEmail: input.enrolleeEmail,
    totalScore: score,
    passThreshold: threshold,
    passed,
    answers: input.answers.map((answer) => ({
      promptId: answer.promptId,
      promptLabel: answer.promptLabel,
      responseValue: answer.responseValue
    }))
  }

  const { data: submissionId, error } = await (supabase as any)
    .schema('atlas')
    .rpc('fn_save_regulation_test_submission', { payload })

  if (error) {
    // Non-renewal submissions should surface hard failures; renewal can continue
    // locally to avoid blocking readiness/renewal workflow exploration.
    if (!isOptionalSupabaseDataError(error) && !isRenewalAssessmentType(input.testType)) throw error
    const fallback: RegulationTestSubmissionRecord = {
      id: draftKey,
      draftKey,
      enrolleeId: input.enrolleeId,
      enrollmentId: input.enrollmentId || null,
      testType: input.testType,
      status: input.status,
      submittedAtIso: now,
      updatedAtIso: now,
      enrolleeName: input.enrolleeName,
      enrolleeCaseId: input.enrolleeCaseId,
      enrolleeEmail: input.enrolleeEmail,
      score,
      passThreshold: threshold,
      passed,
      answers: input.answers
    }
    const local = loadLocalState().filter((item) => item.id !== fallback.id && item.draftKey !== fallback.draftKey)
    persistLocalState([fallback, ...local])
    return fallback
  }

  // The RPC returns only the submission id; rebuild the record shape from the
  // validated input plus client-computed score summary (parity with local mode).
  const saved: RegulationTestSubmissionRecord = {
    id: (submissionId as string) || draftKey,
    draftKey,
    enrolleeId: input.enrolleeId,
    enrollmentId: input.enrollmentId || null,
    testType: input.testType,
    status: input.status,
    submittedAtIso: now,
    updatedAtIso: now,
    enrolleeName: input.enrolleeName,
    enrolleeCaseId: input.enrolleeCaseId,
    enrolleeEmail: input.enrolleeEmail,
    score,
    passThreshold: threshold,
    passed,
    answers: input.answers
  }
  const local = loadLocalState().filter((item) => item.id !== saved.id && item.draftKey !== saved.draftKey)
  persistLocalState([saved, ...local])
  return saved
}

export async function deleteRegulationTestDraft(
  submissionId: string
): Promise<{ id: string; draftKey: string } | null> {
  const trimmedSubmissionId = submissionId.trim()
  if (!trimmedSubmissionId) return null
  const localMatch = loadLocalState().find((record) => record.id === trimmedSubmissionId)

  if (localMatch && isRenewalAssessmentType(localMatch.testType)) {
    // Renewal drafts are treated as local-only artifacts and can be removed
    // without requiring server round trips.
    if (localMatch.status !== 'draft') return null
    persistLocalState(loadLocalState().filter((record) => record.id !== trimmedSubmissionId))
    return { id: localMatch.id, draftKey: localMatch.draftKey }
  }

  if (!hasSupabaseConfig || !supabase) {
    const existing = localMatch
    if (!existing || existing.status !== 'draft') return null
    persistLocalState(loadLocalState().filter((record) => record.id !== trimmedSubmissionId))
    return { id: existing.id, draftKey: existing.draftKey }
  }

  const { data: submission, error: fetchError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_submissions')
    .select('id,draft_key,status')
    .eq('id', trimmedSubmissionId)
    .single()
  if (fetchError) {
    if (isOptionalSupabaseDataError(fetchError)) return null
    throw fetchError
  }
  if (!submission || submission.status !== 'draft') return null
  if (isRenewalAssessmentType(submission.test_type)) {
    persistLocalState(loadLocalState().filter((record) => record.id !== trimmedSubmissionId))
    return { id: submission.id, draftKey: submission.draft_key || submission.id }
  }

  const { error: deleteError } = await (supabase as any)
    .schema('atlas')
    .rpc('fn_delete_regulation_test_draft', { target_submission_id: trimmedSubmissionId })
  if (deleteError) {
    if (!isOptionalSupabaseDataError(deleteError)) throw deleteError
  }

  persistLocalState(loadLocalState().filter((record) => record.id !== trimmedSubmissionId))
  return { id: submission.id, draftKey: submission.draft_key || submission.id }
}
