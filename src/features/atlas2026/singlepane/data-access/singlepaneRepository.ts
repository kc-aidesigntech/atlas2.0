import type {
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeZCodeResolutionInput,
  EnrollmentRequestRecord,
  JourneyStationMarker,
  PartnerStationProfile,
  RouteCandidateRecord
} from '@/features/atlas2026/singlepane/types'
import {
  fetchAppRoleNavigation,
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

/**
 * Single-pane data-access facade.
 *
 * Purpose:
 * - composes per-feature repositories into a single orchestration boundary.
 * - returns User Interface (UI)-shaped records while insulating callers from backend topology.
 */

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

/**
 * Repository facade for single-pane orchestration.
 *
 * Boundary contract:
 * - consolidates reads from Supabase-backed domain views plus local config overlays.
 * - exposes normalized UI-ready records so hooks/components avoid storage-specific logic.
 */

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
  const authUserId = sessionData.session?.user?.id || ''
  const authEmail = sessionData.session?.user?.email?.trim() || ''
  const appMetadata = sessionData.session?.user?.app_metadata || {}
  const metadataPersonId =
    String((appMetadata as Record<string, unknown>).person_id || (appMetadata as Record<string, unknown>).atlas_person_id || '').trim()
  if (metadataPersonId) return metadataPersonId
  if (!authUserId && !authEmail) return null

  // Prefer auth user id linkage (`external_ref`) so role-based scoping remains stable
  // even if account profile email text changes in local settings payloads.
  if (authUserId) {
    const { data: personByExternalRef, error: personByExternalRefError } = await (supabase as any)
      .schema('atlas')
      .from('people')
      .select('id')
      .eq('external_ref', authUserId)
      .limit(1)
      .maybeSingle()
    if (personByExternalRefError) {
      if (isOptionalSupabaseDataError(personByExternalRefError)) return null
      throw personByExternalRefError
    }
    if (personByExternalRef?.id) return String(personByExternalRef.id)
  }

  if (!authEmail) return null
  const { data: personByEmail, error: personByEmailError } = await (supabase as any)
    .schema('atlas')
    .from('people')
    .select('id')
    .ilike('email', authEmail)
    .limit(1)
    .maybeSingle()
  if (personByEmailError) {
    if (isOptionalSupabaseDataError(personByEmailError)) return null
    throw personByEmailError
  }
  return personByEmail?.id ? String(personByEmail.id) : null
}

export async function loadSinglePaneBootstrap(role: AtlasRole): Promise<SinglePaneBootstrapData> {
  // Local overrides are loaded even in cloud mode because intake/timeline edits may
  // be made offline and must be projected over server bootstrap data.
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
  // Domain datasets are fetched in one branch so filtering decisions are applied
  // consistently across profiles, aggregate loads, and breakdown rows.
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
            .filter((record) => navigatorPersonId && record.navigatorPersonId === navigatorPersonId)
            .map((record) => record.enrollmentId)
        )
      : null
  // Navigator scope is always assignment-bound: if identity linkage fails or no active
  // assignments exist, return an empty profile set instead of leaking global enrollee rows.
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

  const loads = visibleLoadRows.map((row) => ({
    enrolleeId: uniqueVisibleProfiles.find((profile) => profile.enrollmentId === row.enrollmentId)?.enrolleeId || row.enrollmentId,
    habitat: row.habitat,
    work: row.work,
    socialNetworks: row.socialNetworks
  }))

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
      // Prefer persisted timeline override (enrollment key first) to preserve edits
      // across bootstrap refreshes and legacy key migrations.
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
  // Warm route-candidate cache for likely-next enrollee selections so route planning
  // opens instantly instead of waiting on a fresh query after menu navigation.
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

  // Marker history only includes completed route stops; active assignments are shown
  // from in-memory route planning state and should not appear as timeline history yet.
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
  // Timeline history for non-active enrollees is prefetched in the background so
  // switching enrollees keeps the strip map populated without a visible delay.
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
    // Upsert behavior here is split on purpose: update existing primary image when present,
    // otherwise insert a new primary row for first-time uploads.
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
    // Local fallback mirrors persisted response shape so callers can apply one
    // merge path regardless of online/offline persistence mode.
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
        // Best-effort registration backfills partner directory records when a known
        // contact submits from an org that has not been indexed yet.
        await ensurePartnerIdentifierRecordForSurvey({
          firstName: splitName.firstName,
          lastName: splitName.lastName,
          organizationName,
          email: fallback?.email || null
        })
      } catch {
        // best-effort auto-registration; UI still gets fallback profile below
      }

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
  ensurePartnerIdentifierRecordForSurvey,
  searchPartnerIdentifierRecordMatches
}
