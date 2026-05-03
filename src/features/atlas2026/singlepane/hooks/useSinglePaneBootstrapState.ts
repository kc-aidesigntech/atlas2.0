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

const DEFAULT_ACCOUNT_SETTINGS: AccountSettings = {
  fullName: 'atlas operator',
  email: 'operator@atlas.local',
  organization: 'atlas operations',
  enabledRoles: ['administrator', 'supervisor', 'partner', 'navigator']
}

function derivePartnerRadialLoad(breakdown: DomainLoadBreakdown | null): DomainLoad | null {
  if (!breakdown) return null
  // Normalize to percentages so radial chart scale remains stable even when
  // source totals vary significantly across organizations.
  const maxTotal = Math.max(breakdown.habitatTotal, breakdown.workTotal, breakdown.socialNetworksTotal, 1)
  return {
    enrolleeId: breakdown.subjectId,
    habitat: Math.round((breakdown.habitatTotal / maxTotal) * 100),
    work: Math.round((breakdown.workTotal / maxTotal) * 100),
    socialNetworks: Math.round((breakdown.socialNetworksTotal / maxTotal) * 100)
  }
}

export function useSinglePaneBootstrapState(role: AtlasRole) {
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
        if (isMounted) {
          setState((current) => ({ ...current, isLoading: true }))
        }

        // Bootstrap aggregates role-scoped domain data, then this hook enriches it
        // with ancillary records used by secondary panels and workflows.
        const data = await loadSinglePaneBootstrap(role)
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

        if (!isMounted) return

        const partnerViewLoad = derivePartnerRadialLoad(partnerViewLoadBreakdown)
        const stationProfile = await loadPartnerStationProfile(nextAccountSettings.organization, {
          fullName: nextAccountSettings.fullName,
          email: nextAccountSettings.email
        })
        if (!isMounted) return

        setState((current) => ({
          ...current,
          isLoading: false,
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
    return () => {
      isMounted = false
    }
  }, [role])

  return {
    state,
    setState
  }
}
