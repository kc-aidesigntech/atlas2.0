import { useEffect, useState } from 'react'
import type {
  AccountSettings,
  AdminDataQualityMetric,
  AtlasRole,
  CountyHeatPoint,
  DomainLoad,
  DomainLoadBreakdown,
  EnrolleeIntakeRecord,
  EnrolleeProfile,
  EnrollmentRequestRecord,
  NavigatorCompetencyAssessmentRecord,
  PartnerStationSpecialtyGroup,
  PartnerStationProfile,
  RoleMenuConfig,
  RouteAssignmentRecord,
  RouteLogEvent,
  TimelineConfig,
} from '@/features/atlas2026/shared/contracts'
import { setScribeOnMenuList } from '@/features/atlas2026/scribe/scribeMenuVisibility'
import { fetchSinglePaneEnrolleeProfiles } from '@atlas/shared'
import { supabase } from '@/lib/supabaseClient'
import { applyIntakeOverrides } from '@/features/atlas2026/singlepane/data-access/intakeLocalState'
import { describeRecordDelta, readRemembered, writeRemembered } from '@/features/atlas2026/singlepane/data-access/rememberedRecords'
import { projectRememberedEnrollee } from '@/features/atlas2026/singlepane/data-access/singlePaneBootstrapRepository'
import {
  freshnessMatches,
  readRememberedUserId,
  readWorkspaceFreshness,
  unchangedExceptEnrollments,
  type WorkspaceFreshness
} from '@/features/atlas2026/singlepane/data-access/workspaceFreshness'
import {
  loadAdminDataQuality,
  loadAccountSettings,
  loadCountyHeatmap,
  loadEnrolleeIntakes,
  loadEnrollmentRequests,
  loadLatestEnrolleeBurdenSurveySubmissions,
  loadNavigatorCompetencyAssessments,
  loadNavigatorStationContext,
  loadPartnerServiceCapacitySurveyHistory,
  loadPartnerRadialLoadBreakdown,
  loadPartnerStationProfile,
  loadRouteAssignments,
  loadSinglePaneBootstrap
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import {
  buildPartnerBurdenBreakdownFromHistory,
  derivePartnerStationSpecialtyGroups,
  buildSurveyDomainLoadBreakdown,
  selectCompletedPartnerSurveysNewestFirst,
  toNormalizedRadialDomainLoad
} from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'
import { isSupabasePermissionError } from '@/features/atlas2026/singlepane/data-access/supabaseOptionalData'
import { workspaceLoadMetrics } from '@/features/atlas2026/singlepane/workspaceLoadMetrics'

/**
 * Builds a loud, role-aware message for a failed bootstrap. Permission/Row-Level
 * Security (RLS) denials get a distinct message because they mean the data exists
 * but the signed-in identity's grants/policies hid it -- a configuration break we
 * must never disguise as an empty workspace.
 */
function toBootstrapErrorMessage(role: AtlasRole, error: unknown): string {
  if (isSupabasePermissionError(error)) {
    return `Access denied while loading ${role} data. Your account is authenticated but the database blocked these records (grant or Row-Level Security policy). This is a configuration problem, not an empty workspace -- contact an administrator rather than re-trying.`
  }
  const detail = error instanceof Error && error.message ? ` (${error.message})` : ''
  return `Unable to load ${role} workspace data from the database${detail}. Nothing is shown because the records could not be read.`
}

/**
 * Bootstraps role-scoped single-pane state.
 *
 * Purpose:
 * - coordinates primary bootstrap payload with auxiliary datasets.
 * - exposes one cohesive state object for screen-level consumers.
 */

export interface SinglePaneBootstrapState {
  isLoading: boolean
  // Loud surface for a failed bootstrap. Non-null whenever the role-scoped domain
  // load could not complete (most importantly a grant/Row-Level Security denial),
  // so the UI can stop pretending an empty roster is a healthy one.
  error: string | null
  enrollees: EnrolleeProfile[]
  loads: DomainLoad[]
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>
  roleConfigs: RoleMenuConfig[]
  timelineConfig: TimelineConfig | null
  timelineConfigsByEnrolleeId: Record<string, TimelineConfig>
  logs: RouteLogEvent[]
  enrollmentRequests: EnrollmentRequestRecord[]
  countyHeatmap: CountyHeatPoint[]
  adminMetrics: AdminDataQualityMetric[]
  partnerLoad: DomainLoad | null
  partnerLoadBreakdown: DomainLoadBreakdown | null
  partnerStationSpecialties: PartnerStationSpecialtyGroup[]
  accountSettings: AccountSettings
  partnerStationProfile: PartnerStationProfile | null
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  routeAssignmentsByEnrolleeId: Record<string, RouteAssignmentRecord>
  navigatorCompetencyAssessments: NavigatorCompetencyAssessmentRecord[]
  selectedEnrolleeId: string
}

type SinglePaneBootstrapPayload = Omit<SinglePaneBootstrapState, 'isLoading' | 'error'>

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  fullName: 'atlas operator',
  email: 'operator@atlas.local',
  organization: 'atlas operations',
  avatarUrl: null,
  enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
}

const ROLE_PREFETCH_ORDER: AtlasRole[] = ['navigator', 'partner', 'supervisor', 'administrator']
const bootstrapPayloadCache = new Map<AtlasRole, SinglePaneBootstrapPayload>()
const bootstrapPayloadInFlight = new Map<AtlasRole, Promise<SinglePaneBootstrapPayload>>()
const freshnessByRole = new Map<AtlasRole, WorkspaceFreshness>()

type RememberedWorkspace = {
  payload: SinglePaneBootstrapPayload
  freshness: WorkspaceFreshness
}

function workspaceMemoryKey(role: AtlasRole) {
  return `workspace:${role}`
}

function rememberWorkspace(userId: string | null, role: AtlasRole, payload: SinglePaneBootstrapPayload, freshness: WorkspaceFreshness) {
  bootstrapPayloadCache.set(role, payload)
  freshnessByRole.set(role, freshness)
  if (!userId) return
  writeRemembered<RememberedWorkspace>(userId, workspaceMemoryKey(role), { payload, freshness })
}

async function patchRememberedEnrollments(
  payload: SinglePaneBootstrapPayload,
  previous: WorkspaceFreshness,
  next: WorkspaceFreshness
): Promise<SinglePaneBootstrapPayload | null> {
  const delta = describeRecordDelta(previous.enrollments, next.enrollments)
  // A new enrollment can change who this role is allowed to see, so membership
  // changes take the full load. Edits to enrollments already on screen patch in place.
  if (delta.addedIds.length || !payload.timelineConfig || !supabase) return null
  if (!delta.changedIds.length && !delta.removedIds.length) return null
  if (delta.changedIds.length > 12) return null

  const profiles = await fetchSinglePaneEnrolleeProfiles(supabase, delta.changedIds)
  const returnedEnrollmentIds = new Set(profiles.map((profile) => profile.enrollmentId))
  const removedEnrollmentIds = new Set(delta.removedIds)
  for (const enrollmentId of delta.changedIds) {
    if (!returnedEnrollmentIds.has(enrollmentId)) removedEnrollmentIds.add(enrollmentId)
  }

  const removedEnrolleeIds = new Set(
    payload.enrollees
      .filter((enrollee) => enrollee.enrollmentId && removedEnrollmentIds.has(enrollee.enrollmentId))
      .map((enrollee) => enrollee.id)
  )
  const enrollees = payload.enrollees.filter((enrollee) => !removedEnrolleeIds.has(enrollee.id))
  const loads = payload.loads.filter((load) => !removedEnrolleeIds.has(load.enrolleeId))
  const loadBreakdownsByEnrolleeId = { ...payload.loadBreakdownsByEnrolleeId }
  const timelineConfigsByEnrolleeId = { ...payload.timelineConfigsByEnrolleeId }
  for (const enrolleeId of removedEnrolleeIds) {
    delete loadBreakdownsByEnrolleeId[enrolleeId]
    delete timelineConfigsByEnrolleeId[enrolleeId]
  }

  for (const profile of profiles) {
    const projected = projectRememberedEnrollee(profile, payload.timelineConfig)
    const [withIntake] = applyIntakeOverrides([projected.enrollee], payload.intakeFormsByEnrolleeId)
    const enrollee = withIntake || projected.enrollee
    const existingIndex = enrollees.findIndex((item) => item.id === enrollee.id)
    if (existingIndex >= 0) enrollees[existingIndex] = enrollee
    else enrollees.push(enrollee)

    const existingBreakdown = loadBreakdownsByEnrolleeId[enrollee.id]
    // Survey-weighted charts stay put when the survey revision did not change.
    if (existingBreakdown?.sourceKind !== 'enrolleeSurvey') {
      loadBreakdownsByEnrolleeId[enrollee.id] = projected.breakdown
      const loadIndex = loads.findIndex((load) => load.enrolleeId === enrollee.id)
      if (loadIndex >= 0) loads[loadIndex] = projected.load
      else loads.push(projected.load)
    }
  }

  const selectedStillVisible = enrollees.some((enrollee) => enrollee.id === payload.selectedEnrolleeId)
  return {
    ...payload,
    enrollees,
    loads,
    loadBreakdownsByEnrolleeId,
    timelineConfigsByEnrolleeId,
    selectedEnrolleeId: selectedStillVisible ? payload.selectedEnrolleeId : enrollees[0]?.id || ''
  }
}

function withScribeOnRole(roleConfigs: RoleMenuConfig[], role: AtlasRole, visible: boolean) {
  return roleConfigs.map((config) =>
    config.role === role ? { ...config, topMenus: setScribeOnMenuList(config.topMenus, visible) } : config
  )
}

/** Keep prefetched role payloads aligned with an administrator's scribe menu toggle. */
export function patchCachedScribeMenu(role: AtlasRole, visible: boolean) {
  for (const [cachedRole, payload] of bootstrapPayloadCache) {
    bootstrapPayloadCache.set(cachedRole, {
      ...payload,
      roleConfigs: withScribeOnRole(payload.roleConfigs, role, visible)
    })
  }
}

async function loadCriticalBootstrapPayload(role: AtlasRole): Promise<SinglePaneBootstrapPayload> {
  // Critical payload only: enough to paint and interact with the first role screen.
  // Supplemental datasets load after first usable paint in a follow-up refresh.
  // Wave 1: remote critical bootstrap + account/station identity (no local override I/O).
  const [data, nextAccountSettings, navigatorStationContext] = await Promise.all([
    loadSinglePaneBootstrap(role, { criticalOnly: true }),
    loadAccountSettings(),
    role === 'navigator' ? loadNavigatorStationContext() : Promise.resolve(null)
  ])
  const stationOrganizationName =
    (role === 'navigator' ? navigatorStationContext?.organizationName : nextAccountSettings.organization)?.trim() ||
    nextAccountSettings.organization
  // Wave 2: station profile + (for partner) My Station radial from survey history,
  // in parallel now that organization identity is known.
  const needsPartnerStationLoad = role === 'partner'
  const [stationProfile, partnerSurveyHistory] = await Promise.all([
    loadPartnerStationProfile(stationOrganizationName, {
      fullName: nextAccountSettings.fullName,
      email: nextAccountSettings.email
    }),
    needsPartnerStationLoad
      ? loadPartnerServiceCapacitySurveyHistory(stationOrganizationName)
      : Promise.resolve([])
  ])
  const completedPartnerSurveyHistory = needsPartnerStationLoad
    ? selectCompletedPartnerSurveysNewestFirst(partnerSurveyHistory)
    : []
  const latestCompletedPartnerSurvey = completedPartnerSurveyHistory[0] || null
  const partnerStationSpecialties = needsPartnerStationLoad
    ? derivePartnerStationSpecialtyGroups(latestCompletedPartnerSurvey)
    : []
  const partnerViewLoadBreakdown = needsPartnerStationLoad
    ? buildPartnerBurdenBreakdownFromHistory(completedPartnerSurveyHistory, {
        subjectId: latestCompletedPartnerSurvey?.partnerId || nextAccountSettings.organization,
        subjectLabel: latestCompletedPartnerSurvey?.header.organizationName || nextAccountSettings.organization
      })
    : null
  const partnerViewLoad = partnerViewLoadBreakdown ? toNormalizedRadialDomainLoad(partnerViewLoadBreakdown) : null
  return {
    enrollees: data.enrollees || [],
    loads: data.loads || [],
    loadBreakdownsByEnrolleeId: data.loadBreakdownsByEnrolleeId || {},
    roleConfigs: data.roleConfigs || [],
    timelineConfig: data.timelineConfig,
    timelineConfigsByEnrolleeId: data.timelineConfigsByEnrolleeId || {},
    logs: data.logs || [],
    enrollmentRequests: [],
    countyHeatmap: [],
    adminMetrics: [],
    partnerLoad: partnerViewLoad,
    partnerLoadBreakdown: partnerViewLoadBreakdown,
    partnerStationSpecialties,
    accountSettings: nextAccountSettings,
    partnerStationProfile: stationProfile,
    intakeFormsByEnrolleeId: {},
    routeAssignmentsByEnrolleeId: {},
    navigatorCompetencyAssessments: [],
    selectedEnrolleeId: data.enrollees?.[0]?.id || ''
  }
}

function mergeWeightedSurveyBreakdowns(
  loads: DomainLoad[],
  loadBreakdownsByEnrolleeId: Record<string, DomainLoadBreakdown>,
  weightedBreakdowns: DomainLoadBreakdown[]
) {
  const nextBreakdowns = { ...loadBreakdownsByEnrolleeId }
  const loadMap = new Map(loads.map((load) => [load.enrolleeId, load]))

  weightedBreakdowns.forEach((breakdown) => {
    nextBreakdowns[breakdown.subjectId] = breakdown
    const normalized = toNormalizedRadialDomainLoad(breakdown)
    if (normalized) {
      loadMap.set(normalized.enrolleeId, normalized)
    }
  })

  return {
    loads: Array.from(loadMap.values()),
    loadBreakdownsByEnrolleeId: nextBreakdowns
  }
}

async function loadBootstrapPayload(role: AtlasRole, forceRefresh = false): Promise<SinglePaneBootstrapPayload> {
  if (!forceRefresh) {
    const cached = bootstrapPayloadCache.get(role)
    if (cached) return cached
    const existingRequest = bootstrapPayloadInFlight.get(role)
    if (existingRequest) return existingRequest
  }

  const request = (async () => {
    // Bootstrap aggregates role-scoped domain data, then this hook enriches it
    // with ancillary records used by secondary panels and workflows.
    // Issue the primary bootstrap payload, every companion dataset, and (for navigators)
    // the partner-station linkage in a single concurrent batch. None of these depend on
    // one another, so collapsing them from sequential awaits into one Promise.all removes
    // several serial round-trips and is the dominant lever on first-login latency.
    const [
      data,
      requests,
      heatmap,
      quality,
      nextAccountSettings,
      savedIntakes,
      savedRouteAssignments,
      savedNavigatorAssessments,
      legacyPartnerViewLoadBreakdown,
      latestEnrolleeSurveySubmissions,
      navigatorStationContext
    ] = await Promise.all([
      loadSinglePaneBootstrap(role),
      loadEnrollmentRequests(role),
      loadCountyHeatmap(),
      loadAdminDataQuality(),
      loadAccountSettings(),
      loadEnrolleeIntakes(),
      loadRouteAssignments(),
      loadNavigatorCompetencyAssessments(),
      loadPartnerRadialLoadBreakdown(),
      loadLatestEnrolleeBurdenSurveySubmissions(),
      // Navigator station resolves from explicit navigator->partner linkage; other roles
      // resolve their station from the account organization below, so skip the call entirely.
      role === 'navigator' ? loadNavigatorStationContext() : Promise.resolve(null)
    ])

    const weightedEnrolleeBreakdowns = latestEnrolleeSurveySubmissions.map((record) =>
      buildSurveyDomainLoadBreakdown({
        subjectId: record.header.enrolleeId,
        subjectLabel: record.header.enrolleeName,
        sourceKind: 'enrolleeSurvey',
        sourceLabel: `${record.header.respondentRole} burden survey`,
        answers: record.answers
      })
    )
    const mergedEnrolleeLoadState = mergeWeightedSurveyBreakdowns(
      data.loads || [],
      data.loadBreakdownsByEnrolleeId || {},
      weightedEnrolleeBreakdowns
    )

    // Navigator station data resolves from explicit navigator->partner linkage (fetched above),
    // while partner users resolve from their account organization.
    const stationOrganizationName =
      (role === 'navigator' ? navigatorStationContext?.organizationName : nextAccountSettings.organization)?.trim() ||
      nextAccountSettings.organization
    // Survey history and station profile depend only on the resolved organization (not on each
    // other), so resolve them together rather than back-to-back.
    const [partnerSurveyHistory, stationProfile] = await Promise.all([
      loadPartnerServiceCapacitySurveyHistory(stationOrganizationName),
      loadPartnerStationProfile(stationOrganizationName, {
        fullName: nextAccountSettings.fullName,
        email: nextAccountSettings.email
      })
    ])
    const completedPartnerSurveyHistory = selectCompletedPartnerSurveysNewestFirst(partnerSurveyHistory)
    const latestCompletedPartnerSurvey = completedPartnerSurveyHistory[0] || null
    const partnerStationSpecialties = derivePartnerStationSpecialtyGroups(latestCompletedPartnerSurvey)
    const partnerViewLoadBreakdown =
      buildPartnerBurdenBreakdownFromHistory(completedPartnerSurveyHistory, {
        subjectId: latestCompletedPartnerSurvey?.partnerId || nextAccountSettings.organization,
        subjectLabel: latestCompletedPartnerSurvey?.header.organizationName || nextAccountSettings.organization
      }) || legacyPartnerViewLoadBreakdown
    const partnerViewLoad = toNormalizedRadialDomainLoad(partnerViewLoadBreakdown)

    const payload: SinglePaneBootstrapPayload = {
      enrollees: data.enrollees || [],
      loads: mergedEnrolleeLoadState.loads,
      loadBreakdownsByEnrolleeId: mergedEnrolleeLoadState.loadBreakdownsByEnrolleeId,
      roleConfigs: data.roleConfigs || [],
      timelineConfig: data.timelineConfig,
      timelineConfigsByEnrolleeId: data.timelineConfigsByEnrolleeId || {},
      logs: data.logs || [],
      enrollmentRequests: requests,
      countyHeatmap: heatmap,
      adminMetrics: quality,
      partnerLoad: partnerViewLoad,
      partnerLoadBreakdown: partnerViewLoadBreakdown,
      partnerStationSpecialties,
      accountSettings: nextAccountSettings,
      partnerStationProfile: stationProfile,
      intakeFormsByEnrolleeId: savedIntakes,
      routeAssignmentsByEnrolleeId: savedRouteAssignments,
      navigatorCompetencyAssessments: savedNavigatorAssessments,
      selectedEnrolleeId: data.enrollees?.[0]?.id || ''
    }
    bootstrapPayloadCache.set(role, payload)
    return payload
  })().finally(() => {
    bootstrapPayloadInFlight.delete(role)
  })

  bootstrapPayloadInFlight.set(role, request)
  return request
}

export function useSinglePaneBootstrapState(role: AtlasRole) {
  const [reloadNonce, setReloadNonce] = useState(0)
  const [state, setState] = useState<SinglePaneBootstrapState>({
    isLoading: true,
    error: null,
    enrollees: [],
    loads: [],
    loadBreakdownsByEnrolleeId: {},
    roleConfigs: [],
    timelineConfig: null,
    timelineConfigsByEnrolleeId: {},
    logs: [],
    enrollmentRequests: [],
    countyHeatmap: [],
    adminMetrics: [],
    partnerLoad: null,
    partnerLoadBreakdown: null,
    partnerStationSpecialties: [],
    accountSettings: DEFAULT_ACCOUNT_SETTINGS,
    partnerStationProfile: null,
    intakeFormsByEnrolleeId: {},
    routeAssignmentsByEnrolleeId: {},
    navigatorCompetencyAssessments: [],
    selectedEnrolleeId: ''
  })

  useEffect(() => {
    let isMounted = true

    async function bootstrap() {
      let paintedFromMemory = false
      try {
        workspaceLoadMetrics.markBootstrapStart(role)
        const userId = await readRememberedUserId()
        const remembered = userId ? readRemembered<RememberedWorkspace>(userId, workspaceMemoryKey(role)) : null
        const cachedPayload = bootstrapPayloadCache.get(role) || remembered?.payload || null
        if (remembered) freshnessByRole.set(role, remembered.freshness)
        if (cachedPayload) {
          paintedFromMemory = true
          bootstrapPayloadCache.set(role, cachedPayload)
          if (isMounted) {
            setState((current) => ({
              ...current,
              ...cachedPayload,
              isLoading: false,
              error: null
            }))
          }
        }

        const freshness = await readWorkspaceFreshness()
        const previousFreshness = freshnessByRole.get(role) || null
        if (cachedPayload && freshnessMatches(previousFreshness, freshness)) {
          workspaceLoadMetrics.markBootstrapEnd(role)
          return
        }

        if (cachedPayload && previousFreshness && unchangedExceptEnrollments(previousFreshness, freshness)) {
          try {
            const patched = await patchRememberedEnrollments(cachedPayload, previousFreshness, freshness)
            if (patched) {
              rememberWorkspace(userId, role, patched, freshness)
              if (!isMounted) return
              setState((current) => ({
                ...current,
                ...patched,
                isLoading: false,
                error: null
              }))
              workspaceLoadMetrics.markBootstrapEnd(role)
              return
            }
          } catch (error) {
            if (isSupabasePermissionError(error)) throw error
            // A failed slice read falls through to the full workspace load.
          }
        }

        if (!paintedFromMemory && isMounted) {
          setState((current) => ({ ...current, isLoading: true, error: null }))
        }
        if (!paintedFromMemory) {
          const criticalPayload = await loadCriticalBootstrapPayload(role)
          if (!isMounted) return
          setState((current) => ({
            ...current,
            ...criticalPayload,
            isLoading: false,
            error: null
          }))
          workspaceLoadMetrics.markBootstrapEnd(role)
        }
        const payload = await loadBootstrapPayload(role, true)
        if (!isMounted) return
        const freshnessAfterLoad = freshness.reliable ? freshness : await readWorkspaceFreshness()
        rememberWorkspace(userId, role, payload, freshnessAfterLoad)
        setState((current) => ({
          ...current,
          ...payload,
          isLoading: false,
          error: null
        }))
        if (paintedFromMemory) workspaceLoadMetrics.markBootstrapEnd(role)
      } catch (error) {
        // Fail loudly: a bootstrap failure (especially a grant/RLS denial) must not
        // masquerade as a healthy-but-empty workspace. A remembered screen stays up
        // on a network miss; a permission denial still clears it.
        console.error('Failed to bootstrap single pane state.', error)
        if (!isMounted) return
        if (paintedFromMemory && !isSupabasePermissionError(error)) {
          setState((current) => ({ ...current, isLoading: false }))
          workspaceLoadMetrics.markBootstrapEnd(role)
          return
        }
        setState((current) => ({
          ...current,
          isLoading: false,
          error: toBootstrapErrorMessage(role, error),
          enrollees: [],
          loads: [],
          loadBreakdownsByEnrolleeId: {},
          enrollmentRequests: [],
          selectedEnrolleeId: ''
        }))
        workspaceLoadMetrics.markBootstrapEnd(role)
      }
    }

    bootstrap()

    const roleHydrateTimeout =
      typeof window === 'undefined'
        ? null
        : window.setTimeout(() => {
            void (async () => {
              const userId = await readRememberedUserId()
              if (!userId) return
              for (const candidateRole of ROLE_PREFETCH_ORDER) {
                if (candidateRole === role || bootstrapPayloadCache.has(candidateRole)) continue
                const stored = readRemembered<RememberedWorkspace>(userId, workspaceMemoryKey(candidateRole))
                if (!stored) continue
                bootstrapPayloadCache.set(candidateRole, stored.payload)
                freshnessByRole.set(candidateRole, stored.freshness)
              }
            })()
          }, 0)

    return () => {
      isMounted = false
      if (roleHydrateTimeout !== null) {
        window.clearTimeout(roleHydrateTimeout)
      }
    }
  }, [role, reloadNonce])

  return {
    state,
    setState,
    reload: () => setReloadNonce((current) => current + 1)
  }
}
