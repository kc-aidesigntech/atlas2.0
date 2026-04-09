import type {
  AdminDataQualityMetric,
  AccountSettings,
  AtlasRole,
  CountyHeatPoint,
  DomainLoadBreakdown,
  DomainLoad,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  PartnerServiceCapacitySubmissionInput,
  PartnerServiceCapacitySubmissionRecord,
  PartnerSurveyRespondentRole,
  RouteAssignmentRecord,
  RouteCandidateRecord,
  RouteLogEvent
} from '@/features/atlas2026/singlepane/types'
import {
  getLocalAdminDataQuality,
  getLocalBaseLogs,
  getLocalCountyHeatmap,
  getLocalEnrollmentRequests,
  getLocalPartnerRadialLoad,
  getLocalPartnerRadialLoadBreakdown,
  getLocalRouteCandidates,
  getLocalSinglePaneBootstrap,
  type SinglePaneBootstrapData
} from '@/features/atlas2026/singlepane/data-access/localCsvData'
import { hasSupabaseConfig, supabase } from '@/lib/supabaseClient'

const STORAGE_KEY = 'atlas2026.singlepane.logs.v3'
const ACCOUNT_SETTINGS_KEY = 'atlas2026.singlepane.account-settings.v1'
const ENROLLEE_INTAKES_KEY = 'atlas2026.singlepane.enrollee-intakes.v1'
const ROUTE_ASSIGNMENTS_KEY = 'atlas2026.singlepane.route-assignments.v1'
const PARTNER_SERVICE_CAPACITY_SURVEY_KEY = 'atlas2026.singlepane.partner-service-capacity.v1'

interface PersistedRouteLogState {
  appendedLogs: RouteLogEvent[]
  overrides: Record<string, RouteLogEvent>
}

type PersistedPartnerServiceCapacityState = Record<string, PartnerServiceCapacitySubmissionRecord>

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

function areLogsEqual(left: RouteLogEvent, right: RouteLogEvent) {
  return (
    left.id === right.id &&
    left.enrolleeId === right.enrolleeId &&
    left.label === right.label &&
    left.timestampIso === right.timestampIso &&
    left.status === right.status &&
    left.phase === right.phase &&
    left.milestoneType === right.milestoneType &&
    left.stationIcon === right.stationIcon &&
    left.timelinePositionRatio === right.timelinePositionRatio &&
    left.domainsRelieved.join('|') === right.domainsRelieved.join('|')
  )
}

function loadPersistedRouteLogState(): PersistedRouteLogState {
  if (typeof window === 'undefined') return { appendedLogs: [], overrides: {} }
  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) return { appendedLogs: [], overrides: {} }
  try {
    const parsed = JSON.parse(raw) as PersistedRouteLogState
    return {
      appendedLogs: Array.isArray(parsed?.appendedLogs) ? parsed.appendedLogs.map(normalizeLog) : [],
      overrides:
        parsed?.overrides && typeof parsed.overrides === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.overrides).map(([key, value]) => [key, normalizeLog(value as RouteLogEvent)])
            )
          : {}
    }
  } catch {
    return { appendedLogs: [], overrides: {} }
  }
}

function loadLocalLogs(): RouteLogEvent[] {
  const baseLogs = getLocalBaseLogs().map(normalizeLog)
  const { appendedLogs, overrides } = loadPersistedRouteLogState()
  return [
    ...baseLogs.map((log) => normalizeLog(overrides[log.id] ? { ...log, ...overrides[log.id] } : log)),
    ...appendedLogs.map(normalizeLog)
  ]
}

function persistLocalLogs(logs: RouteLogEvent[]) {
  if (typeof window === 'undefined') return
  const baseLogs = getLocalBaseLogs().map(normalizeLog)
  const baseLogById = new Map(baseLogs.map((log) => [log.id, log]))
  const overrides: Record<string, RouteLogEvent> = {}
  const appendedLogs: RouteLogEvent[] = []

  for (const log of logs.map(normalizeLog)) {
    const baseLog = baseLogById.get(log.id)
    if (!baseLog) {
      appendedLogs.push(log)
      continue
    }
    if (!areLogsEqual(baseLog, log)) {
      overrides[log.id] = log
    }
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ appendedLogs, overrides } satisfies PersistedRouteLogState))
}

function getDefaultAccountSettings(): AccountSettings {
  return {
    fullName: 'atlas operator',
    email: 'operator@atlas.local',
    organization: 'atlas operations',
    enabledRoles: ['administrator', 'partner', 'navigator']
  }
}

function loadAccountSettingsState(): AccountSettings {
  if (typeof window === 'undefined') return getDefaultAccountSettings()
  const raw = window.localStorage.getItem(ACCOUNT_SETTINGS_KEY)
  if (!raw) return getDefaultAccountSettings()
  try {
    const parsed = JSON.parse(raw) as Partial<AccountSettings>
    const enabledRoles = Array.isArray(parsed.enabledRoles)
      ? parsed.enabledRoles.filter((role): role is AtlasRole => ['navigator', 'partner', 'administrator'].includes(String(role)))
      : getDefaultAccountSettings().enabledRoles
    return {
      fullName: parsed.fullName || getDefaultAccountSettings().fullName,
      email: parsed.email || getDefaultAccountSettings().email,
      organization: parsed.organization || getDefaultAccountSettings().organization,
      enabledRoles: enabledRoles.length ? enabledRoles : getDefaultAccountSettings().enabledRoles
    }
  } catch {
    return getDefaultAccountSettings()
  }
}

function persistAccountSettingsState(settings: AccountSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ACCOUNT_SETTINGS_KEY, JSON.stringify(settings))
}

function loadEnrolleeIntakeState(): Record<string, EnrolleeIntakeRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(ENROLLEE_INTAKES_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, EnrolleeIntakeRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistEnrolleeIntakeState(intakes: Record<string, EnrolleeIntakeRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ENROLLEE_INTAKES_KEY, JSON.stringify(intakes))
}

function loadRouteAssignmentState(): Record<string, RouteAssignmentRecord> {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(ROUTE_ASSIGNMENTS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, RouteAssignmentRecord>
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed
  } catch {
    return {}
  }
}

function persistRouteAssignmentState(assignments: Record<string, RouteAssignmentRecord>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(ROUTE_ASSIGNMENTS_KEY, JSON.stringify(assignments))
}

function applyIntakeOverrides(enrollees: EnrolleeProfile[], intakeOverrides: Record<string, EnrolleeIntakeRecord>) {
  return enrollees.map((enrollee) => {
    const intake = intakeOverrides[enrollee.id]
    if (!intake) return enrollee
    return {
      ...enrollee,
      fullName: intake.fullName,
      dob: intake.dob,
      caseId: intake.caseId,
      email: intake.email,
      assignedNavigator: intake.assignedNavigator,
      zCodeTags: intake.zCodeTags
    }
  })
}

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

function loadPartnerServiceCapacityState(): PersistedPartnerServiceCapacityState {
  if (typeof window === 'undefined') return {}
  const raw = window.localStorage.getItem(PARTNER_SERVICE_CAPACITY_SURVEY_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as PersistedPartnerServiceCapacityState
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function persistPartnerServiceCapacityState(state: PersistedPartnerServiceCapacityState) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PARTNER_SERVICE_CAPACITY_SURVEY_KEY, JSON.stringify(state))
}

function toSubmissionRecord(input: PartnerServiceCapacitySubmissionInput, partnerId: string | null, submittedAtIso: string, id: string) {
  return {
    id,
    partnerId,
    organizationNameNormalized: normalizeOrganizationName(input.header.organizationName),
    submittedAtIso,
    updatedAtIso: submittedAtIso,
    formVersion: input.formVersion,
    header: input.header,
    answers: input.answers
  } satisfies PartnerServiceCapacitySubmissionRecord
}

function deriveCapabilityStrength(score: number) {
  if (score >= 7) return (score - 6) / 3
  if (score <= 3) return (4 - score) / 3
  return 0
}

function deriveCapabilityRelation(score: number) {
  if (score >= 7) return 'specialize' as const
  if (score <= 3) return 'interfere' as const
  return null
}

function aggregateAnswersByNormalizedZCode(input: PartnerServiceCapacitySubmissionInput) {
  const grouped = new Map<string, PartnerServiceCapacitySubmissionInput['answers'][number]>()
  input.answers.forEach((answer) => {
    const existing = grouped.get(answer.normalizedZCode)
    if (!existing || answer.score > existing.score) {
      grouped.set(answer.normalizedZCode, answer)
    }
  })
  return Array.from(grouped.values())
}

async function ensurePartnerRecord(organizationName: string) {
  if (!supabase) return null
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .schema('atlas')
    .from('partners')
    .upsert(
      {
        organization_name: organizationName.trim(),
        organization_name_normalized: organizationNameNormalized,
        updated_at: nowIso
      },
      { onConflict: 'organization_name_normalized' }
    )
    .select('id, organization_name, organization_name_normalized')
    .single()

  if (error) throw error
  return data
}

export async function loadSinglePaneBootstrap(_role: AtlasRole): Promise<SinglePaneBootstrapData> {
  const bootstrap = getLocalSinglePaneBootstrap()
  const logs = loadLocalLogs()
  const intakeOverrides = loadEnrolleeIntakeState()
  const enrollees = applyIntakeOverrides(bootstrap.enrollees, intakeOverrides)
  const timelineConfigsByEnrolleeId = Object.fromEntries(
    Object.entries(bootstrap.timelineConfigsByEnrolleeId).map(([enrolleeId, config]) => [
      enrolleeId,
      intakeOverrides[enrolleeId]?.enrollmentStartIso
        ? { ...config, planStartIso: intakeOverrides[enrolleeId].enrollmentStartIso }
        : config
    ])
  )
  const firstEnrolleeId = enrollees[0]?.id || ''
  return {
    ...bootstrap,
    enrollees,
    timelineConfigsByEnrolleeId,
    timelineConfig: timelineConfigsByEnrolleeId[firstEnrolleeId] || bootstrap.timelineConfig,
    logs
  }
}

export async function appendRouteLog(logs: RouteLogEvent[], nextLog: RouteLogEvent) {
  const finalLogs = [...logs, nextLog].map(normalizeLog)
  persistLocalLogs(finalLogs)
  return finalLogs
}

export async function saveRouteLogs(logs: RouteLogEvent[]) {
  const finalLogs = logs.map(normalizeLog)
  persistLocalLogs(finalLogs)
  return finalLogs
}

export async function loadEnrollmentRequests(role: AtlasRole): Promise<EnrollmentRequestRecord[]> {
  return getLocalEnrollmentRequests(role)
}

export async function loadRouteCandidates(activeZCodes: string[] = []): Promise<RouteCandidateRecord[]> {
  return getLocalRouteCandidates(activeZCodes)
}

export async function loadCountyHeatmap(): Promise<CountyHeatPoint[]> {
  return getLocalCountyHeatmap()
}

export async function loadAdminDataQuality(): Promise<AdminDataQualityMetric[]> {
  return getLocalAdminDataQuality()
}

export async function loadJourneyStationMarkers(enrollmentId?: string): Promise<JourneyStationMarker[]> {
  if (!enrollmentId) return []
  const historyMarkers = loadLocalLogs()
    .filter((log) => log.enrolleeId === enrollmentId && log.phase !== 'regulation')
    .map((log, index) => ({
      id: `station-marker-${log.id}`,
      stationName: index === 0 ? 'partner station' : `partner station ${index + 1}`,
      assignedAtIso: log.timestampIso,
      phase: log.phase,
      iconSlug: log.stationIcon,
      markerType: 'history' as const
    }))
  const selectedAssignment = loadRouteAssignmentState()[enrollmentId]
  if (!selectedAssignment) return historyMarkers
  return [
    ...historyMarkers,
    {
      id: `route-assignment-${selectedAssignment.enrolleeId}`,
      stationName: selectedAssignment.stationName,
      assignedAtIso: selectedAssignment.assignedAtIso,
      phase: selectedAssignment.phase,
      markerType: 'selected'
    }
  ]
}

export async function loadPartnerRadialLoad(): Promise<DomainLoad | null> {
  return getLocalPartnerRadialLoad()
}

export async function loadPartnerRadialLoadBreakdown(): Promise<DomainLoadBreakdown | null> {
  return getLocalPartnerRadialLoadBreakdown()
}

export async function loadAccountSettings(): Promise<AccountSettings> {
  return loadAccountSettingsState()
}

export async function saveAccountSettings(settings: AccountSettings): Promise<AccountSettings> {
  persistAccountSettingsState(settings)
  return settings
}

export async function loadEnrolleeIntakes(): Promise<Record<string, EnrolleeIntakeRecord>> {
  return loadEnrolleeIntakeState()
}

export async function saveEnrolleeIntake(intake: EnrolleeIntakeRecord): Promise<EnrolleeIntakeRecord> {
  const nextState = {
    ...loadEnrolleeIntakeState(),
    [intake.enrolleeId]: intake
  }
  persistEnrolleeIntakeState(nextState)
  return intake
}

export async function loadRouteAssignments(): Promise<Record<string, RouteAssignmentRecord>> {
  return loadRouteAssignmentState()
}

export async function saveRouteAssignment(assignment: RouteAssignmentRecord): Promise<RouteAssignmentRecord> {
  const nextState = {
    ...loadRouteAssignmentState(),
    [assignment.enrolleeId]: assignment
  }
  persistRouteAssignmentState(nextState)
  return assignment
}

export async function loadPartnerServiceCapacitySurvey(organizationName: string): Promise<PartnerServiceCapacitySubmissionRecord | null> {
  const organizationNameNormalized = normalizeOrganizationName(organizationName)
  if (!organizationNameNormalized) return null

  if (!hasSupabaseConfig || !supabase) {
    return loadPartnerServiceCapacityState()[organizationNameNormalized] || null
  }

  const { data: submissions, error } = await supabase
    .schema('atlas')
    .from('partner_service_capacity_submissions')
    .select('*')
    .eq('organization_name_normalized', organizationNameNormalized)
    .order('submitted_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const submission = submissions?.[0]
  if (!submission) return null

  const { data: answers, error: answersError } = await supabase
    .schema('atlas')
    .from('partner_service_capacity_answers')
    .select('*')
    .eq('submission_id', submission.id)
    .order('created_at', { ascending: true })

  if (answersError) throw answersError

  return {
    id: submission.id,
    partnerId: submission.partner_id || null,
    organizationNameNormalized: submission.organization_name_normalized,
    submittedAtIso: submission.submitted_at,
    updatedAtIso: submission.updated_at || submission.submitted_at,
    formVersion: submission.form_version,
    header: {
      firstName: submission.respondent_first_name,
      lastName: submission.respondent_last_name,
      organizationName: submission.organization_name,
      jobTitle: submission.job_title || '',
      respondentRoles: (submission.respondent_roles || []) as PartnerSurveyRespondentRole[],
      otherRoleText: submission.other_role_text || ''
    },
    answers: (answers || []).map((answer) => ({
      promptId: answer.prompt_id,
      parentCode: answer.parent_code,
      zCode: answer.z_code,
      normalizedZCode: answer.normalized_z_code,
      title: answer.title,
      description: answer.description || '',
      score: answer.burden_score
    }))
  }
}

export async function savePartnerServiceCapacitySurvey(
  input: PartnerServiceCapacitySubmissionInput
): Promise<PartnerServiceCapacitySubmissionRecord> {
  const submittedAtIso = new Date().toISOString()
  const organizationNameNormalized = normalizeOrganizationName(input.header.organizationName)
  const fallbackId = `partner-survey-${Date.now().toString(36)}`

  if (!hasSupabaseConfig || !supabase) {
    const nextRecord = toSubmissionRecord(input, null, submittedAtIso, fallbackId)
    const nextState = {
      ...loadPartnerServiceCapacityState(),
      [organizationNameNormalized]: nextRecord
    }
    persistPartnerServiceCapacityState(nextState)
    return nextRecord
  }

  const partner = await ensurePartnerRecord(input.header.organizationName)
  const partnerId = partner?.id || null

  const { data: insertedSubmission, error: submissionError } = await supabase
    .schema('atlas')
    .from('partner_service_capacity_submissions')
    .insert({
      partner_id: partnerId,
      organization_name: input.header.organizationName.trim(),
      organization_name_normalized: organizationNameNormalized,
      respondent_first_name: input.header.firstName.trim(),
      respondent_last_name: input.header.lastName.trim(),
      job_title: input.header.jobTitle.trim() || null,
      respondent_roles: input.header.respondentRoles,
      other_role_text: input.header.otherRoleText.trim() || null,
      form_version: input.formVersion,
      raw_payload: input
    })
    .select('*')
    .single()

  if (submissionError) throw submissionError

  const submissionId = insertedSubmission.id
  const answerRows = input.answers.map((answer) => ({
    submission_id: submissionId,
    prompt_id: answer.promptId,
    parent_code: answer.parentCode,
    z_code: answer.zCode,
    normalized_z_code: answer.normalizedZCode,
    title: answer.title,
    description: answer.description,
    burden_score: answer.score
  }))

  const { error: answerError } = await supabase.schema('atlas').from('partner_service_capacity_answers').insert(answerRows)
  if (answerError) throw answerError

  const normalizedAnswers = aggregateAnswersByNormalizedZCode(input)
  const normalizedZCodes = normalizedAnswers.map((answer) => answer.normalizedZCode)
  const { data: zCodeRows, error: zCodeLookupError } = await supabase
    .schema('atlas')
    .from('z_codes')
    .select('id, z_code')
    .in('z_code', normalizedZCodes)

  if (zCodeLookupError) throw zCodeLookupError
  const zCodeIdByCode = new Map((zCodeRows || []).map((row) => [row.z_code, row.id]))

  if (partnerId) {
    const burdenRows = normalizedAnswers
      .map((answer) => {
        const zCodeId = zCodeIdByCode.get(answer.normalizedZCode)
        if (!zCodeId) return null
        return {
          partner_id: partnerId,
          submission_id: submissionId,
          z_code_id: zCodeId,
          z_code: answer.normalizedZCode,
          burden_score: answer.score,
          derived_relation_type: deriveCapabilityRelation(answer.score),
          strength: deriveCapabilityStrength(answer.score),
          updated_at: submittedAtIso
        }
      })
      .filter(Boolean)

    if (burdenRows.length) {
      const { error: burdenError } = await supabase
        .schema('atlas')
        .from('partner_z_code_burden_scores')
        .upsert(burdenRows, { onConflict: 'partner_id,z_code_id' })
      if (burdenError) throw burdenError
    }

    const capabilityRows = normalizedAnswers.flatMap((answer) => {
      const zCodeId = zCodeIdByCode.get(answer.normalizedZCode)
      if (!zCodeId) return []
      const strength = deriveCapabilityStrength(answer.score)
      return [
        {
          partner_id: partnerId,
          z_code_id: zCodeId,
          relation_type: 'specialize',
          strength: answer.score >= 7 ? strength : 0,
          source: 'service_capacity_survey',
          source_submitted_at: submittedAtIso,
          is_active: answer.score >= 7
        },
        {
          partner_id: partnerId,
          z_code_id: zCodeId,
          relation_type: 'interfere',
          strength: answer.score <= 3 ? strength : 0,
          source: 'service_capacity_survey',
          source_submitted_at: submittedAtIso,
          is_active: answer.score <= 3
        }
      ]
    })

    if (capabilityRows.length) {
      const { error: capabilityError } = await supabase
        .schema('atlas')
        .from('partner_z_code_capabilities')
        .upsert(capabilityRows, { onConflict: 'partner_id,z_code_id,relation_type,source' })
      if (capabilityError) throw capabilityError
    }
  }

  return toSubmissionRecord(input, partnerId, insertedSubmission.submitted_at || submittedAtIso, submissionId)
}
