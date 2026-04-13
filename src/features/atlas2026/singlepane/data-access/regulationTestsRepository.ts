import type {
  RegulationTestAnswer,
  RegulationTestSubmissionInput,
  RegulationTestSubmissionRecord,
  RegulationTestType
} from '@/features/atlas2026/singlepane/types'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'

const LOCAL_STORAGE_KEY = 'atlas2026.singlepane.regulation-tests.v1'

function computePassThreshold(testType: RegulationTestType) {
  return testType === 'mh_sca' ? 126 : 60
}

function computeScore(testType: RegulationTestType, answers: RegulationTestAnswer[]) {
  const numericValues = answers.map((answer) => (typeof answer.responseValue === 'number' ? answer.responseValue : 0))
  if (!numericValues.length) return null
  if (testType === 'mh_sca') {
    return numericValues.reduce((sum, value) => sum + value, 0)
  }
  const average = numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
  return Number(average.toFixed(2))
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
    if (isOptionalSupabaseDataError(error)) {
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

  const records = (submissions || []).map((submission: any) => mapSubmissionRow(submission, answersBySubmissionId.get(submission.id) || []))
  const local = loadLocalState().filter((record) => !(record.enrolleeId === enrolleeId && record.testType === testType))
  persistLocalState([...local, ...records])
  return records
}

export async function saveRegulationTestSubmission(input: RegulationTestSubmissionInput): Promise<RegulationTestSubmissionRecord> {
  const threshold = computePassThreshold(input.testType)
  const score = computeScore(input.testType, input.answers)
  const passed = typeof score === 'number' ? score >= threshold : null
  const draftKey = input.draftKey?.trim() || `reg-test-${Date.now().toString(36)}`

  if (!hasSupabaseConfig || !supabase) {
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
  const { data: submission, error } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_submissions')
    .upsert(
      {
        draft_key: draftKey,
        enrollee_id: input.enrolleeId,
        enrollment_id: input.enrollmentId || null,
        test_type: input.testType,
        status: input.status,
        enrollee_name: input.enrolleeName,
        enrollee_case_id: input.enrolleeCaseId,
        enrollee_email: input.enrolleeEmail,
        total_score: score,
        pass_threshold: threshold,
        passed,
        submitted_at: now,
        updated_at: now
      },
      { onConflict: 'enrollee_id,test_type,draft_key' }
    )
    .select('*')
    .single()

  if (error) {
    if (!isOptionalSupabaseDataError(error)) throw error
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

  const { error: deleteAnswersError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_answers')
    .delete()
    .eq('submission_id', submission.id)
  if (deleteAnswersError && !isOptionalSupabaseDataError(deleteAnswersError)) throw deleteAnswersError

  if (input.answers.length) {
    const { error: answersInsertError } = await (supabase as any)
      .schema('atlas')
      .from('navigator_regulation_test_answers')
      .insert(
        input.answers.map((answer) => ({
          submission_id: submission.id,
          prompt_id: answer.promptId,
          prompt_label: answer.promptLabel,
          response_value: answer.responseValue
        }))
      )
    if (answersInsertError && !isOptionalSupabaseDataError(answersInsertError)) throw answersInsertError
  }

  const saved = mapSubmissionRow(submission, input.answers)
  const local = loadLocalState().filter((item) => item.id !== saved.id && item.draftKey !== saved.draftKey)
  persistLocalState([saved, ...local])
  return saved
}

export async function deleteRegulationTestDraft(
  submissionId: string
): Promise<{ id: string; draftKey: string } | null> {
  const trimmedSubmissionId = submissionId.trim()
  if (!trimmedSubmissionId) return null

  if (!hasSupabaseConfig || !supabase) {
    const existing = loadLocalState().find((record) => record.id === trimmedSubmissionId)
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

  const { error: deleteError } = await (supabase as any)
    .schema('atlas')
    .from('navigator_regulation_test_submissions')
    .delete()
    .eq('id', trimmedSubmissionId)
  if (deleteError) {
    if (!isOptionalSupabaseDataError(deleteError)) throw deleteError
  }

  persistLocalState(loadLocalState().filter((record) => record.id !== trimmedSubmissionId))
  return { id: submission.id, draftKey: submission.draft_key || submission.id }
}
