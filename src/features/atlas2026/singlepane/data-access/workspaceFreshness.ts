/**
 * Cheap "what changed" read for the workspace.
 *
 * One Remote Procedure Call (RPC) returns a revision per visible enrollment.
 * Smaller tables contribute id plus timestamp only. The shell compares that
 * index to the remembered load and skips any collection whose revisions match.
 */
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'
import { isOptionalSupabaseDataError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { revisionMapsMatch } from '@/features/atlas2026/singlepane/data-access/rememberedRecords'

export type WorkspaceFreshness = {
  reliable: boolean
  enrollments: Record<string, string>
  roleNavigation: string
  appConfig: string
  burdenSurveys: Record<string, string>
  partnerSurveys: Record<string, string>
  competency: Record<string, string>
  enrollmentRequests: Record<string, string>
}

const EMPTY_FRESHNESS: WorkspaceFreshness = {
  reliable: false,
  enrollments: {},
  roleNavigation: '',
  appConfig: '',
  burdenSurveys: {},
  partnerSurveys: {},
  competency: {},
  enrollmentRequests: {}
}

function asRevisionMap(rows: Array<{ id: string; revision: string }> | null) {
  if (!rows) return null
  return Object.fromEntries(rows.map((row) => [row.id, row.revision]))
}

async function readIdRevisions(
  table: string,
  columns: string,
  idColumn: string,
  revisionOf: (row: Record<string, unknown>) => string
): Promise<Record<string, string> | null> {
  if (!supabase) return null
  const { data, error } = await supabase.schema('atlas').from(table).select(columns)
  if (error) {
    if (isOptionalSupabaseDataError(error)) return {}
    return null
  }
  const rows = ((data || []) as unknown as Array<Record<string, unknown>>).map((row) => ({
    id: String(row[idColumn] || ''),
    revision: revisionOf(row)
  }))
  return asRevisionMap(rows.filter((row) => row.id)) 
}

export async function readWorkspaceFreshness(): Promise<WorkspaceFreshness> {
  if (!hasSupabaseConfig || !supabase) return EMPTY_FRESHNESS

  const [revisionRows, burdenSurveys, partnerSurveys, competency, enrollmentRequests] = await Promise.all([
    supabase.schema('atlas').rpc('fn_workspace_record_revisions'),
    readIdRevisions('enrollee_burden_survey_submissions', 'id,updated_at,status,submitted_at', 'id', (row) =>
      `${String(row.updated_at || '')}|${String(row.status || '')}|${String(row.submitted_at || '')}`
    ),
    readIdRevisions('partner_service_capacity_submissions', 'id,updated_at,status,submitted_at', 'id', (row) =>
      `${String(row.updated_at || '')}|${String(row.status || '')}|${String(row.submitted_at || '')}`
    ),
    readCompetencyRevisions(),
    readIdRevisions(
      'v_navigator_enrollment_requests',
      'request_id,submitted_at,status,prospective_enrollee,email',
      'request_id',
      (row) =>
        `${String(row.submitted_at || '')}|${String(row.status || '')}|${String(row.prospective_enrollee || '')}|${String(row.email || '')}`
    )
  ])

  if (revisionRows.error) {
    // Missing function means this database has not been migrated yet. The
    // shell still paints memory, then falls back to a full reload.
    if (isOptionalSupabaseDataError(revisionRows.error)) return EMPTY_FRESHNESS
    const code = (revisionRows.error as { code?: string }).code
    if (code === 'PGRST202' || code === '42883') return EMPTY_FRESHNESS
    return EMPTY_FRESHNESS
  }

  const enrollments: Record<string, string> = {}
  let roleNavigation = ''
  let appConfig = ''
  for (const row of revisionRows.data || []) {
    const dataset = String(row.dataset || '')
    const recordId = String(row.record_id || '')
    const revision = String(row.revision || '')
    if (dataset === 'enrollment' && recordId) enrollments[recordId] = revision
    if (dataset === 'role_navigation') roleNavigation = revision
    if (dataset === 'app_config') appConfig = revision
  }

  const reliable = Boolean(burdenSurveys && partnerSurveys && competency && enrollmentRequests)
  return {
    reliable,
    enrollments,
    roleNavigation,
    appConfig,
    burdenSurveys: burdenSurveys || {},
    partnerSurveys: partnerSurveys || {},
    competency: competency || {},
    enrollmentRequests: enrollmentRequests || {}
  }
}

async function readCompetencyRevisions(): Promise<Record<string, string> | null> {
  if (!supabase) return null
  const [assessments, answers] = await Promise.all([
    supabase.schema('atlas').from('navigator_competency_assessments').select('id,assessed_at,notes'),
    supabase.schema('atlas').from('navigator_competency_assessment_answers').select('assessment_id,normalized_z_code,competency_score')
  ])
  if (assessments.error || answers.error) {
    const error = assessments.error || answers.error
    if (isOptionalSupabaseDataError(error)) return {}
    return null
  }
  const scoresByAssessment = new Map<string, string[]>()
  for (const row of answers.data || []) {
    const assessmentId = String(row.assessment_id || '')
    if (!assessmentId) continue
    const current = scoresByAssessment.get(assessmentId) || []
    current.push(`${String(row.normalized_z_code || '')}:${String(row.competency_score ?? '')}`)
    scoresByAssessment.set(assessmentId, current)
  }
  const revisions: Record<string, string> = {}
  for (const row of assessments.data || []) {
    const id = String(row.id || '')
    if (!id) continue
    const scores = (scoresByAssessment.get(id) || []).sort().join(',')
    revisions[id] = `${String(row.assessed_at || '')}|${String(row.notes || '')}|${scores}`
  }
  return revisions
}

export async function readRememberedUserId() {
  if (!hasSupabaseConfig || !supabase) return null
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id || null
}

export function unchangedExceptEnrollments(previous: WorkspaceFreshness, next: WorkspaceFreshness) {
  if (!previous.reliable || !next.reliable) return false
  return (
    previous.roleNavigation === next.roleNavigation &&
    previous.appConfig === next.appConfig &&
    revisionMapsMatch(previous.burdenSurveys, next.burdenSurveys) &&
    revisionMapsMatch(previous.partnerSurveys, next.partnerSurveys) &&
    revisionMapsMatch(previous.competency, next.competency) &&
    revisionMapsMatch(previous.enrollmentRequests, next.enrollmentRequests)
  )
}

export function freshnessMatches(previous: WorkspaceFreshness | null | undefined, next: WorkspaceFreshness) {
  if (!previous?.reliable || !next.reliable) return false
  return (
    previous.roleNavigation === next.roleNavigation &&
    previous.appConfig === next.appConfig &&
    revisionMapsMatch(previous.enrollments, next.enrollments) &&
    revisionMapsMatch(previous.burdenSurveys, next.burdenSurveys) &&
    revisionMapsMatch(previous.partnerSurveys, next.partnerSurveys) &&
    revisionMapsMatch(previous.competency, next.competency) &&
    revisionMapsMatch(previous.enrollmentRequests, next.enrollmentRequests)
  )
}
