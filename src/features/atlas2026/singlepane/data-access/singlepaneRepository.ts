import type {
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  PartnerStationProfile,
  RouteCandidateRecord
} from '@/features/atlas2026/singlepane/types'
import {
  fetchAppRoleNavigation,
  fetchNavigatorAssignedEnrollees,
  fetchPartnerLoadBreakdown,
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
  loadAccountSettings,
  loadEnrolleeIntakes,
  loadRouteAssignments,
  loadTimelineConfigs,
  saveAccountSettings,
  saveEnrolleeIntake,
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
  deletePartnerServiceCapacityDraftRecord,
  ensurePartnerIdentifierRecordForSurvey,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  savePartnerServiceCapacitySurvey,
  searchPartnerIdentifierRecordMatches
} from '@/features/atlas2026/singlepane/data-access/partnerServiceCapacityRepository'
import { withOptionalSupabaseFallback } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import {
  buildDefaultTimelineGates,
  DEFAULT_TIMELINE_DURATION_MONTHS,
  DEFAULT_TIMELINE_MAX_DURATION_MONTHS
} from '@/features/atlas2026/singlepane/timelineConfigUtils'

export interface SinglePaneBootstrapData {
  enrollees: import('@/features/atlas2026/singlepane/types').EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: import('@/features/atlas2026/singlepane/types').RoleMenuConfig[]
  timelineConfig: import('@/features/atlas2026/singlepane/types').TimelineConfig
  timelineConfigsByEnrolleeId: Record<string, import('@/features/atlas2026/singlepane/types').TimelineConfig>
  logs: import('@/features/atlas2026/singlepane/types').RouteLogEvent[]
}

function createDefaultTimelineConfig() {
  return {
    planStartIso: new Date().toISOString(),
    durationMonths: DEFAULT_TIMELINE_DURATION_MONTHS,
    maxDurationMonths: DEFAULT_TIMELINE_MAX_DURATION_MONTHS,
    gates: buildDefaultTimelineGates(DEFAULT_TIMELINE_DURATION_MONTHS)
  }
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
  const [profiles, loadRows, breakdownRows, navigatorAssignedEnrollees] = shouldLoadEnrolleeDomain
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
          : Promise.resolve([])
      ])
    : [[], [], [], []]

  const navigatorEnrollmentIds =
    role === 'navigator' ? new Set(navigatorAssignedEnrollees.map((record) => record.enrollmentId)) : null
  const visibleProfiles =
    navigatorEnrollmentIds && navigatorEnrollmentIds.size
      ? profiles.filter((profile) => navigatorEnrollmentIds.has(profile.enrollmentId))
      : profiles
  const visibleLoadRows =
    navigatorEnrollmentIds && navigatorEnrollmentIds.size
      ? loadRows.filter((row) => navigatorEnrollmentIds.has(row.enrollmentId))
      : loadRows
  const visibleBreakdownRows =
    navigatorEnrollmentIds && navigatorEnrollmentIds.size
      ? breakdownRows.filter((row) => navigatorEnrollmentIds.has(row.enrollmentId))
      : breakdownRows

  const bootstrapEnrollees = visibleProfiles.map((profile) => ({
    id: profile.enrolleeId,
    enrollmentId: profile.enrollmentId,
    fullName: profile.fullName,
    dob: profile.dob,
    caseId: profile.caseId,
    email: profile.email,
    avatarUrl: profile.avatarUrl || undefined,
    assignedNavigator: profile.assignedNavigator,
    zCodeTags: profile.zCodeTags
  }))

  const roleConfigs = roleNavigation.map((item) => ({
    role: item.roleKey as AtlasRole,
    topMenus: item.topMenus,
    actionMenus: item.actionMenus
  }))

  const loads = visibleLoadRows.map((row) => ({
    enrolleeId: visibleProfiles.find((profile) => profile.enrollmentId === row.enrollmentId)?.enrolleeId || row.enrollmentId,
    habitat: row.habitat,
    work: row.work,
    socialNetworks: row.socialNetworks
  }))

  const loadBreakdownsByEnrolleeId = Object.fromEntries(
    visibleProfiles.map((profile) => {
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
      visibleProfiles.map((profile) => [
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

export async function loadRouteCandidates(enrollmentId?: string): Promise<RouteCandidateRecord[]> {
  if (!enrollmentId || !hasSupabaseConfig || !supabase) return []
  const rows = await withOptionalSupabaseFallback(
    `singlepane.routeCandidates:${enrollmentId}`,
    () => fetchSinglePaneRouteCandidates(supabase, enrollmentId),
    []
  )
  return rows.map((row) => ({
    stationId: row.stationId,
    partnerId: row.partnerId,
    stationName: row.stationName,
    score: row.score,
    matchedZCodeCount: row.matchedZCodeCount,
    needUnitsMatched: row.needUnitsMatched,
    partnerBurdenTotal: row.partnerBurdenTotal,
    matchedZCodes: row.matchedZCodes
  }))
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
  const historyMarkers = hasSupabaseConfig && supabase
    ? (await withOptionalSupabaseFallback(
        `singlepane.stationMarkers:${enrollmentId}`,
        () => fetchEnrollmentStationMarkers(supabase, enrollmentId),
        []
      )).map((marker) => ({
        id: marker.routePlanStopId,
        stationName: marker.stationName,
        assignedAtIso: marker.assignedAt,
        phase: marker.status === 'completed' ? 'renewal' : marker.status === 'active' ? 'readiness' : 'regulation',
        iconSlug: marker.iconSlug || undefined,
        markerType: 'history' as const
      }))
    : []
  const assignments = await loadRouteAssignments()
  const selectedAssignment =
    (enrolleeId ? assignments[enrolleeId] : null) ||
    assignments[enrollmentId] ||
    Object.values(assignments).find((assignment) => assignment.enrolleeId === (enrolleeId || enrollmentId))
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
  const breakdown = await loadPartnerRadialLoadBreakdown()
  if (!breakdown) return null
  const maxTotal = Math.max(breakdown.habitatTotal, breakdown.workTotal, breakdown.socialNetworksTotal, 1)
  return {
    enrolleeId: breakdown.subjectId,
    habitat: Math.round((breakdown.habitatTotal / maxTotal) * 100),
    work: Math.round((breakdown.workTotal / maxTotal) * 100),
    socialNetworks: Math.round((breakdown.socialNetworksTotal / maxTotal) * 100)
  }
}

export async function loadPartnerRadialLoadBreakdown(): Promise<DomainLoadBreakdown | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  return withOptionalSupabaseFallback('singlepane.partnerLoadBreakdown', () => fetchPartnerLoadBreakdown(supabase), null)
}

function normalizeOrganizationName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export async function loadPartnerStationProfile(organizationName: string): Promise<PartnerStationProfile | null> {
  if (!hasSupabaseConfig || !supabase || !isSinglePaneSupabaseBootstrapEnabled) return null
  const normalized = normalizeOrganizationName(organizationName)
  if (!normalized) return null

  const data = await withOptionalSupabaseFallback(
    `singlepane.partnerStationProfile:${normalized}`,
    async () => {
      const { data: rows, error } = await (supabase as any)
        .schema('atlas')
        .from('partners')
        .select(
          `
          id,
          organization_name,
          primary_contact_first_name,
          primary_contact_last_name,
          primary_contact_email,
          partner_stations(
            id,
            station_name,
            capacity_total,
            capacity_available,
            counties(county_name)
          )
        `
        )
        .eq('organization_name_normalized', normalized)
        .limit(1)
      if (error) throw error
      return rows || []
    },
    []
  )

  const partner = data?.[0]
  if (!partner) return null
  const station = Array.isArray(partner.partner_stations) ? partner.partner_stations[0] : partner.partner_stations
  const stationCounty = station?.counties
  const countyName = Array.isArray(stationCounty) ? stationCounty[0]?.county_name || null : stationCounty?.county_name || null

  return {
    partnerId: partner.id,
    organizationName: partner.organization_name,
    stationId: station?.id || null,
    stationName: station?.station_name || null,
    countyName,
    primaryContactFirstName: partner.primary_contact_first_name || null,
    primaryContactLastName: partner.primary_contact_last_name || null,
    primaryContactEmail: partner.primary_contact_email || null,
    capacityTotal: typeof station?.capacity_total === 'number' ? station.capacity_total : null,
    capacityAvailable: typeof station?.capacity_available === 'number' ? station.capacity_available : null
  }
}

export {
  appendRouteLog,
  loadAccountSettings,
  loadEnrolleeIntakes,
  loadNavigatorCompetencyAssessments,
  loadPartnerServiceCapacitySurvey,
  loadPartnerServiceCapacitySurveyHistory,
  deletePartnerServiceCapacityDraftRecord,
  loadRouteAssignments,
  saveAccountSettings,
  saveEnrolleeIntake,
  saveNavigatorCompetencyAssessment,
  savePartnerServiceCapacitySurvey,
  saveRouteAssignment,
  saveTimelineConfig,
  saveRouteLogs,
  ensurePartnerIdentifierRecordForSurvey,
  searchPartnerIdentifierRecordMatches
}
