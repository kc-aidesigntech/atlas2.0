import type {
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeZCodeResolutionInput,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  NavigatorEnrollmentAssignmentRecord,
  PartnerStationProfile,
  RouteCandidateRecord,
  UnassignedEnrolleePickupRecord
} from '@/features/atlas2026/singlepane/types'
import {
  fetchAppRoleNavigation,
  fetchEnrollmentAssignmentBoard,
  fetchNavigatorAssignedEnrollees,
  fetchPartnerLoadBreakdown,
  setEnrolleeZCodeResolution as persistEnrolleeZCodeResolution,
  fetchSinglePaneAdminMetrics,
  fetchSinglePaneCountyHeatmap,
  fetchSinglePaneEnrolleeDomainLoadBreakdown,
  fetchSinglePaneEnrolleeDomainLoads,
  fetchSinglePaneEnrolleeProfiles,
  fetchSinglePaneEnrollmentRequests,
  fetchSinglePaneRouteCandidates,
  fetchSinglePaneTimelineConfig
} from '@atlas/shared'
import { fetchEnrollmentStationMarkers } from '@atlas/shared'
import { hasSupabaseConfig, isSinglePaneSupabaseBootstrapEnabled, supabase } from '@/lib/supabaseClient'
import {
  applyIntakeOverrides,
  loadAdminPortalRegistry,
  loadAccountSettings,
  loadEnrolleeIntakes,
  loadNavigatorProgramState,
  loadPartnerTroubleshootingGrants,
  loadRouteAssignments,
  loadTimelineConfigs,
  saveAdminPortalRegistry,
  saveAccountSettings,
  saveEnrolleeIntake,
  saveNavigatorProgramState,
  savePartnerTroubleshootingGrant,
  saveRouteAssignment,
  saveTimelineConfig
} from '@/features/atlas2026/singlepane/data-access/localStateRepository'
import {
  appendRouteLog,
  loadLocalLogs,
  saveRouteLogs
} from '@/features/atlas2026/singlepane/data-access/routeLogRepository'
import {
  loadNavigatorCompetencyAssessments,
  saveNavigatorCompetencyAssessment
} from '@/features/atlas2026/singlepane/data-access/navigatorAssessmentRepository'
import {
  deleteEnrolleeBurdenSurveyDraftRecord,
  loadEnrolleeBurdenSurvey,
  loadEnrolleeBurdenSurveyHistory,
  loadLatestEnrolleeBurdenSurveySubmissions,
  saveEnrolleeBurdenSurvey
} from '@/features/atlas2026/singlepane/data-access/enrolleeBurdenSurveyRepository'
import {
  deletePartnerServiceCapacityDraftRecord,
  ensurePartnerIdentifierRecordForSurvey,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  savePartnerServiceCapacitySurvey,
  searchPartnerIdentifierRecordMatches
} from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'
import {
  loadAccessMatrixDataset,
  saveAccessMatrixEnrollmentNavigators,
  saveAccessMatrixPartnerPrimaryContacts,
  saveAccessMatrixPersonRoles,
  saveAccessMatrixSupervisorAssignments
} from '@/features/atlas2026/singlepane/data-access/accessMatrixRepository'
import { toNormalizedRadialDomainLoad } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { splitFullName } from '@/features/atlas2026/singlepane/personNameUtils'
import { createDefaultTimelineConfig } from '@/features/atlas2026/singlepane/timelineConfigUtils'

export interface SinglePaneBootstrapData {
  enrollees: import('@/features/atlas2026/singlepane/types').EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: import('@/features/atlas2026/singlepane/types').RoleMenuConfig[]
  timelineConfig: import('@/features/atlas2026/singlepane/types').TimelineConfig
  timelineConfigsByEnrolleeId: Record<string, import('@/features/atlas2026/singlepane/types').TimelineConfig>
  logs: import('@/features/atlas2026/singlepane/types').RouteLogEvent[]
}

const routeCandidatesCache = new Map<string, RouteCandidateRecord[]>()
const routeCandidatesInFlight = new Map<string, Promise<RouteCandidateRecord[]>>()
const journeyStationMarkersCache = new Map<string, JourneyStationMarker[]>()
const journeyStationMarkersInFlight = new Map<string, Promise<JourneyStationMarker[]>>()
const DEMO_NAVIGATOR_NAME = 'atlas demo navigator'
let demoTagsTableUnavailable = false

export interface ReferralClaimMaterializationResult {
  enrollmentId: string
  enrolleeId: string
  enrolleeName: string
  createdAtIso: string
}

function normalizeNavigatorTopMenus(menus: string[]) {
  const normalized = menus
    .map((menu) => {
      const lower = menu.trim().toLowerCase()
      if (lower === 'assigned enrollees') return 'enrollees'
      if (lower === 'requests to enroll') return 'my profile'
      if (lower === 'referral portal') return 'refer'
      return menu
    })
    .filter((menu) => menu.trim().toLowerCase() !== 'route planning')

  if (!normalized.some((menu) => menu.trim().toLowerCase() === 'enrollees')) {
    normalized.unshift('enrollees')
  }
  return normalized
}

function normalizeRoleTopMenus(roleKey: string, menus: string[]) {
  if (roleKey === 'navigator') return normalizeNavigatorTopMenus(menus)
  if (roleKey === 'partner') return ['referral portal', 'my station', 'service capacity', 'county commons']
  if (roleKey === 'supervisor') {
    const normalized = menus.filter((menu) => menu.trim().toLowerCase() !== 'route planning')
    return normalized.includes('referral portal') ? normalized : ['referral portal', ...normalized]
  }
  return menus
}

function buildAdminSupersetMenus(roleConfigs: Array<{ role: AtlasRole; topMenus: string[]; actionMenus: string[] }>) {
  const topMenus = new Set<string>()
  const actionMenus = new Set<string>()
  const orderedRolePriority: AtlasRole[] = ['navigator', 'partner', 'supervisor', 'administrator']
  for (const roleKey of orderedRolePriority) {
    const config = roleConfigs.find((item) => item.role === roleKey)
    if (!config) continue
    for (const menu of config.topMenus) {
      topMenus.add(menu)
    }
    for (const action of config.actionMenus) {
      actionMenus.add(action)
    }
  }
  return {
    topMenus: Array.from(topMenus),
    actionMenus: Array.from(actionMenus)
  }
}

function dedupeProfilesByEnrollmentId<T extends { enrollmentId?: string; enrolleeId?: string }>(profiles: T[]) {
  const seen = new Set<string>()
  return profiles.filter((profile) => {
    const key = profile.enrollmentId || profile.enrolleeId || ''
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function deriveParentCodesForAssignmentBoard(profile: {
  activeZCodeDetails?: Array<{ parentCode?: string }>
  zCodeTags?: string[]
}) {
  const fromDetails = (profile.activeZCodeDetails || [])
    .map((detail) => String(detail.parentCode || '').trim().toUpperCase())
    .filter((code) => /^Z\d{2}$/.test(code))

  const source = fromDetails.length
    ? fromDetails
    : (profile.zCodeTags || [])
        .map((tag) => {
          const match = String(tag || '')
            .trim()
            .toUpperCase()
            .match(/^Z(\d{2})/)
          return match ? `Z${match[1]}` : ''
        })
        .filter((code) => /^Z\d{2}$/.test(code))

  return Array.from(new Set(source)).sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
}

function normalizeRosterAssignedNavigatorLabel(value: string | null | undefined) {
  const normalized = (value || '').trim()
  if (!normalized) return ''
  return normalized.toLowerCase() === 'unassigned' ? '' : normalized
}

function createEmptyBootstrap(logs: import('@/features/atlas2026/singlepane/types').RouteLogEvent[]): SinglePaneBootstrapData {
  return {
    enrollees: [],
    loads: [],
    loadBreakdownsByEnrolleeId: {},
    roleConfigs: [],
    timelineConfig: createDefaultTimelineConfig(),
    timelineConfigsByEnrolleeId: {},
    logs
  }
}

async function resolveCurrentPersonId() {
  if (!supabase) return null
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  const appMetadata = sessionData.session?.user?.app_metadata || {}
  const metadataPersonId =
    String((appMetadata as Record<string, unknown>).person_id || (appMetadata as Record<string, unknown>).atlas_person_id || '').trim()
  if (metadataPersonId) return metadataPersonId
  const { data: helperData, error: helperError } = await (supabase as any).schema('atlas').rpc('fn_current_person_id')
  if (helperError) {
    const helperCode = (helperError as { code?: string } | null)?.code
    if (helperCode === 'PGRST202') return null
    throw helperError
  }
  if (typeof helperData === 'string' && helperData.trim()) return helperData
  if (Array.isArray(helperData) && helperData.length) {
    const firstRow = helperData[0] as Record<string, unknown>
    const keyedValue = String(firstRow.fn_current_person_id || firstRow.id || '').trim()
    if (keyedValue) return keyedValue
  }
  if (helperData && typeof helperData === 'object') {
    const keyedValue = String((helperData as Record<string, unknown>).fn_current_person_id || '').trim()
    if (keyedValue) return keyedValue
  }
  return null
}

export async function loadSinglePaneBootstrap(role: AtlasRole): Promise<SinglePaneBootstrapData> {
  const logs = await loadLocalLogs()
  const intakeOverrides = await loadEnrolleeIntakes()
  const timelineOverrides = await loadTimelineConfigs()

  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) {
    return createEmptyBootstrap(logs)
  }

  const [roleNavigation, timelineDefaults] = await Promise.all([
    withOptionalSupabaseFallback('singlepane.roleNavigation', () => fetchAppRoleNavigation(supabase, 'singlepane'), []),
    withOptionalSupabaseFallback(
      'singlepane.timelineDefaults',
      () => fetchSinglePaneTimelineConfig(supabase),
      createDefaultTimelineConfig()
    )
  ])

  const shouldLoadEnrolleeDomain = role !== 'partner'
  const [profiles, loadRows, breakdownRows, navigatorAssignedEnrollees, navigatorPersonId] = shouldLoadEnrolleeDomain
    ? await Promise.all([
        withOptionalSupabaseFallback('singlepane.enrolleeProfiles', () => fetchSinglePaneEnrolleeProfiles(supabase), []),
        withOptionalSupabaseFallback('singlepane.enrolleeDomainLoads', () => fetchSinglePaneEnrolleeDomainLoads(supabase), []),
        withOptionalSupabaseFallback(
          'singlepane.enrolleeDomainLoadBreakdown',
          () => fetchSinglePaneEnrolleeDomainLoadBreakdown(supabase),
          []
        ),
        role === 'navigator'
          ? withOptionalSupabaseFallback('singlepane.navigatorAssignedEnrollees', () => fetchNavigatorAssignedEnrollees(supabase), [])
          : Promise.resolve([]),
        role === 'navigator'
          ? withOptionalSupabaseFallback('singlepane.navigatorPerson', () => resolveCurrentPersonId(), null)
          : Promise.resolve(null)
      ])
    : [[], [], [], [], null]

  const navigatorEnrollmentIds =
    role === 'navigator'
      ? new Set(
          navigatorAssignedEnrollees
            .filter((record) => (navigatorPersonId ? record.navigatorPersonId === navigatorPersonId : false))
            .map((record) => record.enrollmentId)
        )
      : null
  const visibleProfiles =
    role === 'navigator'
      ? profiles.filter((profile) => navigatorEnrollmentIds?.has(profile.enrollmentId))
      : profiles
  const uniqueVisibleProfiles = dedupeProfilesByEnrollmentId(visibleProfiles)
  const visibleLoadRows =
    role === 'navigator'
      ? loadRows.filter((row) => navigatorEnrollmentIds?.has(row.enrollmentId))
      : loadRows
  const visibleBreakdownRows =
    role === 'navigator'
      ? breakdownRows.filter((row) => navigatorEnrollmentIds?.has(row.enrollmentId))
      : breakdownRows

  const bootstrapEnrollees = uniqueVisibleProfiles.map((profile) => ({
    id: profile.enrolleeId,
    enrollmentId: profile.enrollmentId,
    fullName: profile.fullName,
    dob: profile.dob,
    caseId: profile.caseId,
    email: profile.email,
    avatarUrl: profile.avatarUrl || undefined,
    assignedNavigator: profile.assignedNavigator,
    zCodeTags: profile.zCodeTags,
    activeZCodeDetails: profile.activeZCodeDetails,
    completedParentCodes: profile.completedParentCodes
  }))

  const normalizedRoleConfigs = roleNavigation.map((item) => ({
    role: item.roleKey as AtlasRole,
    topMenus: normalizeRoleTopMenus(item.roleKey, item.topMenus),
    actionMenus: item.actionMenus
  }))
  const adminSuperset = buildAdminSupersetMenus(normalizedRoleConfigs)
  const roleConfigs = normalizedRoleConfigs.map((item) =>
    item.role === 'administrator'
      ? {
          ...item,
          topMenus: adminSuperset.topMenus,
          actionMenus: adminSuperset.actionMenus
        }
      : item
  )

  const loadBreakdownsByEnrolleeId = Object.fromEntries(
    uniqueVisibleProfiles.map((profile) => {
      const rows = visibleBreakdownRows
        .filter((row) => row.enrollmentId === profile.enrollmentId)
        .map((row) => ({
          id: `${profile.enrolleeId}:${row.zCodeGroup}`,
          zCodeGroup: row.zCodeGroup,
          mappedDomain: row.mappedDomain,
          rawCount: row.rawCount
        }))
      const totals = rows.reduce(
        (accumulator, row) => {
          if (row.mappedDomain === 'habitat') accumulator.habitatTotal += row.rawCount
          if (row.mappedDomain === 'work') accumulator.workTotal += row.rawCount
          if (row.mappedDomain === 'socialNetworks') accumulator.socialNetworksTotal += row.rawCount
          return accumulator
        },
        { habitatTotal: 0, workTotal: 0, socialNetworksTotal: 0 }
      )
      return [
        profile.enrolleeId,
        {
          subjectId: profile.enrolleeId,
          subjectLabel: profile.fullName,
          sourceKind: 'enrolleeRecords' as const,
          sourceLabel: 'Supabase enrollee z-codes',
          ...totals,
          rows
        } satisfies DomainLoadBreakdown
      ]
    })
  )
  const loads = uniqueVisibleProfiles.map((profile) => {
    const breakdown = loadBreakdownsByEnrolleeId[profile.enrolleeId]
    const fallbackRow = visibleLoadRows.find((row) => row.enrollmentId === profile.enrollmentId)
    return {
      enrolleeId: profile.enrolleeId,
      habitat: breakdown?.habitatTotal ?? fallbackRow?.habitat ?? 0,
      work: breakdown?.workTotal ?? fallbackRow?.work ?? 0,
      socialNetworks: breakdown?.socialNetworksTotal ?? fallbackRow?.socialNetworks ?? 0
    }
  })

  const baseTimelineConfig = {
    planStartIso: new Date().toISOString(),
    durationMonths: timelineDefaults.durationMonths,
    maxDurationMonths: timelineDefaults.maxDurationMonths,
    gates: timelineDefaults.gates
  }

  const bootstrap: SinglePaneBootstrapData = {
    enrollees: bootstrapEnrollees,
    loads,
    loadBreakdownsByEnrolleeId,
    roleConfigs,
    timelineConfig: baseTimelineConfig,
    timelineConfigsByEnrolleeId: Object.fromEntries(
      uniqueVisibleProfiles.map((profile) => [
        profile.enrolleeId,
        {
          ...baseTimelineConfig,
          planStartIso: profile.enrollmentStartIso || baseTimelineConfig.planStartIso,
          durationMonths: profile.targetDurationMonths || baseTimelineConfig.durationMonths
        }
      ])
    ),
    logs
  }
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
  const mergedTimelineConfigs = Object.fromEntries(
    enrollees.map((enrollee) => {
      const persistedTimelineConfig =
        timelineOverrides[`enrollment:${enrollee.enrollmentId}`] ||
        timelineOverrides[`enrollee:${enrollee.id}`] ||
        timelineOverrides[enrollee.id] ||
        timelineConfigsByEnrolleeId[enrollee.id] ||
        bootstrap.timelineConfig
      return [enrollee.id, persistedTimelineConfig]
    })
  )
  return {
    ...bootstrap,
    enrollees,
    timelineConfigsByEnrolleeId: mergedTimelineConfigs,
    timelineConfig: mergedTimelineConfigs[firstEnrolleeId] || bootstrap.timelineConfig,
    logs
  }
}

export async function loadEnrollmentRequests(role: AtlasRole): Promise<EnrollmentRequestRecord[]> {
  if (role !== 'navigator' || !hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const rows = await withOptionalSupabaseFallback('singlepane.enrollmentRequests', () => fetchSinglePaneEnrollmentRequests(supabase), [])
  return rows.map((row) => ({
    id: row.id,
    submittedAt: row.submittedAt,
    status: row.status,
    prospectiveEnrollee: row.prospectiveEnrollee,
    email: row.email || undefined
  }))
}

export async function loadNavigatorEnrollmentAssignments(): Promise<NavigatorEnrollmentAssignmentRecord[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const [profiles, assignmentBoardRows, navigatorAssignments, navigatorPersonId] = await Promise.all([
    withOptionalSupabaseFallback('singlepane.navigatorEnrollmentProfiles', () => fetchSinglePaneEnrolleeProfiles(supabase), []),
    withOptionalSupabaseFallback('singlepane.enrollmentAssignmentBoard', () => fetchEnrollmentAssignmentBoard(supabase), []),
    withOptionalSupabaseFallback('singlepane.navigatorAssignedEnrollees', () => fetchNavigatorAssignedEnrollees(supabase), []),
    withOptionalSupabaseFallback('singlepane.navigatorPerson', () => resolveCurrentPersonId(), null)
  ])

  const viewerEnrollmentIds = new Set(
    navigatorAssignments
      .filter((assignment) => navigatorPersonId && assignment.navigatorPersonId === navigatorPersonId)
      .map((assignment) => assignment.enrollmentId)
  )
  const assignedEnrollmentIds = new Set(navigatorAssignments.map((assignment) => assignment.enrollmentId))
  const assignmentCountsByEnrollmentId = navigatorAssignments.reduce<Record<string, Set<string>>>((accumulator, assignment) => {
    if (!accumulator[assignment.enrollmentId]) {
      accumulator[assignment.enrollmentId] = new Set<string>()
    }
    accumulator[assignment.enrollmentId].add(assignment.navigatorPersonId)
    return accumulator
  }, {})
  const assignmentBoardByEnrollmentId = new Map(assignmentBoardRows.map((row) => [row.enrollmentId, row]))

  return profiles
    .map((profile) => {
      const boardRow = assignmentBoardByEnrollmentId.get(profile.enrollmentId)
      const edgeNavigatorCount = assignmentCountsByEnrollmentId[profile.enrollmentId]?.size || 0
      const boardNavigatorCount = boardRow?.navigatorPersonIds.length || 0
      const navigatorAssignmentCount = Math.max(edgeNavigatorCount, boardNavigatorCount)
      const isAssignedToAnyNavigator = navigatorAssignmentCount > 0
      const boardNames = boardRow?.navigatorNames || []
      const normalizedRosterNavigatorName = normalizeRosterAssignedNavigatorLabel(profile.assignedNavigator)
      const assignedNavigatorNames = boardNames.length
        ? Array.from(new Set(boardNames.map((name) => name.trim()).filter(Boolean)))
        : isAssignedToAnyNavigator && normalizedRosterNavigatorName
          ? [normalizedRosterNavigatorName]
          : []
      return {
        enrollmentId: profile.enrollmentId,
        enrolleeId: profile.enrolleeId,
        enrolleeName: profile.fullName,
        caseId: profile.caseId,
        assignedNavigatorLabel: isAssignedToAnyNavigator ? 'assigned' : 'unassigned',
        navigatorAssignmentCount,
        assignedNavigatorNames,
        zCodeParentCodes: deriveParentCodesForAssignmentBoard(profile),
        isAssignedToAnyNavigator,
        isAssignedToViewer: viewerEnrollmentIds.has(profile.enrollmentId)
      }
    })
    .sort((left, right) => left.enrolleeName.localeCompare(right.enrolleeName))
}

export async function assignNavigatorEnrollmentToSelf(enrollmentId: string) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).schema('atlas').rpc('fn_navigator_assign_enrollment_to_self', {
    target_enrollment_id: enrollmentId
  })
  if (error) throw error
}

export async function unassignNavigatorEnrollmentFromSelf(enrollmentId: string) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return
  const { error } = await (supabase as any).schema('atlas').rpc('fn_navigator_unassign_enrollment_from_self', {
    target_enrollment_id: enrollmentId
  })
  if (error) throw error
}

export async function materializeClaimedReferralIntoEnrollment(record: UnassignedEnrolleePickupRecord) {
  if (!record.id || !hasSupabaseConfig || !supabase) return null
  const payload = {
    queue_record_id: record.id,
    full_name: record.fullName,
    email: record.email || null,
    phone: record.phone || null,
    case_id: record.caseId || null,
    referrer_name: record.referrerName || null,
    referrer_organization: record.referrerOrganization || null,
    background_notes: record.backgroundNotes || null,
    metadata: {
      demo_tag: 'atlas_demo',
      demo_record: true,
      demo_navigator_name: DEMO_NAVIGATOR_NAME
    }
  }
  const { data, error } = await (supabase as any).schema('atlas').rpc('fn_claim_referral_queue_to_enrollment', payload)
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  if (!row || typeof row !== 'object') return null
  const typed = row as Record<string, unknown>
  const enrollmentId = String(typed.enrollment_id || typed.enrollmentId || '').trim()
  const enrolleeId = String(typed.enrollee_id || typed.enrolleeId || '').trim()
  if (!enrollmentId || !enrolleeId) return null
  return {
    enrollmentId,
    enrolleeId,
    enrolleeName: String(typed.enrollee_name || typed.enrolleeName || record.fullName || ''),
    createdAtIso: String(typed.created_at || typed.createdAt || new Date().toISOString())
  } satisfies ReferralClaimMaterializationResult
}

export async function upsertEnrollmentInferredZCodes(
  enrollmentId: string,
  zCodes: string[],
  sourceLabel = 'demo_ollama_inference'
) {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return []
  const normalizedCodes = Array.from(
    new Set(
      zCodes
        .map((value) => value.trim().toUpperCase())
        .filter((value) => /^Z\d{2}(\.\d+)?$/.test(value))
    )
  )
  if (!normalizedCodes.length) return []

  const { data: zRows, error: zRowsError } = await (supabase as any)
    .schema('atlas')
    .from('z_codes')
    .select('id,z_code')
    .in('z_code', normalizedCodes)
  if (zRowsError) throw zRowsError
  const activeRows = (zRows || []) as Array<{ id: string; z_code: string }>
  if (!activeRows.length) return []

  const payload = activeRows.map((row) => ({
    enrollment_id: enrollmentId,
    z_code_id: row.id,
    is_resolved: false,
    resolution_at: null,
    source: sourceLabel,
    ended_at: null
  }))

  const { data: existingRows, error: existingError } = await (supabase as any)
    .schema('atlas')
    .from('enrollee_z_codes')
    .select('z_code_id')
    .eq('enrollment_id', enrollmentId)
    .is('ended_at', null)
  if (existingError) throw existingError
  const existingZCodeIds = new Set((existingRows || []).map((row: { z_code_id: string }) => row.z_code_id))
  const nextRows = payload.filter((row) => !existingZCodeIds.has(row.z_code_id))
  if (!nextRows.length) return activeRows.map((row) => row.z_code)

  const { error: insertError } = await (supabase as any)
    .schema('atlas')
    .from('enrollee_z_codes')
    .insert(nextRows)
  if (insertError) throw insertError
  return activeRows.map((row) => row.z_code)
}

export async function loadDemoTaggedEnrollmentIds(tag = 'atlas_demo') {
  if (demoTagsTableUnavailable) return []
  if (!hasSupabaseConfig || !supabase) return []
  const { data, error } = await (supabase as any)
    .schema('atlas')
    .from('demo_record_tags')
    .select('record_id')
    .eq('tag', tag)
    .eq('record_type', 'enrollments')
  if (error) {
    const typedError = error as { code?: string; message?: string } | null
    if (typedError?.code === 'PGRST205' || typedError?.code === '42P01') {
      demoTagsTableUnavailable = true
      return []
    }
    throw error
  }
  return (data || []).map((row: { record_id: string }) => row.record_id).filter(Boolean)
}

export async function loadRouteCandidates(enrollmentId?: string): Promise<RouteCandidateRecord[]> {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return []
  const cached = routeCandidatesCache.get(enrollmentId)
  if (cached) return cached
  const existingRequest = routeCandidatesInFlight.get(enrollmentId)
  if (existingRequest) return existingRequest

  const request = withOptionalSupabaseFallback(
    `singlepane.routeCandidates:${enrollmentId}`,
    () => fetchSinglePaneRouteCandidates(supabase, enrollmentId),
    []
  )
    .then((rows) => {
      const mapped = rows.map((row) => ({
        stationId: row.stationId,
        partnerId: row.partnerId,
        stationName: row.stationName,
        score: row.score,
        matchedZCodeCount: row.matchedZCodeCount,
        needUnitsMatched: row.needUnitsMatched,
        partnerBurdenTotal: row.partnerBurdenTotal,
        matchedZCodes: row.matchedZCodes,
        matchedParentSummaries: row.matchedParentSummaries
      }))
      routeCandidatesCache.set(enrollmentId, mapped)
      return mapped
    })
    .finally(() => {
      routeCandidatesInFlight.delete(enrollmentId)
    })

  routeCandidatesInFlight.set(enrollmentId, request)
  return request
}

export async function prefetchRouteCandidatesForEnrollments(enrollmentIds: string[]) {
  const uniqueEnrollmentIds = Array.from(new Set(enrollmentIds.map((value) => value.trim()).filter(Boolean)))
  await Promise.all(uniqueEnrollmentIds.map((enrollmentId) => loadRouteCandidates(enrollmentId).catch(() => [])))
}

export async function loadCountyHeatmap(): Promise<CountyHeatPoint[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  const rows = await withOptionalSupabaseFallback('singlepane.countyHeatmap', () => fetchSinglePaneCountyHeatmap(supabase), [])
  return rows.map((row) => ({
    countyId: row.countyId,
    countyName: row.countyName,
    zGroup: row.zGroup,
    activeCaseCount: row.activeCaseCount
  }))
}

export async function loadAdminDataQuality(): Promise<AdminDataQualityMetric[]> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return []
  return withOptionalSupabaseFallback('singlepane.adminMetrics', () => fetchSinglePaneAdminMetrics(supabase), [])
}

export async function loadJourneyStationMarkers(enrollmentId?: string, enrolleeId?: string): Promise<JourneyStationMarker[]> {
  if (!enrollmentId) return []
  const cached = journeyStationMarkersCache.get(enrollmentId)
  if (cached) return cached
  const existingRequest = journeyStationMarkersInFlight.get(enrollmentId)
  if (existingRequest) return existingRequest

  const request = (hasSupabaseConfig && supabase
    ? withOptionalSupabaseFallback(
        `singlepane.stationMarkers:${enrollmentId}`,
        () => fetchEnrollmentStationMarkers(supabase, enrollmentId),
        []
      ).then((rows) =>
        rows
          .filter((marker) => marker.status === 'completed')
          .map((marker) => ({
            id: marker.routePlanStopId,
            stationName: marker.stationName,
            assignedAtIso: marker.assignedAt,
            phase: 'renewal',
            iconSlug: marker.iconSlug || undefined,
            markerType: 'history' as const
          }))
      )
    : Promise.resolve([]))
    .then((markers) => {
      journeyStationMarkersCache.set(enrollmentId, markers)
      return markers
    })
    .finally(() => {
      journeyStationMarkersInFlight.delete(enrollmentId)
    })

  journeyStationMarkersInFlight.set(enrollmentId, request)
  return request
}

export async function prefetchJourneyStationMarkersForEnrollments(
  enrollments: Array<{ enrollmentId?: string; enrolleeId?: string }>
) {
  await Promise.all(
    enrollments.map((entry) =>
      loadJourneyStationMarkers(entry.enrollmentId, entry.enrolleeId).catch(() => [])
    )
  )
}

function sanitizeFilename(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export async function uploadEnrolleeProfileImage(
  enrolleeId: string,
  file: File
): Promise<{ avatarUrl: string; storagePath: string }> {
  if (!enrolleeId.trim()) {
    throw new Error('An enrollee id is required to upload a profile image.')
  }
  if (!hasSupabaseConfig || !supabase) {
    throw new Error('Supabase is required to upload profile images.')
  }
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select an image file.')
  }

  const safeFileName = sanitizeFilename(file.name || 'profile-image.jpeg') || 'profile-image.jpeg'
  const storagePath = `enrollees/${enrolleeId}/${Date.now()}-${safeFileName}`
  const bucket = (supabase as any).storage.from('profile-images')
  const { error: uploadError } = await bucket.upload(storagePath, file, {
    cacheControl: '3600',
    contentType: file.type,
    upsert: false
  })

  if (uploadError) throw uploadError

  const { data: publicData } = bucket.getPublicUrl(storagePath)
  const publicUrl = publicData?.publicUrl || `/storage/v1/object/public/profile-images/${storagePath}`
  const nowIso = new Date().toISOString()

  const profileImagePayload = {
    enrollee_id: enrolleeId,
    storage_bucket: 'profile-images',
    storage_path: storagePath,
    public_url: publicUrl,
    original_filename: file.name || safeFileName,
    mime_type: file.type || null,
    file_size_bytes: typeof file.size === 'number' ? file.size : null,
    intake_source: 'manual',
    intake_status: 'ready',
    is_primary: true,
    alt_text: 'Enrollee profile image',
    metadata: { uploaded_from: 'singlepane-ui' },
    ready_at: nowIso,
    updated_at: nowIso
  }

  const { data: updatedPrimaryRows, error: updatePrimaryError } = await (supabase as any)
    .schema('atlas')
    .from('profile_images')
    .update(profileImagePayload)
    .eq('enrollee_id', enrolleeId)
    .eq('is_primary', true)
    .select('id')

  if (updatePrimaryError) throw updatePrimaryError

  if (!updatedPrimaryRows?.length) {
    const { error: profileImageInsertError } = await (supabase as any)
      .schema('atlas')
      .from('profile_images')
      .insert(profileImagePayload)

    if (profileImageInsertError) throw profileImageInsertError
  }

  return {
    avatarUrl: publicUrl,
    storagePath
  }
}

export async function setEnrolleeZCodeResolution(
  enrolleeZCodeId: string,
  isResolved: boolean,
  input: EnrolleeZCodeResolutionInput = {}
) {
  if (!enrolleeZCodeId || !hasSupabaseConfig || !supabase) {
    return {
      enrolleeZCodeId,
      isResolved,
      resolutionAt: isResolved ? new Date().toISOString() : null,
      resolutionPartnerId: isResolved ? input.partnerId ?? null : null,
      resolutionPartnerName: isResolved ? input.partnerName ?? null : null,
      resolutionNote: isResolved ? input.resolutionNote?.trim() || null : null
    }
  }
  return persistEnrolleeZCodeResolution(
    supabase,
    enrolleeZCodeId,
    isResolved,
    isResolved ? input.partnerId ?? null : null,
    isResolved ? input.partnerName?.trim() || null : null,
    isResolved ? input.resolutionNote?.trim() || null : null
  )
}

export async function loadPartnerRadialLoad(): Promise<DomainLoad | null> {
  const breakdown = await loadPartnerRadialLoadBreakdown()
  return toNormalizedRadialDomainLoad(breakdown)
}

export async function loadPartnerRadialLoadBreakdown(): Promise<DomainLoadBreakdown | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  return withOptionalSupabaseFallback('singlepane.partnerLoadBreakdown', () => fetchPartnerLoadBreakdown(supabase), null)
}

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function buildFallbackPartnerStationProfile(
  organizationName: string,
  fallback?: { fullName?: string | null; email?: string | null }
): PartnerStationProfile | null {
  const normalizedOrganizationName = organizationName.trim()
  if (!normalizedOrganizationName) return null
  const splitName = splitFullName(fallback?.fullName || '')
  return {
    partnerId: 'local-partner-profile',
    organizationName: normalizedOrganizationName,
    stationId: null,
    stationName: normalizedOrganizationName || '[My Station]',
    countyName: null,
    primaryContactFirstName: splitName.firstName || null,
    primaryContactLastName: splitName.lastName || null,
    primaryContactEmail: fallback?.email?.trim() || null,
    capacityTotal: null,
    capacityAvailable: null
  }
}

export async function loadPartnerStationProfile(
  organizationName: string,
  fallback?: { fullName?: string | null; email?: string | null }
): Promise<PartnerStationProfile | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) {
    return buildFallbackPartnerStationProfile(organizationName, fallback)
  }
  const normalized = normalizeOrganizationName(organizationName)
  if (!normalized) return buildFallbackPartnerStationProfile(organizationName, fallback)

  let data = await withOptionalSupabaseFallback(
    `singlepane.partnerStationProfile:${normalized}`,
    async () => {
      const { data: rows, error } = await (supabase as any)
        .schema('atlas')
        .from('v_partner_station_directory')
        .select(
          `
          partner_id,
          organization_name,
          organization_name_normalized,
          primary_contact_first_name,
          primary_contact_last_name,
          primary_contact_email,
          station_id,
          station_name,
          capacity_total,
          capacity_available,
          county_name
        `
        )
        .eq('organization_name_normalized', normalized)
        .limit(1)
      if (error) throw error
      return rows || []
    },
    []
  )

  let partner = data?.[0]
  if (!partner) {
    const splitName = splitFullName(fallback?.fullName || '')
    if (splitName.firstName && splitName.lastName) {
      try {
        await ensurePartnerIdentifierRecordForSurvey({
          firstName: splitName.firstName,
          lastName: splitName.lastName,
          organizationName,
          email: fallback?.email || null
        })
      } catch {}

      data = await withOptionalSupabaseFallback(
        `singlepane.partnerStationProfile.refresh:${normalized}`,
        async () => {
          const { data: rows, error } = await (supabase as any)
            .schema('atlas')
            .from('v_partner_station_directory')
            .select(
              `
              partner_id,
              organization_name,
              organization_name_normalized,
              primary_contact_first_name,
              primary_contact_last_name,
              primary_contact_email,
              station_id,
              station_name,
              capacity_total,
              capacity_available,
              county_name
            `
            )
            .eq('organization_name_normalized', normalized)
            .limit(1)
          if (error) throw error
          return rows || []
        },
        []
      )
      partner = data?.[0]
    }
  }

  if (!partner) return buildFallbackPartnerStationProfile(organizationName, fallback)

  return {
    partnerId: partner.partner_id,
    organizationName: partner.organization_name,
    stationId: partner.station_id || null,
    stationName: partner.station_name || null,
    countyName: partner.county_name || null,
    primaryContactFirstName: partner.primary_contact_first_name || null,
    primaryContactLastName: partner.primary_contact_last_name || null,
    primaryContactEmail: partner.primary_contact_email || null,
    capacityTotal: typeof partner.capacity_total === 'number' ? partner.capacity_total : null,
    capacityAvailable: typeof partner.capacity_available === 'number' ? partner.capacity_available : null
  }
}

export {
  appendRouteLog,
  loadAdminPortalRegistry,
  loadAccountSettings,
  loadEnrolleeBurdenSurvey,
  loadEnrolleeBurdenSurveyHistory,
  loadLatestEnrolleeBurdenSurveySubmissions,
  loadPartnerTroubleshootingGrants,
  loadEnrolleeIntakes,
  loadNavigatorCompetencyAssessments,
  loadNavigatorProgramState,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  deletePartnerServiceCapacityDraftRecord,
  loadRouteAssignments,
  saveAdminPortalRegistry,
  saveAccountSettings,
  saveEnrolleeBurdenSurvey,
  savePartnerTroubleshootingGrant,
  saveEnrolleeIntake,
  saveNavigatorCompetencyAssessment,
  saveNavigatorProgramState,
  savePartnerServiceCapacitySurvey,
  saveRouteAssignment,
  saveTimelineConfig,
  saveRouteLogs,
  loadAccessMatrixDataset,
  saveAccessMatrixPersonRoles,
  saveAccessMatrixEnrollmentNavigators,
  saveAccessMatrixSupervisorAssignments,
  saveAccessMatrixPartnerPrimaryContacts,
  deleteEnrolleeBurdenSurveyDraftRecord,
  ensurePartnerIdentifierRecordForSurvey,
  searchPartnerIdentifierRecordMatches
}
