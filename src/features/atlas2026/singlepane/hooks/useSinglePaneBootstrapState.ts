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
  PartnerStationProfile,
  RoleMenuConfig,
  RouteAssignmentRecord,
  RouteLogEvent,
  TimelineConfig,
} from '@/features/atlas2026/singlepane/types'
import {
  loadAdminDataQuality,
  loadAccountSettings,
  loadCountyHeatmap,
  loadEnrolleeIntakes,
  loadEnrollmentRequests,
  loadNavigatorCompetencyAssessments,
  loadPartnerRadialLoadBreakdown,
  loadPartnerStationProfile,
  loadRouteAssignments,
  loadSinglePaneBootstrap
} from '@/features/atlas2026/singlepane/data-access/singlepaneRepository'
import { toNormalizedRadialDomainLoad } from '@/features/atlas2026/singlepane/data-access/domainLoadMapping'

/**
 * Bootstraps role-scoped single-pane state.
 *
 * Purpose:
 * - coordinates primary bootstrap payload with auxiliary datasets.
 * - exposes one cohesive state object for screen-level consumers.
 */

export interface SinglePaneBootstrapState {
  isLoading: boolean
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
  accountSettings: AccountSettings
  partnerStationProfile: PartnerStationProfile | null
  intakeFormsByEnrolleeId: Record<string, EnrolleeIntakeRecord>
  routeAssignmentsByEnrolleeId: Record<string, RouteAssignmentRecord>
  navigatorCompetencyAssessments: NavigatorCompetencyAssessmentRecord[]
  selectedEnrolleeId: string
}

type SinglePaneBootstrapPayload = Omit<SinglePaneBootstrapState, 'isLoading'>

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
    const data = await loadSinglePaneBootstrap(role)
    // Fetch companion datasets in parallel so first paint includes all side panels
    // without triggering sequential spinner churn.
    const [
      requests,
      heatmap,
      quality,
      partnerViewLoadBreakdown,
      nextAccountSettings,
      savedIntakes,
      savedRouteAssignments,
      savedNavigatorAssessments
    ] = await Promise.all([
      loadEnrollmentRequests(role),
      loadCountyHeatmap(),
      loadAdminDataQuality(),
      loadPartnerRadialLoadBreakdown(),
      loadAccountSettings(),
      loadEnrolleeIntakes(),
      loadRouteAssignments(),
      loadNavigatorCompetencyAssessments()
    ])

    const partnerViewLoad = toNormalizedRadialDomainLoad(partnerViewLoadBreakdown)
    const stationProfile = await loadPartnerStationProfile(nextAccountSettings.organization, {
      fullName: nextAccountSettings.fullName,
      email: nextAccountSettings.email
    })

    const payload: SinglePaneBootstrapPayload = {
      enrollees: data.enrollees || [],
      loads: data.loads || [],
      loadBreakdownsByEnrolleeId: data.loadBreakdownsByEnrolleeId || {},
      roleConfigs: data.roleConfigs || [],
      timelineConfig: data.timelineConfig,
      timelineConfigsByEnrolleeId: data.timelineConfigsByEnrolleeId || {},
      logs: data.logs || [],
      enrollmentRequests: requests,
      countyHeatmap: heatmap,
      adminMetrics: quality,
      partnerLoad: partnerViewLoad,
      partnerLoadBreakdown: partnerViewLoadBreakdown,
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
      try {
        const cachedPayload = bootstrapPayloadCache.get(role)
        if (cachedPayload) {
          // Cached role payload keeps role switches responsive while a background
          // refresh silently syncs with remote updates.
          if (isMounted) {
            setState((current) => ({
              ...current,
              ...cachedPayload,
              isLoading: false
            }))
          }
          const refreshedPayload = await loadBootstrapPayload(role, true)
          if (!isMounted) return
          setState((current) => ({
            ...current,
            ...refreshedPayload,
            isLoading: false
          }))
          return
        }

        if (isMounted) {
          setState((current) => ({ ...current, isLoading: true }))
        }
        const payload = await loadBootstrapPayload(role)
        if (!isMounted) return
        setState((current) => ({
          ...current,
          ...payload,
          isLoading: false
        }))
      } catch (error) {
        console.warn('Failed to bootstrap single pane state.', error)
        if (!isMounted) return
        // Preserve existing state on failure so previously hydrated data remains usable.
        setState((current) => ({
          ...current,
          isLoading: false
        }))
      }
    }

    bootstrap()

    const rolePrefetchTimeout =
      typeof window === 'undefined'
        ? null
        : window.setTimeout(() => {
            for (const candidateRole of ROLE_PREFETCH_ORDER) {
              if (candidateRole === role) continue
              // Fire-and-forget prefetch for alternate role shells so switching role
              // reuses warmed payloads instead of replaying full bootstrap waits.
              void loadBootstrapPayload(candidateRole).catch(() => null)
            }
          }, 280)

    return () => {
      isMounted = false
      if (rolePrefetchTimeout !== null) {
        window.clearTimeout(rolePrefetchTimeout)
      }
    }
  }, [role, reloadNonce])

  return {
    state,
    setState,
    reload: () => setReloadNonce((current) => current + 1)
  }
}
